import { formatCurrency } from "../../lib/format";

export function RevenueBar({
  label,
  value,
  total,
  color
}: {
  label: string;
  value: number;
  total: number;
  color: "blue" | "green" | "amber";
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="revenue-row">
      <div className="revenue-label">
        <span>{label}</span>
        <strong>{formatCurrency(value)}</strong>
      </div>
      <div className="bar-track">
        <div
          className={`bar-fill ${color}`}
          style={{ width: `${Math.max(percent, 3)}%` }}
        />
      </div>
      <span className="bar-percent">{percent}%</span>
    </div>
  );
}
