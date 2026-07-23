import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPlatformSourceRelation,
  platformKeywordSearchColumn
} from "../server/platform-query-source";

test("iOS 查询继续直接读取原始 ASA 成品表", () => {
  const source = buildPlatformSourceRelation("iOS");

  assert.equal(source, "hive.ads.ads_ad_ios_asa_roi_di");
});

test("鸿蒙查询只用真实任务字段构造统一内部列", () => {
  const source = buildPlatformSourceRelation("HarmonyOS");

  assert.match(source, /task_id AS campaign_id/);
  assert.match(source, /sub_task_id AS ad_group_id/);
  assert.match(source, /sub_task_id AS keyword_id/);
  assert.match(source, /sub_task_id AS keyword/);
  assert.doesNotMatch(source, /task_name AS keyword/);
  assert.match(source, /exposure AS impressions/);
  assert.match(source, /click AS taps/);
  assert.match(source, /download AS total_installs/);
  assert.match(source, /revenue_total/);
  assert.match(source, /hive\.ads\.ads_ad_hm_roi_di/);
  assert.doesNotMatch(source, /ads_ad_ios_asa_roi_di/);
});

test("平台搜索列与界面语义一致", () => {
  assert.equal(platformKeywordSearchColumn("iOS"), "keyword");
  assert.equal(platformKeywordSearchColumn("HarmonyOS"), "campaign_name");
});
