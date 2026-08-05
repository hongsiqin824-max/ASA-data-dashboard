import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { QueryParams } from "../lib/api";
import type { CampaignTableSummary } from "../lib/campaign-analysis";
import {
  formatCurrency,
  formatNumber,
  formatPercent
} from "../lib/format";
import {
  isRoiWindowMature,
  roiDaysAvailable
} from "../lib/roi-maturity";
import { campaignDetailHref } from "../lib/route";
import { platformUi } from "../lib/platform";
import type { CampaignRow } from "../lib/types";
import { EmptyRoi, MiniRoi } from "./ui/MiniRoi";
import { RoiCell } from "./ui/RoiCell";
import { StatusBadge } from "./ui/StatusBadge";

type SortDirection = "asc" | "desc";
type SortKey =
  | "label"
  | "adGroupCount"
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
  | "d1Roi"
  | "d2Roi"
  | "d3Roi"
  | "d4Roi"
  | "d5Roi"
  | "d6Roi"
  | "d7Roi"
  | "d15Roi"
  | "d30Roi"
  | "status";

type SortState = {
  key: SortKey;
  direction: SortDirection;
} | null;

type SortValue = string | number | null;

const textSortKeys = new Set<SortKey>(["label", "status"]);

function sortValue(
  row: CampaignRow,
  key: SortKey,
  latestDateMs: number | null
): SortValue {
  if (!isRoiWindowMature(key, roiDaysAvailable(row.firstDate, latestDateMs))) {
    return null;
  }
  if (key === "status") return row.status;
  return row[key] as SortValue;
}

function renderWindowRoi(
  value: number,
  key: SortKey,
  availableDays: number | null
) {
  return isRoiWindowMature(key, availableDays) ? (
    <MiniRoi value={value} />
  ) : (
    <EmptyRoi />
  );
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

export function CampaignTable({
  rows,
  summary,
  query,
  latestDateMs,
  summaryAvailableDays,
  onOpen,
  onOpenKeywords
}: {
  rows: CampaignRow[];
  summary: CampaignTableSummary;
  query: QueryParams;
  latestDateMs: number | null;
  summaryAvailableDays: number | null;
  onOpen: (campaignId: string) => void;
  onOpenKeywords?: (campaignId: string, label: string) => void;
}) {
  const ui = platformUi(query.platform);
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
        direction: textSortKeys.has(key) ? "asc" : "desc"
      };
    });
  }

  return (
    <div className="table-scroll summary-table-scroll">
      <table className="campaign-table">
        <thead>
          <tr>
            <SortableHeader label={ui.parentEntity} sortKey="label" sort={sort} onSort={toggleSort} />
            {ui.hasChildEntity ? (
              <SortableHeader label={ui.hasIosInstallBreakdown ? "广告组" : ui.childEntity} sortKey="adGroupCount" sort={sort} onSort={toggleSort} />
            ) : null}
            {ui.hasIosInstallBreakdown ? (
              <SortableHeader label="关键词" sortKey="keywordCount" sort={sort} onSort={toggleSort} />
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
            <SortableHeader label="成本" sortKey="cost" sort={sort} onSort={toggleSort} />
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
            <SortableHeader label="总 ROI" sortKey="roi" sort={sort} onSort={toggleSort} />
            <SortableHeader label="D1" sortKey="d1Roi" sort={sort} onSort={toggleSort} />
            {ui.hasFullRoiWindows ? (
              <SortableHeader label="D2" sortKey="d2Roi" sort={sort} onSort={toggleSort} />
            ) : null}
            <SortableHeader label="D3" sortKey="d3Roi" sort={sort} onSort={toggleSort} />
            {ui.hasFullRoiWindows ? (
              <>
                <SortableHeader label="D4" sortKey="d4Roi" sort={sort} onSort={toggleSort} />
                <SortableHeader label="D5" sortKey="d5Roi" sort={sort} onSort={toggleSort} />
                <SortableHeader label="D6" sortKey="d6Roi" sort={sort} onSort={toggleSort} />
              </>
            ) : null}
            <SortableHeader label="D7" sortKey="d7Roi" sort={sort} onSort={toggleSort} />
            <SortableHeader label="D15" sortKey="d15Roi" sort={sort} onSort={toggleSort} />
            <SortableHeader label="D30" sortKey="d30Roi" sort={sort} onSort={toggleSort} />
            <SortableHeader label="状态" sortKey="status" sort={sort} onSort={toggleSort} />
          </tr>
        </thead>
        <tbody>
          <tr className="keyword-summary-row">
            <td className="keyword-cell">
              <strong>当前列表汇总</strong>
              <span>{formatNumber(summary.campaignCount)} 个{ui.parentEntity}</span>
            </td>
            {ui.hasChildEntity ? <td>{formatNumber(summary.adGroupCount)}</td> : null}
            {ui.hasIosInstallBreakdown ? <td>{formatNumber(summary.keywordCount)}</td> : null}
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
              {renderWindowRoi(summary.d1Roi, "d1Roi", summaryAvailableDays)}
            </td>
            {ui.hasFullRoiWindows ? (
              <td>
                {renderWindowRoi(summary.d2Roi, "d2Roi", summaryAvailableDays)}
              </td>
            ) : null}
            <td>
              {renderWindowRoi(summary.d3Roi, "d3Roi", summaryAvailableDays)}
            </td>
            {ui.hasFullRoiWindows ? (
              <>
                <td>
                  {renderWindowRoi(summary.d4Roi, "d4Roi", summaryAvailableDays)}
                </td>
                <td>
                  {renderWindowRoi(summary.d5Roi, "d5Roi", summaryAvailableDays)}
                </td>
                <td>
                  {renderWindowRoi(summary.d6Roi, "d6Roi", summaryAvailableDays)}
                </td>
              </>
            ) : null}
            <td>
              {renderWindowRoi(summary.d7Roi, "d7Roi", summaryAvailableDays)}
            </td>
            <td>
              {renderWindowRoi(summary.d15Roi, "d15Roi", summaryAvailableDays)}
            </td>
            <td>
              {renderWindowRoi(summary.d30Roi, "d30Roi", summaryAvailableDays)}
            </td>
            <td>-</td>
          </tr>
          {sortedRows.map((row) => (
            <tr key={row.campaignId}>
              <td className="keyword-cell">
                <a
                  className="keyword-link"
                  href={campaignDetailHref(row.campaignId, query)}
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
                    onOpen(row.campaignId);
                  }}
                >
                  {row.label}
                </a>
                <span>
                  {row.advertiserId
                    ? `广告主ID ${row.advertiserId} · ${ui.parentEntity}ID ${row.campaignId}`
                    : row.campaignId}
                </span>
              </td>
              {ui.hasChildEntity ? (
                <td>
                  {!ui.hasIosInstallBreakdown && onOpenKeywords ? (
                    <button
                      className="table-link-button"
                      type="button"
                      onClick={() => onOpenKeywords(row.campaignId, row.label)}
                    >
                      {formatNumber(row.keywordCount)}
                    </button>
                  ) : (
                    formatNumber(row.adGroupCount)
                  )}
                </td>
              ) : null}
              {ui.hasIosInstallBreakdown ? <td>
                {onOpenKeywords ? (
                  <button
                    className="table-link-button"
                    type="button"
                    onClick={() => onOpenKeywords(row.campaignId, row.label)}
                  >
                    {formatNumber(row.keywordCount)}
                  </button>
                ) : (
                  formatNumber(row.keywordCount)
                )}
              </td> : null}
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
                {renderWindowRoi(row.d1Roi, "d1Roi", roiDaysAvailable(row.firstDate, latestDateMs))}
              </td>
              {ui.hasFullRoiWindows ? (
                <td>
                  {renderWindowRoi(row.d2Roi, "d2Roi", roiDaysAvailable(row.firstDate, latestDateMs))}
                </td>
              ) : null}
              <td>
                {renderWindowRoi(row.d3Roi, "d3Roi", roiDaysAvailable(row.firstDate, latestDateMs))}
              </td>
              {ui.hasFullRoiWindows ? (
                <>
                  <td>
                    {renderWindowRoi(row.d4Roi, "d4Roi", roiDaysAvailable(row.firstDate, latestDateMs))}
                  </td>
                  <td>
                    {renderWindowRoi(row.d5Roi, "d5Roi", roiDaysAvailable(row.firstDate, latestDateMs))}
                  </td>
                  <td>
                    {renderWindowRoi(row.d6Roi, "d6Roi", roiDaysAvailable(row.firstDate, latestDateMs))}
                  </td>
                </>
              ) : null}
              <td>
                {renderWindowRoi(row.d7Roi, "d7Roi", roiDaysAvailable(row.firstDate, latestDateMs))}
              </td>
              <td>
                {renderWindowRoi(row.d15Roi, "d15Roi", roiDaysAvailable(row.firstDate, latestDateMs))}
              </td>
              <td>
                {renderWindowRoi(row.d30Roi, "d30Roi", roiDaysAvailable(row.firstDate, latestDateMs))}
              </td>
              <td>
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
