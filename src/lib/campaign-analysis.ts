import type { CampaignRow } from "./types";

export type CampaignSort =
  | "impact"
  | "cost"
  | "roiHigh"
  | "roiLow"
  | "totalRevenue"
  | "adRevenue"
  | "payRevenue"
  | "ttr"
  | "activationCost"
  | "registrationCost";

export type CampaignScaleFilter =
  | "all"
  | "highCost"
  | "spentNoRevenue"
  | "clickLowActivation";

export type CampaignTableSummary = {
  campaignCount: number;
  adGroupCount: number;
  keywordCount: number;
  impressions: number;
  taps: number;
  ttr: number;
  tapInstalls: number;
  tapNewDownloads: number;
  tapRedownloads: number;
  installs: number;
  totalNewDownloads: number;
  totalRedownloads: number;
  activations: number;
  registrations: number;
  cost: number;
  totalPayUv: number;
  paymentRate: number;
  adRevenue: number;
  vipRevenue: number;
  rechargeRevenue: number;
  payRevenue: number;
  totalRevenue: number;
  roi: number;
  d1Roi: number;
  d3Roi: number;
  d7Roi: number;
  d15Roi: number;
  d30Roi: number;
};

function activationCost(row: CampaignRow) {
  return row.activations > 0 ? row.cost / row.activations : null;
}

function registrationCost(row: CampaignRow) {
  return row.registrations > 0 ? row.cost / row.registrations : null;
}

function nullableAsc(left: number | null, right: number | null) {
  const leftMissing = left === null;
  const rightMissing = right === null;
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;
  return left - right;
}

function clickActivationRate(row: CampaignRow) {
  return row.taps > 0 ? row.activations / row.taps : 0;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

export function compareCampaignRows(
  left: CampaignRow,
  right: CampaignRow,
  sort: CampaignSort
) {
  if (sort === "cost") return right.cost - left.cost || right.roi - left.roi;
  if (sort === "roiHigh") return right.roi - left.roi || right.cost - left.cost;
  if (sort === "roiLow") return left.roi - right.roi || right.cost - left.cost;
  if (sort === "totalRevenue") {
    return right.totalRevenue - left.totalRevenue || right.cost - left.cost;
  }
  if (sort === "adRevenue") return right.adRevenue - left.adRevenue || right.cost - left.cost;
  if (sort === "payRevenue") {
    return right.payRevenue - left.payRevenue || right.cost - left.cost;
  }
  if (sort === "ttr") return right.ttr - left.ttr || right.cost - left.cost;
  if (sort === "activationCost") {
    return nullableAsc(activationCost(left), activationCost(right)) || right.cost - left.cost;
  }
  if (sort === "registrationCost") {
    return nullableAsc(registrationCost(left), registrationCost(right)) || right.cost - left.cost;
  }

  return right.cost - left.cost || right.roi - left.roi;
}

export function filterCampaignRowsByScale(
  rows: CampaignRow[],
  filter: CampaignScaleFilter
) {
  if (filter === "all") return rows;

  if (filter === "highCost") {
    const rankedCosts = rows.map((row) => row.cost).sort((a, b) => b - a);
    const topCount = Math.max(1, Math.ceil(rankedCosts.length * 0.2));
    const threshold = rankedCosts[topCount - 1] ?? Number.POSITIVE_INFINITY;
    return rows.filter((row) => row.cost >= threshold && row.cost > 0);
  }

  if (filter === "spentNoRevenue") {
    return rows.filter((row) => row.cost > 0 && row.totalRevenue <= 0);
  }

  const activeRates = rows
    .filter((row) => row.taps > 0)
    .map((row) => clickActivationRate(row));
  const rateMedian = median(activeRates);
  return rows.filter(
    (row) => row.taps > 0 && clickActivationRate(row) < rateMedian
  );
}

export function summarizeCampaignRows(rows: CampaignRow[]): CampaignTableSummary {
  const sum = (pick: (row: CampaignRow) => number) =>
    rows.reduce((total, row) => total + pick(row), 0);
  const cost = sum((row) => row.cost);
  const impressions = sum((row) => row.impressions);
  const taps = sum((row) => row.taps);
  const installs = sum((row) => row.installs);
  const totalPayUv = sum((row) => row.totalPayUv);
  const totalRevenue = sum((row) => row.totalRevenue);
  const weightedRoi = (pick: (row: CampaignRow) => number) =>
    cost > 0 ? rows.reduce((total, row) => total + pick(row) * row.cost, 0) / cost : 0;

  return {
    campaignCount: rows.length,
    adGroupCount: sum((row) => row.adGroupCount),
    keywordCount: sum((row) => row.keywordCount),
    impressions,
    taps,
    ttr: impressions > 0 ? taps / impressions : 0,
    tapInstalls: sum((row) => row.tapInstalls),
    tapNewDownloads: sum((row) => row.tapNewDownloads),
    tapRedownloads: sum((row) => row.tapRedownloads),
    installs,
    totalNewDownloads: sum((row) => row.totalNewDownloads),
    totalRedownloads: sum((row) => row.totalRedownloads),
    activations: sum((row) => row.activations),
    registrations: sum((row) => row.registrations),
    cost,
    totalPayUv,
    paymentRate: installs > 0 ? totalPayUv / installs : 0,
    adRevenue: sum((row) => row.adRevenue),
    vipRevenue: sum((row) => row.vipRevenue),
    rechargeRevenue: sum((row) => row.rechargeRevenue),
    payRevenue: sum((row) => row.payRevenue),
    totalRevenue,
    roi: cost > 0 ? totalRevenue / cost : 0,
    d1Roi: weightedRoi((row) => row.d1Roi),
    d3Roi: weightedRoi((row) => row.d3Roi),
    d7Roi: weightedRoi((row) => row.d7Roi),
    d15Roi: weightedRoi((row) => row.d15Roi),
    d30Roi: weightedRoi((row) => row.d30Roi)
  };
}
