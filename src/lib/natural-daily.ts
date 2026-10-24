import { compactRetentionColumns, type RetentionColumn } from "./retention-columns";
import {
  isOverallRetentionMature,
  retentionDaysAvailable,
  retentionRate
} from "./retention-maturity";
import type { NaturalDailyRow } from "./types";

// 自然量表只建了这 8 档留存，恰好等于列表页的精简档位（overallRetentionDays）。
export const NATURAL_RETENTION_COLUMNS: RetentionColumn[] = compactRetentionColumns("");

export type NaturalRetentionKey = (typeof NATURAL_RETENTION_COLUMNS)[number]["key"] &
  keyof NaturalDailyRow;

// 自然量 × ASA 同日对照行。ASA 列由服务端按「全量」按天汇总附带（见 server/starrocks.ts fetchNaturalDaily），
// 不随关键词/计划/广告组/ROI 分层筛选变化；asaActivations 为 null 表示 ASA 当日无行，不要当 0。
export type NaturalCompareRow = NaturalDailyRow & {
  // 自然量激活 / (自然量 + ASA 激活)；ASA 缺失时为 null。
  naturalShare: number | null;
};

export type NaturalCompareSummary = Omit<NaturalCompareRow, "date"> & {
  dayCount: number;
};

function nullableSum(values: Array<number | null>) {
  let total = 0;
  let hasValue = false;
  values.forEach((value) => {
    if (value === null) return;
    total += value;
    hasValue = true;
  });
  return hasValue ? total : null;
}

export function naturalShare(
  natural: number,
  asa: number | null
): number | null {
  if (asa === null) return null;
  const total = natural + asa;
  return total > 0 ? natural / total : null;
}

export function buildNaturalCompareRows(
  naturalRows: NaturalDailyRow[]
): NaturalCompareRow[] {
  return naturalRows.map((row) => ({
    ...row,
    naturalShare: naturalShare(row.activations, row.asaActivations)
  }));
}

export function summarizeNaturalCompareRows(
  rows: NaturalCompareRow[]
): NaturalCompareSummary {
  const activations = rows.reduce((total, row) => total + row.activations, 0);
  const asaActivations = nullableSum(rows.map((row) => row.asaActivations));
  return {
    dayCount: rows.length,
    activations,
    registrations: rows.reduce((total, row) => total + row.registrations, 0),
    asaActivations,
    asaRegistrations: nullableSum(rows.map((row) => row.asaRegistrations)),
    naturalShare: naturalShare(activations, asaActivations),
    retainUv1d: nullableSum(rows.map((row) => row.retainUv1d)),
    retainUv3d: nullableSum(rows.map((row) => row.retainUv3d)),
    retainUv7d: nullableSum(rows.map((row) => row.retainUv7d)),
    retainUv14d: nullableSum(rows.map((row) => row.retainUv14d)),
    retainUv30d: nullableSum(rows.map((row) => row.retainUv30d)),
    retainUv60d: nullableSum(rows.map((row) => row.retainUv60d)),
    retainUv90d: nullableSum(rows.map((row) => row.retainUv90d)),
    retainUv180d: nullableSum(rows.map((row) => row.retainUv180d))
  };
}

/**
 * 自然量留存成熟度用自然量表自身的最新数据日判断。两张表都是 T-1，
 * 但产出时间可能不同；拿不到自然量 as-of 时退回 ASA 的 dataAsOfDate。
 * 返回 null 表示该窗口未到期（数仓里是 0，不能当真实留存显示）。
 */
export function naturalRetentionRate(
  row: Pick<NaturalDailyRow, "date" | "activations"> & Partial<NaturalDailyRow>,
  key: NaturalRetentionKey,
  latestDate: string | null | undefined
): number | null {
  const available = retentionDaysAvailable(row.date, latestDate);
  if (!isOverallRetentionMature(key, available)) return null;
  return retentionRate(row[key], row.activations);
}

/** 汇总行：取区间内各天可用天数的最小值，任一天未到期则整列未到期。 */
export function naturalSummaryRetentionRate(
  rows: NaturalCompareRow[],
  summary: NaturalCompareSummary,
  key: NaturalRetentionKey,
  latestDate: string | null | undefined
): number | null {
  const available = rows
    .map((row) => retentionDaysAvailable(row.date, latestDate))
    .filter((days): days is number => days !== null);
  const minAvailable = available.length > 0 ? Math.min(...available) : null;
  if (!isOverallRetentionMature(key, minAvailable)) return null;
  return retentionRate(summary[key], summary.activations);
}
