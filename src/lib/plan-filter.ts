import type { DataPlatform } from "./types";

export function filterRowsByPlanSelection<T extends { campaignId: string }>(
  rows: T[],
  platform: DataPlatform,
  selectedPlanIds: string[] | null
) {
  if (platform !== "iOS" || selectedPlanIds === null) return rows;
  const selected = new Set(selectedPlanIds);
  return rows.filter((row) => selected.has(row.campaignId));
}
