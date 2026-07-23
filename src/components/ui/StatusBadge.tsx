import { statusMeta } from "../../lib/status";
import type { KeywordStatus } from "../../lib/types";

export function StatusBadge({ status }: { status: KeywordStatus }) {
  const meta = statusMeta[status];
  return <span className={`status-badge ${meta.tone}`}>{meta.label}</span>;
}
