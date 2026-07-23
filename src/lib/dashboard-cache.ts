import type { QueryParams } from "./api";
import type { DashboardResponse } from "./types";

const CACHE_VERSION = 10;
const ITEM_PREFIX = `asa-roi-dashboard:v${CACHE_VERSION}:dashboard:`;
const INDEX_KEY = `asa-roi-dashboard:v${CACHE_VERSION}:index`;
const MAX_CACHE_ITEMS = 8;
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const HISTORICAL_CACHE_FRESH_MS = 12 * 60 * 60 * 1000;

type NormalizedQuery = Record<keyof QueryParams, string>;

type CachePayload = {
  version: typeof CACHE_VERSION;
  cachedAt: number;
  query: NormalizedQuery;
  data: DashboardResponse;
};

type CacheIndexItem = {
  key: string;
  cachedAt: number;
};

export type CachedDashboard = {
  key: string;
  cachedAt: number;
  data: DashboardResponse;
};

function normalizeQuery(query: QueryParams): NormalizedQuery {
  return {
    startDate: query.startDate,
    endDate: query.endDate,
    platform: query.platform,
    channel: query.channel,
    channelGroup: query.channelGroup,
    campaignId: query.campaignId,
    adGroupId: query.adGroupId,
    keyword: query.keyword,
    status: query.status,
    grain: query.grain,
    revenueMode: query.revenueMode
  };
}

export function buildDashboardCacheKey(query: QueryParams) {
  return `${ITEM_PREFIX}${encodeURIComponent(JSON.stringify(normalizeQuery(query)))}`;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function isCacheIndexItem(value: unknown): value is CacheIndexItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CacheIndexItem>;
  return typeof item.key === "string" && typeof item.cachedAt === "number";
}

function isDashboardResponse(value: unknown): value is DashboardResponse {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<DashboardResponse>;
  return (
    (data.platform === "iOS" || data.platform === "HarmonyOS") &&
    typeof data.updatedAt === "string" &&
    (typeof data.dataAsOfDate === "string" || data.dataAsOfDate === null) &&
    Array.isArray(data.rows) &&
    Array.isArray(data.dailySummaryRows) &&
    Array.isArray(data.dailyRows) &&
    typeof data.source === "object" &&
    typeof data.summary === "object"
  );
}

function isCachePayload(value: unknown): value is CachePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<CachePayload>;
  return (
    payload.version === CACHE_VERSION &&
    typeof payload.cachedAt === "number" &&
    typeof payload.query === "object" &&
    isDashboardResponse(payload.data)
  );
}

function isNoCachePlaceholder(data: DashboardResponse) {
  return data.source.note.includes("暂无缓存");
}

function readIndex(): CacheIndexItem[] {
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = parseJson(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCacheIndexItem);
  } catch {
    return [];
  }
}

function writeIndex(items: CacheIndexItem[]) {
  try {
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(items));
  } catch {
    // localStorage may be unavailable or full; cache is a best-effort layer.
  }
}

function removeCacheItem(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore cache cleanup failures.
  }
}

function pruneCache(keepKey?: string) {
  const now = Date.now();
  const freshItems = readIndex()
    .filter((item) => item.key === keepKey || now - item.cachedAt <= MAX_CACHE_AGE_MS)
    .sort((a, b) => b.cachedAt - a.cachedAt);
  const kept = freshItems.slice(0, MAX_CACHE_ITEMS);
  const keptKeys = new Set(kept.map((item) => item.key));

  freshItems.forEach((item) => {
    if (!keptKeys.has(item.key)) removeCacheItem(item.key);
  });

  writeIndex(kept);
}

export function readDashboardCache(query: QueryParams): CachedDashboard | null {
  const key = buildDashboardCacheKey(query);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const payload = parseJson(raw);
    if (!isCachePayload(payload)) {
      removeCacheItem(key);
      return null;
    }

    if (Date.now() - payload.cachedAt > MAX_CACHE_AGE_MS) {
      removeCacheItem(key);
      pruneCache();
      return null;
    }

    if (isNoCachePlaceholder(payload.data)) {
      removeCacheItem(key);
      pruneCache();
      return null;
    }

    return { key, cachedAt: payload.cachedAt, data: payload.data };
  } catch {
    return null;
  }
}

export function writeDashboardCache(query: QueryParams, data: DashboardResponse) {
  if (isNoCachePlaceholder(data)) return;

  const key = buildDashboardCacheKey(query);
  const payload: CachePayload = {
    version: CACHE_VERSION,
    cachedAt: Date.now(),
    query: normalizeQuery(query),
    data
  };

  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    pruneCache(key);
    try {
      window.localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      return;
    }
  }

  const nextIndex = [
    { key, cachedAt: payload.cachedAt },
    ...readIndex().filter((item) => item.key !== key)
  ];
  writeIndex(nextIndex);
  pruneCache(key);
}

function beijingToday() {
  const ms = Date.now() + 8 * 60 * 60 * 1000;
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isHistoricalQuery(query: QueryParams) {
  return query.endDate < beijingToday();
}

export function canUseHistoricalCache(query: QueryParams, cachedAt: number) {
  return (
    isHistoricalQuery(query) &&
    Date.now() - cachedAt <= HISTORICAL_CACHE_FRESH_MS
  );
}
