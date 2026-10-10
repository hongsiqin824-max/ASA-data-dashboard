import { COMPACT_ROI_DAYS, roiWindowDays, type RoiWindowKey } from "./roi-maturity";
import type { ExtendedRoiFields } from "./types";

// 全部 ROI 档位，按天数升序。直接从 roiWindowDays 派生，
// 保证「展示哪些列」和「成熟度判断哪些档」永远同源。
export const ROI_COLUMN_DAYS: number[] = Object.values(roiWindowDays)
  .slice()
  .sort((a, b) => a - b);

export type RoiColumn = {
  day: number;
  key: RoiWindowKey;
  /** 紧凑写法，如 D30 */
  label: string;
  /** 中文写法，如 30日ROI */
  labelCn: string;
};

function column(day: number): RoiColumn {
  return {
    day,
    key: `d${day}Roi` as RoiWindowKey,
    label: `D${day}`,
    labelCn: `${day}日ROI`
  };
}

/** 全部 24 档，展开后或明细页用。 */
export function allRoiColumns(): RoiColumn[] {
  return ROI_COLUMN_DAYS.map(column);
}

/** 列表页默认档位。 */
export function compactRoiColumns(): RoiColumn[] {
  return COMPACT_ROI_DAYS.map(column);
}

/** showAll 为真时给全量档位，否则给精简档位。 */
export function roiColumns(showAll: boolean): RoiColumn[] {
  return showAll ? allRoiColumns() : compactRoiColumns();
}

/**
 * 数仓只为 40~180 档提供算好的 roi_Nd，没有 revenue 明细，
 * 因此这些档位无法按「仅付费 / 仅广告」口径拆分。
 */
export function isSplitRevenueWindow(day: number): boolean {
  return day <= 30 || day === 60;
}

/** 40 日及以上、只有 roi_Nd 的档位。 */
export const EXTENDED_ROI_DAYS: number[] = ROI_COLUMN_DAYS.filter(
  (day) => !isSplitRevenueWindow(day)
);

export const EXTENDED_ROI_KEYS = EXTENDED_ROI_DAYS.map(
  (day) => `d${day}Roi` as keyof ExtendedRoiFields
);

/** 40 日及以上档位的列定义，列表页收起、详情页展开时追加在 D60 之后。 */
export function extendedRoiColumns(): RoiColumn[] {
  return EXTENDED_ROI_DAYS.map(column);
}

/** 原样取出 40 日及以上档位，用于行与行之间的字段透传。 */
export function pickExtendedRoi(source: ExtendedRoiFields): ExtendedRoiFields {
  const fields: Record<string, number | null> = {};
  for (const key of EXTENDED_ROI_KEYS) {
    fields[key] = source[key];
  }
  return fields as ExtendedRoiFields;
}

/**
 * 按成本加权还原 40 日及以上档位的 ROI：Σ(roi×cost) / Σ(cost)。
 * 只累计该档位有值的行；某档位全部为 null 时结果也是 null，
 * 避免把「没有数据」算成 0。
 */
export function aggregateExtendedRoi<T extends ExtendedRoiFields>(
  rows: T[],
  cost: (row: T) => number
): ExtendedRoiFields {
  const fields: Record<string, number | null> = {};
  for (const key of EXTENDED_ROI_KEYS) {
    let weighted = 0;
    let costSum = 0;
    let hasValue = false;
    for (const row of rows) {
      const value = row[key];
      if (value === null || value === undefined) continue;
      hasValue = true;
      const rowCost = cost(row);
      weighted += value * rowCost;
      costSum += rowCost;
    }
    if (!hasValue) fields[key] = null;
    else fields[key] = costSum > 0 ? Math.round((weighted / costSum) * 1e4) / 1e4 : 0;
  }
  return fields as ExtendedRoiFields;
}
