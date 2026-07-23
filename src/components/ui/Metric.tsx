import type { ReactNode } from "react";

export function Metric({
  label,
  value,
  trend,
  icon,
  detail
}: {
  label: string;
  value: string;
  trend: string;
  icon: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <article className="metric">
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <div className="metric-detail">{detail}</div> : null}
      <small>{trend}</small>
    </article>
  );
}
