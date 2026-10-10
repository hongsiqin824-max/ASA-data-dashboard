import { resolvePlatformSource } from "./platform";
import type { DataPlatform } from "./types";

const roiWindows = [
  "1d", "2d", "3d", "4d", "5d", "6d", "7d", "15d", "30d", "60d"
] as const;

export function platformKeywordSearchColumn(platform: DataPlatform) {
  return platform === "iOS" ? "keyword" : "campaign_name";
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
