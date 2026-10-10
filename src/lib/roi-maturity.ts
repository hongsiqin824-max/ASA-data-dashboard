const DAY_MS = 24 * 60 * 60 * 1000;

// 数仓建的 ROI 档位：1~7 日逐日，之后 15、30，再按 10 日步长到 180 日
// （没有 8~14、16~29 等中间天，31~39 也没有）。
// 这里必须列全所有档位：isRoiWindowMature 对未声明的 key 会直接放行，
// 漏了就会把「窗口还没到期」的 0 当成真实 ROI 显示出去。
export const roiWindowDays = {
  d1Roi: 1,
  d2Roi: 2,
  d3Roi: 3,
  d4Roi: 4,
  d5Roi: 5,
  d6Roi: 6,
  d7Roi: 7,
  d15Roi: 15,
  d30Roi: 30,
  d40Roi: 40,
  d50Roi: 50,
  d60Roi: 60,
  d70Roi: 70,
  d80Roi: 80,
  d90Roi: 90,
  d100Roi: 100,
  d110Roi: 110,
  d120Roi: 120,
  d130Roi: 130,
  d140Roi: 140,
  d150Roi: 150,
  d160Roi: 160,
  d170Roi: 170,
  d180Roi: 180
} as const;

// 列表页默认展示的精简档位，其余档位在「展开」后才出现。
export const COMPACT_ROI_DAYS = [1, 2, 3, 4, 5, 6, 7, 15, 30, 60] as const;

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
