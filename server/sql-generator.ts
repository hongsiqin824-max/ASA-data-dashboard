import { type RevenueMode } from "./shared";
import type { DataPlatform } from "./types";

function dashedDate(compact: string) {
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

function quoteSql(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

export function buildSourceTableAuditSql(params: {
  platform: DataPlatform;
  table: string;
  startDate: string;
  endDate: string;
  keyword?: string;
  campaignId?: string;
  adGroupId?: string;
  revenueMode: RevenueMode;
}) {
  const isHarmony = params.platform === "HarmonyOS";
  const isXhs = params.platform === "Xiaohongshu";
  const keywordColumn = isHarmony ? "task_name" : isXhs ? "campaign_name" : "keyword";
  const campaignColumn = isHarmony ? "task_id" : "campaign_id";
  const adGroupColumn = isHarmony ? "sub_task_id" : isXhs ? null : "ad_group_id";
  const filters = [
    `day BETWEEN ${quoteSql(params.startDate)} AND ${quoteSql(params.endDate)}`
  ];
  if (params.keyword) {
    filters.push(
      isXhs
        ? `(${keywordColumn} LIKE concat('%', ${quoteSql(params.keyword)}, '%') OR campaign_id LIKE concat('%', ${quoteSql(params.keyword)}, '%'))`
        : `${keywordColumn} LIKE concat('%', ${quoteSql(params.keyword)}, '%')`
    );
  }
  if (params.campaignId) {
    filters.push(`${campaignColumn} = ${quoteSql(params.campaignId)}`);
  }
  if (params.adGroupId && adGroupColumn) {
    filters.push(`${adGroupColumn} = ${quoteSql(params.adGroupId)}`);
  }

  return `-- ${params.revenueMode} ROI source-table audit query
SELECT *
FROM ${params.table}
WHERE ${filters.join("\n  AND ")}
ORDER BY day DESC, spend DESC
LIMIT 1000;`;
}

export function buildKeywordRoiSql(params: {
  startDate: string;
  endDate: string;
  keyword?: string;
  campaignId?: string;
  adGroupId?: string;
  revenueMode: RevenueMode;
}) {
  const startDate = dashedDate(params.startDate);
  const endDate = dashedDate(params.endDate);
  const keywordFilter = params.keyword
    ? `AND c.keyword LIKE concat('%', ${quoteSql(params.keyword)}, '%')`
    : "";
  const campaignFilter = params.campaignId
    ? `AND c.campaign_id = ${quoteSql(params.campaignId)}`
    : "";
  const adGroupFilter = params.adGroupId
    ? `AND c.ad_group_id = ${quoteSql(params.adGroupId)}`
    : "";
  const revenueExpr =
    params.revenueMode === "ad"
      ? "COALESCE(r.ad_revenue, 0)"
      : params.revenueMode === "pay"
        ? "COALESCE(r.vip_revenue, 0) + COALESCE(r.recharge_revenue, 0)"
        : "COALESCE(r.ad_revenue, 0) + COALESCE(r.vip_revenue, 0) + COALESCE(r.recharge_revenue, 0)";

  return `-- iOS ASA keyword ROI, generated from ios_asa_roi_数据模型说明.md
-- TODO before production:
-- 1. Confirm zc_vip.pay_status paid values.
-- 2. Confirm token_orders.pay_status paid values and refund_status excluded values.
-- 3. Confirm attr.uuid = taku.dqd_uuid encryption/mapping.
-- 4. Confirm whether token_orders.client_type needs iOS filtering.

WITH cost AS (
  SELECT
    CAST(campaign_id AS STRING) AS campaign_id,
    CAST(ad_group_id AS STRING) AS ad_group_id,
    CAST(keyword_id AS STRING) AS keyword_id,
    MAX(keyword) AS keyword,
    MAX(match_type) AS match_type,
    SUM(COALESCE(impressions, 0)) AS impressions,
    SUM(COALESCE(taps, 0)) AS taps,
    SUM(COALESCE(tap_installs, 0)) AS tap_installs,
    SUM(COALESCE(tap_new_downloads, 0)) AS tap_new_downloads,
    SUM(COALESCE(tap_redownloads, 0)) AS tap_redownloads,
    SUM(COALESCE(total_installs, tap_installs, 0)) AS installs,
    SUM(COALESCE(total_new_downloads, 0)) AS total_new_downloads,
    SUM(COALESCE(total_redownloads, 0)) AS total_redownloads,
    SUM(CAST(get_json_object(local_spend, '$.amount') AS DECIMAL(18,4))) AS cost
  FROM ods.ods_api_asa_keyword_report_di
  WHERE process_day BETWEEN '${params.startDate}' AND '${params.endDate}'
  GROUP BY CAST(campaign_id AS STRING), CAST(ad_group_id AS STRING), CAST(keyword_id AS STRING)
),
attr AS (
  SELECT
    CAST(device_id AS BIGINT) AS device_id,
    uuid,
    CAST(campaign_id AS STRING) AS campaign_id,
    CAST(ad_group_id AS STRING) AS ad_group_id,
    CAST(keyword_id AS STRING) AS keyword_id,
    CAST(uuid_begin_time AS TIMESTAMP) AS begin_time,
    CAST(uuid_end_time AS TIMESTAMP) AS end_time,
    CAST(install_time AS TIMESTAMP) AS install_time
  FROM dwd.dwd_ad_ios_ads_attribution_df
  WHERE day = (SELECT MAX(day) FROM dwd.dwd_ad_ios_ads_attribution_df)
    AND attribution = 'true'
    AND keyword_id IS NOT NULL
    AND CAST(keyword_id AS BIGINT) > 0
),
ad_revenue AS (
  SELECT
    a.campaign_id,
    a.ad_group_id,
    a.keyword_id,
    SUM(COALESCE(t.cny_estimate_revenue, 0)) AS ad_revenue
  FROM attr a
  JOIN dwd.dwd_ad_taku_device_report_di t
    ON t.dqd_uuid = a.uuid
   AND CAST(concat(substr(t.day, 1, 4), '-', substr(t.day, 5, 2), '-', substr(t.day, 7, 2), ' 00:00:00') AS TIMESTAMP) >= a.begin_time
   AND CAST(concat(substr(t.day, 1, 4), '-', substr(t.day, 5, 2), '-', substr(t.day, 7, 2), ' 00:00:00') AS TIMESTAMP) < a.end_time
  WHERE t.day BETWEEN '${params.startDate}' AND '${params.endDate}'
    AND t.device_type IN ('1', '2')
  GROUP BY a.campaign_id, a.ad_group_id, a.keyword_id
),
vip_revenue AS (
  SELECT
    a.campaign_id,
    a.ad_group_id,
    a.keyword_id,
    SUM(CAST(v.total AS DECIMAL(18,4))) AS vip_revenue
  FROM attr a
  JOIN ods.ods_mysql_dqd_dedecms_zc_vip_purchorder_pt v
    ON CAST(v.device_id AS BIGINT) = a.device_id
   AND CAST(v.pay_time AS TIMESTAMP) >= a.begin_time
   AND CAST(v.pay_time AS TIMESTAMP) < a.end_time
  WHERE v.process_day = (
      SELECT MAX(process_day)
      FROM ods.ods_mysql_dqd_dedecms_zc_vip_purchorder_pt
    )
    AND v.pay_time >= '${startDate} 00:00:00'
    AND v.pay_time < date_add('${endDate}', 1)
    AND v.pay_status IN (${process.env.ASA_VIP_PAID_STATUS ?? "/* TODO */ 1"})
    AND v.deleted_at IS NULL
  GROUP BY a.campaign_id, a.ad_group_id, a.keyword_id
),
recharge_revenue AS (
  SELECT
    a.campaign_id,
    a.ad_group_id,
    a.keyword_id,
    SUM(CAST(o.price AS DECIMAL(18,4))) AS recharge_revenue
  FROM attr a
  JOIN ods.ods_mysql_lottery_token_orders_pt o
    ON CAST(o.device_id AS BIGINT) = a.device_id
   AND CAST(o.pay_time AS TIMESTAMP) >= a.begin_time
   AND CAST(o.pay_time AS TIMESTAMP) < a.end_time
  WHERE o.process_day = (
      SELECT MAX(process_day)
      FROM ods.ods_mysql_lottery_token_orders_pt
    )
    AND o.pay_time >= '${startDate} 00:00:00'
    AND o.pay_time < date_add('${endDate}', 1)
    AND o.pay_status IN (${process.env.ASA_TOKEN_PAID_STATUS ?? "/* TODO */ 1"})
    AND COALESCE(o.refund_status, 0) NOT IN (${process.env.ASA_TOKEN_REFUND_STATUS ?? "/* TODO refund */ -999"})
  GROUP BY a.campaign_id, a.ad_group_id, a.keyword_id
),
revenue AS (
  SELECT
    campaign_id,
    ad_group_id,
    keyword_id,
    SUM(ad_revenue) AS ad_revenue,
    SUM(vip_revenue) AS vip_revenue,
    SUM(recharge_revenue) AS recharge_revenue
  FROM (
    SELECT campaign_id, ad_group_id, keyword_id, ad_revenue, 0 AS vip_revenue, 0 AS recharge_revenue FROM ad_revenue
    UNION ALL
    SELECT campaign_id, ad_group_id, keyword_id, 0 AS ad_revenue, vip_revenue, 0 AS recharge_revenue FROM vip_revenue
    UNION ALL
    SELECT campaign_id, ad_group_id, keyword_id, 0 AS ad_revenue, 0 AS vip_revenue, recharge_revenue FROM recharge_revenue
  ) u
  GROUP BY campaign_id, ad_group_id, keyword_id
)
SELECT
  c.campaign_id,
  c.ad_group_id,
  c.keyword_id,
  c.keyword,
  c.match_type,
  c.impressions,
  c.taps,
  CASE WHEN c.impressions > 0 THEN c.taps / c.impressions ELSE 0 END AS ttr,
  c.tap_installs,
  c.tap_new_downloads,
  c.tap_redownloads,
  c.installs,
  c.total_new_downloads,
  c.total_redownloads,
  c.cost,
  COALESCE(r.ad_revenue, 0) AS ad_revenue,
  COALESCE(r.vip_revenue, 0) AS vip_revenue,
  COALESCE(r.recharge_revenue, 0) AS recharge_revenue,
  COALESCE(r.vip_revenue, 0) + COALESCE(r.recharge_revenue, 0) AS pay_revenue,
  ${revenueExpr} AS total_revenue,
  CASE WHEN c.cost > 0 THEN ${revenueExpr} / c.cost ELSE 0 END AS roi
FROM cost c
LEFT JOIN revenue r
  ON c.campaign_id = r.campaign_id
 AND c.ad_group_id = r.ad_group_id
 AND c.keyword_id = r.keyword_id
WHERE 1 = 1
  ${keywordFilter}
  ${campaignFilter}
  ${adGroupFilter}
ORDER BY roi DESC;`;
}
