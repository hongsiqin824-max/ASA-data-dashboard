import { Download, RefreshCw } from "lucide-react";
import { formatDateTime } from "../lib/format";
import { platformLabel } from "../lib/platform";
import type { DashboardResponse, DataPlatform } from "../lib/types";
import type { DataLoadState } from "../lib/load-state";

function syncLabel(data: DashboardResponse | null, loadState: DataLoadState) {
  if (loadState.isFetching) {
    return data ? "后台同步中" : "读取中";
  }

  if (data?.source.cache?.status === "hit") {
    return `服务器缓存于 ${formatDateTime(data.source.cache.cachedAt)}`;
  }

  if (loadState.skippedNetwork && loadState.cacheLoadedAt) {
    return `缓存于 ${formatDateTime(new Date(loadState.cacheLoadedAt).toISOString())}`;
  }

  return data ? `更新于 ${formatDateTime(data.updatedAt)}` : "等待数据";
}

export function Topbar({
  title,
  platform,
  data,
  loadState,
  exportLabel,
  exportDisabled = false,
  onExport
}: {
  title: string;
  platform: DataPlatform;
  data: DashboardResponse | null;
  loadState: DataLoadState;
  exportLabel: string;
  exportDisabled?: boolean;
  onExport: () => void;
}) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">{platformLabel(platform)} Attribution Dashboard</p>
        <h1>{title}</h1>
      </div>
      <div className="topbar-actions">
        <span className={`sync-pill ${loadState.isFetching ? "syncing" : ""}`}>
          <RefreshCw className={loadState.isFetching ? "spin-icon" : ""} size={15} />
          {syncLabel(data, loadState)}
        </span>
        <button
          className="icon-button"
          type="button"
          title={exportLabel}
          onClick={onExport}
          disabled={!data || exportDisabled}
        >
          <Download size={18} />
        </button>
      </div>
    </header>
  );
}
