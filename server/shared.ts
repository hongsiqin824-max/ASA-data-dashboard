export type RevenueMode = "pay" | "ad" | "all";
export type SourceMode = "unconfigured" | "live";

export function parseRevenueMode(value: unknown): RevenueMode {
  return value === "pay" || value === "ad" ? value : "all";
}

export function parseSourceMode(value: unknown): SourceMode {
  if (value === "live") return value;
  return "unconfigured";
}

export function round(value: number, digits = 2) {
  const base = 10 ** digits;
  return Math.round(value * base) / base;
}

export function compactDate(value: unknown, fallback: string) {
  const normalized = String(value ?? "").replaceAll("-", "");
  return /^\d{8}$/.test(normalized) ? normalized : fallback;
}

// 返回北京时间(UTC+8)偏移 dayOffset 天的 YYYYMMDD 格式日期。
export function beijingCompactDate(dayOffset = 0): string {
  const ms = Date.now() + (8 * 60 + dayOffset * 24 * 60) * 60 * 1000;
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}
