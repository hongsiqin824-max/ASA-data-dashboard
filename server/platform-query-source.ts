import { resolvePlatformSource } from "./platform";
import type { DataPlatform } from "./types";

const roiWindows = [
  "1d", "2d", "3d", "4d", "5d", "6d", "7d", "15d", "30d", "60d"
] as const;

// 百度关键词粒度里 keyword_id = -1 的行统一显示成这个名字（同 iOS 的 -1 行，一个单元一行）。
// -1 包括：自动扩量 / 无关键词 / 归因缺失；另外数仓 20261110 分区起才按关键词拆，
// 之前的分区（10-26~11-09）一个单元一天只有一行、keyword_id 全是 -1，也归在这里。
// 所以文案不写「自动扩量」，免得把没拆的历史数当成自动扩量。
export const BAIDU_UNMATCHED_KEYWORD_LABEL = "未匹配关键词";

// 顶部搜索框匹配哪些列（多列时任一命中即可）。列名指 buildPlatformSourceRelation 输出的统一列。
export function platformKeywordSearchColumns(
  platform: DataPlatform
): readonly string[] {
  if (platform === "iOS") return ["keyword"];
  if (platform === "Baidu") return ["keyword", "campaign_name"];
  if (platform === "Xiaohongshu") return ["campaign_name", "campaign_id"];
  return ["campaign_name"];
}

export function buildPlatformSourceRelation(platform: DataPlatform): string {
  const { table } = resolvePlatformSource(platform);
  if (platform === "iOS") return table;

  if (platform === "Xiaohongshu") {
    const revenueWindows = roiWindows.flatMap((window) => [
      `revenue_${window}`,
      `revenue_vip_${window}`,
      `revenue_charge_${window}`,
      `0 AS ad_revenue_${window}`,
      `roi_${window}`
    ]);

    return `(SELECT
      day,
      report_date,
      advertiser_id,
      campaign_id,
      campaign_name,
      '' AS ad_group_id,
      '' AS ad_group_name,
      '' AS keyword_id,
      '' AS keyword,
      impression AS impressions,
      click AS taps,
      0 AS tap_installs,
      0 AS tap_new_downloads,
      0 AS tap_redownloads,
      0 AS total_installs,
      0 AS total_new_downloads,
      0 AS total_redownloads,
      new_user_cnt,
      new_register_cnt,
      spend,
      cost_per_activation,
      cost_per_register,
      pay_uv,
      pay_uv_1d,
      NULL AS cost_per_pay,
      revenue_total,
      revenue_vip_total,
      revenue_charge_total,
      0 AS ad_revenue_total,
      roi_total,
      ${revenueWindows.join(",\n      ")}
    FROM ${table})`;
  }

  // 百度：推广计划 → campaign，推广单元 → ad_group，关键词 → keyword（与 iOS 计划/广告组/关键词 同构）。
  // keyword_id 为 -1 / 空（自动扩量、无关键词、归因缺失、11-10 前未拆分）时按单元归成一行「未匹配关键词」。
  if (platform === "Baidu") {
    const unmatched = "(keyword_id IS NULL OR keyword_id IN ('', '-1'))";
    const revenueWindows = roiWindows.flatMap((window) => [
      `revenue_${window}`,
      `revenue_vip_${window}`,
      `revenue_charge_${window}`,
      `0 AS ad_revenue_${window}`,
      `roi_${window}`
    ]);

    return `(SELECT
      day,
      report_date,
      plan_id AS campaign_id,
      plan_name AS campaign_name,
      unit_id AS ad_group_id,
      unit_name AS ad_group_name,
      CASE WHEN ${unmatched} THEN '-1' ELSE keyword_id END AS keyword_id,
      CASE
        WHEN ${unmatched} THEN '${BAIDU_UNMATCHED_KEYWORD_LABEL}'
        ELSE COALESCE(NULLIF(keyword, ''), keyword_id)
      END AS keyword,
      impression AS impressions,
      click AS taps,
      0 AS tap_installs,
      0 AS tap_new_downloads,
      0 AS tap_redownloads,
      0 AS total_installs,
      0 AS total_new_downloads,
      0 AS total_redownloads,
      new_user_cnt,
      new_register_cnt,
      spend,
      cost_per_activation,
      cost_per_register,
      pay_uv,
      pay_uv_1d,
      cost_per_pay,
      revenue_total,
      revenue_vip_total,
      revenue_charge_total,
      0 AS ad_revenue_total,
      roi_total,
      ${revenueWindows.join(",\n      ")}
    FROM ${table})`;
  }

  const revenueWindows = roiWindows.flatMap((window) => [
    `revenue_${window}`,
    `revenue_vip_${window}`,
    `revenue_charge_${window}`,
    `0 AS ad_revenue_${window}`,
    `roi_${window}`
  ]);

  return `(SELECT
      day,
      report_date,
      task_id AS campaign_id,
      task_name AS campaign_name,
      sub_task_id AS ad_group_id,
      sub_task_id AS ad_group_name,
      sub_task_id AS keyword_id,
      sub_task_id AS keyword,
      exposure AS impressions,
      click AS taps,
      0 AS tap_installs,
      0 AS tap_new_downloads,
      0 AS tap_redownloads,
      download AS total_installs,
      0 AS total_new_downloads,
      0 AS total_redownloads,
      new_user_cnt,
      new_register_cnt,
      spend,
      cost_per_activation,
      cost_per_register,
      pay_uv,
      pay_uv_1d,
      cost_per_pay,
      revenue_total,
      revenue_vip_total,
      revenue_charge_total,
      0 AS ad_revenue_total,
      roi_total,
      ${revenueWindows.join(",\n      ")}
    FROM ${table})`;
}
