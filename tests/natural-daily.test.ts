import assert from "node:assert/strict";
import test from "node:test";
import {
  compareIosNaturalRequiredColumns,
  IOS_NATURAL_REQUIRED_SOURCE_COLUMNS
} from "../server/platform-schema";
import { mapNaturalDailyRow } from "../server/starrocks";
import {
  buildNaturalCompareRows,
  NATURAL_RETENTION_COLUMNS,
  naturalRetentionRate,
  naturalShare,
  naturalSummaryRetentionRate,
  summarizeNaturalCompareRows
} from "../src/lib/natural-daily";
import { overallRetentionDays } from "../src/lib/retention-maturity";
import type { DailyCampaignRow, NaturalDailyRow } from "../src/lib/types";

function naturalRow(overrides: Partial<NaturalDailyRow> = {}): NaturalDailyRow {
  return {
    date: "2026-10-20",
    activations: 1000,
    registrations: 250,
    retainUv1d: 400,
    retainUv3d: 300,
    retainUv7d: 0,
    retainUv14d: 0,
    retainUv30d: 0,
    retainUv60d: 0,
    retainUv90d: 0,
    retainUv180d: 0,
    ...overrides
  };
}

test("自然量表必需列自洽，且不包含 ASA 专属的消耗/收益/关键词列", () => {
  const result = compareIosNaturalRequiredColumns(IOS_NATURAL_REQUIRED_SOURCE_COLUMNS);
  assert.equal(result.ok, true);
  assert.deepEqual(result.missing, []);
  assert.equal(IOS_NATURAL_REQUIRED_SOURCE_COLUMNS.includes("new_user_cnt"), true);
  assert.equal(IOS_NATURAL_REQUIRED_SOURCE_COLUMNS.includes("retain_uv_180d"), true);
  assert.equal(
    (IOS_NATURAL_REQUIRED_SOURCE_COLUMNS as readonly string[]).includes("spend"),
    false
  );
  assert.equal(
    (IOS_NATURAL_REQUIRED_SOURCE_COLUMNS as readonly string[]).includes("keyword_id"),
    false
  );
});

test("缺少留存列时自然量表结构检查失败", () => {
  const result = compareIosNaturalRequiredColumns([
    "day",
    "report_date",
    "new_user_cnt",
    "new_register_cnt"
  ]);
  assert.equal(result.ok, false);
  assert.ok(result.missing.includes("retain_uv_1d"));
});

test("自然量留存档位与列表页精简档位同源", () => {
  assert.deepEqual(
    NATURAL_RETENTION_COLUMNS.map((col) => col.day),
    Object.values(overallRetentionDays).slice().sort((a, b) => a - b)
  );
  assert.equal(NATURAL_RETENTION_COLUMNS[0].label, "次日留存");
});

test("数仓行映射：日期用 report_date，留存保留 0 与 NULL 的区别", () => {
  const row = mapNaturalDailyRow({
    day: "20261020",
    report_date: "2026-10-20",
    new_user_cnt: "3067",
    new_register_cnt: 748,
    retain_uv_1d: 1706,
    retain_uv_3d: 0,
    retain_uv_7d: null,
    retain_uv_14d: "",
    retain_uv_30d: 0,
    retain_uv_60d: 0,
    retain_uv_90d: 0,
    retain_uv_180d: 0
  });
  assert.equal(row.date, "2026-10-20");
  assert.equal(row.activations, 3067);
  assert.equal(row.registrations, 748);
  assert.equal(row.retainUv1d, 1706);
  assert.equal(row.retainUv3d, 0);
  assert.equal(row.retainUv7d, null);
  assert.equal(row.retainUv14d, null);
});

test("未到期留存窗口数仓返回 0，不能当真实留存显示", () => {
  const row = naturalRow({ date: "2026-10-20", retainUv7d: 0 });
  // 最新数据日 10-23：D1/D3 已成熟，D7 未到期
  assert.equal(naturalRetentionRate(row, "retainUv1d", "2026-10-23"), 0.4);
  assert.equal(naturalRetentionRate(row, "retainUv3d", "2026-10-23"), 0.3);
  assert.equal(naturalRetentionRate(row, "retainUv7d", "2026-10-23"), null);
  // 拿不到最新数据日时一律视为未成熟
  assert.equal(naturalRetentionRate(row, "retainUv1d", null), null);
});

test("自然量占比 = 自然 / (自然 + ASA)，ASA 缺失时为 null 而非 0", () => {
  assert.equal(naturalShare(3000, 1000), 0.75);
  assert.equal(naturalShare(0, 0), null);
  assert.equal(naturalShare(3000, null), null);
});

test("对照行按日期匹配同日 ASA 激活/注册，无 ASA 行的日期保留为 null", () => {
  // dailySummaryRows.date 真实格式是 YYYYMMDD，自然量行是 YYYY-MM-DD，必须能对上
  const asa = [
    { date: "20261020", activations: 1000, registrations: 300 },
    { date: "20261021", activations: 500, registrations: 100 }
  ] as DailyCampaignRow[];
  const rows = buildNaturalCompareRows(
    [
      naturalRow({ date: "2026-10-20", activations: 3000 }),
      naturalRow({ date: "2026-10-22", activations: 2000 })
    ],
    asa
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].asaActivations, 1000);
  assert.equal(rows[0].asaRegistrations, 300);
  assert.equal(rows[0].naturalShare, 0.75);
  assert.equal(rows[1].asaActivations, null);
  assert.equal(rows[1].asaRegistrations, null);
  assert.equal(rows[1].naturalShare, null);
});

test("汇总行累加激活/注册/留存，并按最早一天判断留存成熟度", () => {
  const rows = buildNaturalCompareRows(
    [
      naturalRow({ date: "2026-10-16", activations: 1000, retainUv1d: 400, retainUv7d: 200 }),
      naturalRow({ date: "2026-10-20", activations: 1000, retainUv1d: 500, retainUv7d: 0 })
    ],
    [{ date: "2026-10-16", activations: 400, registrations: 50 }] as DailyCampaignRow[]
  );
  const summary = summarizeNaturalCompareRows(rows);
  assert.equal(summary.dayCount, 2);
  assert.equal(summary.activations, 2000);
  assert.equal(summary.registrations, 500);
  assert.equal(summary.retainUv1d, 900);
  // ASA 只有一天有值，汇总只累加有值的天
  assert.equal(summary.asaActivations, 400);
  // 最新数据日 10-23：10-20 那天 D7 未到期 → 汇总 D7 整列不显示；D1 两天都到期
  assert.equal(naturalSummaryRetentionRate(rows, summary, "retainUv1d", "2026-10-23"), 0.45);
  assert.equal(naturalSummaryRetentionRate(rows, summary, "retainUv7d", "2026-10-23"), null);
});
