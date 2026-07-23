export function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2
  }).format(value);
}

export function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatRoi(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatOptionalPercent(value: number | null) {
  return value === null ? "-" : formatPercent(value);
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}
