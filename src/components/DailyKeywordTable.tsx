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
import { EmptyRoi, MiniRoi } from "./ui/MiniRoi";
import { RoiCell } from "./ui/RoiCell";

export function DailyKeywordTable({
  rows,
  dataAsOfDate,
  platform = "iOS"
}: {
  rows: DailyKeywordRow[];
  dataAsOfDate?: string | null;
  platform?: DataPlatform;
}) {
  const ui = platformUi(platform);
  const latestDateMs = latestRoiDateMs([
    dataAsOfDate,
    ...rows.map((row) => row.date)
  ]);

  function renderWindowRoi(row: DailyKeywordRow, key: RoiWindowKey) {
    if (!isRoiWindowMature(key, roiDaysAvailable(row.date, latestDateMs))) {
      return <EmptyRoi />;
    }
    return <MiniRoi value={row[key]} />;
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
            <th>总成本</th>
            <th>单激活成本</th>
            <th>单注册成本</th>
            <th>付费率</th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
