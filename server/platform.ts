import type { DataPlatform } from "./types";

export type PlatformSource = {
  platform: DataPlatform;
  label: "iOS" | "鸿蒙" | "小红书" | "百度";
  table: string;
};

export const XHS_WORLD_CUP_RANGE = {
  startDate: "20260611",
  endDate: "20260719"
} as const;

const sources: Record<DataPlatform, PlatformSource> = {
  iOS: {
    platform: "iOS",
    label: "iOS",
    table:
      process.env.ASA_DB_TABLE_IOS ??
      process.env.ASA_DB_TABLE ??
      "hive.ads.ads_ad_ios_asa_roi_di"
  },
  HarmonyOS: {
    platform: "HarmonyOS",
    label: "鸿蒙",
    table:
      process.env.ASA_DB_TABLE_HARMONY ?? "hive.ads.ads_ad_hm_roi_di"
  },
  Xiaohongshu: {
    platform: "Xiaohongshu",
    label: "小红书",
    table:
      process.env.ASA_DB_TABLE_XHS ?? "hive.ads.ads_ad_xhs_roi_di"
  },
  Baidu: {
    platform: "Baidu",
    label: "百度",
    table:
      process.env.ASA_DB_TABLE_BAIDU ?? "hive.ads.ads_ad_baidu_roi_di"
  }
};

export function parseDataPlatform(value: unknown): DataPlatform | null {
  if (value === undefined || value === null || value === "") return "iOS";
  if (
    value === "iOS" ||
    value === "HarmonyOS" ||
    value === "Xiaohongshu" ||
    value === "Baidu"
  ) {
    return value;
  }
  return null;
}

export function resolvePlatformSource(platform: DataPlatform): PlatformSource {
  return sources[platform];
}

// iOS 自然量按天表：剔除 ASA 归因后的 iPhone 新增设备，仅在 iOS 平台下附带查询。
export const IOS_NATURAL_TABLE =
  process.env.ASA_DB_TABLE_IOS_NATURAL ?? "hive.ads.ads_ad_ios_natural_user_di";

export function platformSourceNote(
  platform: DataPlatform,
  hasRows: boolean
): string {
  const source = resolvePlatformSource(platform);
  return `实时数仓 ${source.label} · ${source.table}：${
    hasRows ? "已返回真实数据" : "该区间暂无数据"
  }`;
}
