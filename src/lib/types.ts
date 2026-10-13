export type KeywordStatus = "scaling" | "observe" | "pause" | "new";
export type DataPlatform = "iOS" | "HarmonyOS" | "Xiaohongshu";

// AI 出价建议：针对单个关键词，由大模型基于历史投放数据给出。
// action 对应 ASA 出价工具文档的四类场景：up(小幅提价) / down(降价控本) /
// pause(暂停或大幅降价) / hold(样本不足维持观察)。
export type KeywordAdviceAction = "up" | "down" | "pause" | "hold";

export type KeywordAdvice = {
  campaignId: string;
  adGroupId: string;
  keywordId: string;
  // AI 推荐出价（规则兜底后的最终合规值）；无法判断时为 null。
  recommendedBid: number | null;
  // 最终合规动作（可能被业务规则覆盖）。
  action: KeywordAdviceAction;
  // 调价理由：分点问题 + 动作，≤200 字，可含换行。
  reason: string;
  // 模型原始动作（规则兜底前）；与 action 不同表示被规则覆盖过。
  rawAction: KeywordAdviceAction;
  // 模型原始出价（规则兜底前）；与 recommendedBid 不同表示被夹逼/改写过。
  rawRecommendedBid: number | null;
  // 业务规则修正说明：命中哪条兜底规则、为什么、改成了什么，可多条。为空表示未修正。
  adjustments: string[];
};

// 账户级优化诊断：跨关键词/跨计划的实战诊断（抢同词、否定词、Search Match 回收等）。
export type AccountDiagnosisItem = {
  // 诊断标题，如「足球 app（球迷需求-精准）」。
  title: string;
  // 关键指标摘要，如「花费 ¥22,320 | ROI 0.106」；可为空。
  summary: string;
  // 问题分点。
  points: string[];
  // 落地动作。
  action: string;
};

// 成品表中的留存设备数：1~30 日逐日，之后按 10 日步长到 180 日
// （数仓只建了这些档位，没有 31~39 等中间天）。
// null 表示该窗口暂无数据或不适用于当前平台，与真实留存数为 0 明确区分。
export type RetainUvFields = {
  retainUv1d: number | null;
  retainUv2d: number | null;
  retainUv3d: number | null;
  retainUv4d: number | null;
  retainUv5d: number | null;
  retainUv6d: number | null;
  retainUv7d: number | null;
  retainUv8d: number | null;
  retainUv9d: number | null;
  retainUv10d: number | null;
  retainUv11d: number | null;
  retainUv12d: number | null;
  retainUv13d: number | null;
  retainUv14d: number | null;
  retainUv15d: number | null;
  retainUv16d: number | null;
  retainUv17d: number | null;
  retainUv18d: number | null;
  retainUv19d: number | null;
  retainUv20d: number | null;
  retainUv21d: number | null;
  retainUv22d: number | null;
  retainUv23d: number | null;
  retainUv24d: number | null;
  retainUv25d: number | null;
  retainUv26d: number | null;
  retainUv27d: number | null;
  retainUv28d: number | null;
  retainUv29d: number | null;
  retainUv30d: number | null;
  retainUv40d: number | null;
  retainUv50d: number | null;
  retainUv60d: number | null;
  retainUv70d: number | null;
  retainUv80d: number | null;
  retainUv90d: number | null;
  retainUv100d: number | null;
  retainUv110d: number | null;
  retainUv120d: number | null;
  retainUv130d: number | null;
  retainUv140d: number | null;
  retainUv150d: number | null;
  retainUv160d: number | null;
  retainUv170d: number | null;
  retainUv180d: number | null;
};

// 40 日及以上的 ROI 档位。数仓只给了算好的 roi_Nd，没有对应的 revenue 明细，
// 所以这些档位无法按「仅付费 / 仅广告」口径拆分：
// 非「全部」口径下取 null，界面显示 "-"，与真实 ROI 为 0 区分。
export type ExtendedRoiFields = {
  d40Roi: number | null;
  d50Roi: number | null;
  d70Roi: number | null;
  d80Roi: number | null;
  d90Roi: number | null;
  d100Roi: number | null;
  d110Roi: number | null;
  d120Roi: number | null;
  d130Roi: number | null;
  d140Roi: number | null;
  d150Roi: number | null;
  d160Roi: number | null;
  d170Roi: number | null;
  d180Roi: number | null;
};

export type KeywordRow = RetainUvFields & ExtendedRoiFields & {
  dateRange: string;
  firstDate?: string | null;
  lastDate?: string | null;
  activeDays?: number;
  // 全历史投放天数（跨查询区间，近 N 天回看内 COUNT(DISTINCT 活跃日)）。
  // 用于 AI 建议的「需 7 天以上历史」门槛，避免近 7 天默认区间下 activeDays 恒不足。
  historyActiveDays?: number;
  campaignId: string;
  campaignName: string;
  advertiserId?: string;
  adGroupId: string;
  adGroupName: string;
  keywordId: string;
  keyword: string;
  matchType: "exact" | "broad" | "search_match";
  platform: DataPlatform;
  impressions: number;
  taps: number;
  ttr: number;
  tapInstalls: number;
  tapNewDownloads: number;
  tapRedownloads: number;
  installs: number;
  totalNewDownloads: number;
  totalRedownloads: number;
  activations: number;
  registrations: number;
  cost: number;
  cpt: number;
  cpa: number;
  // ASA 实际出价：由数仓补充字段提供；暂无数据时为 null，界面显示 "-"。
  currentBid?: number | null;
  retentionD2: number | null;
  retentionD3: number | null;
  retentionD7: number | null;
  retentionD14: number | null;
  retentionD30: number | null;
  ltv: number;
  ltvRate: number;
  arpu: number;
  arppu: number;
  adImpressions: number;
  avgAdImpressions: number;
  adEcpm: number;
  adFillRate: number;
  totalPayUv: number;
  paymentRate: number;
  adRevenue: number;
  vipRevenue: number;
  rechargeRevenue: number;
  payRevenue: number;
  totalRevenue: number;
  roi: number;
  d1Roi: number;
  d2Roi: number;
  d3Roi: number;
  d4Roi: number;
  d5Roi: number;
  d6Roi: number;
  d7Roi: number;
  d15Roi: number;
  d30Roi: number;
  d60Roi: number;
  status: KeywordStatus;
};

// 计划(campaign)汇总行：前端从 KeywordRow 按 campaignId 聚合而来（见 lib/campaign.ts）。
export type CampaignRow = ExtendedRoiFields & {
  campaignId: string;
  label: string; // 展示名：真实计划名 → 广告组名 → campaignId 回退
  advertiserId?: string;
  firstDate?: string | null;
  lastDate?: string | null;
  adGroupCount: number;
  keywordCount: number;
  installs: number;
  impressions: number;
  taps: number;
  ttr: number;
  tapInstalls: number;
  tapNewDownloads: number;
  tapRedownloads: number;
  totalNewDownloads: number;
  totalRedownloads: number;
  activations: number;
  registrations: number;
  cost: number;
  totalPayUv: number;
  paymentRate: number;
  adRevenue: number;
  vipRevenue: number;
  rechargeRevenue: number;
  payRevenue: number;
  totalRevenue: number;
  roi: number;
  d1Roi: number;
  d2Roi: number;
  d3Roi: number;
  d4Roi: number;
  d5Roi: number;
  d6Roi: number;
  d7Roi: number;
  d15Roi: number;
  d30Roi: number;
  d60Roi: number;
  status: KeywordStatus;
};

// 计划内「按天」聚合行：某计划下所有关键词每日行按 date 合并（见 lib/campaign.ts）。
// 日期汇总行带全量留存档位：列表页只展示其中几档，明细页展开全部。
export type DailyCampaignRow = RetainUvFields & ExtendedRoiFields & {
  date: string;
  keywordCount: number;
  impressions: number;
  taps: number;
  ttr: number;
  tapInstalls: number;
  tapNewDownloads: number;
  tapRedownloads: number;
  installs: number;
  totalNewDownloads: number;
  totalRedownloads: number;
  activations: number;
  registrations: number;
  cost: number;
  totalPayUv: number;
  paymentRate: number;
  adRevenue: number;
  vipRevenue: number;
  rechargeRevenue: number;
  payRevenue: number;
  totalRevenue: number;
  roi: number;
  d1Roi: number;
  d2Roi: number;
  d3Roi: number;
  d4Roi: number;
  d5Roi: number;
  d6Roi: number;
  d7Roi: number;
  d15Roi: number;
  d30Roi: number;
  d60Roi: number;
};

export type DailyKeywordRow = RetainUvFields & ExtendedRoiFields & {
  platform: DataPlatform;
  date: string;
  campaignId: string;
  campaignName: string;
  advertiserId?: string;
  adGroupId: string;
  adGroupName: string;
  keywordId: string;
  keyword: string;
  impressions: number;
  taps: number;
  ttr: number;
  tapInstalls: number;
  tapNewDownloads: number;
  tapRedownloads: number;
  installs: number;
  totalNewDownloads: number;
  totalRedownloads: number;
  activations: number;
  registrations: number;
  cost: number;
  activationCost: number;
  registrationCost: number;
  paymentRate: number;
  retentionD2: number | null;
  retentionD3: number | null;
  retentionD7: number | null;
  ltv: number;
  ltvRate: number;
  arpu: number;
  arppu: number;
  adImpressions: number;
  avgAdImpressions: number;
  adEcpm: number;
  adFillRate: number;
  totalPayUv: number;
  d1PayUv: number;
  payCost: number | null;
  adRevenue: number;
  vipRevenue: number;
  rechargeRevenue: number;
  payRevenue: number;
  totalRevenue: number;
  roi: number;
  d1Roi: number;
  d2Roi: number;
  d3Roi: number;
  d4Roi: number;
  d5Roi: number;
  d6Roi: number;
  d7Roi: number;
  d15Roi: number;
  d30Roi: number;
  d60Roi: number;
};

export type DashboardResponse = {
  platform: DataPlatform;
  updatedAt: string;
  dateRange: {
    start: string;
    end: string;
  };
  // 数仓中最新可用数据日。ROI 窗口成熟度不应受当前查询范围限制。
  dataAsOfDate: string | null;
  source: {
    mode: "unconfigured" | "live";
    note: string;
    table: string;
    modelVersion?: string;
    revenueMode?: "pay" | "ad" | "all";
    sqlEndpoint?: string;
    unresolvedItems?: readonly string[];
    cache?: {
      status: "hit" | "miss" | "refresh";
      cachedAt: string;
      ttlSeconds: number;
    };
  };
  dataModel?: {
    version: string;
    formula: string;
    grain: readonly string[];
    currency: string;
    attributionWindow: string;
    unresolvedItems: readonly string[];
  };
  filters: {
    campaigns: ReadonlyArray<{ id: string; name: string }>;
    adGroups: ReadonlyArray<{ id: string; name: string }>;
    channels: ReadonlyArray<{ id: string; name: string }>;
    channelGroups: ReadonlyArray<{ id: string; name: string }>;
    statuses: ReadonlyArray<{ id: KeywordStatus; name: string }>;
  };
  summary: {
    impressions: number;
    taps: number;
    ttr: number;
    tapInstalls: number;
    tapNewDownloads: number;
    tapRedownloads: number;
    installs: number;
    totalNewDownloads: number;
    totalRedownloads: number;
    activations: number;
    registrations: number;
    cost: number;
    adRevenue: number;
    vipRevenue?: number;
    rechargeRevenue?: number;
    payRevenue: number;
    totalRevenue: number;
    roi: number;
    cpa: number;
    activationRate: number;
  };
  rows: KeywordRow[];
  dailySummaryRows: DailyCampaignRow[];
  dailyRows: DailyKeywordRow[];
};
