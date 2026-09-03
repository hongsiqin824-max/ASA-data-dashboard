import type { DailyKeywordRow, KeywordRow, KeywordStatus } from "./types";

function round(value: number, digits = 2) {
  const base = 10 ** digits;
  return Math.round(value * base) / base;
}

function dashedDate(value: string) {
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  return value;
}

function statusFromRoi(roi: number): KeywordStatus {
  if (roi >= 1) return "scaling";
  if (roi >= 0.3) return "observe";
  return "pause";
}

export function dailyKeywordRowsToKeywordRows(
  rows: DailyKeywordRow[],
  fallbackDate: string
): KeywordRow[] {
  return rows.map((row) => {
    const date = dashedDate(row.date || fallbackDate);
    const cpt = row.taps > 0 ? round(row.cost / row.taps) : 0;
    const cpa = row.installs > 0 ? round(row.cost / row.installs) : 0;

    return {
      dateRange: date,
      firstDate: date,
      lastDate: date,
      activeDays: row.cost > 0 || row.installs > 0 || row.activations > 0 ? 1 : 0,
      campaignId: row.campaignId,
      campaignName: row.campaignName,
      adGroupId: row.adGroupId,
      adGroupName: row.adGroupName,
      keywordId: row.keywordId,
      keyword: row.keyword,
      matchType: "broad",
      platform: row.platform,
      impressions: row.impressions,
      taps: row.taps,
      ttr: row.ttr,
      tapInstalls: row.tapInstalls,
      tapNewDownloads: row.tapNewDownloads,
      tapRedownloads: row.tapRedownloads,
      installs: row.installs,
      totalNewDownloads: row.totalNewDownloads,
      totalRedownloads: row.totalRedownloads,
      activations: row.activations,
      registrations: row.registrations,
      cost: row.cost,
      cpt,
      cpa,
      retentionD2: row.retentionD2,
      retentionD3: row.retentionD3,
      retentionD7: row.retentionD7,
      retentionD14: null,
      retentionD30: null,
      retainUv1d: row.retainUv1d,
      retainUv2d: row.retainUv2d,
      retainUv3d: row.retainUv3d,
      retainUv4d: row.retainUv4d,
      retainUv5d: row.retainUv5d,
      retainUv6d: row.retainUv6d,
      retainUv7d: row.retainUv7d,
      retainUv8d: row.retainUv8d,
      retainUv9d: row.retainUv9d,
      retainUv10d: row.retainUv10d,
      retainUv11d: row.retainUv11d,
      retainUv12d: row.retainUv12d,
      retainUv13d: row.retainUv13d,
      retainUv14d: row.retainUv14d,
      retainUv15d: row.retainUv15d,
      retainUv16d: row.retainUv16d,
      retainUv17d: row.retainUv17d,
      retainUv18d: row.retainUv18d,
      retainUv19d: row.retainUv19d,
      retainUv20d: row.retainUv20d,
      retainUv21d: row.retainUv21d,
      retainUv22d: row.retainUv22d,
      retainUv23d: row.retainUv23d,
      retainUv24d: row.retainUv24d,
      retainUv25d: row.retainUv25d,
      retainUv26d: row.retainUv26d,
      retainUv27d: row.retainUv27d,
      retainUv28d: row.retainUv28d,
      retainUv29d: row.retainUv29d,
      retainUv30d: row.retainUv30d,
      ltv: row.ltv,
      ltvRate: row.ltvRate,
      arpu: row.arpu,
      arppu: row.arppu,
      adImpressions: row.adImpressions,
      avgAdImpressions: row.avgAdImpressions,
      adEcpm: row.adEcpm,
      adFillRate: row.adFillRate,
      totalPayUv: row.totalPayUv,
      paymentRate: row.paymentRate,
      adRevenue: row.adRevenue,
      vipRevenue: row.vipRevenue,
      rechargeRevenue: row.rechargeRevenue,
      payRevenue: row.payRevenue,
      totalRevenue: row.totalRevenue,
      roi: row.roi,
      d1Roi: row.d1Roi,
      d2Roi: row.d2Roi,
      d3Roi: row.d3Roi,
      d4Roi: row.d4Roi,
      d5Roi: row.d5Roi,
      d6Roi: row.d6Roi,
      d7Roi: row.d7Roi,
      d15Roi: row.d15Roi,
      d30Roi: row.d30Roi,
      status: statusFromRoi(row.roi)
    };
  });
}
