const DAY_MS = 24 * 60 * 60 * 1000;

export const overallRetentionDays = {
  retainUv1d: 1,
  retainUv3d: 3,
  retainUv7d: 7,
  retainUv14d: 14,
  retainUv30d: 30,
  retainUv60d: 60,
  retainUv90d: 90,
  retainUv180d: 180
} as const;

export type OverallRetentionKey = keyof typeof overallRetentionDays;

function parseDateMs(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-?(\d{2})-?(\d{2})$/);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Returns the number of completed days after the cohort date. */
export function retentionDaysAvailable(
  cohortDate: string | null | undefined,
  latestDate: string | null | undefined
) {
  const cohortMs = parseDateMs(cohortDate);
  const latestMs = parseDateMs(latestDate);
  if (cohortMs === null || latestMs === null) return null;
  return Math.max(0, Math.floor((latestMs - cohortMs) / DAY_MS));
}

/**
 * 从 retainUvNd 解析出该窗口需要的天数。
 * overallRetentionDays 只声明了列表页展示的档位，明细页会展开全部档位（含 2、40、50、70 日等），
 * 这些档位同样要参与成熟度判断，否则会被当成「已成熟」而直接显示未到期的数据。
 * 返回 null 表示传入的不是留存字段，不参与判断。
 */
function retentionWindowDay(key: string): number | null {
  const declared = overallRetentionDays[key as OverallRetentionKey];
  if (declared !== undefined) return declared;
  const match = key.match(/^retainUv(\d+)d$/);
  return match ? Number(match[1]) : null;
}

export function isOverallRetentionMature(
  key: string,
  availableDays: number | null
) {
  const required = retentionWindowDay(key);
  if (required === null) return true;
  return availableDays !== null && availableDays >= required;
}

/**
 * Returns retention as a fraction of activations. The留存设备数 (retainUvNd)
 * counts retained devices from the activated-device cohort (激活/new_user_cnt),
 * so activations is the correct denominator; using registrations (a subset of
 * activations) inflates the rate above 100%. A null result means the retention
 * value is unavailable or there is no valid activation denominator.
 */
export function retentionRate(
  retainedUsers: number | null | undefined,
  activations: number | null | undefined
) {
  if (
    retainedUsers === null ||
    retainedUsers === undefined ||
    activations === null ||
    activations === undefined ||
    activations <= 0
  ) {
    return null;
  }
  return retainedUsers / activations;
}
