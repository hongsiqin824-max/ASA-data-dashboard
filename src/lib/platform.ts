import type { DataPlatform } from "./types";

export const DATA_PLATFORMS: readonly DataPlatform[] = ["iOS", "HarmonyOS"];

export function platformLabel(platform: DataPlatform): "iOS" | "鸿蒙" {
  return platform === "HarmonyOS" ? "鸿蒙" : "iOS";
}

export function clientPlatform(value: string | null): DataPlatform {
  return value === "HarmonyOS" ? "HarmonyOS" : "iOS";
}

export function platformExportPrefix(platform: DataPlatform): "ios" | "harmony" {
  return platform === "HarmonyOS" ? "harmony" : "ios";
}

export function keywordEntityOrder(
  platform: DataPlatform
): readonly ["parent" | "child", "parent" | "child"] {
  return platform === "HarmonyOS"
    ? ["parent", "child"]
    : ["child", "parent"];
}

export function platformUi(platform: DataPlatform) {
  if (platform === "HarmonyOS") {
    return {
      parentEntity: "任务",
      childEntity: "子任务",
      installMetric: "下载",
      spendSource: "华为广告支出",
      hasAdRevenue: false,
      hasIosInstallBreakdown: false
    } as const;
  }

  return {
    parentEntity: "计划",
    childEntity: "关键词",
    installMetric: "安装",
    spendSource: "Apple Ads 支出",
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
