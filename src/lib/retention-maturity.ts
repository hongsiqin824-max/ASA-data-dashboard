const DAY_MS = 24 * 60 * 60 * 1000;

export const overallRetentionDays = {
  retainUv1d: 1,
  retainUv3d: 3,
  retainUv7d: 7,
  retainUv14d: 14,
  retainUv30d: 30
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

export function isOverallRetentionMature(
  key: string,
  availableDays: number | null
) {
  const required = overallRetentionDays[key as OverallRetentionKey];
  return required === undefined || (availableDays !== null && availableDays >= required);
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
