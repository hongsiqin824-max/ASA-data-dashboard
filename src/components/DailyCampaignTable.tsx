import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  formatCurrency,
  formatNumber,
  formatPercent
} from "../lib/format";
import {
  isRoiWindowMature,
  latestRoiDateMs,
  minimumRoiDaysAvailable,
  roiDaysAvailable,
  type RoiWindowKey
} from "../lib/roi-maturity";
import {
  isOverallRetentionMature,
  retentionDaysAvailable,
  retentionRate
} from "../lib/retention-maturity";
import type { DailyCampaignRow, DataPlatform } from "../lib/types";
import { extendedRoiColumns } from "../lib/roi-columns";
import { platformUi } from "../lib/platform";
import { retentionColumns, type RetentionColumn } from "../lib/retention-columns";
import { EmptyRoi, MiniRoi } from "./ui/MiniRoi";
import { RoiCell } from "./ui/RoiCell";

export type DailyCampaignTableSummary = Omit<DailyCampaignRow, "date"> & {
  dayCount: number;
};

type SortDirection = "asc" | "desc";
type SortKey =
  | "date"
  | "keywordCount"
  | "impressions"
  | "taps"
  | "ttr"
  | "tapInstalls"
  | "tapNewDownloads"
  | "tapRedownloads"
  | "installs"
  | "totalNewDownloads"
  | "totalRedownloads"
  | "activations"
  | "registrations"
  | "cost"
  | "totalPayUv"
  | "paymentRate"
  | "adRevenue"
  | "payRevenue"
  | "totalRevenue"
  | "roi"
  | RoiWindowKey;

type SortState = {
  key: SortKey;
  direction: SortDirection;
} | null;

type SortValue = string | number | null;

const textSortKeys = new Set<SortKey>(["date"]);

function formatRetentionRate(
  retainedUsers: number | null | undefined,
  activations: number | null | undefined
) {
  const rate = retentionRate(retainedUsers, activations);
  return rate === null ? "-" : formatPercent(rate);
}

function sortValue(
  row: DailyCampaignRow,
  key: SortKey,
  latestMs: number | null
): SortValue {
  if (!isRoiWindowMature(key, roiDaysAvailable(row.date, latestMs))) return null;
  return row[key] as SortValue;
}

function compareSortValues(left: SortValue, right: SortValue, direction: SortDirection) {
  const leftMissing = left === null || left === "";
  const rightMissing = right === null || right === "";
  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;

  const result =
    typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left).localeCompare(String(right), "zh-CN", {
          numeric: true,
          sensitivity: "base"
        });
  return direction === "asc" ? result : -result;
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
}) {
  const active = sort?.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  const directionLabel = !active
    ? "未排序"
    : sort.direction === "asc"
      ? "升序"
      : "降序";

  return (
    <th aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
      <button
        className={`th-sort-button ${active ? "active" : ""}`}
        type="button"
        title={`${label}排序，当前${directionLabel}`}
        onClick={() => onSort(sortKey)}
      >
        <span>{label}</span>
        <Icon size={13} />
      </button>
    </th>
  );
}

// 计划内「逐日」ROI 趋势表：该计划下所有关键词每日数据按 date 汇总。
export function DailyCampaignTable({
  rows,
  summary,
  maturityRows,
  dataAsOfDate,
  platform = "iOS",
  showOverallRetention = false,
  showAllRetention = false,
  showAllRoi = false,
  onOpenKeywords
}: {
  rows: DailyCampaignRow[];
  summary?: DailyCampaignTableSummary;
  maturityRows?: DailyCampaignRow[];
  dataAsOfDate?: string | null;
  platform?: DataPlatform;
  showOverallRetention?: boolean;
  /** 明细页传 true：展示全部留存档位；列表页保持精简。 */
  showAllRetention?: boolean;
  /** 明细页传 true：追加 40 日及以上的 ROI 档位；列表页保持精简。 */
  showAllRoi?: boolean;
  onOpenKeywords?: (date: string) => void;
}) {
  const ui = platformUi(platform);
  const OVERALL_RETENTION_COLUMNS = retentionColumns(showAllRetention, "");
  const extendedRoi =
    showAllRoi && ui.hasExtendedRoiWindows ? extendedRoiColumns() : [];
  const [sort, setSort] = useState<SortState>(null);
  const latestMs = useMemo(
    () =>
      latestRoiDateMs([
        dataAsOfDate,
        ...(maturityRows ?? rows).map((row) => row.date)
      ]),
    [dataAsOfDate, maturityRows, rows]
  );
  const summaryAvailableDays = useMemo(
    () => minimumRoiDaysAvailable(rows.map((row) => row.date), latestMs),
    [latestMs, rows]
  );
  const latestRetentionDate = dataAsOfDate ??
    (maturityRows ?? rows).map((row) => row.date).sort().at(-1) ?? null;
  const summaryRetentionAvailableDays = useMemo(() => {
    const available = rows
      .map((row) => retentionDaysAvailable(row.date, latestRetentionDate))
      .filter((days): days is number => days !== null);
    return available.length > 0 ? Math.min(...available) : null;
  }, [latestRetentionDate, rows]);
  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((left, right) => {
      const result = compareSortValues(
        sortValue(left, sort.key, latestMs),
        sortValue(right, sort.key, latestMs),
        sort.direction
      );
      return result || right.date.localeCompare(left.date);
    });
  }, [rows, sort, latestMs]);

  function renderSummaryWindowRoi(value: number | null, key: SortKey) {
    if (value === null || !isRoiWindowMature(key, summaryAvailableDays)) {
      return <EmptyRoi />;
    }
    return <MiniRoi value={value} />;
  }

  function renderRowWindowRoi(row: DailyCampaignRow, key: SortKey) {
    if (!isRoiWindowMature(key, roiDaysAvailable(row.date, latestMs))) {
      return <EmptyRoi />;
    }
    const value = row[key as keyof DailyCampaignRow] as number | null;
    // 40 日及以上档位在非「全部」收益口径下取不到值
    if (value === null) return <EmptyRoi />;
    return <MiniRoi value={value} />;
  }

  function renderRetention(
    row: DailyCampaignRow,
    key: RetentionColumn["key"]
  ) {
    const available = retentionDaysAvailable(row.date, latestRetentionDate);
    if (!isOverallRetentionMature(key, available)) return "-";
    return formatRetentionRate(row[key], row.activations);
  }

  function renderSummaryRetention(
    key: RetentionColumn["key"]
  ) {
    if (!isOverallRetentionMature(key, summaryRetentionAvailableDays)) return "-";
    return formatRetentionRate(summary?.[key], summary?.activations);
  }

  function toggleSort(key: SortKey) {
    setSort((current) => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === "desc" ? "asc" : "desc"
        };
      }
      return {
        key,
        direction: textSortKeys.has(key) ? "desc" : "desc"
      };
    });
  }

  return (
    <div className="table-scroll daily-table-scroll">
      <table className="daily-table">
        <thead>
          <tr>
            <SortableHeader label="日期" sortKey="date" sort={sort} onSort={toggleSort} />
            {ui.hasChildEntity ? (
              <SortableHeader label={ui.childEntity} sortKey="keywordCount" sort={sort} onSort={toggleSort} />
            ) : null}
            <SortableHeader label="展示" sortKey="impressions" sort={sort} onSort={toggleSort} />
            <SortableHeader label="点击" sortKey="taps" sort={sort} onSort={toggleSort} />
            <SortableHeader label="点击率" sortKey="ttr" sort={sort} onSort={toggleSort} />
            {ui.hasIosInstallBreakdown ? (
              <>
                <SortableHeader label="点击安装" sortKey="tapInstalls" sort={sort} onSort={toggleSort} />
                <SortableHeader label="点击新下载" sortKey="tapNewDownloads" sort={sort} onSort={toggleSort} />
                <SortableHeader label="点击重下载" sortKey="tapRedownloads" sort={sort} onSort={toggleSort} />
                <SortableHeader label="总安装" sortKey="installs" sort={sort} onSort={toggleSort} />
                <SortableHeader label="总新下载" sortKey="totalNewDownloads" sort={sort} onSort={toggleSort} />
                <SortableHeader label="总重下载" sortKey="totalRedownloads" sort={sort} onSort={toggleSort} />
              </>
            ) : ui.hasInstallMetric ? (
              <SortableHeader label="下载" sortKey="installs" sort={sort} onSort={toggleSort} />
            ) : null}
            <SortableHeader label="激活" sortKey="activations" sort={sort} onSort={toggleSort} />
            <SortableHeader label="注册" sortKey="registrations" sort={sort} onSort={toggleSort} />
            {showOverallRetention
              ? OVERALL_RETENTION_COLUMNS.map(({ key, label }) => (
                  <th key={key}>{label}</th>
                ))
              : null}
            <SortableHeader label="总消耗" sortKey="cost" sort={sort} onSort={toggleSort} />
            <SortableHeader
              label={ui.hasPaymentRate ? "付费率" : "付费UV"}
              sortKey={ui.hasPaymentRate ? "paymentRate" : "totalPayUv"}
              sort={sort}
              onSort={toggleSort}
            />
            {ui.hasAdRevenue ? (
              <>
                <SortableHeader label="广告收入" sortKey="adRevenue" sort={sort} onSort={toggleSort} />
                <SortableHeader label="付费收入" sortKey="payRevenue" sort={sort} onSort={toggleSort} />
              </>
            ) : (
              <>
                <th>会员收入</th>
                <th>充值收入</th>
              </>
            )}
            <SortableHeader label="总收益" sortKey="totalRevenue" sort={sort} onSort={toggleSort} />
            <SortableHeader label="总ROI" sortKey="roi" sort={sort} onSort={toggleSort} />
            <SortableHeader label="1日ROI" sortKey="d1Roi" sort={sort} onSort={toggleSort} />
            <SortableHeader label="2日ROI" sortKey="d2Roi" sort={sort} onSort={toggleSort} />
            <SortableHeader label="3日ROI" sortKey="d3Roi" sort={sort} onSort={toggleSort} />
            <SortableHeader label="4日ROI" sortKey="d4Roi" sort={sort} onSort={toggleSort} />
            <SortableHeader label="5日ROI" sortKey="d5Roi" sort={sort} onSort={toggleSort} />
            <SortableHeader label="6日ROI" sortKey="d6Roi" sort={sort} onSort={toggleSort} />
            <SortableHeader label="7日ROI" sortKey="d7Roi" sort={sort} onSort={toggleSort} />
            <SortableHeader label="15日ROI" sortKey="d15Roi" sort={sort} onSort={toggleSort} />
            <SortableHeader label="30日ROI" sortKey="d30Roi" sort={sort} onSort={toggleSort} />
            <SortableHeader label="60日ROI" sortKey="d60Roi" sort={sort} onSort={toggleSort} />
            {extendedRoi.map((col) => (
              <SortableHeader
                key={col.key}
                label={col.labelCn}
                sortKey={col.key}
                sort={sort}
                onSort={toggleSort}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {summary ? (
            <tr className="keyword-summary-row">
              <td className="date-cell">
                <strong>当前列表汇总</strong>
                <span>{formatNumber(summary.dayCount)} 天</span>
              </td>
              {ui.hasChildEntity ? <td>{formatNumber(summary.keywordCount)}</td> : null}
              <td>{formatNumber(summary.impressions)}</td>
              <td>{formatNumber(summary.taps)}</td>
              <td>{formatPercent(summary.ttr)}</td>
              {ui.hasIosInstallBreakdown ? (
                <>
                  <td>{formatNumber(summary.tapInstalls)}</td>
                  <td>{formatNumber(summary.tapNewDownloads)}</td>
                  <td>{formatNumber(summary.tapRedownloads)}</td>
                  <td>{formatNumber(summary.installs)}</td>
                  <td>{formatNumber(summary.totalNewDownloads)}</td>
                  <td>{formatNumber(summary.totalRedownloads)}</td>
                </>
              ) : ui.hasInstallMetric ? (
                <td>{formatNumber(summary.installs)}</td>
              ) : null}
              <td>{formatNumber(summary.activations)}</td>
              <td>{formatNumber(summary.registrations)}</td>
              {showOverallRetention
                ? OVERALL_RETENTION_COLUMNS.map(({ key }) => (
                    <td key={key}>{renderSummaryRetention(key)}</td>
                  ))
                : null}
              <td>{formatCurrency(summary.cost)}</td>
              <td>
                {ui.hasPaymentRate
                  ? formatPercent(summary.paymentRate)
                  : formatNumber(summary.totalPayUv)}
              </td>
              {ui.hasAdRevenue ? (
                <>
                  <td>{formatCurrency(summary.adRevenue)}</td>
                  <td>{formatCurrency(summary.payRevenue)}</td>
                </>
              ) : (
                <>
                  <td>{formatCurrency(summary.vipRevenue)}</td>
                  <td>{formatCurrency(summary.rechargeRevenue)}</td>
                </>
              )}
              <td>{formatCurrency(summary.totalRevenue)}</td>
              <td>
                <RoiCell value={summary.roi} />
              </td>
              <td>
                {renderSummaryWindowRoi(summary.d1Roi, "d1Roi")}
              </td>
              <td>
                {renderSummaryWindowRoi(summary.d2Roi, "d2Roi")}
              </td>
              <td>
                {renderSummaryWindowRoi(summary.d3Roi, "d3Roi")}
              </td>
              <td>
                {renderSummaryWindowRoi(summary.d4Roi, "d4Roi")}
              </td>
              <td>
                {renderSummaryWindowRoi(summary.d5Roi, "d5Roi")}
              </td>
              <td>
                {renderSummaryWindowRoi(summary.d6Roi, "d6Roi")}
              </td>
              <td>
                {renderSummaryWindowRoi(summary.d7Roi, "d7Roi")}
              </td>
              <td>
                {renderSummaryWindowRoi(summary.d15Roi, "d15Roi")}
              </td>
              <td>
                {renderSummaryWindowRoi(summary.d30Roi, "d30Roi")}
              </td>
              <td>
                {renderSummaryWindowRoi(summary.d60Roi, "d60Roi")}
              </td>
              {extendedRoi.map((col) => (
                <td key={col.key}>
                  {renderSummaryWindowRoi(summary[col.key], col.key)}
                </td>
              ))}
            </tr>
          ) : null}
          {sortedRows.map((row) => (
            <tr key={row.date}>
              <td className="date-cell">{row.date}</td>
              {ui.hasChildEntity ? (
                <td>
                  {onOpenKeywords ? (
                    <button
                      className="table-link-button"
                      type="button"
                      onClick={() => onOpenKeywords(row.date)}
                    >
                      {formatNumber(row.keywordCount)}
                    </button>
                  ) : (
                    formatNumber(row.keywordCount)
                  )}
                </td>
              ) : null}
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
              ) : ui.hasInstallMetric ? (
                <td>{formatNumber(row.installs)}</td>
              ) : null}
              <td>{formatNumber(row.activations)}</td>
              <td>{formatNumber(row.registrations)}</td>
              {showOverallRetention
                ? OVERALL_RETENTION_COLUMNS.map(({ key }) => (
                    <td key={key}>{renderRetention(row, key)}</td>
                  ))
                : null}
              <td>{formatCurrency(row.cost)}</td>
              <td>
                {ui.hasPaymentRate
                  ? formatPercent(row.paymentRate)
                  : formatNumber(row.totalPayUv)}
              </td>
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
                {renderRowWindowRoi(row, "d1Roi")}
              </td>
              <td>
                {renderRowWindowRoi(row, "d2Roi")}
              </td>
              <td>
                {renderRowWindowRoi(row, "d3Roi")}
              </td>
              <td>
                {renderRowWindowRoi(row, "d4Roi")}
              </td>
              <td>
                {renderRowWindowRoi(row, "d5Roi")}
              </td>
              <td>
                {renderRowWindowRoi(row, "d6Roi")}
              </td>
              <td>
                {renderRowWindowRoi(row, "d7Roi")}
              </td>
              <td>
                {renderRowWindowRoi(row, "d15Roi")}
              </td>
              <td>
                {renderRowWindowRoi(row, "d30Roi")}
              </td>
              <td>
                {renderRowWindowRoi(row, "d60Roi")}
              </td>
              {extendedRoi.map((col) => (
                <td key={col.key}>{renderRowWindowRoi(row, col.key)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
