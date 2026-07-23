import type { DashboardResponse, DataPlatform } from "./types";
import type { RevenueMode } from "./shared";

type CacheStatus = NonNullable<DashboardResponse["source"]["cache"]>["status"];

type DashboardCacheKeyInput = {
  platform: DataPlatform;
  startDate: string;
  endDate: string;
  keyword: string;
  campaignId: string;
  adGroupId: string;
  status: string;
  revenueMode: RevenueMode;
};

type CacheItem = {
  key: string;
  cachedAt: number;
  expiresAt: number;
  data: DashboardResponse;
};

const dashboardCache = new Map<string, CacheItem>();
const MAX_CACHE_ITEMS = Number(process.env.ASA_DASHBOARD_CACHE_MAX_ITEMS ?? 48);
const HISTORICAL_TTL_MS =
  Number(process.env.ASA_DASHBOARD_CACHE_HISTORICAL_MINUTES ?? 720) * 60 * 1000;
// 查询只读缓存、刷新才查数仓。默认区间包含今天时也要能稳定复用预热缓存，
// 否则 10 分钟过期后用户每次进来都会看到“暂无缓存”。
const LIVE_TTL_MS =
  Number(process.env.ASA_DASHBOARD_CACHE_LIVE_MINUTES ?? 1440) * 60 * 1000;

function beijingTodayCompact() {
  const ms = Date.now() + 8 * 60 * 60 * 1000;
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function ttlForEndDate(endDate: string) {
  return endDate < beijingTodayCompact() ? HISTORICAL_TTL_MS : LIVE_TTL_MS;
}

function pruneCache() {
  const now = Date.now();
  Array.from(dashboardCache.entries()).forEach(([key, item]) => {
    if (item.expiresAt <= now) dashboardCache.delete(key);
  });

  const items = Array.from(dashboardCache.values()).sort(
    (left, right) => right.cachedAt - left.cachedAt
  );
  items.slice(MAX_CACHE_ITEMS).forEach((item) => dashboardCache.delete(item.key));
}

function cloneWithCacheMeta(
  data: DashboardResponse,
  status: CacheStatus,
  cachedAt: number,
  ttlMs: number
): DashboardResponse {
  return {
    ...data,
    source: {
      ...data.source,
      cache: {
        status,
        cachedAt: new Date(cachedAt).toISOString(),
        ttlSeconds: Math.round(ttlMs / 1000)
      }
    }
  };
}

export function buildDashboardServerCacheKey(input: DashboardCacheKeyInput) {
  return JSON.stringify({
    platform: input.platform,
    startDate: input.startDate,
    endDate: input.endDate,
    keyword: input.keyword,
    campaignId: input.campaignId,
    adGroupId: input.adGroupId,
    status: input.status,
    revenueMode: input.revenueMode
  });
}

export function readDashboardServerCache(key: string, endDate: string) {
  pruneCache();
  const item = dashboardCache.get(key);
  if (!item) return null;
  if (item.expiresAt <= Date.now()) {
    dashboardCache.delete(key);
    return null;
  }

  return cloneWithCacheMeta(item.data, "hit", item.cachedAt, ttlForEndDate(endDate));
}

export function writeDashboardServerCache(
  key: string,
  endDate: string,
  data: DashboardResponse,
  status: Extract<CacheStatus, "miss" | "refresh">
) {
  const cachedAt = Date.now();
  const ttlMs = ttlForEndDate(endDate);
  const response = cloneWithCacheMeta(data, status, cachedAt, ttlMs);
  dashboardCache.set(key, {
    key,
    cachedAt,
    expiresAt: cachedAt + ttlMs,
    data: response
  });
  pruneCache();
  return response;
}
