import assert from "node:assert/strict";
import test from "node:test";
import { aggregateCampaignDaily } from "../src/lib/campaign";
import {
  isOverallRetentionMature,
  retentionDaysAvailable,
  retentionRate
} from "../src/lib/retention-maturity";
import {
  HARMONY_REQUIRED_SOURCE_COLUMNS,
  REQUIRED_SOURCE_COLUMNS,
  XHS_REQUIRED_SOURCE_COLUMNS,
  compareRequiredColumns
} from "../server/platform-schema";
import type { DailyKeywordRow } from "../src/lib/types";
import { mapDailySummaryRow } from "../server/starrocks";

let fixtureId = 0;

function dailyRow(
  date: string,
  retention: Partial<Record<string, number | null>> = {}
): DailyKeywordRow {
  return {
    date,
    keywordCount: 1,
    impressions: 0,
    taps: 0,
    ttr: 0,
    tapInstalls: 0,
    tapNewDownloads: 0,
    tapRedownloads: 0,
    installs: 0,
    totalNewDownloads: 0,
    totalRedownloads: 0,
    activations: 0,
    registrations: 0,
    cost: 0,
    totalPayUv: 0,
    paymentRate: 0,
    adRevenue: 0,
    vipRevenue: 0,
    rechargeRevenue: 0,
    payRevenue: 0,
    totalRevenue: 0,
    roi: 0,
    d1Roi: 0,
    d2Roi: 0,
    d3Roi: 0,
    d4Roi: 0,
    d5Roi: 0,
    d6Roi: 0,
    d7Roi: 0,
    d15Roi: 0,
    d30Roi: 0,
    retainUv1d: retention.retainUv1d ?? null,
    retainUv3d: retention.retainUv3d ?? null,
    retainUv7d: retention.retainUv7d ?? null,
    retainUv14d: retention.retainUv14d ?? null,
    retainUv30d: retention.retainUv30d ?? null,
    platform: "iOS",
    campaignId: "c",
    campaignName: "c",
    advertiserId: "",
    adGroupId: "g",
    adGroupName: "g",
    keywordId: `keyword-${fixtureId += 1}`,
    keyword: "k",
    activationCost: 0,
    registrationCost: 0,
    retentionD2: null,
    retentionD3: null,
    retentionD7: null,
    retentionD14: null,
    retentionD30: null,
    ltv: 0,
    ltvRate: 0,
    arpu: 0,
    arppu: 0,
    adImpressions: 0,
    avgAdImpressions: 0,
    adEcpm: 0,
    adFillRate: 0,
    d1PayUv: 0,
    payCost: null
  };
}

test("日期聚合按天合计整体留存并保留空值语义", () => {
  const rows = aggregateCampaignDaily([
    dailyRow("2026-09-01", { retainUv1d: 2, retainUv3d: 0, retainUv7d: null }),
    dailyRow("2026-09-01", { retainUv1d: 3, retainUv3d: 1, retainUv7d: null }),
    dailyRow("2026-08-31", { retainUv1d: 4, retainUv3d: 2, retainUv7d: 1 })
  ]);
  assert.deepEqual(rows.map((row) => row.date), ["2026-09-01", "2026-08-31"]);
  assert.equal(rows[0].retainUv1d, 5);
  assert.equal(rows[0].retainUv3d, 1);
  assert.equal(rows[0].retainUv7d, null);
});

test("整体留存按完成天数成熟，D1 不提前一天", () => {
  assert.equal(retentionDaysAvailable("2026-09-01", "2026-09-01"), 0);
  assert.equal(retentionDaysAvailable("2026-09-01", "2026-09-02"), 1);
  assert.equal(isOverallRetentionMature("retainUv1d", 0), false);
  assert.equal(isOverallRetentionMature("retainUv1d", 1), true);
  assert.equal(isOverallRetentionMature("retainUv30d", 29), false);
  assert.equal(isOverallRetentionMature("retainUv30d", 30), true);
});

test("留存百分比使用激活数作为分母，并保留无效分母为空", () => {
  assert.equal(retentionRate(25, 100), 0.25);
  assert.equal(retentionRate(0, 100), 0);
  assert.equal(retentionRate(25, 0), null);
  assert.equal(retentionRate(25, null), null);
  assert.equal(retentionRate(null, 100), null);
});

test("日期汇总映射保留留存字段的 NULL、0 和正数", () => {
  const row = mapDailySummaryRow(
    {
      day: "20260901",
      retain_uv_1d: 0,
      retain_uv_3d: 12,
      retain_uv_7d: null,
      retain_uv_14d: "",
      retain_uv_30d: 34
    },
    "all"
  );
  assert.equal(row.retainUv1d, 0);
  assert.equal(row.retainUv3d, 12);
  assert.equal(row.retainUv7d, null);
  assert.equal(row.retainUv14d, null);
  assert.equal(row.retainUv30d, 34);
});

test("iOS schema 要求 1~30 日留存字段，非 iOS 不增加要求", () => {
  const iosCheck = compareRequiredColumns("iOS", REQUIRED_SOURCE_COLUMNS);
  assert.equal(iosCheck.ok, true);
  assert.deepEqual(iosCheck.missing, []);
  assert.equal(compareRequiredColumns("HarmonyOS", HARMONY_REQUIRED_SOURCE_COLUMNS).ok, true);
  assert.equal(compareRequiredColumns("Xiaohongshu", XHS_REQUIRED_SOURCE_COLUMNS).ok, true);
});
