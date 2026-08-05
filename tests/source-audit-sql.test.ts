import assert from "node:assert/strict";
import test from "node:test";
import { buildSourceTableAuditSql } from "../server/sql-generator";

test("鸿蒙 SQL 查看入口只查询可信成品表并转义筛选值", () => {
  const sql = buildSourceTableAuditSql({
    platform: "HarmonyOS",
    table: "hive.ads.ads_ad_hm_roi_di",
    startDate: "20260701",
    endDate: "20260707",
    keyword: "球'赛",
    campaignId: "campaign-1",
    adGroupId: "",
    revenueMode: "all"
  });

  assert.match(sql, /FROM hive\.ads\.ads_ad_hm_roi_di/);
  assert.match(sql, /day BETWEEN '20260701' AND '20260707'/);
  assert.match(sql, /task_name LIKE concat\('%', '球''赛', '%'\)/);
  assert.match(sql, /task_id = 'campaign-1'/);
  assert.doesNotMatch(sql, /keyword LIKE/);
  assert.doesNotMatch(sql, /dwd_ad_ios_ads_attribution_df/);
});

test("小红书 SQL 查看入口按推广计划检索且不引用子层级", () => {
  const sql = buildSourceTableAuditSql({
    platform: "Xiaohongshu",
    table: "hive.ads.ads_ad_xhs_roi_di",
    startDate: "20260611",
    endDate: "20260719",
    keyword: "世界杯'计划",
    campaignId: "campaign-1",
    adGroupId: "should-not-appear",
    revenueMode: "all"
  });

  assert.match(sql, /FROM hive\.ads\.ads_ad_xhs_roi_di/);
  assert.match(sql, /day BETWEEN '20260611' AND '20260719'/);
  assert.match(sql, /campaign_name LIKE/);
  assert.match(sql, /campaign_id LIKE/);
  assert.match(sql, /campaign_id = 'campaign-1'/);
  assert.doesNotMatch(sql, /ad_group_id|sub_task_id|keyword LIKE/);
});
