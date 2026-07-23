-- =============================================================
-- 02 关键词 ROI 主查询（核心字段）  Hive / Spark SQL
-- ROI = 归因收入(广告+会员+充值) / ASA花费，keyword 级；可上卷到 campaign / adgroup
-- 跑之前先跑 01 探查，用结果替换下面占位符：
--   {START_DAY} {END_DAY}     统计区间 yyyyMMdd（如 20260525 / 20260624）
--   {VIP_PAID_STATUS}         会员已支付状态值，如 1 或 1,2     （来自探查1）
--   {TOKEN_PAID_STATUS}       充值已支付状态值，如 1           （来自探查2）
--   {TOKEN_REFUND_EXCLUDE}    充值需排除的退款状态值，如 1     （来自探查3）
-- 可选：充值仅取 iOS 时，取消 client_type 行注释并填值（来自探查4）
-- =============================================================

WITH cost AS (   -- 分母：ASA 花费，keyword 级，按区间累加
  SELECT
    CAST(campaign_id AS STRING)  AS campaign_id,
    CAST(ad_group_id AS STRING)  AS ad_group_id,
    CAST(keyword_id  AS STRING)  AS keyword_id,
    MAX(keyword)    AS keyword,
    MAX(match_type) AS match_type,
    SUM(COALESCE(impressions, 0))                  AS impressions,
    SUM(COALESCE(taps, 0))                         AS taps,
    SUM(COALESCE(total_installs, tap_installs, 0)) AS installs,
    SUM(CAST(get_json_object(local_spend, '$.amount') AS DECIMAL(18,4))) AS cost
  FROM ods.ods_api_asa_keyword_report_di
  WHERE process_day BETWEEN '{START_DAY}' AND '{END_DAY}'
    AND keyword_id IS NOT NULL
    AND COALESCE(deleted, 'false') <> 'true'
  GROUP BY CAST(campaign_id AS STRING), CAST(ad_group_id AS STRING), CAST(keyword_id AS STRING)
),
attr AS (   -- 归因桥梁：取最新 day 分区 = 全量；DISTINCT 防快照重复行导致收入翻倍
  SELECT DISTINCT
    CAST(device_id AS BIGINT)          AS device_id,
    uuid,
    CAST(campaign_id AS STRING)        AS campaign_id,
    CAST(ad_group_id AS STRING)        AS ad_group_id,
    CAST(keyword_id AS STRING)         AS keyword_id,
    CAST(uuid_begin_time AS TIMESTAMP) AS begin_time,
    CAST(uuid_end_time   AS TIMESTAMP) AS end_time
  FROM dwd.dwd_ad_ios_ads_attribution_df
  WHERE day = (SELECT MAX(day) FROM dwd.dwd_ad_ios_ads_attribution_df)
    AND attribution = 'true'
    AND keyword_id IS NOT NULL
    AND CAST(keyword_id AS BIGINT) > 0
),
ad_rev AS (   -- 广告变现：uuid 关联，day 落入归因窗 [begin, end)
  SELECT
    a.campaign_id,
    a.ad_group_id,
    a.keyword_id,
    SUM(COALESCE(t.cny_estimate_revenue, 0)) AS ad_revenue
  FROM attr a
  JOIN dwd.dwd_ad_taku_device_report_di t
    ON t.dqd_uuid = a.uuid
   AND CAST(concat(substr(t.day,1,4),'-',substr(t.day,5,2),'-',substr(t.day,7,2),' 00:00:00') AS TIMESTAMP) >= a.begin_time
   AND CAST(concat(substr(t.day,1,4),'-',substr(t.day,5,2),'-',substr(t.day,7,2),' 00:00:00') AS TIMESTAMP) <  a.end_time
  WHERE t.day BETWEEN '{START_DAY}' AND '{END_DAY}'
    AND t.device_type IN ('1','2')
  GROUP BY a.campaign_id, a.ad_group_id, a.keyword_id
),
vip_rev AS (   -- 会员收入：device_id 关联，pay_time 落入归因窗
  SELECT
    a.campaign_id,
    a.ad_group_id,
    a.keyword_id,
    SUM(CAST(v.total AS DECIMAL(18,4))) AS vip_revenue
  FROM attr a
  JOIN ods.ods_mysql_dqd_dedecms_zc_vip_purchorder_pt v
    ON CAST(v.device_id AS BIGINT) = a.device_id
   AND CAST(v.pay_time AS TIMESTAMP) >= a.begin_time
   AND CAST(v.pay_time AS TIMESTAMP) <  a.end_time
  WHERE v.process_day = (SELECT MAX(process_day) FROM ods.ods_mysql_dqd_dedecms_zc_vip_purchorder_pt)
    AND v.pay_status IN ({VIP_PAID_STATUS})
    AND v.pay_time IS NOT NULL AND v.pay_time <> ''
    AND (v.deleted_at IS NULL OR v.deleted_at = '')
  GROUP BY a.campaign_id, a.ad_group_id, a.keyword_id
),
recharge_rev AS (   -- 充值收入：device_id 关联，pay_time 落入归因窗
  SELECT
    a.campaign_id,
    a.ad_group_id,
    a.keyword_id,
    SUM(CAST(o.price AS DECIMAL(18,4))) AS recharge_revenue
  FROM attr a
  JOIN ods.ods_mysql_lottery_token_orders_pt o
    ON CAST(o.device_id AS BIGINT) = a.device_id
   AND CAST(o.pay_time AS TIMESTAMP) >= a.begin_time
   AND CAST(o.pay_time AS TIMESTAMP) <  a.end_time
  WHERE o.process_day = (SELECT MAX(process_day) FROM ods.ods_mysql_lottery_token_orders_pt)
    AND o.pay_status IN ({TOKEN_PAID_STATUS})
    AND o.pay_time IS NOT NULL AND o.pay_time <> ''
    AND COALESCE(o.refund_status, 0) NOT IN ({TOKEN_REFUND_EXCLUDE})
    -- AND o.client_type IN (/* iOS 值，见探查4 */)
  GROUP BY a.campaign_id, a.ad_group_id, a.keyword_id
),
revenue AS (   -- 三类收入按 keyword 汇总
  SELECT campaign_id,
         ad_group_id,
         keyword_id,
         SUM(ad_revenue)       AS ad_revenue,
         SUM(vip_revenue)      AS vip_revenue,
         SUM(recharge_revenue) AS recharge_revenue
  FROM (
    SELECT campaign_id, ad_group_id, keyword_id, ad_revenue,        0 AS vip_revenue,        0 AS recharge_revenue FROM ad_rev
    UNION ALL
    SELECT campaign_id, ad_group_id, keyword_id,        0 AS ad_revenue, vip_revenue,        0 AS recharge_revenue FROM vip_rev
    UNION ALL
    SELECT campaign_id, ad_group_id, keyword_id,        0 AS ad_revenue,        0 AS vip_revenue, recharge_revenue FROM recharge_rev
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
  c.installs,
  c.cost,
  COALESCE(r.ad_revenue, 0)       AS ad_revenue,
  COALESCE(r.vip_revenue, 0)      AS vip_revenue,
  COALESCE(r.recharge_revenue, 0) AS recharge_revenue,
  COALESCE(r.vip_revenue, 0) + COALESCE(r.recharge_revenue, 0) AS pay_revenue,
  COALESCE(r.ad_revenue, 0) + COALESCE(r.vip_revenue, 0) + COALESCE(r.recharge_revenue, 0) AS total_revenue,
  CASE WHEN c.cost > 0
       THEN (COALESCE(r.ad_revenue,0) + COALESCE(r.vip_revenue,0) + COALESCE(r.recharge_revenue,0)) / c.cost
       ELSE 0 END AS roi
FROM cost c
LEFT JOIN revenue r
  ON c.campaign_id = r.campaign_id
 AND c.ad_group_id = r.ad_group_id
 AND c.keyword_id = r.keyword_id
ORDER BY roi DESC;

-- =============================================================
-- 上卷到 campaign / adgroup 级：把最外层 SELECT 换成按维度 GROUP BY，例如 campaign 级：
--   SELECT c.campaign_id,
--          SUM(c.cost) AS cost,
--          SUM(COALESCE(r.ad_revenue,0)+COALESCE(r.vip_revenue,0)+COALESCE(r.recharge_revenue,0)) AS total_revenue,
--          CASE WHEN SUM(c.cost) > 0
--               THEN SUM(COALESCE(r.ad_revenue,0)+COALESCE(r.vip_revenue,0)+COALESCE(r.recharge_revenue,0)) / SUM(c.cost)
--               ELSE 0 END AS roi
--   FROM cost c
--   LEFT JOIN revenue r
--     ON c.campaign_id = r.campaign_id
--    AND c.ad_group_id = r.ad_group_id
--    AND c.keyword_id = r.keyword_id
--   GROUP BY c.campaign_id ORDER BY roi DESC;
-- =============================================================
