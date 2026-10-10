import { overallRetentionDays } from "./retention-maturity";
import type { RetainUvFields } from "./types";

// 数仓建的留存档位：1~30 日逐日，之后按 10 日步长到 180 日。
export const RETENTION_COLUMN_DAYS: number[] = [
  ...Array.from({ length: 30 }, (_, index) => index + 1),
  ...Array.from({ length: 15 }, (_, index) => 40 + index * 10)
];

export type RetentionColumn = {
  day: number;
  key: keyof RetainUvFields;
  label: string;
};

function column(day: number, prefix: string): RetentionColumn {
  // 日期汇总表用中文口径（prefix 为空）：第 1 天习惯叫“次日留存”，其余为“N日留存”。
  const label =
    prefix === "" ? (day === 1 ? "次日留存" : `${day}日留存`) : `${prefix}${day}留存`;
  return {
    day,
    key: `retainUv${day}d` as keyof RetainUvFields,
    label
  };
}

/** 全部 45 档，明细页用（横向可滚动）。 */
export function allRetentionColumns(prefix = "D"): RetentionColumn[] {
  return RETENTION_COLUMN_DAYS.map((day) => column(day, prefix));
}

/**
 * 列表页用的精简档位。取 overallRetentionDays 里声明的那几档，
 * 保证“列表页展示哪些档”和“成熟度判断用哪些档”始终同源。
 */
export function compactRetentionColumns(prefix = "D"): RetentionColumn[] {
  return Object.values(overallRetentionDays)
    .slice()
    .sort((a, b) => a - b)
    .map((day) => column(day, prefix));
}

/** showAll 为真时给全量档位，否则给精简档位。 */
export function retentionColumns(showAll: boolean, prefix = "D"): RetentionColumn[] {
  return showAll ? allRetentionColumns(prefix) : compactRetentionColumns(prefix);
}
