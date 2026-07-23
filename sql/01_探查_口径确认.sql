-- =============================================================
-- 01 探查 / 口径确认  (Hive / Spark SQL)
-- 用途：主查询 02 跑之前，先用这 6 段确认文档里 ⚠️ 标注的不确定口径。
--      逐段单独运行，把结果记下来，再去填 02 的占位符。
-- 需替换：{START_DAY} {END_DAY}  —— 统计区间，格式 yyyyMMdd，如 20260525 / 20260624
-- =============================================================


-- 探查1：会员表 pay_status 分布 —— 确认【哪些值=已支付】(填到 02 的 {VIP_PAID_STATUS})
SELECT pay_status,
       COUNT(*)                               AS cnt,
       SUM(CAST(total AS DECIMAL(18,4)))      AS sum_amount
FROM ods.ods_mysql_dqd_dedecms_zc_vip_purchorder_pt
WHERE process_day = (SELECT MAX(process_day) FROM ods.ods_mysql_dqd_dedecms_zc_vip_purchorder_pt)
GROUP BY pay_status
ORDER BY cnt DESC;


-- 探查2：充值表 pay_status 分布 —— 确认【哪些值=已支付】(填到 02 的 {TOKEN_PAID_STATUS})
SELECT pay_status,
       COUNT(*)                               AS cnt,
       SUM(CAST(price AS DECIMAL(18,4)))      AS sum_amount
FROM ods.ods_mysql_lottery_token_orders_pt
WHERE process_day = (SELECT MAX(process_day) FROM ods.ods_mysql_lottery_token_orders_pt)
GROUP BY pay_status
ORDER BY cnt DESC;


-- 探查3：充值表 refund_status 分布 —— 确认【哪些值=已退款，需排除】(填到 02 的 {TOKEN_REFUND_EXCLUDE})
SELECT refund_status,
       COUNT(*) AS cnt
FROM ods.ods_mysql_lottery_token_orders_pt
WHERE process_day = (SELECT MAX(process_day) FROM ods.ods_mysql_lottery_token_orders_pt)
GROUP BY refund_status
ORDER BY cnt DESC;


-- 探查4：充值表 client_type 分布 —— 确认是否需要按 iOS 过滤、iOS 是哪个值
SELECT client_type,
       COUNT(*) AS cnt
FROM ods.ods_mysql_lottery_token_orders_pt
WHERE process_day = (SELECT MAX(process_day) FROM ods.ods_mysql_lottery_token_orders_pt)
GROUP BY client_type
ORDER BY cnt DESC;


-- 探查5：uuid 加密口径一致性 —— attr.uuid 与 taku.dqd_uuid 能否对上
-- matched 远小于两边数量 / 接近 0  → 加密口径不一致，广告收入会偏低或为 0，需找映射(idfa/idfv)
WITH attr AS (
  SELECT DISTINCT uuid
  FROM dwd.dwd_ad_ios_ads_attribution_df
  WHERE day = (SELECT MAX(day) FROM dwd.dwd_ad_ios_ads_attribution_df)
    AND attribution = 'true' AND uuid IS NOT NULL AND uuid <> ''
),
taku AS (
  SELECT DISTINCT dqd_uuid
  FROM dwd.dwd_ad_taku_device_report_di
  WHERE day BETWEEN '{START_DAY}' AND '{END_DAY}'
    AND device_type IN ('1','2') AND dqd_uuid IS NOT NULL AND dqd_uuid <> ''
)
SELECT
  (SELECT COUNT(*) FROM attr) AS attr_uuid_cnt,
  (SELECT COUNT(*) FROM taku) AS taku_uuid_cnt,
  COUNT(*)                    AS matched_uuid_cnt
FROM attr a JOIN taku t ON a.uuid = t.dqd_uuid;


-- 探查6：花费币种确认 —— local_spend 是否都是 RMB（出现 USD 等需对齐汇率口径）
SELECT get_json_object(local_spend, '$.currency') AS currency,
       COUNT(*) AS cnt
FROM ods.ods_api_asa_keyword_report_di
WHERE process_day BETWEEN '{START_DAY}' AND '{END_DAY}'
GROUP BY get_json_object(local_spend, '$.currency')
ORDER BY cnt DESC;
