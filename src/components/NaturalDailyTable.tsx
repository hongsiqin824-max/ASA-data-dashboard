import { useMemo } from "react";
import { formatNumber, formatPercent } from "../lib/format";
import {
  NATURAL_RETENTION_COLUMNS,
  naturalRetentionRate,
  naturalSummaryRetentionRate,
  summarizeNaturalCompareRows,
  type NaturalCompareRow,
  type NaturalRetentionKey
} from "../lib/natural-daily";

function formatNullablePercent(value: number | null) {
  return value === null ? "-" : formatPercent(value);
}

function formatNullableNumber(value: number | null) {
  return value === null ? "-" : formatNumber(value);
}

// iOS 自然量按天表：剔除 ASA 归因后的 iPhone 新增设备，与同日 ASA 激活/注册对照。
// 没有消耗/收益，因此不展示 ROI 列；留存率分母为自然量激活数。
export function NaturalDailyTable({
  rows,
  latestDate
}: {
  rows: NaturalCompareRow[];
  /** 自然量表自身的最新数据日；缺失时由上层回退到 ASA 的 dataAsOfDate。 */
  latestDate: string | null | undefined;
}) {
  const summary = useMemo(() => summarizeNaturalCompareRows(rows), [rows]);
  const sortedRows = useMemo(
    () => [...rows].sort((left, right) => right.date.localeCompare(left.date)),
    [rows]
  );

  function renderRetention(row: NaturalCompareRow, key: NaturalRetentionKey) {
    return formatNullablePercent(naturalRetentionRate(row, key, latestDate));
  }

  return (
    <div className="table-scroll daily-table-scroll">
      <table className="daily-table">
        <thead>
          <tr>
            <th>日期</th>
            <th>自然量激活</th>
            <th>ASA 激活</th>
            <th>自然量占比</th>
            <th>自然量注册</th>
            <th>ASA 注册</th>
            <th>自然量注册率</th>
            {NATURAL_RETENTION_COLUMNS.map(({ key, label }) => (
              <th key={key}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            <tr className="keyword-summary-row">
              <td className="date-cell">
                <strong>当前列表汇总</strong>
                <span>{formatNumber(summary.dayCount)} 天</span>
              </td>
              <td>{formatNumber(summary.activations)}</td>
              <td>{formatNullableNumber(summary.asaActivations)}</td>
              <td>{formatNullablePercent(summary.naturalShare)}</td>
              <td>{formatNumber(summary.registrations)}</td>
              <td>{formatNullableNumber(summary.asaRegistrations)}</td>
              <td>
                {summary.activations > 0
                  ? formatPercent(summary.registrations / summary.activations)
                  : "-"}
              </td>
              {NATURAL_RETENTION_COLUMNS.map(({ key }) => (
                <td key={key}>
                  {formatNullablePercent(
                    naturalSummaryRetentionRate(
                      rows,
                      summary,
                      key as NaturalRetentionKey,
                      latestDate
                    )
                  )}
                </td>
              ))}
            </tr>
          ) : null}
          {sortedRows.map((row) => (
            <tr key={row.date}>
              <td className="date-cell">{row.date}</td>
              <td>{formatNumber(row.activations)}</td>
              <td>{formatNullableNumber(row.asaActivations)}</td>
              <td>{formatNullablePercent(row.naturalShare)}</td>
              <td>{formatNumber(row.registrations)}</td>
              <td>{formatNullableNumber(row.asaRegistrations)}</td>
              <td>
                {row.activations > 0
                  ? formatPercent(row.registrations / row.activations)
                  : "-"}
              </td>
              {NATURAL_RETENTION_COLUMNS.map(({ key }) => (
                <td key={key}>{renderRetention(row, key as NaturalRetentionKey)}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7 + NATURAL_RETENTION_COLUMNS.length} className="advice-empty">
                当前区间暂无自然量数据
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
