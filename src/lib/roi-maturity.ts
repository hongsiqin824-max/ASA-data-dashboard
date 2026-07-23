const DAY_MS = 24 * 60 * 60 * 1000;

export const roiWindowDays = {
  d1Roi: 1,
  d2Roi: 2,
  d3Roi: 3,
  d4Roi: 4,
  d5Roi: 5,
  d6Roi: 6,
  d7Roi: 7,
  d15Roi: 15,
  d30Roi: 30
} as const;

export type RoiWindowKey = keyof typeof roiWindowDays;

export function parseRoiDateMs(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-?(\d{2})-?(\d{2})$/);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function latestRoiDateMs(values: Array<string | null | undefined>) {
  return values.reduce<number | null>((latest, value) => {
    const current = parseRoiDateMs(value);
    if (current === null) return latest;
    return latest === null || current > latest ? current : latest;
  }, null);
}

export function roiDaysAvailable(
  lastActiveDate: string | null | undefined,
  latestDateMs: number | null
) {
  const lastActiveMs = parseRoiDateMs(lastActiveDate);
  if (lastActiveMs === null || latestDateMs === null) return null;
  return Math.max(0, Math.floor((latestDateMs - lastActiveMs) / DAY_MS) + 1);
}

export function isRoiWindowMature(
  key: string,
  availableDays: number | null
) {
  const requiredDays = roiWindowDays[key as RoiWindowKey];
  if (requiredDays === undefined) return true;
  return availableDays !== null && availableDays >= requiredDays;
}

export function minimumRoiDaysAvailable(
  dates: Array<string | null | undefined>,
  latestDateMs: number | null
) {
  const available = dates
    .map((date) => roiDaysAvailable(date, latestDateMs))
    .filter((days): days is number => days !== null);
  return available.length > 0 ? Math.min(...available) : null;
}
