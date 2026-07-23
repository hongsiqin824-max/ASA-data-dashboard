export type DataLoadState = {
  isFetching: boolean;
  startedAt: number | null;
  lastLoadedAt: number | null;
  lastFetchDurationMs: number | null;
  fromCache: boolean;
  cacheLoadedAt: number | null;
  nextRefreshAt: number | null;
  skippedNetwork: boolean;
};

export type DashboardLoadMode = "query" | "refresh";

export function dashboardRequestOptions(mode: DashboardLoadMode): {
  cacheOnly?: boolean;
  forceRefresh?: boolean;
} {
  return mode === "refresh" ? { forceRefresh: true } : { cacheOnly: true };
}

export const initialDataLoadState: DataLoadState = {
  isFetching: true,
  startedAt: Date.now(),
  lastLoadedAt: null,
  lastFetchDurationMs: null,
  fromCache: false,
  cacheLoadedAt: null,
  nextRefreshAt: null,
  skippedNetwork: false
};
