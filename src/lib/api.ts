import type {
  AccountDiagnosisItem,
  DailyKeywordRow,
  DashboardResponse,
  KeywordAdvice
} from "./types";
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

export type CampaignOption = {
  id: string;
  name: string;
};

export async function fetchCampaignOptions(
  platform: DataPlatform
): Promise<CampaignOption[]> {
  const query = new URLSearchParams({ platform });
  const response = await fetch(withBase(`/api/asa/campaigns?${query.toString()}`));
  if (!response.ok) {
    let message = `计划列表请求失败：${response.status}`;
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
    campaigns?: CampaignOption[];
  };
  ensurePlatformResponse(platform, payload.platform);
  return payload.campaigns ?? [];
}

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

// 发给后端做 AI 出价建议的单个关键词指标（裁剪自 KeywordRow，控制请求体大小）。
export type AdviceKeywordInput = {
  campaignId: string;
  adGroupId: string;
  keywordId: string;
  keyword: string;
  campaignName: string;
  currentBid: number | null;
  cpt: number;
  cpa: number;
  cost: number;
  impressions: number;
  taps: number;
  installs: number;
  activeDays: number;
  roi: number;
  d1Roi: number;
  d3Roi: number;
  d7Roi: number;
  d30Roi: number;
  // true=前端规则命中场景三（曝光≥50 且消耗=0 且转化=0）的无效投放词。
  scene3?: boolean;
};

export async function fetchAdviceConfig(): Promise<{ enabled: boolean }> {
  try {
    const response = await fetch(withBase("/api/asa/keyword-advice/config"));
    if (!response.ok) return { enabled: false };
    return (await response.json()) as { enabled: boolean };
  } catch {
    return { enabled: false };
  }
}

export type KeywordAdviceResponse = {
  advices: KeywordAdvice[];
  diagnosis: AccountDiagnosisItem[];
};

export async function fetchKeywordAdvice(
  platform: DataPlatform,
  keywords: AdviceKeywordInput[],
  options: { forceRefresh?: boolean; withDiagnosis?: boolean } = {}
): Promise<KeywordAdviceResponse> {
  const response = await fetch(withBase("/api/asa/keyword-advice"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      platform,
      keywords,
      forceRefresh: options.forceRefresh ?? false,
      withDiagnosis: options.withDiagnosis ?? true
    })
  });
  if (!response.ok) {
    let message = `AI 建议请求失败：${response.status}`;
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
    advices?: KeywordAdvice[];
    diagnosis?: AccountDiagnosisItem[];
  };
  ensurePlatformResponse(platform, payload.platform);
  return {
    advices: payload.advices ?? [],
    diagnosis: payload.diagnosis ?? []
  };
}
