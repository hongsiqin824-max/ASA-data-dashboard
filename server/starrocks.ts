import mysql from "mysql2/promise";
import type {
  DailyCampaignRow,
  DailyKeywordRow,
  DataPlatform,
  KeywordRow
} from "./types";
import {
  buildPlatformSourceRelation,
  platformKeywordSearchColumn
} from "./platform-query-source";
import { round, type RevenueMode } from "./shared";

// StarRocks（MySQL 协议）连接池。账号/连接信息从环境变量读取（见 .env.local）。
let pool: mysql.Pool | null = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.ASA_DB_HOST ?? "172.21.0.148",
      port: Number(process.env.ASA_DB_PORT ?? 9030),
      user: process.env.ASA_DB_USER,
      password: process.env.ASA_DB_PASSWORD,
      connectionLimit: 4,
      // decimal 字段以数字返回，避免字符串
      decimalNumbers: true
    });
  }
  return pool;
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// 按总 ROI 阈值自动分层：>=100% 高 ROI / 30%~100% 中 ROI / <30% 低 ROI
function statusFromRoi(roi: number): KeywordRow["status"] {
  if (roi >= 1) return "scaling";
  if (roi >= 0.3) return "observe";
  return "pause";
}

function revenueByMode(pay: number, ad: number, mode: RevenueMode): number {
  if (mode === "ad") return ad;
  if (mode === "pay") return pay;
  return pay + ad;
}

function windowRoi(
  cost: number,
  totalRevenue: unknown,
  vipRevenue: unknown,
  rechargeRevenue: unknown,
  adRevenue: unknown,
  mode: RevenueMode
) {
  if (cost <= 0) return 0;
  const ad = num(adRevenue);
  const splitPay = num(vipRevenue) + num(rechargeRevenue);
  const fallbackPay = Math.max(0, num(totalRevenue) - ad);
  const pay = splitPay > 0 ? splitPay : fallbackPay;
  return round(revenueByMode(pay, ad, mode) / cost, 4);
}

export type LiveQueryParams = {
  platform: DataPlatform;
  startDate: string; // YYYYMMDD
  endDate: string; // YYYYMMDD
  keyword: string;
  keywordId?: string;
  campaignId: string;
  adGroupId: string;
  status?: string;
  revenueMode: RevenueMode;
};

// 组装可选过滤条件（参数化，防注入）。
function buildFilters(params: LiveQueryParams, alias = "") {
  const column = (name: string) => (alias ? `${alias}.${name}` : name);
  const clauses: string[] = [`${column("day")} BETWEEN ? AND ?`];
  const values: Array<string> = [params.startDate, params.endDate];
  if (params.keyword) {
    clauses.push(`${column(platformKeywordSearchColumn(params.platform))} LIKE ?`);
    values.push(`%${params.keyword}%`);
  }
  if (params.keywordId) {
    clauses.push(`${column("keyword_id")} = ?`);
    values.push(params.keywordId);
  }
  if (params.campaignId) {
    clauses.push(`${column("campaign_id")} = ?`);
    values.push(params.campaignId);
  }
  if (params.adGroupId) {
    clauses.push(`${column("ad_group_id")} = ?`);
    values.push(params.adGroupId);
  }
  return { where: clauses.join(" AND "), values };
}

function statusHavingClause(params: LiveQueryParams) {
  if (!params.status) return "";
  if (!["scaling", "observe", "pause", "new"].includes(params.status)) return "";
  if (params.status === "new") return "HAVING 1 = 0";

  const payExpr = `CASE
    WHEN SUM(revenue_vip_total) + SUM(revenue_charge_total) > 0
    THEN SUM(revenue_vip_total) + SUM(revenue_charge_total)
    ELSE GREATEST(SUM(revenue_total) - SUM(ad_revenue_total), 0)
  END`;
  const revenueExpr =
    params.revenueMode === "pay"
      ? payExpr
      : params.revenueMode === "ad"
        ? "SUM(ad_revenue_total)"
        : `(${payExpr} + SUM(ad_revenue_total))`;
  const roiExpr = `CASE WHEN SUM(spend) > 0 THEN ${revenueExpr} / SUM(spend) ELSE 0 END`;

  if (params.status === "scaling") return `HAVING ${roiExpr} >= 1`;
  if (params.status === "observe") {
    return `HAVING ${roiExpr} >= 0.3 AND ${roiExpr} < 1`;
  }
  return `HAVING ${roiExpr} < 0.3`;
}

function dashed(compact: string) {
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

function dbDay(value: unknown): string | null {
  const raw = String(value ?? "");
  if (/^\d{8}$/.test(raw)) return dashed(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return raw || null;
}

async function fetchSummaryRows(params: LiveQueryParams): Promise<KeywordRow[]> {
  const { where, values } = buildFilters(params);
  const table = buildPlatformSourceRelation(params.platform);
  const sql = `SELECT
      t.campaign_id,
      MAX(t.campaign_name) AS campaign_name,
      t.ad_group_id,
      MAX(t.ad_group_name) AS ad_group_name,
      t.keyword_id,
      MAX(t.keyword) AS keyword,
      SUM(t.impressions) AS impressions,
      SUM(t.taps) AS taps,
      SUM(t.tap_installs) AS tap_installs,
      SUM(t.tap_new_downloads) AS tap_new_downloads,
      SUM(t.tap_redownloads) AS tap_redownloads,
      SUM(t.total_installs) AS installs,
      SUM(t.total_new_downloads) AS total_new_downloads,
      SUM(t.total_redownloads) AS total_redownloads,
      SUM(t.new_user_cnt) AS new_user_cnt,
      SUM(t.new_register_cnt) AS new_register_cnt,
      SUM(t.spend) AS spend,
      SUM(t.pay_uv) AS pay_uv,
      SUM(t.revenue_total) AS revenue_total,
      SUM(t.revenue_vip_total) AS revenue_vip_total,
      SUM(t.revenue_charge_total) AS revenue_charge_total,
      SUM(t.ad_revenue_total) AS ad_revenue_total,
      SUM(t.revenue_1d) AS revenue_1d,
      SUM(t.revenue_2d) AS revenue_2d,
      SUM(t.revenue_3d) AS revenue_3d,
      SUM(t.revenue_4d) AS revenue_4d,
      SUM(t.revenue_5d) AS revenue_5d,
      SUM(t.revenue_6d) AS revenue_6d,
      SUM(t.revenue_7d) AS revenue_7d,
      SUM(t.revenue_15d) AS revenue_15d,
      SUM(t.revenue_30d) AS revenue_30d,
      SUM(t.revenue_vip_1d) AS revenue_vip_1d,
      SUM(t.revenue_vip_2d) AS revenue_vip_2d,
      SUM(t.revenue_vip_3d) AS revenue_vip_3d,
      SUM(t.revenue_vip_4d) AS revenue_vip_4d,
      SUM(t.revenue_vip_5d) AS revenue_vip_5d,
      SUM(t.revenue_vip_6d) AS revenue_vip_6d,
      SUM(t.revenue_vip_7d) AS revenue_vip_7d,
      SUM(t.revenue_vip_15d) AS revenue_vip_15d,
      SUM(t.revenue_vip_30d) AS revenue_vip_30d,
      SUM(t.revenue_charge_1d) AS revenue_charge_1d,
      SUM(t.revenue_charge_2d) AS revenue_charge_2d,
      SUM(t.revenue_charge_3d) AS revenue_charge_3d,
      SUM(t.revenue_charge_4d) AS revenue_charge_4d,
      SUM(t.revenue_charge_5d) AS revenue_charge_5d,
      SUM(t.revenue_charge_6d) AS revenue_charge_6d,
      SUM(t.revenue_charge_7d) AS revenue_charge_7d,
      SUM(t.revenue_charge_15d) AS revenue_charge_15d,
      SUM(t.revenue_charge_30d) AS revenue_charge_30d,
      SUM(t.ad_revenue_1d) AS ad_revenue_1d,
      SUM(t.ad_revenue_2d) AS ad_revenue_2d,
      SUM(t.ad_revenue_3d) AS ad_revenue_3d,
      SUM(t.ad_revenue_4d) AS ad_revenue_4d,
      SUM(t.ad_revenue_5d) AS ad_revenue_5d,
      SUM(t.ad_revenue_6d) AS ad_revenue_6d,
      SUM(t.ad_revenue_7d) AS ad_revenue_7d,
      SUM(t.ad_revenue_15d) AS ad_revenue_15d,
      SUM(t.ad_revenue_30d) AS ad_revenue_30d,
      MIN(CASE
        WHEN t.spend > 0 OR t.total_installs > 0 OR t.new_user_cnt > 0 OR t.new_register_cnt > 0
        THEN t.day
      END) AS first_active_day,
      MAX(CASE
        WHEN t.spend > 0 OR t.total_installs > 0 OR t.new_user_cnt > 0 OR t.new_register_cnt > 0
        THEN t.day
      END) AS last_active_day,
      COUNT(DISTINCT CASE
        WHEN t.spend > 0 OR t.total_installs > 0 OR t.new_user_cnt > 0 OR t.new_register_cnt > 0
        THEN t.day
      END) AS active_days
    FROM ${table} t
    WHERE ${where}
    GROUP BY t.campaign_id, t.ad_group_id, t.keyword_id
    ORDER BY spend DESC`;
  const [result] = await getPool().query(sql, values);
  const list = result as unknown as Record<string, unknown>[];
  const dateRange = `${dashed(params.startDate)}~${dashed(params.endDate)}`;
  return list.map((r) =>
    mapSummaryRow(r, dateRange, params.platform, params.revenueMode)
  );
}

function mapSummaryRow(
  r: Record<string, unknown>,
  dateRange: string,
  platform: DataPlatform,
  mode: RevenueMode
): KeywordRow {
  const impressions = num(r.impressions);
  const taps = num(r.taps);
  const installs = num(r.installs);
  const activations = num(r.new_user_cnt);
  const registrations = num(r.new_register_cnt);
  const payUv = num(r.pay_uv);
  const cost = round(num(r.spend), 4);

  // 收益拆分：vip+充值 = 付费(pay)，广告变现单列。
  const vipRevenue = round(num(r.revenue_vip_total), 4);
  const rechargeRevenue = round(num(r.revenue_charge_total), 4);
  const adRevenue = round(num(r.ad_revenue_total), 4);
  // 付费收入优先用拆分相加，回退到 revenue_total（建表口径=充值+会员）。
  const splitPay = round(vipRevenue + rechargeRevenue, 4);
  const payRevenue =
    splitPay > 0
      ? splitPay
      : round(Math.max(0, num(r.revenue_total) - adRevenue), 4);

  const totalRevenue = round(revenueByMode(payRevenue, adRevenue, mode), 4);
  const roi = cost > 0 ? round(totalRevenue / cost, 4) : 0;

  return {
    dateRange,
    firstDate: dbDay(r.first_active_day),
    lastDate: dbDay(r.last_active_day),
    activeDays: num(r.active_days),
    campaignId: String(r.campaign_id ?? ""),
    campaignName: String(r.campaign_name ?? ""),
    adGroupId: String(r.ad_group_id ?? ""),
    adGroupName: String(r.ad_group_name ?? ""),
    keywordId: String(r.keyword_id ?? ""),
    keyword: String(r.keyword ?? ""),
    matchType: "broad",
    platform,
    impressions,
    taps,
    ttr: impressions > 0 ? round(taps / impressions, 6) : 0,
    tapInstalls: num(r.tap_installs),
    tapNewDownloads: num(r.tap_new_downloads),
    tapRedownloads: num(r.tap_redownloads),
    installs,
    totalNewDownloads: num(r.total_new_downloads),
    totalRedownloads: num(r.total_redownloads),
    activations,
    registrations,
    cost,
    cpt: taps > 0 ? round(cost / taps) : 0,
    cpa: installs > 0 ? round(cost / installs) : 0,
    retentionD2: null,
    retentionD3: null,
    retentionD7: null,
    retentionD14: null,
    retentionD30: null,
    ltv: installs > 0 ? round(totalRevenue / installs, 2) : 0,
    ltvRate: registrations > 0 ? round(totalRevenue / registrations, 2) : 0,
    arpu: installs > 0 ? round(totalRevenue / installs, 2) : 0,
    arppu: payUv > 0 ? round(totalRevenue / payUv, 2) : 0,
    adImpressions: 0,
    avgAdImpressions: 0,
    adEcpm: 0,
    adFillRate: 0,
    totalPayUv: payUv,
    paymentRate: installs > 0 ? round(payUv / installs, 4) : 0,
    adRevenue,
    vipRevenue,
    rechargeRevenue,
    payRevenue,
    totalRevenue,
    roi,
    d1Roi: windowRoi(cost, r.revenue_1d, r.revenue_vip_1d, r.revenue_charge_1d, r.ad_revenue_1d, mode),
    d2Roi: windowRoi(cost, r.revenue_2d, r.revenue_vip_2d, r.revenue_charge_2d, r.ad_revenue_2d, mode),
    d3Roi: windowRoi(cost, r.revenue_3d, r.revenue_vip_3d, r.revenue_charge_3d, r.ad_revenue_3d, mode),
    d4Roi: windowRoi(cost, r.revenue_4d, r.revenue_vip_4d, r.revenue_charge_4d, r.ad_revenue_4d, mode),
    d5Roi: windowRoi(cost, r.revenue_5d, r.revenue_vip_5d, r.revenue_charge_5d, r.ad_revenue_5d, mode),
    d6Roi: windowRoi(cost, r.revenue_6d, r.revenue_vip_6d, r.revenue_charge_6d, r.ad_revenue_6d, mode),
    d7Roi: windowRoi(cost, r.revenue_7d, r.revenue_vip_7d, r.revenue_charge_7d, r.ad_revenue_7d, mode),
    d15Roi: windowRoi(cost, r.revenue_15d, r.revenue_vip_15d, r.revenue_charge_15d, r.ad_revenue_15d, mode),
    d30Roi: windowRoi(cost, r.revenue_30d, r.revenue_vip_30d, r.revenue_charge_30d, r.ad_revenue_30d, mode),
    status: statusFromRoi(roi)
  };
}

function keywordHistoryKey(
  row: Pick<KeywordRow, "campaignId" | "adGroupId" | "keywordId">
) {
  return `${row.campaignId}\u0000${row.adGroupId}\u0000${row.keywordId}`;
}

async function fetchKeywordHistory(params: LiveQueryParams) {
  const table = buildPlatformSourceRelation(params.platform);
  const clauses: string[] = [];
  const values: string[] = [];
  if (params.keyword) {
    clauses.push(`${platformKeywordSearchColumn(params.platform)} LIKE ?`);
    values.push(`%${params.keyword}%`);
  }
  if (params.campaignId) {
    clauses.push("campaign_id = ?");
    values.push(params.campaignId);
  }
  if (params.adGroupId) {
    clauses.push("ad_group_id = ?");
    values.push(params.adGroupId);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const sql = `SELECT
      campaign_id,
      ad_group_id,
      keyword_id,
      MIN(CASE
        WHEN spend > 0 OR total_installs > 0 OR new_user_cnt > 0 OR new_register_cnt > 0
        THEN day
      END) AS first_active_day,
      MAX(CASE
        WHEN spend > 0 OR total_installs > 0 OR new_user_cnt > 0 OR new_register_cnt > 0
        THEN day
      END) AS last_active_day
    FROM ${table} source_history
    ${where}
    GROUP BY campaign_id, ad_group_id, keyword_id`;
  const [result] = await getPool().query(sql, values);
  const list = result as unknown as Record<string, unknown>[];
  const history = new Map<string, Pick<KeywordRow, "firstDate" | "lastDate">>();
  list.forEach((row) => {
    const key = keywordHistoryKey({
      campaignId: String(row.campaign_id ?? ""),
      adGroupId: String(row.ad_group_id ?? ""),
      keywordId: String(row.keyword_id ?? "")
    });
    history.set(key, {
      firstDate: dbDay(row.first_active_day),
      lastDate: dbDay(row.last_active_day)
    });
  });
  return history;
}

async function fetchDailyRows(params: LiveQueryParams): Promise<DailyKeywordRow[]> {
  const { where, values } = buildFilters(params);
  const table = buildPlatformSourceRelation(params.platform);
  const sql = `SELECT
      day, campaign_id, campaign_name, ad_group_id, ad_group_name, keyword_id, keyword,
      impressions, taps, tap_installs, tap_new_downloads, tap_redownloads,
      total_installs, total_new_downloads, total_redownloads,
      new_user_cnt, new_register_cnt, spend, cost_per_activation, cost_per_register,
      pay_uv, pay_uv_1d, cost_per_pay,
      revenue_total, revenue_vip_total, revenue_charge_total, ad_revenue_total,
      revenue_1d, revenue_2d, revenue_3d, revenue_4d, revenue_5d, revenue_6d, revenue_7d,
      revenue_15d, revenue_30d,
      revenue_vip_1d, revenue_vip_2d, revenue_vip_3d, revenue_vip_4d, revenue_vip_5d, revenue_vip_6d, revenue_vip_7d,
      revenue_vip_15d, revenue_vip_30d,
      revenue_charge_1d, revenue_charge_2d, revenue_charge_3d, revenue_charge_4d, revenue_charge_5d, revenue_charge_6d, revenue_charge_7d,
      revenue_charge_15d, revenue_charge_30d,
      ad_revenue_1d, ad_revenue_2d, ad_revenue_3d, ad_revenue_4d, ad_revenue_5d, ad_revenue_6d, ad_revenue_7d,
      ad_revenue_15d, ad_revenue_30d
    FROM ${table} source_daily
    WHERE ${where}
    ORDER BY day DESC, spend DESC
    LIMIT 20000`;
  const [result] = await getPool().query(sql, values);
  const list = result as unknown as Record<string, unknown>[];
  return list.map((r) => mapDailyRow(r, params.platform, params.revenueMode));
}

async function fetchDailySummaryRows(
  params: LiveQueryParams
): Promise<DailyCampaignRow[]> {
  const { where, values } = buildFilters(params);
  const table = buildPlatformSourceRelation(params.platform);
  const statusHaving = statusHavingClause(params);
  if (statusHaving) {
    const dailyFilters = buildFilters(params, "t");
    const sql = `WITH keyword_scope AS (
        SELECT campaign_id, ad_group_id, keyword_id
        FROM ${table} source_scope
        WHERE ${where}
        GROUP BY campaign_id, ad_group_id, keyword_id
        ${statusHaving}
      )
      SELECT
        t.day,
        COUNT(DISTINCT CONCAT(
          COALESCE(CAST(t.campaign_id AS VARCHAR), ''),
          '|',
          COALESCE(CAST(t.ad_group_id AS VARCHAR), ''),
          '|',
          COALESCE(CAST(t.keyword_id AS VARCHAR), '')
        )) AS keyword_count,
        SUM(t.impressions) AS impressions,
        SUM(t.taps) AS taps,
        SUM(t.tap_installs) AS tap_installs,
        SUM(t.tap_new_downloads) AS tap_new_downloads,
        SUM(t.tap_redownloads) AS tap_redownloads,
        SUM(t.total_installs) AS installs,
        SUM(t.total_new_downloads) AS total_new_downloads,
        SUM(t.total_redownloads) AS total_redownloads,
        SUM(t.new_user_cnt) AS new_user_cnt,
        SUM(t.new_register_cnt) AS new_register_cnt,
        SUM(t.spend) AS spend,
        SUM(t.pay_uv) AS pay_uv,
        SUM(t.revenue_total) AS revenue_total,
        SUM(t.revenue_vip_total) AS revenue_vip_total,
        SUM(t.revenue_charge_total) AS revenue_charge_total,
        SUM(t.ad_revenue_total) AS ad_revenue_total,
        SUM(t.revenue_1d) AS revenue_1d,
        SUM(t.revenue_2d) AS revenue_2d,
        SUM(t.revenue_3d) AS revenue_3d,
        SUM(t.revenue_4d) AS revenue_4d,
        SUM(t.revenue_5d) AS revenue_5d,
        SUM(t.revenue_6d) AS revenue_6d,
        SUM(t.revenue_7d) AS revenue_7d,
        SUM(t.revenue_15d) AS revenue_15d,
        SUM(t.revenue_30d) AS revenue_30d,
        SUM(t.revenue_vip_1d) AS revenue_vip_1d,
        SUM(t.revenue_vip_2d) AS revenue_vip_2d,
        SUM(t.revenue_vip_3d) AS revenue_vip_3d,
        SUM(t.revenue_vip_4d) AS revenue_vip_4d,
        SUM(t.revenue_vip_5d) AS revenue_vip_5d,
        SUM(t.revenue_vip_6d) AS revenue_vip_6d,
        SUM(t.revenue_vip_7d) AS revenue_vip_7d,
        SUM(t.revenue_vip_15d) AS revenue_vip_15d,
        SUM(t.revenue_vip_30d) AS revenue_vip_30d,
        SUM(t.revenue_charge_1d) AS revenue_charge_1d,
        SUM(t.revenue_charge_2d) AS revenue_charge_2d,
        SUM(t.revenue_charge_3d) AS revenue_charge_3d,
        SUM(t.revenue_charge_4d) AS revenue_charge_4d,
        SUM(t.revenue_charge_5d) AS revenue_charge_5d,
        SUM(t.revenue_charge_6d) AS revenue_charge_6d,
        SUM(t.revenue_charge_7d) AS revenue_charge_7d,
        SUM(t.revenue_charge_15d) AS revenue_charge_15d,
        SUM(t.revenue_charge_30d) AS revenue_charge_30d,
        SUM(t.ad_revenue_1d) AS ad_revenue_1d,
        SUM(t.ad_revenue_2d) AS ad_revenue_2d,
        SUM(t.ad_revenue_3d) AS ad_revenue_3d,
        SUM(t.ad_revenue_4d) AS ad_revenue_4d,
        SUM(t.ad_revenue_5d) AS ad_revenue_5d,
        SUM(t.ad_revenue_6d) AS ad_revenue_6d,
        SUM(t.ad_revenue_7d) AS ad_revenue_7d,
        SUM(t.ad_revenue_15d) AS ad_revenue_15d,
        SUM(t.ad_revenue_30d) AS ad_revenue_30d
      FROM ${table} t
      JOIN keyword_scope s
        ON t.campaign_id = s.campaign_id
        AND t.ad_group_id = s.ad_group_id
        AND t.keyword_id = s.keyword_id
      WHERE ${dailyFilters.where}
      GROUP BY t.day
      ORDER BY t.day DESC`;
    const [result] = await getPool().query(sql, [
      ...values,
      ...dailyFilters.values
    ]);
    const list = result as unknown as Record<string, unknown>[];
    return list.map((r) => mapDailySummaryRow(r, params.revenueMode));
  }

  const sql = `SELECT
      day,
      COUNT(DISTINCT CONCAT(
        COALESCE(CAST(campaign_id AS VARCHAR), ''),
        '|',
        COALESCE(CAST(ad_group_id AS VARCHAR), ''),
        '|',
        COALESCE(CAST(keyword_id AS VARCHAR), '')
      )) AS keyword_count,
      SUM(impressions) AS impressions,
      SUM(taps) AS taps,
      SUM(tap_installs) AS tap_installs,
      SUM(tap_new_downloads) AS tap_new_downloads,
      SUM(tap_redownloads) AS tap_redownloads,
      SUM(total_installs) AS installs,
      SUM(total_new_downloads) AS total_new_downloads,
      SUM(total_redownloads) AS total_redownloads,
      SUM(new_user_cnt) AS new_user_cnt,
      SUM(new_register_cnt) AS new_register_cnt,
      SUM(spend) AS spend,
      SUM(pay_uv) AS pay_uv,
      SUM(revenue_total) AS revenue_total,
      SUM(revenue_vip_total) AS revenue_vip_total,
      SUM(revenue_charge_total) AS revenue_charge_total,
      SUM(ad_revenue_total) AS ad_revenue_total,
      SUM(revenue_1d) AS revenue_1d,
      SUM(revenue_2d) AS revenue_2d,
      SUM(revenue_3d) AS revenue_3d,
      SUM(revenue_4d) AS revenue_4d,
      SUM(revenue_5d) AS revenue_5d,
      SUM(revenue_6d) AS revenue_6d,
      SUM(revenue_7d) AS revenue_7d,
      SUM(revenue_15d) AS revenue_15d,
      SUM(revenue_30d) AS revenue_30d,
      SUM(revenue_vip_1d) AS revenue_vip_1d,
      SUM(revenue_vip_2d) AS revenue_vip_2d,
      SUM(revenue_vip_3d) AS revenue_vip_3d,
      SUM(revenue_vip_4d) AS revenue_vip_4d,
      SUM(revenue_vip_5d) AS revenue_vip_5d,
      SUM(revenue_vip_6d) AS revenue_vip_6d,
      SUM(revenue_vip_7d) AS revenue_vip_7d,
      SUM(revenue_vip_15d) AS revenue_vip_15d,
      SUM(revenue_vip_30d) AS revenue_vip_30d,
      SUM(revenue_charge_1d) AS revenue_charge_1d,
      SUM(revenue_charge_2d) AS revenue_charge_2d,
      SUM(revenue_charge_3d) AS revenue_charge_3d,
      SUM(revenue_charge_4d) AS revenue_charge_4d,
      SUM(revenue_charge_5d) AS revenue_charge_5d,
      SUM(revenue_charge_6d) AS revenue_charge_6d,
      SUM(revenue_charge_7d) AS revenue_charge_7d,
      SUM(revenue_charge_15d) AS revenue_charge_15d,
      SUM(revenue_charge_30d) AS revenue_charge_30d,
      SUM(ad_revenue_1d) AS ad_revenue_1d,
      SUM(ad_revenue_2d) AS ad_revenue_2d,
      SUM(ad_revenue_3d) AS ad_revenue_3d,
      SUM(ad_revenue_4d) AS ad_revenue_4d,
      SUM(ad_revenue_5d) AS ad_revenue_5d,
      SUM(ad_revenue_6d) AS ad_revenue_6d,
      SUM(ad_revenue_7d) AS ad_revenue_7d,
      SUM(ad_revenue_15d) AS ad_revenue_15d,
      SUM(ad_revenue_30d) AS ad_revenue_30d
    FROM ${table} source_daily_summary
    WHERE ${where}
    GROUP BY day
    ORDER BY day DESC`;
  const [result] = await getPool().query(sql, values);
  const list = result as unknown as Record<string, unknown>[];
  return list.map((r) => mapDailySummaryRow(r, params.revenueMode));
}

function mapDailySummaryRow(
  r: Record<string, unknown>,
  mode: RevenueMode
): DailyCampaignRow {
  const impressions = num(r.impressions);
  const taps = num(r.taps);
  const installs = num(r.installs);
  const payUv = num(r.pay_uv);
  const cost = round(num(r.spend), 4);

  const vipRevenue = round(num(r.revenue_vip_total), 4);
  const rechargeRevenue = round(num(r.revenue_charge_total), 4);
  const adRevenue = round(num(r.ad_revenue_total), 4);
  const splitPay = round(vipRevenue + rechargeRevenue, 4);
  const payRevenue =
    splitPay > 0
      ? splitPay
      : round(Math.max(0, num(r.revenue_total) - adRevenue), 4);
  const totalRevenue = round(revenueByMode(payRevenue, adRevenue, mode), 4);
  const roi = cost > 0 ? round(totalRevenue / cost, 4) : 0;

  return {
    date: String(r.day ?? ""),
    keywordCount: num(r.keyword_count),
    impressions,
    taps,
    ttr: impressions > 0 ? round(taps / impressions, 6) : 0,
    tapInstalls: num(r.tap_installs),
    tapNewDownloads: num(r.tap_new_downloads),
    tapRedownloads: num(r.tap_redownloads),
    installs,
    totalNewDownloads: num(r.total_new_downloads),
    totalRedownloads: num(r.total_redownloads),
    activations: num(r.new_user_cnt),
    registrations: num(r.new_register_cnt),
    cost,
    totalPayUv: payUv,
    paymentRate: installs > 0 ? round(payUv / installs, 4) : 0,
    adRevenue,
    vipRevenue,
    rechargeRevenue,
    payRevenue,
    totalRevenue,
    roi,
    d1Roi: windowRoi(cost, r.revenue_1d, r.revenue_vip_1d, r.revenue_charge_1d, r.ad_revenue_1d, mode),
    d2Roi: windowRoi(cost, r.revenue_2d, r.revenue_vip_2d, r.revenue_charge_2d, r.ad_revenue_2d, mode),
    d3Roi: windowRoi(cost, r.revenue_3d, r.revenue_vip_3d, r.revenue_charge_3d, r.ad_revenue_3d, mode),
    d4Roi: windowRoi(cost, r.revenue_4d, r.revenue_vip_4d, r.revenue_charge_4d, r.ad_revenue_4d, mode),
    d5Roi: windowRoi(cost, r.revenue_5d, r.revenue_vip_5d, r.revenue_charge_5d, r.ad_revenue_5d, mode),
    d6Roi: windowRoi(cost, r.revenue_6d, r.revenue_vip_6d, r.revenue_charge_6d, r.ad_revenue_6d, mode),
    d7Roi: windowRoi(cost, r.revenue_7d, r.revenue_vip_7d, r.revenue_charge_7d, r.ad_revenue_7d, mode),
    d15Roi: windowRoi(cost, r.revenue_15d, r.revenue_vip_15d, r.revenue_charge_15d, r.ad_revenue_15d, mode),
    d30Roi: windowRoi(cost, r.revenue_30d, r.revenue_vip_30d, r.revenue_charge_30d, r.ad_revenue_30d, mode)
  };
}

function mapDailyRow(
  r: Record<string, unknown>,
  platform: DataPlatform,
  mode: RevenueMode
): DailyKeywordRow {
  const impressions = num(r.impressions);
  const taps = num(r.taps);
  const installs = num(r.total_installs);
  const activations = num(r.new_user_cnt);
  const registrations = num(r.new_register_cnt);
  const payUv = num(r.pay_uv);
  const cost = round(num(r.spend), 4);
  const payCostRaw = r.cost_per_pay;

  // 收益拆分：vip+充值=付费，广告变现单列；付费总额回退到 revenue_total。
  const vipRevenue = round(num(r.revenue_vip_total), 4);
  const rechargeRevenue = round(num(r.revenue_charge_total), 4);
  const adRevenue = round(num(r.ad_revenue_total), 4);
  const splitPay = round(vipRevenue + rechargeRevenue, 4);
  const payRevenue =
    splitPay > 0
      ? splitPay
      : round(Math.max(0, num(r.revenue_total) - adRevenue), 4);
  const totalRevenue = round(revenueByMode(payRevenue, adRevenue, mode), 4);
  const roi = cost > 0 ? round(totalRevenue / cost, 4) : 0;

  return {
    platform,
    date: String(r.day ?? ""),
    campaignId: String(r.campaign_id ?? ""),
    campaignName: String(r.campaign_name ?? ""),
    adGroupId: String(r.ad_group_id ?? ""),
    adGroupName: String(r.ad_group_name ?? ""),
    keywordId: String(r.keyword_id ?? ""),
    keyword: String(r.keyword ?? ""),
    impressions,
    taps,
    ttr: impressions > 0 ? round(taps / impressions, 6) : 0,
    tapInstalls: num(r.tap_installs),
    tapNewDownloads: num(r.tap_new_downloads),
    tapRedownloads: num(r.tap_redownloads),
    installs,
    totalNewDownloads: num(r.total_new_downloads),
    totalRedownloads: num(r.total_redownloads),
    activations,
    registrations,
    cost,
    activationCost: round(num(r.cost_per_activation), 4),
    registrationCost: round(num(r.cost_per_register), 4),
    paymentRate: installs > 0 ? round(payUv / installs, 4) : 0,
    retentionD2: null,
    retentionD3: null,
    retentionD7: null,
    ltv: installs > 0 ? round(totalRevenue / installs, 2) : 0,
    ltvRate: registrations > 0 ? round(totalRevenue / registrations, 2) : 0,
    arpu: installs > 0 ? round(totalRevenue / installs, 2) : 0,
    arppu: payUv > 0 ? round(totalRevenue / payUv, 2) : 0,
    adImpressions: 0,
    avgAdImpressions: 0,
    adEcpm: 0,
    adFillRate: 0,
    totalPayUv: payUv,
    d1PayUv: num(r.pay_uv_1d),
    payCost: payCostRaw === null || payCostRaw === undefined ? null : round(num(payCostRaw), 4),
    adRevenue,
    vipRevenue,
    rechargeRevenue,
    payRevenue,
    totalRevenue,
    roi,
    d1Roi: windowRoi(cost, r.revenue_1d, r.revenue_vip_1d, r.revenue_charge_1d, r.ad_revenue_1d, mode),
    d2Roi: windowRoi(cost, r.revenue_2d, r.revenue_vip_2d, r.revenue_charge_2d, r.ad_revenue_2d, mode),
    d3Roi: windowRoi(cost, r.revenue_3d, r.revenue_vip_3d, r.revenue_charge_3d, r.ad_revenue_3d, mode),
    d4Roi: windowRoi(cost, r.revenue_4d, r.revenue_vip_4d, r.revenue_charge_4d, r.ad_revenue_4d, mode),
    d5Roi: windowRoi(cost, r.revenue_5d, r.revenue_vip_5d, r.revenue_charge_5d, r.ad_revenue_5d, mode),
    d6Roi: windowRoi(cost, r.revenue_6d, r.revenue_vip_6d, r.revenue_charge_6d, r.ad_revenue_6d, mode),
    d7Roi: windowRoi(cost, r.revenue_7d, r.revenue_vip_7d, r.revenue_charge_7d, r.ad_revenue_7d, mode),
    d15Roi: windowRoi(cost, r.revenue_15d, r.revenue_vip_15d, r.revenue_charge_15d, r.ad_revenue_15d, mode),
    d30Roi: windowRoi(cost, r.revenue_30d, r.revenue_vip_30d, r.revenue_charge_30d, r.ad_revenue_30d, mode)
  };
}

async function fetchAdGroups(params: LiveQueryParams) {
  const table = buildPlatformSourceRelation(params.platform);
  const sql = `SELECT DISTINCT ad_group_id, ad_group_name FROM ${table} source_groups
    WHERE day BETWEEN ? AND ? ORDER BY ad_group_name`;
  const [result] = await getPool().query(sql, [params.startDate, params.endDate]);
  const list = result as unknown as Record<string, unknown>[];
  return list
    .filter((r) => r.ad_group_id != null)
    .map((r) => ({
      id: String(r.ad_group_id),
      name: String(r.ad_group_name ?? r.ad_group_id)
    }));
}

async function fetchDataAsOfDate(params: LiveQueryParams) {
  const table = buildPlatformSourceRelation(params.platform);
  const [result] = await getPool().query(
    `SELECT MAX(day) AS data_as_of_date FROM ${table} source_max`
  );
  const row = (result as unknown as Record<string, unknown>[])[0];
  return dbDay(row?.data_as_of_date);
}

export async function fetchLiveData(params: LiveQueryParams) {
  const [summaryRows, dailySummaryRows, adGroups, dataAsOfDate, history] = await Promise.all([
    fetchSummaryRows(params),
    fetchDailySummaryRows(params),
    fetchAdGroups(params),
    fetchDataAsOfDate(params),
    fetchKeywordHistory(params)
  ]);
  const rows = summaryRows.map((row) => ({
    ...row,
    ...history.get(keywordHistoryKey(row))
  }));
  return {
    rows,
    dailySummaryRows,
    dailyRows: [] as DailyKeywordRow[],
    adGroups,
    dataAsOfDate
  };
}

export async function fetchLiveDailyRows(params: LiveQueryParams) {
  return fetchDailyRows(params);
}
