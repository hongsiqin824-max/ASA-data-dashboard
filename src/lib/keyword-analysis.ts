import type { DailyKeywordRow, KeywordRow } from "./types";

export type KeywordSort = "impact" | "cost" | "roi" | "activationCost" | "registrationCost";

export type KeywordAnalysisRow = KeywordRow & {
  firstDate: string | null;
  lastDate: string | null;
  activeDays: number;
  activationCost: number | null;
  registrationCost: number | null;
};

export type KeywordTableSummary = {
  keywordCount: number;
  impressions: number;
  taps: number;
  ttr: number;
  tapInstalls: number;
  tapNewDownloads: number;
  tapRedownloads: number;
  cost: number;
  installs: number;
  totalNewDownloads: number;
  totalRedownloads: number;
  activations: number;
  registrations: number;
  activationCost: number | null;
  registrationCost: number | null;
  adRevenue: number;
  vipRevenue: number;
  rechargeRevenue: number;
  payRevenue: number;
  totalRevenue: number;
  roi: number;
  d1Roi: number;
  d2Roi: number;
  d3Roi: number;
  d4Roi: number;
  d5Roi: number;
  d6Roi: number;
  d7Roi: number;
  d15Roi: number;
  d30Roi: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function rowKey(row: Pick<KeywordRow, "campaignId" | "adGroupId" | "keywordId">) {
  return `${row.campaignId}\u0000${row.adGroupId}\u0000${row.keywordId}`;
}

function sourceDateToTime(value: string | null | undefined) {
  if (!value) return null;
  const compact = /^\d{8}$/.test(value) ? value : value.replace(/-/g, "");
  if (!/^\d{8}$/.test(compact)) return null;
  const year = Number(compact.slice(0, 4));
  const month = Number(compact.slice(4, 6)) - 1;
  const day = Number(compact.slice(6, 8));
  const time = Date.UTC(year, month, day);
  return Number.isNaN(time) ? null : time;
}

function formatCompactDate(time: number | null) {
  if (time === null) return null;
  const date = new Date(time);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDailyMeta(dailyRows: DailyKeywordRow[]) {
  const groups = new Map<string, { first: number | null; last: number | null; days: Set<string> }>();

  dailyRows.forEach((row) => {
    const key = rowKey(row);
    const current = groups.get(key) ?? {
      first: null,
      last: null,
      days: new Set<string>()
    };
    if (row.cost > 0 || row.installs > 0 || row.activations > 0 || row.registrations > 0) {
      current.days.add(row.date);
      const time = sourceDateToTime(row.date);
      if (time !== null) {
        current.first = current.first === null ? time : Math.min(current.first, time);
        current.last = current.last === null ? time : Math.max(current.last, time);
      }
    }
    groups.set(key, current);
  });

  return groups;
}

function inferActiveDays(row: KeywordRow, first: number | null, last: number | null, dayCount: number) {
  const sourceActiveDays = Number(row.activeDays);
  if (Number.isFinite(sourceActiveDays) && sourceActiveDays > 0) {
    return Math.max(dayCount, Math.floor(sourceActiveDays));
  }
  if (dayCount > 0) return dayCount;
  if (first !== null && last !== null) {
    return Math.max(1, Math.floor((last - first) / MS_PER_DAY) + 1);
  }
  if (row.cost > 0 || row.installs > 0 || row.activations > 0) return 1;
  return 0;
}

export function analyzeKeywordRows(
  rows: KeywordRow[],
  dailyRows: DailyKeywordRow[]
): KeywordAnalysisRow[] {
  const meta = buildDailyMeta(dailyRows);

  return rows.map((row) => {
    const group = meta.get(rowKey(row));
    const sourceFirst = sourceDateToTime(row.firstDate);
    const sourceLast = sourceDateToTime(row.lastDate);
    const first = sourceFirst ?? group?.first ?? null;
    const last = sourceLast ?? group?.last ?? null;
    const activeDays = inferActiveDays(row, first, last, group?.days.size ?? 0);

    return {
      ...row,
      firstDate: formatCompactDate(first),
      lastDate: formatCompactDate(last),
      activeDays,
      activationCost: row.activations > 0 ? row.cost / row.activations : null,
      registrationCost: row.registrations > 0 ? row.cost / row.registrations : null
    };
  });
}

export function compareKeywordRows(
  a: KeywordAnalysisRow,
  b: KeywordAnalysisRow,
  sort: KeywordSort
): number {
  if (sort === "cost") return b.cost - a.cost || compareKeywordRows(a, b, "roi");
  if (sort === "roi") {
    return b.roi - a.roi || b.cost - a.cost;
  }
  if (sort === "activationCost") {
    const left = a.activationCost ?? Number.POSITIVE_INFINITY;
    const right = b.activationCost ?? Number.POSITIVE_INFINITY;
    return left - right || b.cost - a.cost;
  }
  if (sort === "registrationCost") {
    const left = a.registrationCost ?? Number.POSITIVE_INFINITY;
    const right = b.registrationCost ?? Number.POSITIVE_INFINITY;
    return left - right || b.cost - a.cost;
  }

  return b.cost - a.cost || b.roi - a.roi;
}

export function summarizeKeywordRows(rows: KeywordAnalysisRow[]): KeywordTableSummary {
  const sum = (pick: (row: KeywordAnalysisRow) => number) =>
    rows.reduce((total, row) => total + pick(row), 0);
  const cost = sum((row) => row.cost);
  const impressions = sum((row) => row.impressions);
  const taps = sum((row) => row.taps);
  const installs = sum((row) => row.installs);
  const activations = sum((row) => row.activations);
  const registrations = sum((row) => row.registrations);
  const adRevenue = sum((row) => row.adRevenue);
  const vipRevenue = sum((row) => row.vipRevenue);
  const rechargeRevenue = sum((row) => row.rechargeRevenue);
  const payRevenue = sum((row) => row.payRevenue);
  const totalRevenue = sum((row) => row.totalRevenue);
  const weightedRoi = (pick: (row: KeywordAnalysisRow) => number) =>
    cost > 0 ? rows.reduce((total, row) => total + pick(row) * row.cost, 0) / cost : 0;

  return {
    keywordCount: rows.length,
    impressions,
    taps,
    ttr: impressions > 0 ? taps / impressions : 0,
    tapInstalls: sum((row) => row.tapInstalls),
    tapNewDownloads: sum((row) => row.tapNewDownloads),
    tapRedownloads: sum((row) => row.tapRedownloads),
    cost,
    installs,
    totalNewDownloads: sum((row) => row.totalNewDownloads),
    totalRedownloads: sum((row) => row.totalRedownloads),
    activations,
    registrations,
    activationCost: activations > 0 ? cost / activations : null,
    registrationCost: registrations > 0 ? cost / registrations : null,
    adRevenue,
    vipRevenue,
    rechargeRevenue,
    payRevenue,
    totalRevenue,
    roi: cost > 0 ? totalRevenue / cost : 0,
    d1Roi: weightedRoi((row) => row.d1Roi),
    d2Roi: weightedRoi((row) => row.d2Roi),
    d3Roi: weightedRoi((row) => row.d3Roi),
    d4Roi: weightedRoi((row) => row.d4Roi),
    d5Roi: weightedRoi((row) => row.d5Roi),
    d6Roi: weightedRoi((row) => row.d6Roi),
    d7Roi: weightedRoi((row) => row.d7Roi),
    d15Roi: weightedRoi((row) => row.d15Roi),
    d30Roi: weightedRoi((row) => row.d30Roi)
  };
}
