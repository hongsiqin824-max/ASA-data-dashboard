import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { QueryParams } from "../lib/api";
import {
  formatCurrency,
  formatNumber,
  formatPercent
} from "../lib/format";
import {
  type KeywordAnalysisRow,
  type KeywordTableSummary
} from "../lib/keyword-analysis";
import {
  isRoiWindowMature,
  roiDaysAvailable,
  roiWindowDays,
  type RoiWindowKey
} from "../lib/roi-maturity";
import { keywordDetailHref } from "../lib/route";
import { keywordEntityOrder, platformUi } from "../lib/platform";
import { retentionColumns } from "../lib/retention-columns";
import { extendedRoiColumns } from "../lib/roi-columns";
import { EmptyRoi, MiniRoi } from "./ui/MiniRoi";
import { RoiCell } from "./ui/RoiCell";
import { StatusBadge } from "./ui/StatusBadge";

function formatOptionalCurrency(value: number | null) {
  return value === null ? "-" : formatCurrency(value);
}

function renderRetention(
  value: number | null | undefined,
  day: number,
  availableDays: number | null
) {
  if (availableDays === null || availableDays < day) return "-";
  return value === null || value === undefined ? "-" : formatNumber(value);
}

function renderWindowRoi(
  value: number | null,
  cost: number,
  key: SortKey,
  availableDays: number | null
) {
  // value 为 null：40 日及以上档位在非「全部」收益口径下取不到值
  return value !== null && cost > 0 && isRoiWindowMature(key, availableDays) ? (
    <MiniRoi value={value} />
  ) : (
    <EmptyRoi />
  );
}

const RENDER_BATCH_SIZE = 200;

type SortDirection = "asc" | "desc";
type SortKey =
  | "keyword"
  | "campaignName"
  | "adGroupName"
  | "firstDate"
  | "activeDays"
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
  | "activationCost"
  | "registrationCost"
  | "paymentRate"
  | RoiWindowKey
  | "roi"
  | "adRevenue"
  | "payRevenue"
  | "totalRevenue"
  | "status";

type SortState = {
  key: SortKey;
  direction: SortDirection;
} | null;

type SortValue = string | number | null;

const textSortKeys = new Set<SortKey>([
  "keyword",
  "campaignName",
  "adGroupName",
  "firstDate",
  "status"
]);

function roiWindowValue(
  row: KeywordAnalysisRow,
  key: SortKey,
  latestDateMs: number | null
) {
  const availableDays = roiDaysAvailable(row.firstDate, latestDateMs);
  return row.cost > 0 && isRoiWindowMature(key, availableDays)
    ? row[key as keyof KeywordAnalysisRow]
    : null;
}

function sortValue(
  row: KeywordAnalysisRow,
  key: SortKey,
  latestDateMs: number | null
): SortValue {
  if (key in roiWindowDays) {
    return roiWindowValue(row, key as RoiWindowKey, latestDateMs) as number | null;
  }
  if (key === "activationCost" || key === "registrationCost") return row[key];
  if (key === "status") return row.status;
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

function ChildEntityCell({
  row,
  query,
  onOpen
}: {
  row: KeywordAnalysisRow;
  query: QueryParams;
  onOpen: (keywordId: string, campaignId: string, adGroupId: string) => void;
}) {
  return (
    <td className="keyword-cell">
      <a
        className="keyword-link"
        href={keywordDetailHref(
          row.keywordId,
          query,
          row.campaignId,
          row.adGroupId
        )}
        onClick={(event) => {
          if (
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            event.button !== 0
          ) {
            return;
          }

          event.preventDefault();
          onOpen(row.keywordId, row.campaignId, row.adGroupId);
        }}
      >
        {row.keyword}
      </a>
      {row.keyword !== row.keywordId ? <span>{row.keywordId}</span> : null}
    </td>
  );
}

export function KeywordTable({
  rows,
  summary,
  query,
  latestDateMs,
  summaryAvailableDays,
  onOpen,
  showAllRetention = false,
  showAllRoi = false
}: {
  rows: KeywordAnalysisRow[];
  summary: KeywordTableSummary;
  query: QueryParams;
  latestDateMs: number | null;
  summaryAvailableDays: number | null;
  onOpen: (keywordId: string, campaignId: string, adGroupId: string) => void;
  /** 明细页传 true：展示全部留存档位；列表页保持精简。 */
  showAllRetention?: boolean;
  /** 明细页传 true：追加 40 日及以上的 ROI 档位；列表页保持精简。 */
  showAllRoi?: boolean;
}) {
  const ui = platformUi(query.platform);
  const showRetention = query.platform === "iOS";
  const RETENTION_COLUMNS = retentionColumns(showAllRetention);
  const extendedRoi =
    showAllRoi && ui.hasExtendedRoiWindows ? extendedRoiColumns() : [];
  const parentFirst = keywordEntityOrder(query.platform)[0] === "parent";
  const [renderLimit, setRenderLimit] = useState(RENDER_BATCH_SIZE);
  const [sort, setSort] = useState<SortState>(null);
  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((left, right) => {
      const result = compareSortValues(
        sortValue(left, sort.key, latestDateMs),
        sortValue(right, sort.key, latestDateMs),
        sort.direction
      );
      return result || right.cost - left.cost;
    });
  }, [latestDateMs, rows, sort]);
  const visibleRows = useMemo(
    () => sortedRows.slice(0, renderLimit),
    [renderLimit, sortedRows]
  );
  const hasMoreRows = visibleRows.length < sortedRows.length;

  function toggleSort(key: SortKey) {
    setRenderLimit(RENDER_BATCH_SIZE);
    setSort((current) => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === "desc" ? "asc" : "desc"
        };
      }
      return {
        key,
        direction: textSortKeys.has(key) ? "asc" : "desc"
      };
    });
  }

  return (
    <>
      <div className="table-scroll summary-table-scroll">
        <table className="keyword-table">
          <thead>
            <tr>
              {parentFirst ? (
                <>
                  <SortableHeader label={ui.parentEntity} sortKey="campaignName" sort={sort} onSort={toggleSort} />
                  <SortableHeader label={ui.childEntity} sortKey="keyword" sort={sort} onSort={toggleSort} />
                </>
              ) : (
                <>
                  <SortableHeader label={ui.childEntity} sortKey="keyword" sort={sort} onSort={toggleSort} />
                  <SortableHeader label={ui.parentEntity} sortKey="campaignName" sort={sort} onSort={toggleSort} />
                </>
              )}
              {ui.hasIosInstallBreakdown ? (
                <SortableHeader label="广告组" sortKey="adGroupName" sort={sort} onSort={toggleSort} />
              ) : null}
              <SortableHeader label="首投日" sortKey="firstDate" sort={sort} onSort={toggleSort} />
              <SortableHeader label="投放天数" sortKey="activeDays" sort={sort} onSort={toggleSort} />
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
              ) : (
                <SortableHeader label="下载" sortKey="installs" sort={sort} onSort={toggleSort} />
              )}
              <SortableHeader label="激活" sortKey="activations" sort={sort} onSort={toggleSort} />
              <SortableHeader label="注册" sortKey="registrations" sort={sort} onSort={toggleSort} />
              <SortableHeader label="消耗" sortKey="cost" sort={sort} onSort={toggleSort} />
              <SortableHeader label="单激活成本" sortKey="activationCost" sort={sort} onSort={toggleSort} />
              <SortableHeader label="单注册成本" sortKey="registrationCost" sort={sort} onSort={toggleSort} />
              <SortableHeader label="付费率" sortKey="paymentRate" sort={sort} onSort={toggleSort} />
              {showRetention
                ? RETENTION_COLUMNS.map(({ key, label }) => (
                    <th key={key} title="关键词留存设备数；同一设备可能在多个关键词中重复计数">
                      {label}
                    </th>
                  ))
                : null}
              <SortableHeader label="总 ROI" sortKey="roi" sort={sort} onSort={toggleSort} />
              <SortableHeader label="D1 ROI" sortKey="d1Roi" sort={sort} onSort={toggleSort} />
              <SortableHeader label="D2 ROI" sortKey="d2Roi" sort={sort} onSort={toggleSort} />
              <SortableHeader label="D3 ROI" sortKey="d3Roi" sort={sort} onSort={toggleSort} />
              <SortableHeader label="D4 ROI" sortKey="d4Roi" sort={sort} onSort={toggleSort} />
              <SortableHeader label="D5 ROI" sortKey="d5Roi" sort={sort} onSort={toggleSort} />
              <SortableHeader label="D6 ROI" sortKey="d6Roi" sort={sort} onSort={toggleSort} />
              <SortableHeader label="D7 ROI" sortKey="d7Roi" sort={sort} onSort={toggleSort} />
              <SortableHeader label="D15 ROI" sortKey="d15Roi" sort={sort} onSort={toggleSort} />
              <SortableHeader label="D30 ROI" sortKey="d30Roi" sort={sort} onSort={toggleSort} />
              <SortableHeader label="D60 ROI" sortKey="d60Roi" sort={sort} onSort={toggleSort} />
              {extendedRoi.map((col) => (
                <SortableHeader
                  key={col.key}
                  label={`${col.label} ROI`}
                  sortKey={col.key}
                  sort={sort}
                  onSort={toggleSort}
                />
              ))}
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
              <SortableHeader label="累计分层" sortKey="status" sort={sort} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            <tr className="keyword-summary-row">
              <td title={showRetention ? "留存设备数为关键词行直接求和，未跨关键词去重" : undefined}>
                {showRetention ? "当前列表汇总（关键词留存合计）" : "当前列表汇总"}
              </td>
              {ui.hasChildEntity ? (
                <td>{formatNumber(summary.keywordCount)} 个{ui.childEntity}</td>
              ) : null}
              {ui.hasIosInstallBreakdown ? <td>-</td> : null}
              <td>-</td>
              <td>-</td>
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
              ) : (
                <td>{formatNumber(summary.installs)}</td>
              )}
              <td>{formatNumber(summary.activations)}</td>
              <td>{formatNumber(summary.registrations)}</td>
              <td>{formatCurrency(summary.cost)}</td>
              <td>{formatOptionalCurrency(summary.activationCost)}</td>
              <td>{formatOptionalCurrency(summary.registrationCost)}</td>
              <td>-</td>
              {showRetention
                ? RETENTION_COLUMNS.map(({ day, key }) => (
                    <td key={key} title="关键词留存合计，未跨关键词去重">
                      {renderRetention(summary[key], day, summaryAvailableDays)}
                    </td>
                  ))
                : null}
              <td>
                <RoiCell value={summary.roi} />
              </td>
              <td>
                {renderWindowRoi(summary.d1Roi, summary.cost, "d1Roi", summaryAvailableDays)}
              </td>
              <td>
                {renderWindowRoi(summary.d2Roi, summary.cost, "d2Roi", summaryAvailableDays)}
              </td>
              <td>
                {renderWindowRoi(summary.d3Roi, summary.cost, "d3Roi", summaryAvailableDays)}
              </td>
              <td>
                {renderWindowRoi(summary.d4Roi, summary.cost, "d4Roi", summaryAvailableDays)}
              </td>
              <td>
                {renderWindowRoi(summary.d5Roi, summary.cost, "d5Roi", summaryAvailableDays)}
              </td>
              <td>
                {renderWindowRoi(summary.d6Roi, summary.cost, "d6Roi", summaryAvailableDays)}
              </td>
              <td>
                {renderWindowRoi(summary.d7Roi, summary.cost, "d7Roi", summaryAvailableDays)}
              </td>
              <td>
                {renderWindowRoi(summary.d15Roi, summary.cost, "d15Roi", summaryAvailableDays)}
              </td>
              <td>
                {renderWindowRoi(summary.d30Roi, summary.cost, "d30Roi", summaryAvailableDays)}
              </td>
              <td>
                {renderWindowRoi(summary.d60Roi, summary.cost, "d60Roi", summaryAvailableDays)}
              </td>
              {extendedRoi.map((col) => (
                <td key={col.key}>
                  {renderWindowRoi(
                    summary[col.key],
                    summary.cost,
                    col.key,
                    summaryAvailableDays
                  )}
                </td>
              ))}
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
              <td>-</td>
            </tr>
            {visibleRows.map((row) => (
              <tr key={`${row.campaignId}-${row.adGroupId}-${row.keywordId}`}>
                {parentFirst ? (
                  <>
                    <td>{row.campaignName || row.campaignId}</td>
                    <ChildEntityCell row={row} query={query} onOpen={onOpen} />
                  </>
                ) : (
                  <>
                    <ChildEntityCell row={row} query={query} onOpen={onOpen} />
                    <td>{row.campaignName || row.campaignId}</td>
                  </>
                )}
                {ui.hasIosInstallBreakdown ? <td>{row.adGroupName}</td> : null}
                <td>{row.firstDate ?? "-"}</td>
                <td>{row.activeDays > 0 ? `${formatNumber(row.activeDays)} 天` : "-"}</td>
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
                <td>{formatOptionalCurrency(row.activationCost)}</td>
                <td>{formatOptionalCurrency(row.registrationCost)}</td>
                <td>{formatPercent(row.paymentRate)}</td>
                {showRetention
                  ? RETENTION_COLUMNS.map(({ day, key }) => (
                      <td key={key}>
                        {renderRetention(row[key], day, roiDaysAvailable(row.firstDate, latestDateMs))}
                      </td>
                    ))
                  : null}
                <td>
                  <RoiCell value={row.roi} />
                </td>
                <td>{renderWindowRoi(row.d1Roi, row.cost, "d1Roi", roiDaysAvailable(row.firstDate, latestDateMs))}</td>
                <td>{renderWindowRoi(row.d2Roi, row.cost, "d2Roi", roiDaysAvailable(row.firstDate, latestDateMs))}</td>
                <td>{renderWindowRoi(row.d3Roi, row.cost, "d3Roi", roiDaysAvailable(row.firstDate, latestDateMs))}</td>
                <td>{renderWindowRoi(row.d4Roi, row.cost, "d4Roi", roiDaysAvailable(row.firstDate, latestDateMs))}</td>
                <td>{renderWindowRoi(row.d5Roi, row.cost, "d5Roi", roiDaysAvailable(row.firstDate, latestDateMs))}</td>
                <td>{renderWindowRoi(row.d6Roi, row.cost, "d6Roi", roiDaysAvailable(row.firstDate, latestDateMs))}</td>
                <td>{renderWindowRoi(row.d7Roi, row.cost, "d7Roi", roiDaysAvailable(row.firstDate, latestDateMs))}</td>
                <td>{renderWindowRoi(row.d15Roi, row.cost, "d15Roi", roiDaysAvailable(row.firstDate, latestDateMs))}</td>
                <td>{renderWindowRoi(row.d30Roi, row.cost, "d30Roi", roiDaysAvailable(row.firstDate, latestDateMs))}</td>
                <td>{renderWindowRoi(row.d60Roi, row.cost, "d60Roi", roiDaysAvailable(row.firstDate, latestDateMs))}</td>
                {extendedRoi.map((col) => (
                  <td key={col.key}>
                    {renderWindowRoi(
                      row[col.key],
                      row.cost,
                      col.key,
                      roiDaysAvailable(row.firstDate, latestDateMs)
                    )}
                  </td>
                ))}
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
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasMoreRows ? (
        <div className="table-load-more">
          <span>
            已渲染 {formatNumber(visibleRows.length)} / {formatNumber(rows.length)} 个{ui.childEntity}
          </span>
          <button
            className="ghost-button"
            type="button"
            onClick={() => setRenderLimit((current) => current + RENDER_BATCH_SIZE)}
          >
            加载更多
          </button>
        </div>
      ) : null}
    </>
  );
}
