import type { ReactNode } from "react";

export function Field({
  label,
  children,
  size = "md",
  plain = false
}: {
  label: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "auto";
  plain?: boolean;
}) {
  return (
    <label className={`field field-${size}`}>
      <span>{label}</span>
      {plain ? children : <div className="field-control">{children}</div>}
    </label>
  );
}
