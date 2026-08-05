import "./env"; // 必须第一行：先加载 .env.local，再让下面的模块读 process.env
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchLiveDailyRows, fetchLiveData } from "./starrocks";
import { dataModelForPlatform } from "./data-model";
import { adGroups, campaigns, channelGroups, channels, statuses } from "./filters";
import { compactDate, parseRevenueMode, parseSourceMode } from "./shared";
import {
  buildKeywordRoiSql,
  buildSourceTableAuditSql
} from "./sql-generator";
import { computeSummary } from "./summary";
import {
  parseDataPlatform,
  platformSourceNote,
  resolvePlatformSource,
  XHS_WORLD_CUP_RANGE
} from "./platform";
import type {
  DailyCampaignRow,
  DailyKeywordRow,
  DataPlatform,
  DashboardResponse,
  KeywordRow
} from "./types";
import {
  buildDashboardServerCacheKey,
  readDashboardServerCache,
  writeDashboardServerCache
} from "./dashboard-cache";

const app = express();
const port = Number(process.env.API_PORT ?? 4173);
const sourceMode = parseSourceMode(process.env.ASA_DATA_MODE);
const SUPPORTED_PLATFORM_MESSAGE = "platform 仅支持 iOS、HarmonyOS 或 Xiaohongshu";
const basePath = (() => {
  try {
    return new URL(process.env.ASA_BASE_URL ?? "http://127.0.0.1:4173").pathname.replace(
      /\/+$/,
      ""
    );
  } catch {
    return "";
  }
})();

app.use(express.json());

// 公开探活，不需要登录
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// ASA 后台接入数据主站后不再自带飞书登录，身份校验由上游主站负责。
app.get("/api/me", (_req, res) => {
  res.json({ authEnabled: false, user: null });
});

app.get("/api/asa/data-model", (req, res) => {
  const platform = parseDataPlatform(req.query.platform);
  if (!platform) {
    res.status(400).json({ error: SUPPORTED_PLATFORM_MESSAGE });
    return;
  }
  const source = resolvePlatformSource(platform);
  res.json(dataModelForPlatform(platform, source.table));
});

app.get("/api/asa/keyword-roi/sql", (req, res) => {
  const platform = parseDataPlatform(req.query.platform);
  if (!platform) {
    res.status(400).json({ error: SUPPORTED_PLATFORM_MESSAGE });
    return;
  }
  const defaults = defaultRangeForPlatform(platform);
  const startDate = compactDate(req.query.startDate, defaults.startDate);
  const endDate = compactDate(req.query.endDate, defaults.endDate);
  const revenueMode = parseRevenueMode(req.query.revenueMode);
  const source = resolvePlatformSource(platform);
  const model = dataModelForPlatform(platform, source.table);
  const sqlParams = {
    startDate,
    endDate,
    keyword: String(req.query.keyword ?? "").trim(),
    campaignId: String(req.query.campaignId ?? ""),
    adGroupId: String(req.query.adGroupId ?? ""),
    revenueMode
  };

  res.json({
    generatedAt: new Date().toISOString(),
    platform,
    table: source.table,
    engine: "Hive/Spark SQL",
    modelVersion: model.version,
    revenueMode,
    unresolvedItems: model.unresolvedItems,
    sql:
      platform === "iOS"
        ? buildKeywordRoiSql(sqlParams)
        : buildSourceTableAuditSql({
            ...sqlParams,
            platform,
            table: source.table
          })
  });
});

app.get("/api/asa/keyword-roi", async (req, res) => {
  const platform = parseDataPlatform(req.query.platform);
  if (!platform) {
    res.status(400).json({ error: SUPPORTED_PLATFORM_MESSAGE });
    return;
  }
  const source = resolvePlatformSource(platform);
  const model = dataModelForPlatform(platform, source.table);
  const keywordRaw = String(req.query.keyword ?? "").trim();
  const campaignId = String(req.query.campaignId ?? "");
  const adGroupId = String(req.query.adGroupId ?? "");
  const status = String(req.query.status ?? "");
  const defaults = defaultRangeForPlatform(platform);
  const startDate = compactDate(req.query.startDate, defaults.startDate);
  const endDate = compactDate(req.query.endDate, defaults.endDate);
  const revenueMode = parseRevenueMode(req.query.revenueMode);
  const forceRefresh =
    req.query.forceRefresh === "true" || req.query.forceRefresh === "1";
  const cacheOnly =
    req.query.cacheOnly === "true" || req.query.cacheOnly === "1";
  const sqlQuery = new URLSearchParams();
  Object.entries(req.query).forEach(([key, value]) => {
    if (
      key !== "forceRefresh" &&
      key !== "cacheOnly" &&
      typeof value === "string" &&
      value
    ) {
      sqlQuery.set(key, value);
    }
  });
  sqlQuery.set("platform", platform);
  const cacheKey = buildDashboardServerCacheKey({
    platform,
    startDate,
    endDate,
    keyword: keywordRaw,
    campaignId,
    adGroupId,
    status,
    revenueMode
  });

  if (sourceMode === "live" && !forceRefresh) {
    const cached = readDashboardServerCache(cacheKey, endDate);
    if (cached) {
      res.json(cached);
      return;
    }
    if (cacheOnly) {
      res.json({
        platform,
        updatedAt: new Date().toISOString(),
        dateRange: {
          start: String(req.query.startDate ?? dashedCompactDate(defaults.startDate)),
          end: String(req.query.endDate ?? dashedCompactDate(defaults.endDate))
        },
        dataAsOfDate: null,
        source: {
          mode: sourceMode,
          note: "当前查询条件暂无缓存，请点击刷新从数仓读取最新数据",
          table: source.table,
          modelVersion: model.version,
          revenueMode,
          sqlEndpoint: `/api/asa/keyword-roi/sql?${sqlQuery.toString()}`,
          unresolvedItems: model.unresolvedItems
        },
        dataModel: model,
        filters: {
          campaigns: [],
          adGroups,
          channels,
          channelGroups,
          statuses
        },
        summary: computeSummary([]),
        rows: [],
        dailySummaryRows: [],
        dailyRows: []
      });
      return;
    }
  }

  let filtered: KeywordRow[] = [];
  let filteredDailySummary: DailyCampaignRow[] = [];
  let filteredDaily: DailyKeywordRow[] = [];
  let filterCampaigns: Array<{ id: string; name: string }> = campaigns;
  let filterAdGroups: Array<{ id: string; name: string }> = adGroups;
  let sourceNote = "未配置真实数据源，当前不展示演示数据";
  let dataAsOfDate: string | null = null;

  if (sourceMode === "live") {
    try {
      const live = await fetchLiveData({
        platform,
        startDate,
        endDate,
        keyword: keywordRaw,
        campaignId,
        adGroupId,
        status,
        revenueMode
      });
      filtered = status
        ? live.rows.filter((row) => row.status === status)
        : live.rows;
      const keepKeys = new Set(filtered.map(keywordScopeKey));
      filteredDailySummary = live.dailySummaryRows;
      filteredDaily = status
        ? live.dailyRows.filter((row) => keepKeys.has(keywordScopeKey(row)))
        : live.dailyRows;
      filterCampaigns = [];
      filterAdGroups = live.adGroups;
      dataAsOfDate = live.dataAsOfDate;
      sourceNote = platformSourceNote(platform, filtered.length > 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      res.status(500).json({
        error: `${source.label} 数仓读取失败：${message}。请确认已开启飞连 VPN，且数据库账号对该表有查询权限。`
      });
      return;
    }
  }

  const normalizedSummary = computeSummary(filtered);

  const response: DashboardResponse = {
    platform,
    updatedAt:
      sourceMode === "live"
        ? new Date().toISOString()
        : new Date().toISOString(),
    dateRange: {
      start: String(req.query.startDate ?? dashedCompactDate(defaults.startDate)),
      end: String(req.query.endDate ?? dashedCompactDate(defaults.endDate))
    },
    dataAsOfDate,
    source: {
      mode: sourceMode,
      note: sourceNote,
      table: source.table,
      modelVersion: model.version,
      revenueMode,
      sqlEndpoint: `/api/asa/keyword-roi/sql?${sqlQuery.toString()}`,
      unresolvedItems: model.unresolvedItems
    },
    dataModel: model,
    filters: {
      campaigns: filterCampaigns,
      adGroups: filterAdGroups,
      channels,
      channelGroups,
      statuses
    },
    summary: normalizedSummary,
    rows: filtered,
    dailySummaryRows: filteredDailySummary,
    dailyRows: filteredDaily
  };

  res.json(
    sourceMode === "live"
      ? writeDashboardServerCache(
          cacheKey,
          endDate,
          response,
          forceRefresh ? "refresh" : "miss"
        )
      : response
  );
});

app.get("/api/asa/keyword-roi/daily", async (req, res) => {
  const platform = parseDataPlatform(req.query.platform);
  if (!platform) {
    res.status(400).json({ error: SUPPORTED_PLATFORM_MESSAGE });
    return;
  }
  const source = resolvePlatformSource(platform);
  if (sourceMode !== "live") {
    res.json({ platform, dailyRows: [] });
    return;
  }

  const defaults = defaultRangeForPlatform(platform);
  const startDate = compactDate(req.query.startDate, defaults.startDate);
  const endDate = compactDate(req.query.endDate, defaults.endDate);
  const revenueMode = parseRevenueMode(req.query.revenueMode);

  try {
    const dailyRows = await fetchLiveDailyRows({
      platform,
      startDate,
      endDate,
      keyword: String(req.query.keyword ?? "").trim(),
      keywordId: String(req.query.keywordId ?? ""),
      campaignId: String(req.query.campaignId ?? ""),
      adGroupId: String(req.query.adGroupId ?? ""),
      revenueMode
    });
    res.json({ platform, dailyRows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    res.status(500).json({
      error: `${source.label} 数仓读取失败：${message}。请确认已开启飞连 VPN，且数据库账号对该表有查询权限。`
    });
  }
});

function keywordScopeKey(row: Pick<KeywordRow, "campaignId" | "adGroupId" | "keywordId">) {
  return `${row.campaignId}\u0000${row.adGroupId}\u0000${row.keywordId}`;
}

function beijingCompactDate(dayOffset = 0) {
  const ms = Date.now() + (8 * 60 + dayOffset * 24 * 60) * 60 * 1000;
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function dashedCompactDate(compact: string) {
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

function defaultRangeForPlatform(platform: DataPlatform) {
  return platform === "Xiaohongshu"
    ? XHS_WORLD_CUP_RANGE
    : { startDate: "20260525", endDate: "20260624" };
}

async function prewarmPlatformDashboardCache(platform: DataPlatform) {
  if (sourceMode !== "live") return;

  const startDate =
    platform === "Xiaohongshu"
      ? XHS_WORLD_CUP_RANGE.startDate
      : beijingCompactDate(-6);
  const endDate =
    platform === "Xiaohongshu" ? XHS_WORLD_CUP_RANGE.endDate : beijingCompactDate(0);
  const revenueMode = parseRevenueMode("all");
  const source = resolvePlatformSource(platform);
  const model = dataModelForPlatform(platform, source.table);
  const cacheKey = buildDashboardServerCacheKey({
    platform,
    startDate,
    endDate,
    keyword: "",
    campaignId: "",
    adGroupId: "",
    status: "",
    revenueMode
  });
  const existing = readDashboardServerCache(cacheKey, endDate);
  if (existing) return;

  try {
    const startedAt = Date.now();
    const live = await fetchLiveData({
      platform,
      startDate,
      endDate,
      keyword: "",
      campaignId: "",
      adGroupId: "",
      status: "",
      revenueMode
    });
    const sqlQuery = new URLSearchParams({
      platform,
      startDate: `${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6, 8)}`,
      endDate: `${endDate.slice(0, 4)}-${endDate.slice(4, 6)}-${endDate.slice(6, 8)}`
    });
    const response: DashboardResponse = {
      platform,
      updatedAt: new Date().toISOString(),
      dateRange: {
        start: sqlQuery.get("startDate") ?? "",
        end: sqlQuery.get("endDate") ?? ""
      },
      dataAsOfDate: live.dataAsOfDate,
      source: {
        mode: sourceMode,
        note: platformSourceNote(platform, live.rows.length > 0),
        table: source.table,
        modelVersion: model.version,
        revenueMode,
        sqlEndpoint: `/api/asa/keyword-roi/sql?${sqlQuery.toString()}`,
        unresolvedItems: model.unresolvedItems
      },
      dataModel: model,
      filters: {
        campaigns: [],
        adGroups: live.adGroups,
        channels,
        channelGroups,
        statuses
      },
      summary: computeSummary(live.rows),
      rows: live.rows,
      dailySummaryRows: live.dailySummaryRows,
      dailyRows: []
    };
    writeDashboardServerCache(cacheKey, endDate, response, "miss");
    console.log(
      "%s dashboard cache prewarmed: %d rows in %ds",
      platform,
      live.rows.length,
      ((Date.now() - startedAt) / 1000).toFixed(1)
    );
  } catch (error) {
    console.warn(
      `${platform} dashboard cache prewarm failed:`,
      error instanceof Error ? error.message : error
    );
  }
}

// 生产部署：由本服务直接托管前端构建产物（dist/）。
const serveStatic = process.env.ASA_SERVE_STATIC === "true";
if (serveStatic) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const distDir = path.resolve(__dirname, "..", "dist");
  app.use(express.static(distDir));
  app.get(/^\/auth\/.*/, (_req, res) => {
    res.redirect(basePath || "/");
  });
  // SPA 兜底：非 /api 的请求都回 index.html，交给前端路由
  app.get(/^\/(?!api\/|auth\/).*/, (_req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

const host = process.env.ASA_HOST ?? "127.0.0.1";

// ASA 自身不再做登录；外网访问控制由承载它的数据主站统一处理。
if (host !== "127.0.0.1" && host !== "localhost") {
  console.warn(
    "提示：服务绑定在 %s，ASA 自身未启用登录；请确认上游数据主站已完成访问控制。",
    host
  );
}

app.listen(port, host, () => {
  console.log(
    `ASA ROI API listening on http://${host}:${port} (data mode: ${sourceMode}, auth: delegated)`
  );
  setTimeout(() => {
    void (async () => {
      for (const platform of [
        "iOS",
        "HarmonyOS",
        "Xiaohongshu"
      ] satisfies DataPlatform[]) {
        await prewarmPlatformDashboardCache(platform);
      }
    })();
  }, 1000);
});
