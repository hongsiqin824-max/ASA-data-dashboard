import type { DataPlatform } from "./types";

export const DATA_PLATFORMS: readonly DataPlatform[] = [
  "iOS",
  "HarmonyOS",
  "Xiaohongshu",
  "Baidu"
];

export const XHS_WORLD_CUP_RANGE = {
  startDate: "2026-06-11",
  endDate: "2026-07-19"
} as const;

export function platformLabel(
  platform: DataPlatform
): "iOS" | "鸿蒙" | "小红书" | "百度" {
  if (platform === "HarmonyOS") return "鸿蒙";
  if (platform === "Baidu") return "百度";
  return platform === "Xiaohongshu" ? "小红书" : "iOS";
}

export function clientPlatform(value: string | null): DataPlatform {
  if (value === "HarmonyOS" || value === "Xiaohongshu" || value === "Baidu") {
    return value;
  }
  return "iOS";
}

export function platformExportPrefix(
  platform: DataPlatform
): "ios" | "harmony" | "xhs" | "baidu" {
  if (platform === "HarmonyOS") return "harmony";
  if (platform === "Baidu") return "baidu";
  return platform === "Xiaohongshu" ? "xhs" : "ios";
}

export function keywordEntityOrder(
  platform: DataPlatform
): readonly ["parent" | "child", "parent" | "child"] {
  return platform === "iOS" ? ["child", "parent"] : ["parent", "child"];
}

export function platformUi(platform: DataPlatform) {
  if (platform === "Baidu") {
    return {
      parentEntity: "推广计划",
      childEntity: "推广单元",
      installMetric: "安装",
      spendSource: "百度广告支出",
      hasChildEntity: true,
      hasInstallMetric: false,
      // 表里没有安装/下载数，付费率（付费UV / 安装）恒为 0，改显示付费UV
      hasPaymentRate: false,
      hasFullRoiWindows: true,
      hasExtendedRoiWindows: false,
      hasAdRevenue: false,
      hasIosInstallBreakdown: false
    } as const;
  }

  if (platform === "HarmonyOS") {
    return {
      parentEntity: "任务",
      childEntity: "子任务",
      installMetric: "下载",
      spendSource: "华为广告支出",
      hasChildEntity: true,
      hasInstallMetric: true,
      hasPaymentRate: true,
      hasFullRoiWindows: false,
      hasExtendedRoiWindows: false,
      hasAdRevenue: false,
      hasIosInstallBreakdown: false
    } as const;
  }

  if (platform === "Xiaohongshu") {
    return {
      parentEntity: "推广计划",
      childEntity: "计划明细",
      installMetric: "安装",
      spendSource: "小红书广告支出",
      hasChildEntity: false,
      hasInstallMetric: false,
      hasPaymentRate: false,
      hasFullRoiWindows: true,
      hasExtendedRoiWindows: false,
      hasAdRevenue: false,
      hasIosInstallBreakdown: false
    } as const;
  }

  return {
    parentEntity: "计划",
    childEntity: "关键词",
    installMetric: "安装",
    spendSource: "Apple Ads 支出",
    hasChildEntity: true,
    hasInstallMetric: true,
    hasPaymentRate: true,
    hasFullRoiWindows: false,
    // 只有 iOS 表建了 roi_40d~roi_180d
    hasExtendedRoiWindows: true,
    hasAdRevenue: true,
    hasIosInstallBreakdown: true
  } as const;
}

export function ensurePlatformResponse(
  requested: DataPlatform,
  received: DataPlatform
): void {
  if (requested !== received) {
    throw new Error(`平台响应不匹配：请求 ${requested}，收到 ${received}`);
  }
}
