import type { QueryParams } from "./api";
import { stripBase, withBase } from "./base";
import { clientPlatform } from "./platform";

// 计算北京时间(UTC+8)下、偏移 dayOffset 天的 YYYY-MM-DD。
// 显式按 +8 计算，不依赖运行环境时区（服务器/浏览器在别的时区也对）。
function beijingDate(dayOffset = 0): string {
  const ms = Date.now() + (8 * 60 + dayOffset * 24 * 60) * 60 * 1000;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 默认区间：滚动近 7 天（今天往前推 6 天 ~ 今天）。
// 页面加载时计算一次，整个会话稳定；与 buildQuerySearch 的"等于默认就不入 URL"逻辑兼容。
export const initialQuery: QueryParams = {
  startDate: beijingDate(-6),
  endDate: beijingDate(0),
  platform: "iOS",
  channel: "",
  channelGroup: "",
  campaignId: "",
  adGroupId: "",
  keyword: "",
  status: "",
  grain: "day",
  revenueMode: "all"
};

export type RouteState =
  | {
      page: "campaigns";
    }
  | {
      page: "campaign";
      campaignId: string;
    }
  | {
      page: "detail";
      keywordId: string;
      campaignId?: string;
      adGroupId?: string;
    };

const queryKeys: Array<keyof QueryParams> = [
  "startDate",
  "endDate",
  "platform",
  "channel",
  "channelGroup",
  "campaignId",
  "adGroupId",
  "keyword",
  "status",
  "grain",
  "revenueMode"
];

export function readRouteFromUrl(): RouteState {
  const path = stripBase(window.location.pathname);
  const scopedKeywordMatch = path.match(
    /^\/campaigns\/([^/]+)\/ad-groups\/([^/]+)\/keywords\/([^/]+)/
  );
  if (scopedKeywordMatch?.[1] && scopedKeywordMatch?.[2] && scopedKeywordMatch?.[3]) {
    return {
      page: "detail",
      campaignId: decodeURIComponent(scopedKeywordMatch[1]),
      adGroupId: decodeURIComponent(scopedKeywordMatch[2]),
      keywordId: decodeURIComponent(scopedKeywordMatch[3])
    };
  }

  const campaignKeywordMatch = path.match(/^\/campaigns\/([^/]+)\/keywords\/([^/]+)/);
  if (campaignKeywordMatch?.[1] && campaignKeywordMatch?.[2]) {
    return {
      page: "detail",
      campaignId: decodeURIComponent(campaignKeywordMatch[1]),
      keywordId: decodeURIComponent(campaignKeywordMatch[2])
    };
  }

  const keywordMatch = path.match(/^\/keywords\/([^/]+)/);
  if (keywordMatch?.[1]) {
    return {
      page: "detail",
      keywordId: decodeURIComponent(keywordMatch[1])
    };
  }

  const campaignMatch = path.match(/^\/campaigns\/([^/]+)/);
  if (campaignMatch?.[1]) {
    return {
      page: "campaign",
      campaignId: decodeURIComponent(campaignMatch[1])
    };
  }

  return { page: "campaigns" };
}

export function readQueryFromUrl(): QueryParams {
  const params = new URLSearchParams(window.location.search);
  const grain = params.get("grain");
  const revenueMode = params.get("revenueMode");
  const platform = params.has("platform")
    ? clientPlatform(params.get("platform"))
    : initialQuery.platform;

  return {
    startDate: params.get("startDate") ?? initialQuery.startDate,
    endDate: params.get("endDate") ?? initialQuery.endDate,
    platform,
    channel: params.get("channel") ?? initialQuery.channel,
    channelGroup: params.get("channelGroup") ?? initialQuery.channelGroup,
    campaignId: params.get("campaignId") ?? initialQuery.campaignId,
    adGroupId: params.get("adGroupId") ?? initialQuery.adGroupId,
    keyword: params.get("keyword") ?? initialQuery.keyword,
    status: params.get("status") ?? initialQuery.status,
    grain: grain === "month" ? "month" : "day",
    revenueMode:
      revenueMode === "pay" || (revenueMode === "ad" && platform === "iOS")
        ? revenueMode
        : "all"
  };
}

export function buildQuerySearch(query: QueryParams) {
  const params = new URLSearchParams();
  queryKeys.forEach((key) => {
    if (query[key] !== initialQuery[key]) {
      params.set(key, query[key]);
    }
  });

  const search = params.toString();
  return search ? `?${search}` : "";
}

export function keywordDetailHref(
  keywordId: string,
  query: QueryParams,
  campaignId?: string,
  adGroupId?: string
) {
  if (campaignId && adGroupId) {
    return withBase(
      `/campaigns/${encodeURIComponent(campaignId)}/ad-groups/${encodeURIComponent(
        adGroupId
      )}/keywords/${encodeURIComponent(keywordId)}${buildQuerySearch(query)}`
    );
  }

  if (campaignId) {
    return withBase(
      `/campaigns/${encodeURIComponent(campaignId)}/keywords/${encodeURIComponent(
        keywordId
      )}${buildQuerySearch(query)}`
    );
  }

  return withBase(
    `/keywords/${encodeURIComponent(keywordId)}${buildQuerySearch(query)}`
  );
}

export function campaignDetailHref(campaignId: string, query: QueryParams) {
  return withBase(
    `/campaigns/${encodeURIComponent(campaignId)}${buildQuerySearch(query)}`
  );
}
