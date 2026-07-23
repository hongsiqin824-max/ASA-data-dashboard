import type { DailyKeywordRow, DashboardResponse } from "./types";
import type { DataPlatform } from "./types";
import { withBase } from "./base";
import { ensurePlatformResponse } from "./platform";

export type QueryParams = {
  startDate: string;
  endDate: string;
  platform: DataPlatform;
  channel: string;
  channelGroup: string;
  campaignId: string;
  adGroupId: string;
  keyword: string;
  status: string;
  grain: "day" | "month";
  revenueMode: "pay" | "ad" | "all";
};

export async function fetchKeywordRoi(
  params: QueryParams,
  options: { cacheOnly?: boolean; forceRefresh?: boolean } = {}
): Promise<DashboardResponse> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  if (options.forceRefresh) query.set("forceRefresh", "true");
  else if (options.cacheOnly) query.set("cacheOnly", "true");

  const response = await fetch(withBase(`/api/asa/keyword-roi?${query.toString()}`));
  if (!response.ok) {
    let message = `API 请求失败：${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // 响应体不是 JSON 时，沿用默认状态码提示
    }
    throw new Error(message);
  }

  const payload = (await response.json()) as DashboardResponse;
  ensurePlatformResponse(params.platform, payload.platform);
  return payload;
}

export async function fetchKeywordDailyRows(
  params: QueryParams,
  scope: {
    campaignId?: string;
    adGroupId?: string;
    keywordId?: string;
  }
): Promise<DailyKeywordRow[]> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  if (scope.campaignId) query.set("campaignId", scope.campaignId);
  if (scope.adGroupId) query.set("adGroupId", scope.adGroupId);
  if (scope.keywordId) query.set("keywordId", scope.keywordId);

  const response = await fetch(withBase(`/api/asa/keyword-roi/daily?${query.toString()}`));
  if (!response.ok) {
    let message = `API 请求失败：${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // Keep default status code message.
    }
    throw new Error(message);
  }

  const payload = (await response.json()) as {
    platform: DataPlatform;
    dailyRows?: DailyKeywordRow[];
  };
  ensurePlatformResponse(params.platform, payload.platform);
  return payload.dailyRows ?? [];
}
