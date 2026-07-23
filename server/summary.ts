import type { KeywordRow } from "./types";
import { round } from "./shared";

export function computeSummary(list: KeywordRow[]) {
  const summary = list.reduce(
    (acc, row) => {
      acc.impressions += row.impressions;
      acc.taps += row.taps;
      acc.tapInstalls += row.tapInstalls;
      acc.tapNewDownloads += row.tapNewDownloads;
      acc.tapRedownloads += row.tapRedownloads;
      acc.installs += row.installs;
      acc.totalNewDownloads += row.totalNewDownloads;
      acc.totalRedownloads += row.totalRedownloads;
      acc.activations += row.activations;
      acc.cost += row.cost;
      acc.adRevenue += row.adRevenue;
      acc.vipRevenue += row.vipRevenue;
      acc.rechargeRevenue += row.rechargeRevenue;
      acc.payRevenue += row.payRevenue;
      acc.totalRevenue += row.totalRevenue;
      return acc;
    },
    {
      impressions: 0,
      taps: 0,
      tapInstalls: 0,
      tapNewDownloads: 0,
      tapRedownloads: 0,
      installs: 0,
      totalNewDownloads: 0,
      totalRedownloads: 0,
      activations: 0,
      cost: 0,
      adRevenue: 0,
      vipRevenue: 0,
      rechargeRevenue: 0,
      payRevenue: 0,
      totalRevenue: 0
    }
  );

  return {
    ...summary,
    cost: round(summary.cost),
    adRevenue: round(summary.adRevenue),
    vipRevenue: round(summary.vipRevenue),
    rechargeRevenue: round(summary.rechargeRevenue),
    payRevenue: round(summary.payRevenue),
    totalRevenue: round(summary.totalRevenue),
    ttr: summary.impressions > 0 ? round(summary.taps / summary.impressions, 6) : 0,
    roi: summary.cost > 0 ? round(summary.totalRevenue / summary.cost, 4) : 0,
    cpa: summary.installs > 0 ? round(summary.cost / summary.installs) : 0,
    activationRate:
      summary.installs > 0 ? round(summary.activations / summary.installs, 4) : 0
  };
}
