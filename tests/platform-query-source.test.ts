import assert from "node:assert/strict";
import test from "node:test";
import {
  BAIDU_UNMATCHED_KEYWORD_LABEL,
  buildPlatformSourceRelation,
  platformKeywordSearchColumns
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
  assert.deepEqual(platformKeywordSearchColumns("iOS"), ["keyword"]);
  assert.deepEqual(platformKeywordSearchColumns("HarmonyOS"), ["campaign_name"]);
  assert.deepEqual(platformKeywordSearchColumns("Xiaohongshu"), [
    "campaign_name",
    "campaign_id"
  ]);
  // 百度：关键词或推广计划名任一命中
  assert.deepEqual(platformKeywordSearchColumns("Baidu"), [
    "keyword",
    "campaign_name"
  ]);
});

test("小红书查询只用真实计划字段，内部空键不构造业务子层级", () => {
  const source = buildPlatformSourceRelation("Xiaohongshu");

  assert.match(source, /advertiser_id/);
  assert.match(source, /campaign_id/);
  assert.match(source, /campaign_name/);
  assert.match(source, /'' AS ad_group_id/);
  assert.match(source, /'' AS keyword_id/);
  assert.match(source, /impression AS impressions/);
  assert.match(source, /click AS taps/);
  assert.match(source, /0 AS total_installs/);
  assert.match(source, /pay_uv,/);
  assert.match(source, /NULL AS cost_per_pay/);
  assert.match(source, /hive\.ads\.ads_ad_xhs_roi_di/);
  assert.doesNotMatch(source, /pay_uv_total/);
  assert.doesNotMatch(source, /task_id|sub_task_id|download AS total_installs/);
  assert.doesNotMatch(source, /ads_ad_ios_asa_roi_di|ads_ad_hm_roi_di/);
});

test("百度查询把推广计划/推广单元/关键词映射为统一内部列（界面简称计划/单元）", () => {
  const source = buildPlatformSourceRelation("Baidu");

  assert.match(source, /plan_id AS campaign_id/);
  assert.match(source, /plan_name AS campaign_name/);
  assert.match(source, /unit_id AS ad_group_id/);
  assert.match(source, /unit_name AS ad_group_name/);
  // 关键词取数仓真实列，不再拿推广单元充当关键词
  assert.doesNotMatch(source, /unit_id AS keyword_id|unit_name AS keyword/);
  assert.match(source, /ELSE keyword_id END AS keyword_id/);
  assert.match(source, /keyword_id IN \('', '-1'\)/);
  assert.ok(source.includes(`THEN '${BAIDU_UNMATCHED_KEYWORD_LABEL}'`));
  // 同 iOS 只用 -1 一种，不按日期另分「未拆分」行；文案不写「自动扩量」（11-10 前未拆分的历史数也在这一行）
  assert.equal(BAIDU_UNMATCHED_KEYWORD_LABEL, "未匹配关键词");
  assert.doesNotMatch(source, /'-2'|day </);
  assert.match(source, /impression AS impressions/);
  // 与 iOS / 鸿蒙 / 小红书 一致取 pay_uv，不取 pay_uv_total
  assert.match(source, /pay_uv,/);
  assert.doesNotMatch(source, /pay_uv_total/);
  assert.match(source, /revenue_60d/);
  assert.match(source, /hive\.ads\.ads_ad_baidu_roi_di/);
  assert.doesNotMatch(source, /task_id|ads_ad_xhs_roi_di|ads_ad_hm_roi_di/);
});
