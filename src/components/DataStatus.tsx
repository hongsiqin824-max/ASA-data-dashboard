import { Database, RefreshCw } from "lucide-react";
import type { DataLoadState } from "../lib/load-state";
import type { DashboardResponse } from "../lib/types";
import { formatDateTime, formatNumber } from "../lib/format";

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function statusCopy({
  data,
  error,
  loadState,
  now
}: {
  data: DashboardResponse | null;
  error: string;
  loadState: DataLoadState;
  now: number;
}) {
  const elapsed = loadState.startedAt ? now - loadState.startedAt : 0;
  const rowCount = data ? data.rows.length : 0;
  const serverCache = data?.source.cache;

  if (loadState.isFetching && data && loadState.fromCache) {
    return {
      title: "显示缓存数据，正在后台同步",
      detail: `已等待 ${formatDuration(elapsed)}，当前缓存 ${formatNumber(rowCount)} 个关键词`
    };
  }

  if (loadState.isFetching && data) {
    return {
      title: "保留当前数据，正在刷新数仓",
      detail: `已等待 ${formatDuration(elapsed)}，完成后会展示最新读取结果`
    };
  }

  if (loadState.isFetching) {
    return {
      title: "正在读取数仓",
      detail: `已等待 ${formatDuration(elapsed)}，完成后会自动更新当前视图`
    };
  }

  if (error && data) {
    return {
      title: "后台同步失败，继续显示已有数据",
      detail: error
    };
  }

  if (error) {
    return {
      title: "数据加载失败",
      detail: error
    };
  }

  if (data && rowCount === 0) {
    if (data.source.note.includes("暂无缓存")) {
      return {
        title: "当前查询暂无缓存",
        detail: "点击刷新可从数仓读取最新数据，并覆盖缓存"
      };
    }
    return {
      title: "当前筛选无匹配关键词",
      detail: "可以调整日期或筛选条件，也可以重新读取数仓"
    };
  }

  if (data && loadState.skippedNetwork && loadState.cacheLoadedAt) {
    return {
      title: "显示历史缓存数据",
      detail: `缓存于 ${formatDateTime(new Date(loadState.cacheLoadedAt).toISOString())}，历史区间暂不重复查库`
    };
  }

  if (data && loadState.lastFetchDurationMs !== null) {
    if (serverCache?.status === "hit") {
      return {
        title: "已使用服务器缓存",
        detail: `${formatNumber(rowCount)} 个关键词，缓存于 ${formatDateTime(
          serverCache.cachedAt
        )}，接口耗时 ${(loadState.lastFetchDurationMs / 1000).toFixed(1)} 秒`
      };
    }

    if (serverCache?.status === "refresh") {
      return {
        title: "数据已刷新",
        detail: `${formatNumber(rowCount)} 个关键词，耗时 ${(
          loadState.lastFetchDurationMs / 1000
        ).toFixed(1)} 秒`
      };
    }

    return {
      title: "数据已同步",
      detail: `${formatNumber(rowCount)} 个关键词，耗时 ${(
        loadState.lastFetchDurationMs / 1000
      ).toFixed(1)} 秒`
    };
  }

  return {
    title: "等待数据",
    detail: "当前没有可展示的数据"
  };
}

export function DataStatus({
  data,
  error,
  loadState,
  now,
  onRefresh
}: {
  data: DashboardResponse | null;
  error: string;
  loadState: DataLoadState;
  now: number;
  onRefresh: () => void;
}) {
  if (!loadState.isFetching && !data && !error) return null;

  const copy = statusCopy({ data, error, loadState, now });
  const tone = error
    ? "warning"
    : data && data.rows.length === 0
      ? "empty"
      : loadState.fromCache || loadState.skippedNetwork
        ? "cache"
        : "sync";

  return (
    <section className={`data-status ${tone}`} aria-live="polite">
      <div className="data-status-icon">
        {loadState.isFetching ? (
          <RefreshCw className="spin-icon" size={17} />
        ) : (
          <Database size={17} />
        )}
      </div>
      <div className="data-status-copy">
        <strong>{copy.title}</strong>
        <span>{copy.detail}</span>
      </div>
      <div className="data-status-actions">
        <button
          className="ghost-button data-status-button"
          type="button"
          title="重新读取数仓最新数据"
          onClick={onRefresh}
          disabled={loadState.isFetching}
        >
          <RefreshCw size={15} />
          刷新
        </button>
      </div>
      {loadState.isFetching ? <span className="data-progress" /> : null}
    </section>
  );
}
