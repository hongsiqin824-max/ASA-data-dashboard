import type { CSSProperties } from "react";
import { formatRoi } from "../../lib/format";

export function MiniRoi({
  value,
  emphasis = false
}: {
  value: number;
  emphasis?: boolean;
}) {
  const width = Math.min(100, Math.max(value > 0 ? 3 : 0, value * 100));
  const tone = value >= 1 ? "high" : value >= 0.3 ? "medium" : "low";
  return (
    <div
      className={`mini-roi mini-roi--${tone} ${emphasis ? "mini-roi--emphasis" : ""}`}
      style={{ "--mini-roi-fill": `${width.toFixed(2)}%` } as CSSProperties}
    >
      <span>{formatRoi(value)}</span>
    </div>
  );
}

export function EmptyRoi() {
  return <span className="mini-roi-empty" aria-label="暂无数据" />;
}
