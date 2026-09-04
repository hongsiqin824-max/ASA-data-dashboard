// 计划(campaign)层聚合：从关键词汇总行 / 关键词每日行在前端汇总出
// 「计划」这一级。后端成品表没有 campaign_name 列，因此展示名按以下顺序回退：
// 真实 campaignName → 该计划下广告组名(ad_group_name) → campaign_id。
import type {
  CampaignRow,
  DailyCampaignRow,
  DailyKeywordRow,
  KeywordRow,
  KeywordStatus
} from "./types";

function round(value: number, digits = 2) {
  const base = 10 ** digits;
  return Math.round(value * base) / base;
}

// 与后端 statusFromRoi 阈值保持一致：>=100% 高 ROI / 30%~100% 中 ROI / <30% 低 ROI
function statusFromRoi(roi: number): KeywordStatus {
  if (roi >= 1) return "scaling";
  if (roi >= 0.3) return "observe";
  return "pause";
}

function campaignLabel(rows: KeywordRow[], campaignId: string): string {
  const named = rows.find((r) => r.campaignName)?.campaignName;
  if (named) return named;
  const groups = [...new Set(rows.map((r) => r.adGroupName).filter(Boolean))];
  if (groups.length === 1) return groups[0];
  if (groups.length > 1) return `${groups[0]} 等${groups.length}个广告组`;
  return campaignId || "未知计划";
}

export function aggregateCampaigns(rows: KeywordRow[]): CampaignRow[] {
  const groups = new Map<string, KeywordRow[]>();
  rows.forEach((row) => {
    const list = groups.get(row.campaignId);
    if (list) list.push(row);
    else groups.set(row.campaignId, [row]);
  });

  return Array.from(groups.values()).map((list) => {
    const campaignId = list[0].campaignId;
    const sum = (pick: (r: KeywordRow) => number) =>
      list.reduce((acc, r) => acc + pick(r), 0);
    const cost = sum((r) => r.cost);
    // 窗口 ROI 用「成本加权」还原：Σ(kw.dNRoi × kw.cost) / Σ(kw.cost)，
    // 不能直接对各关键词的 ROI 求平均(会被小成本词带偏)。
    const weightedRoi = (pick: (r: KeywordRow) => number) =>
      cost > 0
        ? round(list.reduce((a, r) => a + pick(r) * r.cost, 0) / cost, 4)
        : 0;
    const installs = sum((r) => r.installs);
    const impressions = sum((r) => r.impressions);
    const taps = sum((r) => r.taps);
    const totalPayUv = sum((r) => r.totalPayUv);
    const totalRevenue = sum((r) => r.totalRevenue);
    const roi = cost > 0 ? round(totalRevenue / cost, 4) : 0;

    return {
      campaignId,
      label: campaignLabel(list, campaignId),
      advertiserId: list.find((row) => row.advertiserId)?.advertiserId,
      firstDate:
        list
          .map((row) => row.firstDate)
          .filter((date): date is string => Boolean(date))
          .sort()
          .at(0) ?? null,
      lastDate:
        list
          .map((row) => row.lastDate)
          .filter((date): date is string => Boolean(date))
          .sort()
          .at(-1) ?? null,
      adGroupCount: new Set(list.map((r) => r.adGroupId).filter(Boolean)).size,
      keywordCount: list.length,
      impressions,
      taps,
      ttr: impressions > 0 ? round(taps / impressions, 6) : 0,
      tapInstalls: sum((r) => r.tapInstalls),
      tapNewDownloads: sum((r) => r.tapNewDownloads),
      tapRedownloads: sum((r) => r.tapRedownloads),
      installs,
      totalNewDownloads: sum((r) => r.totalNewDownloads),
      totalRedownloads: sum((r) => r.totalRedownloads),
      activations: sum((r) => r.activations),
      registrations: sum((r) => r.registrations),
      cost: round(cost),
      totalPayUv,
      paymentRate: installs > 0 ? round(totalPayUv / installs, 4) : 0,
      adRevenue: round(sum((r) => r.adRevenue)),
      vipRevenue: round(sum((r) => r.vipRevenue)),
      rechargeRevenue: round(sum((r) => r.rechargeRevenue)),
      payRevenue: round(sum((r) => r.payRevenue)),
      totalRevenue: round(totalRevenue),
      roi,
      d1Roi: weightedRoi((r) => r.d1Roi),
      d2Roi: weightedRoi((r) => r.d2Roi),
      d3Roi: weightedRoi((r) => r.d3Roi),
      d4Roi: weightedRoi((r) => r.d4Roi),
      d5Roi: weightedRoi((r) => r.d5Roi),
      d6Roi: weightedRoi((r) => r.d6Roi),
      d7Roi: weightedRoi((r) => r.d7Roi),
      d15Roi: weightedRoi((r) => r.d15Roi),
      d30Roi: weightedRoi((r) => r.d30Roi),
      status: statusFromRoi(roi)
    };
  });
}

// 计划内「按天」聚合：把该计划下所有关键词的每日行按 date 合并，
// 得到这条计划逐日的成本 / 收益 / ROI 走势(对应「每天不同计划的 ROI」)。
export function aggregateCampaignDaily(
  dailyRows: DailyKeywordRow[]
): DailyCampaignRow[] {
  const groups = new Map<string, DailyKeywordRow[]>();
  dailyRows.forEach((row) => {
    const list = groups.get(row.date);
    if (list) list.push(row);
    else groups.set(row.date, [row]);
  });

  return Array.from(groups.values())
    .map((list) => {
      const sum = (pick: (r: DailyKeywordRow) => number) =>
        list.reduce((acc, r) => acc + pick(r), 0);
      const sumNullable = (
        pick: (r: DailyKeywordRow) => number | null | undefined
      ) => {
        let total = 0;
        let hasValue = false;
        list.forEach((row) => {
          const value = pick(row);
          if (value === null || value === undefined) return;
          total += value;
          hasValue = true;
        });
        return hasValue ? total : null;
      };
      const cost = sum((r) => r.cost);
      const weightedRoi = (pick: (r: DailyKeywordRow) => number) =>
        cost > 0
          ? round(list.reduce((a, r) => a + pick(r) * r.cost, 0) / cost, 4)
          : 0;
      const installs = sum((r) => r.installs);
      const impressions = sum((r) => r.impressions);
      const taps = sum((r) => r.taps);
      const totalPayUv = sum((r) => r.totalPayUv);
      const totalRevenue = sum((r) => r.totalRevenue);
      const roi = cost > 0 ? round(totalRevenue / cost, 4) : 0;

      return {
        date: list[0].date,
        keywordCount: list.length,
        impressions,
        taps,
        ttr: impressions > 0 ? round(taps / impressions, 6) : 0,
        tapInstalls: sum((r) => r.tapInstalls),
        tapNewDownloads: sum((r) => r.tapNewDownloads),
        tapRedownloads: sum((r) => r.tapRedownloads),
        installs,
        totalNewDownloads: sum((r) => r.totalNewDownloads),
        totalRedownloads: sum((r) => r.totalRedownloads),
        activations: sum((r) => r.activations),
        registrations: sum((r) => r.registrations),
        retainUv1d: sumNullable((r) => r.retainUv1d),
        retainUv3d: sumNullable((r) => r.retainUv3d),
        retainUv7d: sumNullable((r) => r.retainUv7d),
        retainUv14d: sumNullable((r) => r.retainUv14d),
        retainUv30d: sumNullable((r) => r.retainUv30d),
        cost: round(cost),
        totalPayUv,
        paymentRate: installs > 0 ? round(totalPayUv / installs, 4) : 0,
        adRevenue: round(sum((r) => r.adRevenue)),
        vipRevenue: round(sum((r) => r.vipRevenue)),
        rechargeRevenue: round(sum((r) => r.rechargeRevenue)),
        payRevenue: round(sum((r) => r.payRevenue)),
        totalRevenue: round(totalRevenue),
        roi,
        d1Roi: weightedRoi((r) => r.d1Roi),
        d2Roi: weightedRoi((r) => r.d2Roi),
        d3Roi: weightedRoi((r) => r.d3Roi),
        d4Roi: weightedRoi((r) => r.d4Roi),
        d5Roi: weightedRoi((r) => r.d5Roi),
        d6Roi: weightedRoi((r) => r.d6Roi),
        d7Roi: weightedRoi((r) => r.d7Roi),
        d15Roi: weightedRoi((r) => r.d15Roi),
        d30Roi: weightedRoi((r) => r.d30Roi)
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}
