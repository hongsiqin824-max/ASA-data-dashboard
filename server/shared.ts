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
