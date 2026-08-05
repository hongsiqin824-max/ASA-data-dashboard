import assert from "node:assert/strict";
import test from "node:test";
import {
  compareRequiredColumns,
  HARMONY_REQUIRED_SOURCE_COLUMNS,
  REQUIRED_SOURCE_COLUMNS,
  XHS_REQUIRED_SOURCE_COLUMNS
} from "../server/platform-schema";

test("缺少成本或 ROI 核心字段时结构检查失败", () => {
  const result = compareRequiredColumns("iOS", [
    "day",
    "campaign_id",
    "ad_group_id",
    "keyword_id"
  ]);

  assert.equal(result.ok, false);
  assert.ok(result.missing.includes("spend"));
  assert.ok(result.missing.includes("revenue_total"));
});

test("小红书按广告主和推广计划字段准入，不要求不存在的子层级", () => {
  const result = compareRequiredColumns(
    "Xiaohongshu",
    XHS_REQUIRED_SOURCE_COLUMNS
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.missing, []);
  assert.equal(XHS_REQUIRED_SOURCE_COLUMNS.includes("advertiser_id"), true);
  assert.equal(XHS_REQUIRED_SOURCE_COLUMNS.includes("campaign_id"), true);
  assert.equal(XHS_REQUIRED_SOURCE_COLUMNS.includes("pay_uv"), true);
  assert.equal(XHS_REQUIRED_SOURCE_COLUMNS.includes("ad_group_id"), false);
  assert.equal(XHS_REQUIRED_SOURCE_COLUMNS.includes("keyword_id"), false);
  assert.equal(XHS_REQUIRED_SOURCE_COLUMNS.includes("pay_uv_total"), false);
  assert.equal(XHS_REQUIRED_SOURCE_COLUMNS.includes("revenue_60d"), false);
});

test("当前查询需要的字段全部存在时结构检查通过", () => {
  const result = compareRequiredColumns("iOS", REQUIRED_SOURCE_COLUMNS);

  assert.equal(result.ok, true);
  assert.deepEqual(result.missing, []);
});

test("鸿蒙按任务和子任务字段执行结构准入，不要求 iOS 专属字段", () => {
  const result = compareRequiredColumns(
    "HarmonyOS",
    HARMONY_REQUIRED_SOURCE_COLUMNS
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.missing, []);
  assert.equal(HARMONY_REQUIRED_SOURCE_COLUMNS.includes("task_id"), true);
  assert.equal(HARMONY_REQUIRED_SOURCE_COLUMNS.includes("sub_task_id"), true);
  assert.equal(HARMONY_REQUIRED_SOURCE_COLUMNS.includes("ad_revenue_total"), false);
});
