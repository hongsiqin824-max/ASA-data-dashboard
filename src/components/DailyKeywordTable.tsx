import {
  formatCurrency,
  formatNumber,
  formatPercent
} from "../lib/format";
import {
  isRoiWindowMature,
  latestRoiDateMs,
  roiDaysAvailable,
  type RoiWindowKey
} from "../lib/roi-maturity";
import type { DailyKeywordRow, DataPlatform } from "../lib/types";
import { platformUi } from "../lib/platform";
import { retentionColumns } from "../lib/retention-columns";
import { extendedRoiColumns } from "../lib/roi-columns";
import { EmptyRoi, MiniRoi } from "./ui/MiniRoi";
import { RoiCell } from "./ui/RoiCell";

function renderRetention(
  value: number | null | undefined,
  day: number,
  availableDays: number | null
) {
  if (availableDays === null || availableDays < day) return "-";
  return value === null || value === undefined ? "-" : formatNumber(value);
}

export function DailyKeywordTable({
  rows,
  dataAsOfDate,
  platform = "iOS",
  showAllRetention = false,
  showAllRoi = false
}: {
  rows: DailyKeywordRow[];
  dataAsOfDate?: string | null;
  platform?: DataPlatform;
  /** 明细页传 true：展示全部留存档位；列表页保持精简。 */
  showAllRetention?: boolean;
  /** 明细页传 true：追加 40 日及以上的 ROI 档位；列表页保持精简。 */
  showAllRoi?: boolean;
}) {
  const ui = platformUi(platform);
  const showRetention = platform === "iOS";
  const RETENTION_COLUMNS = retentionColumns(showAllRetention);
  const extendedRoi =
    showAllRoi && ui.hasExtendedRoiWindows ? extendedRoiColumns() : [];
  const latestDateMs = latestRoiDateMs([
    dataAsOfDate,
    ...rows.map((row) => row.date)
  ]);

  function renderWindowRoi(row: DailyKeywordRow, key: RoiWindowKey) {
    if (!isRoiWindowMature(key, roiDaysAvailable(row.date, latestDateMs))) {
      return <EmptyRoi />;
    }
    const value = row[key];
    // 40 日及以上档位在非「全部」收益口径下取不到值
    if (value === null) return <EmptyRoi />;
    return <MiniRoi value={value} />;
  }

  return (
    <div className="table-scroll daily-table-scroll">
      <table className="daily-table">
        <thead>
          <tr>
            <th>日期</th>
            {ui.hasIosInstallBreakdown ? <th>广告组</th> : <th>{ui.parentEntity}</th>}
            <th>{ui.childEntity}ID</th>
            {ui.hasIosInstallBreakdown ? <th>关键词</th> : null}
            <th>展示</th>
            <th>点击</th>
            <th>点击率</th>
            {ui.hasIosInstallBreakdown ? (
              <>
                <th>点击安装</th>
                <th>点击新下载</th>
                <th>点击重下载</th>
                <th>总安装</th>
                <th>总新下载</th>
                <th>总重下载</th>
              </>
            ) : (
              <th>下载</th>
            )}
            <th>激活</th>
            <th>注册</th>
            <th>总消耗</th>
            <th>单激活成本</th>
            <th>单注册成本</th>
            <th>付费率</th>
            {showRetention
              ? RETENTION_COLUMNS.map(({ key, label }) => (
                  <th key={key} title="留存设备数；同一设备可能在多个关键词中重复计数">
                    {label}
                  </th>
                ))
              : null}
            <th>LTV</th>
            <th>LTV倍率</th>
            <th>ARPU</th>
            <th>ARPPU</th>
            <th>总充值UV</th>
            <th>1日充值UV</th>
            <th>单付费成本</th>
            {ui.hasAdRevenue ? (
              <>
                <th>广告收入</th>
                <th>付费收入</th>
              </>
            ) : (
              <>
                <th>会员收入</th>
                <th>充值收入</th>
              </>
            )}
            <th>总收益</th>
            <th>总ROI</th>
            <th>1日ROI</th>
            <th>2日ROI</th>
            <th>3日ROI</th>
            <th>4日ROI</th>
            <th>5日ROI</th>
            <th>6日ROI</th>
            <th>7日ROI</th>
            <th>15日ROI</th>
            <th>30日ROI</th>
            <th>60日ROI</th>
            {extendedRoi.map((col) => (
              <th key={col.key}>{col.labelCn}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.date}-${row.campaignId}-${row.adGroupId}-${row.keywordId}`}>
              <td className="date-cell">{row.date}</td>
              <td>{ui.hasIosInstallBreakdown ? row.adGroupName : row.campaignName}</td>
              <td>{row.keywordId}</td>
              {ui.hasIosInstallBreakdown ? <td className="daily-keyword">{row.keyword}</td> : null}
              <td>{formatNumber(row.impressions)}</td>
              <td>{formatNumber(row.taps)}</td>
              <td>{formatPercent(row.ttr)}</td>
              {ui.hasIosInstallBreakdown ? (
                <>
                  <td>{formatNumber(row.tapInstalls)}</td>
                  <td>{formatNumber(row.tapNewDownloads)}</td>
                  <td>{formatNumber(row.tapRedownloads)}</td>
                  <td>{formatNumber(row.installs)}</td>
                  <td>{formatNumber(row.totalNewDownloads)}</td>
                  <td>{formatNumber(row.totalRedownloads)}</td>
                </>
              ) : (
                <td>{formatNumber(row.installs)}</td>
              )}
              <td>{formatNumber(row.activations)}</td>
              <td>{formatNumber(row.registrations)}</td>
              <td>{formatCurrency(row.cost)}</td>
              <td>{formatCurrency(row.activationCost)}</td>
              <td>{formatCurrency(row.registrationCost)}</td>
              <td>{formatPercent(row.paymentRate)}</td>
              {showRetention
                ? RETENTION_COLUMNS.map(({ day, key }) => (
                    <td key={key}>
                      {renderRetention(row[key], day, roiDaysAvailable(row.date, latestDateMs))}
                    </td>
                  ))
                : null}
              <td>{formatCurrency(row.ltv)}</td>
              <td>{row.ltvRate.toFixed(2)}</td>
              <td>{formatCurrency(row.arpu)}</td>
              <td>{formatCurrency(row.arppu)}</td>
              <td>{formatNumber(row.totalPayUv)}</td>
              <td>{formatNumber(row.d1PayUv)}</td>
              <td>{row.payCost === null ? "-" : formatCurrency(row.payCost)}</td>
              {ui.hasAdRevenue ? (
                <>
                  <td>{formatCurrency(row.adRevenue)}</td>
                  <td>{formatCurrency(row.payRevenue)}</td>
                </>
              ) : (
                <>
                  <td>{formatCurrency(row.vipRevenue)}</td>
                  <td>{formatCurrency(row.rechargeRevenue)}</td>
                </>
              )}
              <td>{formatCurrency(row.totalRevenue)}</td>
              <td>
                <RoiCell value={row.roi} />
              </td>
              <td>
                {renderWindowRoi(row, "d1Roi")}
              </td>
              <td>
                {renderWindowRoi(row, "d2Roi")}
              </td>
              <td>
                {renderWindowRoi(row, "d3Roi")}
              </td>
              <td>
                {renderWindowRoi(row, "d4Roi")}
              </td>
              <td>
                {renderWindowRoi(row, "d5Roi")}
              </td>
              <td>
                {renderWindowRoi(row, "d6Roi")}
              </td>
              <td>
                {renderWindowRoi(row, "d7Roi")}
              </td>
              <td>
                {renderWindowRoi(row, "d15Roi")}
              </td>
              <td>
                {renderWindowRoi(row, "d30Roi")}
              </td>
              <td>
                {renderWindowRoi(row, "d60Roi")}
              </td>
              {extendedRoi.map((col) => (
                <td key={col.key}>{renderWindowRoi(row, col.key)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
