import type {
  CampaignRow,
  DailyCampaignRow,
  DailyKeywordRow,
  DataPlatform,
  KeywordRow
} from "./types";
import { platformExportPrefix } from "./platform";
import {
  isOverallRetentionMature,
  retentionDaysAvailable,
  retentionRate
} from "./retention-maturity";
import { statusMeta } from "./status";

// 1~30 日逐日，之后按 10 日步长到 180 日（与数仓建的档位一致）。
const RETENTION_DAYS = [
  ...Array.from({ length: 30 }, (_, index) => index + 1),
  ...Array.from({ length: 15 }, (_, index) => 40 + index * 10)
];

function retentionValue(
  row: KeywordRow | DailyKeywordRow,
  day: number
): number | null | undefined {
  const key = `retainUv${day}d`;
  return (row as unknown as Record<string, unknown>)[key] as number | null | undefined;
}

export const XHS_CAMPAIGN_EXPORT_HEADERS = [
  "广告主ID", "推广计划ID", "推广计划名", "展示", "点击", "点击率", "激活", "注册",
  "消耗", "付费UV", "会员收入", "充值收入", "付费收入", "总收益", "总ROI",
  "D1 ROI", "D2 ROI", "D3 ROI", "D4 ROI", "D5 ROI", "D6 ROI", "D7 ROI",
  "D15 ROI", "D30 ROI", "状态"
];

export const XHS_DAILY_EXPORT_HEADERS = [
  "日期", "广告主ID", "推广计划ID", "推广计划名", "展示", "点击", "点击率", "激活",
  "注册", "总消耗", "单激活成本", "单注册成本", "付费UV", "1日付费UV", "会员收入",
  "充值收入", "付费收入", "总收益", "总ROI", "1日ROI", "2日ROI", "3日ROI",
  "4日ROI", "5日ROI", "6日ROI", "7日ROI", "15日ROI", "30日ROI"
];

export function exportCampaignRows(rows: CampaignRow[], platform: DataPlatform) {
  if (platform === "Xiaohongshu") {
    downloadCsv(
      "xhs-campaign-roi-summary.csv",
      XHS_CAMPAIGN_EXPORT_HEADERS,
      rows.map((row) => [
        row.advertiserId ?? "", row.campaignId, row.label, row.impressions, row.taps,
        row.ttr, row.activations, row.registrations, row.cost, row.totalPayUv,
        row.vipRevenue, row.rechargeRevenue, row.payRevenue, row.totalRevenue, row.roi,
        row.d1Roi, row.d2Roi, row.d3Roi, row.d4Roi, row.d5Roi, row.d6Roi, row.d7Roi,
        row.d15Roi, row.d30Roi, statusMeta[row.status].label
      ])
    );
    return;
  }

  if (platform === "HarmonyOS") {
    downloadCsv(
      "harmony-task-roi-summary.csv",
      [
        "任务ID", "任务名", "子任务数", "展示", "点击", "点击率", "下载",
        "激活", "注册", "消耗", "付费率", "付费UV", "会员收入", "充值收入",
        "付费收入", "总收益", "总ROI", "D1 ROI", "D2 ROI", "D3 ROI",
        "D4 ROI", "D5 ROI", "D6 ROI", "D7 ROI", "D15 ROI", "D30 ROI", "D60 ROI", "状态"
      ],
      rows.map((row) => [
        row.campaignId, row.label, row.adGroupCount, row.impressions, row.taps,
        row.ttr, row.installs, row.activations, row.registrations, row.cost,
        row.paymentRate, row.totalPayUv, row.vipRevenue, row.rechargeRevenue,
        row.payRevenue, row.totalRevenue, row.roi, row.d1Roi, row.d2Roi,
        row.d3Roi, row.d4Roi, row.d5Roi, row.d6Roi, row.d7Roi, row.d15Roi,
        row.d30Roi, row.d60Roi, statusMeta[row.status].label
      ])
    );
    return;
  }

  const headers = [
    "计划ID",
    "计划名",
    "广告组数",
    "关键词数",
    "展示",
    "点击",
    "点击率",
    "点击安装",
    "点击新下载",
    "点击重下载",
    "总安装",
    "总新下载",
    "总重下载",
    "激活",
    "注册",
    "消耗",
    "付费率",
    "总充值UV",
    "广告收入",
    "会员收入",
    "充值收入",
    "付费收入",
    "总收益",
    "总ROI",
    "D1 ROI",
    "D2 ROI",
    "D3 ROI",
    "D4 ROI",
    "D5 ROI",
    "D6 ROI",
    "D7 ROI",
    "D15 ROI",
    "D30 ROI",
    "D60 ROI",
    "状态"
  ];
  const body = rows.map((row) => [
    row.campaignId,
    row.label,
    row.adGroupCount,
    row.keywordCount,
    row.impressions,
    row.taps,
    row.ttr,
    row.tapInstalls,
    row.tapNewDownloads,
    row.tapRedownloads,
    row.installs,
    row.totalNewDownloads,
    row.totalRedownloads,
    row.activations,
    row.registrations,
    row.cost,
    row.paymentRate,
    row.totalPayUv,
    row.adRevenue,
    row.vipRevenue,
    row.rechargeRevenue,
    row.payRevenue,
    row.totalRevenue,
    row.roi,
    row.d1Roi,
    row.d2Roi,
    row.d3Roi,
    row.d4Roi,
    row.d5Roi,
    row.d6Roi,
    row.d7Roi,
    row.d15Roi,
    row.d30Roi,
    row.d60Roi,
    statusMeta[row.status].label
  ]);
  downloadCsv(`${platformExportPrefix(platform)}-campaign-roi-summary.csv`, headers, body);
}

export function exportKeywordRows(rows: KeywordRow[], platform: DataPlatform) {
  if (platform === "HarmonyOS") {
    downloadCsv(
      "harmony-sub-task-roi-summary.csv",
      [
        "子任务ID", "任务ID", "任务名", "展示", "点击", "点击率", "下载",
        "激活", "注册", "消耗", "付费率", "付费UV", "会员收入", "充值收入",
        "付费收入", "总收益", "总ROI", "D1 ROI", "D2 ROI", "D3 ROI",
        "D4 ROI", "D5 ROI", "D6 ROI", "D7 ROI", "D15 ROI", "D30 ROI", "D60 ROI", "状态"
      ],
      rows.map((row) => [
        row.keywordId, row.campaignId, row.campaignName, row.impressions, row.taps,
        row.ttr, row.installs, row.activations, row.registrations, row.cost,
        row.paymentRate, row.totalPayUv, row.vipRevenue, row.rechargeRevenue,
        row.payRevenue, row.totalRevenue, row.roi, row.d1Roi, row.d2Roi,
        row.d3Roi, row.d4Roi, row.d5Roi, row.d6Roi, row.d7Roi, row.d15Roi,
        row.d30Roi, row.d60Roi, statusMeta[row.status].label
      ])
    );
    return;
  }

  const headers = [
    "关键词ID",
    "关键词",
    "计划",
    "广告组",
    "展示",
    "点击",
    "点击率",
    "点击安装",
    "点击新下载",
    "点击重下载",
    "总安装",
    "总新下载",
    "总重下载",
    "激活",
    "注册",
    "消耗",
    "付费率",
    ...RETENTION_DAYS.map((day) => `D${day}留存设备数`),
    "LTV",
    "LTV倍率",
    "ARPU",
    "ARPPU",
    "广告展现",
    "人均展现",
    "eCPM",
    "广告展现率",
    "广告收入",
    "会员收入",
    "充值收入",
    "付费收入",
    "总收益",
    "总ROI",
    "D1 ROI",
    "D2 ROI",
    "D3 ROI",
    "D4 ROI",
    "D5 ROI",
    "D6 ROI",
    "D7 ROI",
    "D15 ROI",
    "D30 ROI",
    "D60 ROI",
    "状态"
  ];
  const body = rows.map((row) => [
    row.keywordId,
    row.keyword,
    row.campaignName,
    row.adGroupName,
    row.impressions,
    row.taps,
    row.ttr,
    row.tapInstalls,
    row.tapNewDownloads,
    row.tapRedownloads,
    row.installs,
    row.totalNewDownloads,
    row.totalRedownloads,
    row.activations,
    row.registrations,
    row.cost,
    row.paymentRate,
    ...RETENTION_DAYS.map((day) => retentionValue(row, day) ?? ""),
    row.ltv,
    row.ltvRate,
    row.arpu,
    row.arppu,
    row.adImpressions,
    row.avgAdImpressions,
    row.adEcpm,
    row.adFillRate,
    row.adRevenue,
    row.vipRevenue,
    row.rechargeRevenue,
    row.payRevenue,
    row.totalRevenue,
    row.roi,
    row.d1Roi,
    row.d2Roi,
    row.d3Roi,
    row.d4Roi,
    row.d5Roi,
    row.d6Roi,
    row.d7Roi,
    row.d15Roi,
    row.d30Roi,
    row.d60Roi,
    statusMeta[row.status].label
  ]);
  downloadCsv(`${platformExportPrefix(platform)}-keyword-roi-summary.csv`, headers, body);
}

export function exportDailyRows(
  rows: DailyKeywordRow[],
  keyword: string,
  platform: DataPlatform
) {
  if (platform === "Xiaohongshu") {
    downloadCsv(
      `xhs-${keyword}-daily-detail.csv`,
      XHS_DAILY_EXPORT_HEADERS,
      rows.map((row) => [
        row.date, row.advertiserId ?? "", row.campaignId, row.campaignName,
        row.impressions, row.taps, row.ttr, row.activations, row.registrations,
        row.cost, row.activationCost, row.registrationCost, row.totalPayUv,
        row.d1PayUv, row.vipRevenue, row.rechargeRevenue, row.payRevenue,
        row.totalRevenue, row.roi, row.d1Roi, row.d2Roi, row.d3Roi, row.d4Roi,
        row.d5Roi, row.d6Roi, row.d7Roi, row.d15Roi, row.d30Roi, row.d60Roi
      ])
    );
    return;
  }

  if (platform === "HarmonyOS") {
    downloadCsv(
      `harmony-${keyword}-daily-detail.csv`,
      [
        "日期", "子任务ID", "任务ID", "任务名", "展示", "点击", "点击率", "下载",
        "激活", "注册", "总消耗", "单激活成本", "单注册成本", "付费率", "付费UV",
        "1日付费UV", "单付费成本", "会员收入", "充值收入", "付费收入", "总收益",
        "总ROI", "1日ROI", "2日ROI", "3日ROI", "4日ROI", "5日ROI", "6日ROI",
        "7日ROI", "15日ROI", "30日ROI", "60日ROI"
      ],
      rows.map((row) => [
        row.date, row.keywordId, row.campaignId, row.campaignName, row.impressions,
        row.taps, row.ttr, row.installs, row.activations, row.registrations,
        row.cost, row.activationCost, row.registrationCost, row.paymentRate,
        row.totalPayUv, row.d1PayUv, row.payCost ?? "", row.vipRevenue,
        row.rechargeRevenue, row.payRevenue, row.totalRevenue, row.roi, row.d1Roi,
        row.d2Roi, row.d3Roi, row.d4Roi, row.d5Roi, row.d6Roi, row.d7Roi,
        row.d15Roi, row.d30Roi, row.d60Roi
      ])
    );
    return;
  }

  const headers = [
    "日期",
    "关键词ID",
    "关键词",
    "计划",
    "广告组",
    "展示",
    "点击",
    "点击率",
    "点击安装",
    "点击新下载",
    "点击重下载",
    "总安装",
    "总新下载",
    "总重下载",
    "激活",
    "注册",
    "总消耗",
    "单激活成本",
    "单注册成本",
    "付费率",
    ...RETENTION_DAYS.map((day) => `D${day}留存设备数`),
    "LTV",
    "LTV倍率",
    "ARPU",
    "ARPPU",
    "广告展现",
    "人均展现",
    "eCPM",
    "广告展现率",
    "总充值UV",
    "1日充值UV",
    "单付费成本",
    "广告收入",
    "会员收入",
    "充值收入",
    "付费收入",
    "总收益",
    "总ROI",
    "1日ROI",
    "2日ROI",
    "3日ROI",
    "4日ROI",
    "5日ROI",
    "6日ROI",
    "7日ROI",
    "15日ROI",
    "30日ROI",
    "60日ROI"
  ];
  const body = rows.map((row) => [
    row.date,
    row.keywordId,
    row.keyword,
    row.campaignName,
    row.adGroupName,
    row.impressions,
    row.taps,
    row.ttr,
    row.tapInstalls,
    row.tapNewDownloads,
    row.tapRedownloads,
    row.installs,
    row.totalNewDownloads,
    row.totalRedownloads,
    row.activations,
    row.registrations,
    row.cost,
    row.activationCost,
    row.registrationCost,
    row.paymentRate,
    ...RETENTION_DAYS.map((day) => retentionValue(row, day) ?? ""),
    row.ltv,
    row.ltvRate,
    row.arpu,
    row.arppu,
    row.adImpressions,
    row.avgAdImpressions,
    row.adEcpm,
    row.adFillRate,
    row.totalPayUv,
    row.d1PayUv,
    row.payCost ?? "",
    row.adRevenue,
    row.vipRevenue,
    row.rechargeRevenue,
    row.payRevenue,
    row.totalRevenue,
    row.roi,
    row.d1Roi,
    row.d2Roi,
    row.d3Roi,
    row.d4Roi,
    row.d5Roi,
    row.d6Roi,
    row.d7Roi,
    row.d15Roi,
    row.d30Roi,
    row.d60Roi
  ]);
  downloadCsv(
    `${platformExportPrefix(platform)}-${keyword}-daily-detail.csv`,
    headers,
    body
  );
}

export function exportDailySummaryRows(
  rows: DailyCampaignRow[],
  platform: DataPlatform,
  dataAsOfDate?: string | null
) {
  if (platform === "Xiaohongshu") {
    downloadCsv(
      "xhs-daily-roi-summary.csv",
      [
        "日期", "展示", "点击", "点击率", "激活", "注册", "总消耗", "付费UV",
        "会员收入", "充值收入", "付费收入", "总收益", "总ROI", "1日ROI",
        "2日ROI", "3日ROI", "4日ROI", "5日ROI", "6日ROI", "7日ROI",
        "15日ROI", "30日ROI"
      ],
      rows.map((row) => [
        row.date, row.impressions, row.taps, row.ttr, row.activations,
        row.registrations, row.cost, row.totalPayUv, row.vipRevenue,
        row.rechargeRevenue, row.payRevenue, row.totalRevenue, row.roi,
        row.d1Roi, row.d2Roi, row.d3Roi, row.d4Roi, row.d5Roi, row.d6Roi,
        row.d7Roi, row.d15Roi, row.d30Roi
      ])
    );
    return;
  }

  if (platform === "HarmonyOS") {
    downloadCsv(
      "harmony-daily-roi-summary.csv",
      [
        "日期", "子任务数", "展示", "点击", "点击率", "下载", "激活", "注册",
        "总消耗", "付费率", "付费UV", "会员收入", "充值收入", "付费收入",
        "总收益", "总ROI", "1日ROI", "2日ROI", "3日ROI", "4日ROI",
        "5日ROI", "6日ROI", "7日ROI", "15日ROI", "30日ROI", "60日ROI"
      ],
      rows.map((row) => [
        row.date, row.keywordCount, row.impressions, row.taps, row.ttr, row.installs,
        row.activations, row.registrations, row.cost, row.paymentRate,
        row.totalPayUv, row.vipRevenue, row.rechargeRevenue, row.payRevenue,
        row.totalRevenue, row.roi, row.d1Roi, row.d2Roi, row.d3Roi, row.d4Roi,
        row.d5Roi, row.d6Roi, row.d7Roi, row.d15Roi, row.d30Roi, row.d60Roi
      ])
    );
    return;
  }

  const latestRetentionDate = dataAsOfDate ??
    rows.map((row) => row.date).sort().at(-1) ?? null;
  const retentionPercent = (
    row: DailyCampaignRow,
    key:
      | "retainUv1d"
      | "retainUv3d"
      | "retainUv7d"
      | "retainUv14d"
      | "retainUv30d"
      | "retainUv60d"
      | "retainUv90d"
      | "retainUv180d"
  ) => {
    if (!isOverallRetentionMature(key, retentionDaysAvailable(row.date, latestRetentionDate))) {
      return "";
    }
    const rate = retentionRate(row[key], row.activations);
    return rate === null ? "" : `${(rate * 100).toFixed(2)}%`;
  };

  const headers = [
    "日期",
    "关键词数",
    "展示",
    "点击",
    "点击率",
    "点击安装",
    "点击新下载",
    "点击重下载",
    "总安装",
    "总新下载",
    "总重下载",
    "激活",
    "注册",
    "次日留存",
    "3日留存",
    "7日留存",
    "14日留存",
    "30日留存",
    "60日留存",
    "90日留存",
    "180日留存",
    "总消耗",
    "付费率",
    "总充值UV",
    "广告收入",
    "会员收入",
    "充值收入",
    "付费收入",
    "总收益",
    "总ROI",
    "1日ROI",
    "2日ROI",
    "3日ROI",
    "4日ROI",
    "5日ROI",
    "6日ROI",
    "7日ROI",
    "15日ROI",
    "30日ROI",
    "60日ROI"
  ];
  const body = rows.map((row) => [
    row.date,
    row.keywordCount,
    row.impressions,
    row.taps,
    row.ttr,
    row.tapInstalls,
    row.tapNewDownloads,
    row.tapRedownloads,
    row.installs,
    row.totalNewDownloads,
    row.totalRedownloads,
    row.activations,
    row.registrations,
    retentionPercent(row, "retainUv1d"),
    retentionPercent(row, "retainUv3d"),
    retentionPercent(row, "retainUv7d"),
    retentionPercent(row, "retainUv14d"),
    retentionPercent(row, "retainUv30d"),
    retentionPercent(row, "retainUv60d"),
    retentionPercent(row, "retainUv90d"),
    retentionPercent(row, "retainUv180d"),
    row.cost,
    row.paymentRate,
    row.totalPayUv,
    row.adRevenue,
    row.vipRevenue,
    row.rechargeRevenue,
    row.payRevenue,
    row.totalRevenue,
    row.roi,
    row.d1Roi,
    row.d2Roi,
    row.d3Roi,
    row.d4Roi,
    row.d5Roi,
    row.d6Roi,
    row.d7Roi,
    row.d15Roi,
    row.d30Roi,
    row.d60Roi
  ]);
  downloadCsv(`${platformExportPrefix(platform)}-daily-roi-summary.csv`, headers, body);
}

function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>
) {
  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell).replace(/"/g, '""');
          return `"${value}"`;
        })
        .join(",")
    )
    .join("\n");
  const blob = new Blob([String.fromCharCode(0xfeff) + csv], {
    type: "text/csv;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
