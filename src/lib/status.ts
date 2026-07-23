import type { KeywordStatus } from "./types";

export const statusMeta: Record<
  KeywordStatus,
  { label: string; tone: "green" | "amber" | "red" | "blue" }
> = {
  scaling: { label: "高 ROI", tone: "green" },
  observe: { label: "中 ROI", tone: "amber" },
  pause: { label: "低 ROI", tone: "red" },
  new: { label: "新词", tone: "blue" }
};
