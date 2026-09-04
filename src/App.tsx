import { useEffect, useMemo, useState } from "react";
import { fetchCampaignOptions, fetchKeywordDailyRows, fetchKeywordRoi } from "./lib/api";
import { dailyKeywordRowsToKeywordRows } from "./lib/daily-keywords";
import {
  buildQuerySearch,
  campaignDetailHref,
  keywordDetailHref,
  readQueryFromUrl,
  readRouteFromUrl,
  type RouteState
} from "./lib/route";
import {
  exportCampaignRows,
  exportDailySummaryRows,
  exportDailyRows,
  exportKeywordRows
} from "./lib/export";
import { withBase } from "./lib/base";
import type { QueryParams } from "./lib/api";
import type {
  DailyKeywordRow,
  DashboardResponse,
  DataPlatform,
  KeywordRow
} from "./lib/types";
import { platformLabel, platformUi } from "./lib/platform";
import { aggregateCampaignDaily, aggregateCampaigns } from "./lib/campaign";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { FilterBar } from "./components/FilterBar";
import { MetricGrid } from "./components/MetricGrid";
import {
  CampaignListPage,
  type HomeView,
  type KeywordListScope
} from "./components/CampaignListPage";
import { CampaignDetailPage } from "./components/CampaignDetailPage";
import { KeywordDetailPage } from "./components/KeywordDetailPage";
import { DetailEmptyState } from "./components/DetailEmptyState";
import { DataStatus } from "./components/DataStatus";
import {
  canUseHistoricalCache,
  readDashboardCache,
  writeDashboardCache
} from "./lib/dashboard-cache";
import {
  dashboardRequestOptions,
  type DashboardLoadMode,
  type DataLoadState
} from "./lib/load-state";

type DashboardState = {
  data: DashboardResponse | null;
  loadState: DataLoadState;
};

type DailyScopeState = {
  key: string;
  rows: DailyKeywordRow[];
  error: string;
};

type DateKeywordScopeState = {
  key: string;
  rows: KeywordRow[];
  error: string;
};

function compactOrDashedDate(value: string) {
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  return value;
}

function prepareDashboardLoad(
  query: QueryParams,
  skipLocalCache: boolean
): DashboardState {
  const startedAt = Date.now();
  const cached = readDashboardCache(query);
  const canSkipNetwork =
    cached !== null && !skipLocalCache && canUseHistoricalCache(query, cached.cachedAt);

  return {
    data: cached?.data ?? null,
    loadState: {
      isFetching: !canSkipNetwork,
      startedAt: canSkipNetwork ? null : startedAt,
      lastLoadedAt: cached?.cachedAt ?? null,
      lastFetchDurationMs: null,
      fromCache: cached !== null,
      cacheLoadedAt: cached?.cachedAt ?? null,
      nextRefreshAt: null,
      skippedNetwork: canSkipNetwork
    }
  };
}

function markDashboardRefreshing(current: DashboardState): DashboardState {
  return {
    ...current,
    loadState: {
      ...current.loadState,
      isFetching: true,
      startedAt: Date.now(),
      lastFetchDurationMs: null,
      nextRefreshAt: null,
      skippedNetwork: false
    }
  };
}

function App() {
  const [route, setRoute] = useState<RouteState>(() => readRouteFromUrl());
  const [query, setQuery] = useState<QueryParams>(() => readQueryFromUrl());
  const [dashboard, setDashboard] = useState<DashboardState>(() =>
    prepareDashboardLoad(readQueryFromUrl(), false)
  );
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [homeView, setHomeView] = useState<HomeView>(() =>
    platformUi(readQueryFromUrl().platform).hasChildEntity ? "keywords" : "campaigns"
  );
  const [keywordScope, setKeywordScope] = useState<KeywordListScope>({
    type: "all"
  });
  const [iosPlanSelection, setIosPlanSelection] = useState<string[] | null>(null);
  const [iosPlanOptions, setIosPlanOptions] = useState<
    Array<{ id: string; label: string }>
  >([]);
  const [iosPlanLoading, setIosPlanLoading] = useState(false);
  const [refreshRequest, setRefreshRequest] = useState({
    id: 0,
    mode: "query" as DashboardLoadMode
  });
  const [dailyScope, setDailyScope] = useState<DailyScopeState>({
    key: "",
    rows: [],
    error: ""
  });
  const [dateKeywordScope, setDateKeywordScope] =
    useState<DateKeywordScopeState>({
      key: "",
      rows: [],
      error: ""
    });

  const data = dashboard.data;
  const loadState = dashboard.loadState;
  const loading = loadState.isFetching;

  function updateQuery(next: Partial<QueryParams>) {
    const nextQuery = { ...query, ...next };
    setRoute({ page: "campaigns" });
    setQuery(nextQuery);
    setKeywordScope({ type: "all" });
    setDashboard(prepareDashboardLoad(nextQuery, false));
    setError("");
    setRefreshRequest((current) => ({
      id: current.id + 1,
      mode: "query"
    }));
    window.history.replaceState(
      { page: "campaigns" },
      "",
      withBase(`/${buildQuerySearch(nextQuery)}`)
    );
  }

  function changePlatform(platform: DataPlatform) {
    setHomeView(platformUi(platform).hasChildEntity ? "keywords" : "campaigns");
    updateQuery({
      platform,
      campaignId: "",
      adGroupId: ""
    });
  }
  function openCampaignDetail(campaignId: string) {
    setRoute({ page: "campaign", campaignId });
    window.history.pushState(
      { page: "campaign", from: "campaigns" },
      "",
      campaignDetailHref(campaignId, query)
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openKeywordDetail(
    keywordId: string,
    campaignId: string,
    adGroupId: string
  ) {
    setRoute({ page: "detail", keywordId, campaignId, adGroupId });
    window.history.pushState(
      { page: "detail", from: "campaign", campaignId, adGroupId },
      "",
      keywordDetailHref(keywordId, query, campaignId, adGroupId)
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showHome() {
    setRoute({ page: "campaigns" });
    window.history.replaceState(
      { page: "campaigns" },
      "",
      withBase(`/${buildQuerySearch(query)}`)
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openCampaignKeywords(campaignId: string, label: string) {
    setHomeView("keywords");
    setKeywordScope({
      type: "campaign",
      campaignId,
      label
    });
    showHome();
  }

  function openDateKeywords(date: string) {
    const label = compactOrDashedDate(date);
    setHomeView("keywords");
    setKeywordScope({
      type: "date",
      date,
      label
    });
    showHome();
  }

  function clearKeywordScope() {
    setKeywordScope({ type: "all" });
  }

  function backToCampaigns() {
    if (window.history.state?.from === "campaigns") {
      window.history.back();
      return;
    }
    setRoute({ page: "campaigns" });
    window.history.replaceState(
      { page: "campaigns" },
      "",
      withBase(`/${buildQuerySearch(query)}`)
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function backToCampaignDetail(campaignId: string) {
    if (window.history.state?.from === "campaign") {
      window.history.back();
      return;
    }
    if (!campaignId) {
      backToCampaigns();
      return;
    }
    setRoute({ page: "campaign", campaignId });
    window.history.replaceState(
      { page: "campaign", from: "campaigns" },
      "",
      campaignDetailHref(campaignId, query)
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  useEffect(() => {
    window.history.replaceState(
      { ...(window.history.state ?? {}), page: readRouteFromUrl().page },
      "",
      window.location.href
    );

    const handlePopState = () => {
      const nextQuery = readQueryFromUrl();
      setRoute(readRouteFromUrl());
      setQuery(nextQuery);
      setHomeView(
        platformUi(nextQuery.platform).hasChildEntity ? "keywords" : "campaigns"
      );
      setKeywordScope({ type: "all" });
      setDashboard(prepareDashboardLoad(nextQuery, false));
      setError("");
      setRefreshRequest((current) => ({
        id: current.id + 1,
        mode: "query"
      }));
      window.scrollTo({ top: 0 });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (query.platform !== "iOS" || homeView !== "keywords") {
      return;
    }

    let active = true;
    let settled = false;
    queueMicrotask(() => {
      if (active && !settled) setIosPlanLoading(true);
    });
    fetchCampaignOptions("iOS")
      .then((options) => {
        if (!active) return;
        setIosPlanOptions(options.map((option) => ({ id: option.id, label: option.name })));
      })
      .catch(() => {
        if (active) setIosPlanOptions([]);
      })
      .finally(() => {
        settled = true;
        if (active) setIosPlanLoading(false);
      });

    return () => {
      active = false;
    };
  }, [homeView, query.platform]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const startedAt = Date.now();
    const skipLocalCache = refreshRequest.mode !== "query";
    const prepared = prepareDashboardLoad(query, skipLocalCache);

    if (prepared.loadState.skippedNetwork) {
      return () => {
        active = false;
      };
    }

    fetchKeywordRoi(query, dashboardRequestOptions(refreshRequest.mode))
      .then((payload) => {
        if (active) {
          const loadedAt = Date.now();
          writeDashboardCache(query, payload);
          setError("");
          setDashboard({
            data: payload,
            loadState: {
              isFetching: false,
              startedAt: null,
              lastLoadedAt: loadedAt,
              lastFetchDurationMs: loadedAt - startedAt,
              fromCache: false,
              cacheLoadedAt: null,
              nextRefreshAt: null,
              skippedNetwork: false
            }
          });
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : "数据加载失败");
          setDashboard((current) => ({
            ...current,
            loadState: {
              ...current.loadState,
              isFetching: false,
              startedAt: null,
              nextRefreshAt: null
            }
          }));
        }
      });

    return () => {
      active = false;
    };
  }, [query, refreshRequest]);

  function refreshData() {
    setDashboard((current) => markDashboardRefreshing(current));
    setRefreshRequest((current) => ({
      id: current.id + 1,
      mode: "refresh"
    }));
  }

  function resetIosPlanSelection() {
    if (query.platform === "iOS") setIosPlanSelection(null);
  }

  const sortedRows = useMemo(() => {
    return [...(data?.rows ?? [])].sort((a, b) => b.roi - a.roi);
  }, [data]);

  // 计划层在前端聚合：按成本降序（收入回填前 ROI 多为 0，成本排序更有意义）
  const campaignRows = useMemo(() => {
    return aggregateCampaigns(data?.rows ?? []).sort((a, b) => b.cost - a.cost);
  }, [data]);

  const hasCampaigns = campaignRows.length > 0;
  // 选中的计划（计划详情页）
  const selectedCampaignId =
    route.page === "campaign" ? route.campaignId : null;
  const selectedCampaign = campaignRows.find(
    (row) => row.campaignId === selectedCampaignId
  );
  const campaignKeywordRows = selectedCampaignId
    ? sortedRows.filter((row) => row.campaignId === selectedCampaignId)
    : [];

  // 选中的关键词（关键词每日明细页）
  const selectedKeywordId = route.page === "detail" ? route.keywordId : null;
  const detailCampaignId = route.page === "detail" ? route.campaignId : undefined;
  const detailAdGroupId = route.page === "detail" ? route.adGroupId : undefined;
  const selectedKeyword = sortedRows.find((row) => {
    if (row.keywordId !== selectedKeywordId) return false;
    if (detailAdGroupId && row.adGroupId !== detailAdGroupId) return false;
    return detailCampaignId ? row.campaignId === detailCampaignId : true;
  });
  // 关键词所属计划：优先 history.state，回退到行数据，用于「返回计划详情」
  const keywordCampaignId =
    detailCampaignId ??
    window.history.state?.campaignId ??
    selectedKeyword?.campaignId ??
    "";

  const dailyScopeKey =
    route.page === "campaign" && selectedCampaignId
      ? `campaign:${query.platform}:${query.startDate}:${query.endDate}:${query.revenueMode}:${selectedCampaignId}`
      : route.page === "detail" && selectedKeywordId
        ? `keyword:${query.platform}:${query.startDate}:${query.endDate}:${query.revenueMode}:${detailCampaignId ?? ""}:${detailAdGroupId ?? ""}:${selectedKeywordId}`
        : "";
  const dailyScopeLoading = Boolean(dailyScopeKey && dailyScope.key !== dailyScopeKey);
  const dailyScopeError = dailyScope.key === dailyScopeKey ? dailyScope.error : "";
  const scopedDailyRows = useMemo(() => {
    const rows = dailyScope.key === dailyScopeKey ? dailyScope.rows : [];
    return [...rows].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.cost - a.cost;
    });
  }, [dailyScope.key, dailyScope.rows, dailyScopeKey]);
  const campaignDailyRows = useMemo(() => {
    if (!selectedCampaignId) return [];
    return aggregateCampaignDaily(scopedDailyRows);
  }, [scopedDailyRows, selectedCampaignId]);
  const selectedDailyRows = selectedKeywordId ? scopedDailyRows : [];

  const dateKeywordScopeKey =
    keywordScope.type === "date"
      ? [
          "date",
          keywordScope.date,
          query.platform,
          query.channel,
          query.channelGroup,
          query.campaignId,
          query.adGroupId,
          query.keyword,
          query.status,
          query.grain,
          query.revenueMode
        ].join(":")
      : "";
  const scopedDateKeywordRows =
    dateKeywordScope.key === dateKeywordScopeKey ? dateKeywordScope.rows : [];
  const scopedDateKeywordError =
    dateKeywordScope.key === dateKeywordScopeKey ? dateKeywordScope.error : "";
  const scopedDateKeywordLoading = Boolean(
    dateKeywordScopeKey && dateKeywordScope.key !== dateKeywordScopeKey
  );

  useEffect(() => {
    if (!dailyScopeKey) {
      return;
    }

    let active = true;
    const scope =
      route.page === "campaign"
        ? { campaignId: selectedCampaignId ?? "" }
        : {
            campaignId: detailCampaignId,
            adGroupId: detailAdGroupId,
            keywordId: selectedKeywordId ?? ""
          };

    fetchKeywordDailyRows(query, scope)
      .then((rows) => {
        if (!active) return;
        setDailyScope({
          key: dailyScopeKey,
          rows,
          error: ""
        });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setDailyScope({
          key: dailyScopeKey,
          rows: [],
          error: err instanceof Error ? err.message : "每日明细加载失败"
        });
      });

    return () => {
      active = false;
    };
  }, [
    dailyScopeKey,
    detailAdGroupId,
    detailCampaignId,
    query,
    route.page,
    selectedCampaignId,
    selectedKeywordId
  ]);

  useEffect(() => {
    if (keywordScope.type !== "date" || !dateKeywordScopeKey) {
      return;
    }

    let active = true;
    const date = compactOrDashedDate(keywordScope.date);
    const scopedQuery = {
      ...query,
      startDate: date,
      endDate: date
    };

    fetchKeywordDailyRows(scopedQuery, {})
      .then((rows) => {
        if (!active) return;
        setDateKeywordScope({
          key: dateKeywordScopeKey,
          rows: dailyKeywordRowsToKeywordRows(rows, date),
          error: ""
        });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setDateKeywordScope({
          key: dateKeywordScopeKey,
          rows: [],
          error: err instanceof Error ? err.message : "日期关键词加载失败"
        });
      });

    return () => {
      active = false;
    };
  }, [dateKeywordScopeKey, keywordScope, query]);

  const ui = platformUi(query.platform);
  let exportLabel =
    homeView === "daily"
      ? "导出日期汇总"
      : homeView === "campaigns"
        ? `导出${ui.parentEntity}汇总`
        : `导出${ui.childEntity}汇总`;
  let exportDisabled = false;
  let onExport =
    homeView === "daily"
      ? () =>
          exportDailySummaryRows(
            data?.dailySummaryRows ?? [],
            query.platform,
            data?.dataAsOfDate
          )
      : homeView === "campaigns"
      ? () => exportCampaignRows(campaignRows, query.platform)
      : () => exportKeywordRows(sortedRows, query.platform);
  if (route.page === "detail" && selectedKeyword) {
    exportLabel = dailyScopeLoading
      ? "每日明细加载中"
      : `导出 ${selectedKeyword.keyword} 每日明细`;
    exportDisabled = dailyScopeLoading;
    onExport = () =>
      exportDailyRows(selectedDailyRows, selectedKeyword.keyword, query.platform);
  } else if (route.page === "campaign" && selectedCampaign) {
    if (ui.hasChildEntity) {
      exportLabel = `导出 ${selectedCampaign.label} ${ui.childEntity}`;
      onExport = () => exportKeywordRows(campaignKeywordRows, query.platform);
    } else {
      exportLabel = dailyScopeLoading
        ? "逐日明细加载中"
        : `导出 ${selectedCampaign.label} 逐日明细`;
      exportDisabled = dailyScopeLoading;
      onExport = () =>
        exportDailyRows(scopedDailyRows, selectedCampaign.label, query.platform);
    }
  }

  const title =
    route.page === "detail"
      ? `${ui.childEntity}每日明细`
      : route.page === "campaign"
        ? (selectedCampaign?.label ?? `${ui.parentEntity}详情`)
        : `${platformLabel(query.platform)} ${ui.parentEntity} ROI 总览`;
  return (
    <div className="app-shell">
      <Sidebar data={data} platform={query.platform} onHome={backToCampaigns} />

      <main className="main">
        <Topbar
          title={title}
          platform={query.platform}
          data={data}
          loadState={loadState}
          exportLabel={exportLabel}
          exportDisabled={exportDisabled}
          onExport={onExport}
        />

        <DataStatus
          data={data}
          error={error}
          loadState={loadState}
          now={now}
          onRefresh={refreshData}
        />

        {route.page === "campaigns" ? (
          <FilterBar
            query={query}
            data={data}
            onChange={updateQuery}
            onPlatformChange={changePlatform}
            onResetPlans={resetIosPlanSelection}
          />
        ) : null}

        {error ? <div className="error-state">{error}</div> : null}

        {route.page === "campaigns" ? (
          <MetricGrid data={data} hasKeywordRows={hasCampaigns} />
        ) : null}

        {route.page === "detail" && selectedKeyword ? (
          <KeywordDetailPage
            keyword={selectedKeyword}
            rows={selectedDailyRows}
            loading={dailyScopeLoading}
            error={dailyScopeError}
            dataAsOfDate={data?.dataAsOfDate ?? null}
            onBack={() => backToCampaignDetail(keywordCampaignId)}
          />
        ) : route.page === "detail" ? (
          <DetailEmptyState
            loading={loading && !data}
            entity={ui.childEntity}
            backLabel={`返回${ui.parentEntity}详情`}
            onBack={() => backToCampaignDetail(keywordCampaignId)}
          />
        ) : route.page === "campaign" && selectedCampaign ? (
          <CampaignDetailPage
            campaign={selectedCampaign}
            dailyRows={campaignDailyRows}
            dailyLoading={dailyScopeLoading}
            dailyError={dailyScopeError}
            keywordRows={campaignKeywordRows}
            query={query}
            dataAsOfDate={data?.dataAsOfDate ?? null}
            onBack={backToCampaigns}
            onOpenKeyword={(keywordId, campaignId, adGroupId) =>
              openKeywordDetail(
                keywordId,
                campaignId || selectedCampaign.campaignId,
                adGroupId
              )
            }
          />
        ) : route.page === "campaign" ? (
          <DetailEmptyState
            loading={loading && !data}
            entity={ui.parentEntity}
            backLabel={`返回${ui.parentEntity}总览`}
            onBack={backToCampaigns}
          />
        ) : (
          <CampaignListPage
            data={data}
            campaignRows={campaignRows}
            view={homeView}
            loading={loading}
            query={query}
            keywordScope={keywordScope}
            scopedDateKeywordRows={scopedDateKeywordRows}
            scopedDateKeywordLoading={scopedDateKeywordLoading}
            scopedDateKeywordError={scopedDateKeywordError}
            planOptions={iosPlanOptions}
            planSelection={iosPlanSelection}
            planLoading={iosPlanLoading}
            onPlanSelectionChange={setIosPlanSelection}
            onOpen={openCampaignDetail}
            onOpenKeyword={openKeywordDetail}
            onViewChange={setHomeView}
            onOpenCampaignKeywords={openCampaignKeywords}
            onOpenDateKeywords={openDateKeywords}
            onClearKeywordScope={clearKeywordScope}
          />
        )}
      </main>
    </div>
  );
}

export default App;
