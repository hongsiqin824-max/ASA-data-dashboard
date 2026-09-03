import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { QueryParams } from "../lib/api";
import {
  compareCampaignRows,
  filterCampaignRowsByScale,
  summarizeCampaignRows,
  type CampaignScaleFilter,
  type CampaignSort
} from "../lib/campaign-analysis";
import { formatNumber } from "../lib/format";
import {
  analyzeKeywordRows,
  compareKeywordRows,
  summarizeKeywordRows,
  type KeywordSort
} from "../lib/keyword-analysis";
import { latestRoiDateMs, minimumRoiDaysAvailable } from "../lib/roi-maturity";
import { platformUi } from "../lib/platform";
import { filterRowsByPlanSelection } from "../lib/plan-filter";
import type {
  CampaignRow,
  DailyCampaignRow,
  DashboardResponse,
  KeywordRow
} from "../lib/types";
import { CampaignTable } from "./CampaignTable";
import { DailyCampaignTable } from "./DailyCampaignTable";
import type { DailyCampaignTableSummary } from "./DailyCampaignTable";
import { KeywordTable } from "./KeywordTable";
import { Segmented } from "./ui/Segmented";
import { PlanMultiSelect, type PlanOption, type PlanSelection } from "./ui/PlanMultiSelect";

export type HomeView = "keywords" | "campaigns" | "daily";
export type KeywordListScope =
  | { type: "all" }
  | { type: "campaign"; campaignId: string; label: string }
  | { type: "date"; date: string; label: string };
type RoiFilter = "all" | "high" | "middle" | "low";

const emptyKeywordRows: DashboardResponse["rows"] = [];
const emptyDailyRows: DailyCampaignRow[] = [];

function round(value: number, digits = 2) {
  const base = 10 ** digits;
  return Math.round(value * base) / base;
}

function matchesRoiFilter(roi: number, filter: RoiFilter) {
  if (filter === "all") return true;
  if (filter === "high") return roi >= 1;
  if (filter === "middle") return roi >= 0.3 && roi < 1;
  return roi < 0.3;
}

function summarizeDailyRows(rows: DailyCampaignRow[]): DailyCampaignTableSummary {
  const sum = (pick: (row: DailyCampaignRow) => number) =>
    rows.reduce((total, row) => total + pick(row), 0);
  const cost = sum((row) => row.cost);
  const impressions = sum((row) => row.impressions);
  const taps = sum((row) => row.taps);
  const installs = sum((row) => row.installs);
  const totalPayUv = sum((row) => row.totalPayUv);
  const totalRevenue = sum((row) => row.totalRevenue);
  const weightedRoi = (pick: (row: DailyCampaignRow) => number) =>
    cost > 0
      ? round(rows.reduce((total, row) => total + pick(row) * row.cost, 0) / cost, 4)
      : 0;

  return {
    dayCount: rows.length,
    keywordCount: sum((row) => row.keywordCount),
    impressions,
    taps,
    ttr: impressions > 0 ? round(taps / impressions, 6) : 0,
    tapInstalls: sum((row) => row.tapInstalls),
    tapNewDownloads: sum((row) => row.tapNewDownloads),
    tapRedownloads: sum((row) => row.tapRedownloads),
    installs,
    totalNewDownloads: sum((row) => row.totalNewDownloads),
    totalRedownloads: sum((row) => row.totalRedownloads),
    activations: sum((row) => row.activations),
    registrations: sum((row) => row.registrations),
    cost: round(cost),
    totalPayUv,
    paymentRate: installs > 0 ? round(totalPayUv / installs, 4) : 0,
    adRevenue: round(sum((row) => row.adRevenue)),
    vipRevenue: round(sum((row) => row.vipRevenue)),
    rechargeRevenue: round(sum((row) => row.rechargeRevenue)),
    payRevenue: round(sum((row) => row.payRevenue)),
    totalRevenue: round(totalRevenue),
    roi: cost > 0 ? round(totalRevenue / cost, 4) : 0,
    d1Roi: weightedRoi((row) => row.d1Roi),
    d2Roi: weightedRoi((row) => row.d2Roi),
    d3Roi: weightedRoi((row) => row.d3Roi),
    d4Roi: weightedRoi((row) => row.d4Roi),
    d5Roi: weightedRoi((row) => row.d5Roi),
    d6Roi: weightedRoi((row) => row.d6Roi),
    d7Roi: weightedRoi((row) => row.d7Roi),
    d15Roi: weightedRoi((row) => row.d15Roi),
    d30Roi: weightedRoi((row) => row.d30Roi)
  };
}

export function CampaignListPage({
  data,
  campaignRows,
  view,
  loading,
  query,
  keywordScope,
  scopedDateKeywordRows,
  scopedDateKeywordLoading,
  scopedDateKeywordError,
  onOpen,
  onOpenKeyword,
  onViewChange,
  onOpenCampaignKeywords,
  onOpenDateKeywords,
  onClearKeywordScope,
  planOptions,
  planSelection,
  planLoading,
  onPlanSelectionChange
}: {
  data: DashboardResponse | null;
  campaignRows: CampaignRow[];
  view: HomeView;
  loading: boolean;
  query: QueryParams;
  keywordScope: KeywordListScope;
  scopedDateKeywordRows: KeywordRow[];
  scopedDateKeywordLoading: boolean;
  scopedDateKeywordError: string;
  onOpen: (campaignId: string) => void;
  onOpenKeyword: (keywordId: string, campaignId: string, adGroupId: string) => void;
  onViewChange: (view: HomeView) => void;
  onOpenCampaignKeywords: (campaignId: string, label: string) => void;
  onOpenDateKeywords: (date: string) => void;
  onClearKeywordScope: () => void;
  planOptions: PlanOption[];
  planSelection: PlanSelection;
  planLoading: boolean;
  onPlanSelectionChange: (next: PlanSelection) => void;
}) {
  const ui = platformUi(query.platform);
  const keywordRows = useMemo(() => {
    if (keywordScope.type === "date") {
      return query.status
        ? scopedDateKeywordRows.filter((row) => row.status === query.status)
        : scopedDateKeywordRows;
    }
    if (keywordScope.type === "campaign") {
      return (data?.rows ?? emptyKeywordRows).filter(
        (row) => row.campaignId === keywordScope.campaignId
      );
    }
    return data?.rows ?? emptyKeywordRows;
  }, [data?.rows, keywordScope, query.status, scopedDateKeywordRows]);
  const dailyRows = data?.dailySummaryRows ?? emptyDailyRows;
  const latestDateMs = useMemo(
    () =>
      latestRoiDateMs([
        data?.dataAsOfDate,
        ...dailyRows.map((row) => row.date),
        ...keywordRows.map((row) => row.lastDate)
      ]),
    [data?.dataAsOfDate, dailyRows, keywordRows]
  );
  const summaryAvailableDays = useMemo(() => {
    return minimumRoiDaysAvailable(
      dailyRows.map((row) => row.date),
      latestDateMs
    );
  }, [dailyRows, latestDateMs]);
  const hasCampaigns = campaignRows.length > 0;
  const hasKeywords = keywordRows.length > 0;
  const hasDailyRows = dailyRows.length > 0;
  const [keywordSort, setKeywordSort] = useState<KeywordSort>("impact");
  const [campaignSort, setCampaignSort] = useState<CampaignSort>("impact");
  const [roiFilter, setRoiFilter] = useState<RoiFilter>("all");
  const [campaignRoiFilter, setCampaignRoiFilter] = useState<RoiFilter>("all");
  const [dailyRoiFilter, setDailyRoiFilter] = useState<RoiFilter>("all");
  const [campaignScaleFilter, setCampaignScaleFilter] =
    useState<CampaignScaleFilter>("all");

  // 计划搜索：纯前端按 计划名 / 计划ID 过滤当前已加载的计划（不触发重新查库）
  const [search, setSearch] = useState("");
  const [keywordSearch, setKeywordSearch] = useState("");
  const [dailySearch, setDailySearch] = useState("");
  const q = search.trim().toLowerCase();
  const keywordQ = keywordSearch.trim().toLowerCase();
  const dailyQ = dailySearch.trim().toLowerCase();
  const visibleRows = useMemo(() => {
    const searchedRows = !q
      ? campaignRows
      : campaignRows.filter(
          (r) =>
            r.label.toLowerCase().includes(q) ||
            r.campaignId.toLowerCase().includes(q)
        );

    return filterCampaignRowsByScale(
      searchedRows.filter((row) =>
        matchesRoiFilter(row.roi, campaignRoiFilter)
      ),
      campaignScaleFilter
    ).sort((a, b) => compareCampaignRows(a, b, campaignSort));
  }, [
    campaignRows,
    campaignRoiFilter,
    campaignScaleFilter,
    campaignSort,
    q
  ]);
  const campaignSummary = useMemo(
    () => summarizeCampaignRows(visibleRows),
    [visibleRows]
  );
  const analyzedKeywordRows = useMemo(
    () => analyzeKeywordRows(keywordRows, []),
    [keywordRows]
  );
  const visibleKeywords = useMemo(() => {
    return [...filterRowsByPlanSelection(analyzedKeywordRows, query.platform, planSelection)]
      .filter((row) => matchesRoiFilter(row.roi, roiFilter))
      .filter((row) => {
        if (!keywordQ) return true;
        return (
          row.keyword.toLowerCase().includes(keywordQ) ||
          row.keywordId.toLowerCase().includes(keywordQ) ||
          row.adGroupName.toLowerCase().includes(keywordQ) ||
          row.campaignName.toLowerCase().includes(keywordQ)
        );
      })
      .sort((a, b) => compareKeywordRows(a, b, keywordSort));
  }, [analyzedKeywordRows, keywordQ, keywordSort, planSelection, query.platform, roiFilter]);
  const keywordSummary = useMemo(
    () => summarizeKeywordRows(visibleKeywords),
    [visibleKeywords]
  );
  const visibleDailyRows = useMemo(() => {
    return dailyRows
      .filter((row) => matchesRoiFilter(row.roi, dailyRoiFilter))
      .filter((row) => {
        if (!dailyQ) return true;
        return row.date.toLowerCase().includes(dailyQ);
      });
  }, [dailyQ, dailyRoiFilter, dailyRows]);
  const dailySummary = useMemo(
    () => summarizeDailyRows(visibleDailyRows),
    [visibleDailyRows]
  );

  const campaignSubtitle = !hasCampaigns
    ? `当前暂无真实${ui.parentEntity}数据，等待真实数据源接入`
    : q
      ? `搜索“${search.trim()}”命中 ${formatNumber(visibleRows.length)} / ${formatNumber(campaignRows.length)} 个${ui.parentEntity}`
      : campaignRoiFilter !== "all" || campaignScaleFilter !== "all"
        ? `当前筛选命中 ${formatNumber(visibleRows.length)} / ${formatNumber(campaignRows.length)} 个${ui.parentEntity}`
      : ui.hasChildEntity
        ? `当前区间共 ${formatNumber(campaignRows.length)} 个投放${ui.parentEntity}，点击${ui.parentEntity}查看逐日 ROI 与${ui.childEntity}`
        : `当前区间共 ${formatNumber(campaignRows.length)} 个${ui.parentEntity}，点击${ui.parentEntity}查看逐日 ROI 趋势`;
  const keywordSubtitle = !hasKeywords
    ? scopedDateKeywordLoading
      ? `正在读取 ${keywordScope.type === "date" ? keywordScope.label : ""} 的${ui.childEntity}`
      : scopedDateKeywordError || `当前暂无${ui.childEntity}数据`
      : planSelection !== null
      ? `当前计划筛选命中 ${formatNumber(visibleKeywords.length)} / ${formatNumber(keywordRows.length)} 个${ui.childEntity}`
      : keywordQ
      ? `搜索“${keywordSearch.trim()}”命中 ${formatNumber(visibleKeywords.length)} / ${formatNumber(keywordRows.length)} 个${ui.childEntity}`
      : keywordScope.type !== "all"
        ? `当前显示 ${formatNumber(visibleKeywords.length)} / ${formatNumber(keywordRows.length)} 个${ui.childEntity}，来源：${keywordScope.label}`
        : `当前显示 ${formatNumber(visibleKeywords.length)} / ${formatNumber(keywordRows.length)} 个${ui.childEntity}，可直接查看 D1-D7、D15、D30 与总 ROI`;
  const dailySubtitle = !hasDailyRows
    ? "当前暂无日期汇总数据"
    : dailyQ || dailyRoiFilter !== "all"
      ? `当前筛选命中 ${formatNumber(visibleDailyRows.length)} / ${formatNumber(dailyRows.length)} 天`
      : `当前区间共 ${formatNumber(dailyRows.length)} 天数据，按日核验成本、收益、ROI 与转化字段`;
  const showingKeywords = ui.hasChildEntity && view === "keywords";
  const showingCampaigns = !ui.hasChildEntity || view === "campaigns";
  const showingDaily = view === "daily";
  const title = showingKeywords
    ? ui.childEntity
    : showingCampaigns
      ? ui.parentEntity
      : "日期";
  const subtitle = showingKeywords
    ? keywordSubtitle
    : showingCampaigns
      ? campaignSubtitle
      : dailySubtitle;

  return (
    <>
      <section className="panel table-panel">
        <div className="panel-header table-header">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <div className="table-header-tools">
            <Segmented
              value={view}
              onChange={(value) => {
                const nextView =
                  value === "daily"
                    ? "daily"
                    : value === "campaigns"
                      ? "campaigns"
                      : "keywords";
                onViewChange(nextView);
              }}
              options={
                ui.hasChildEntity
                  ? [
                      { value: "keywords", label: ui.childEntity },
                      { value: "campaigns", label: ui.parentEntity },
                      { value: "daily", label: "日期" }
                    ]
                  : [
                      { value: "campaigns", label: ui.parentEntity },
                      { value: "daily", label: "日期" }
                    ]
              }
            />
            {showingKeywords && query.platform === "iOS" ? (
              <PlanMultiSelect
                options={planOptions}
                selectedIds={planSelection}
                loading={planLoading}
                onChange={onPlanSelectionChange}
              />
            ) : null}
            {showingKeywords && hasKeywords ? (
              <div className="field-control compact-select">
                <select
                  aria-label={`选择${ui.childEntity}排序`}
                  value={keywordSort}
                  onChange={(event) => setKeywordSort(event.target.value as KeywordSort)}
                >
                  <option value="impact">消耗优先</option>
                  <option value="cost">消耗最高</option>
                  <option value="roi">总 ROI 最高</option>
                  <option value="activationCost">激活成本最低</option>
                  <option value="registrationCost">注册成本最低</option>
                </select>
                <ChevronDown className="select-icon" size={15} />
              </div>
            ) : null}
            {showingCampaigns && hasCampaigns ? (
              <div className="field-control compact-select">
                <select
                  aria-label={`选择${ui.parentEntity}排序`}
                  value={campaignSort}
                  onChange={(event) =>
                    setCampaignSort(event.target.value as CampaignSort)
                  }
                >
                  <option value="impact">消耗优先</option>
                  <option value="cost">消耗最高</option>
                  <option value="roiHigh">总 ROI 最高</option>
                  <option value="roiLow">总 ROI 最低</option>
                  <option value="totalRevenue">总收益最高</option>
                  {ui.hasAdRevenue ? <option value="adRevenue">广告收入最高</option> : null}
                  <option value="payRevenue">付费收入最高</option>
                  <option value="ttr">点击率最高</option>
                  <option value="activationCost">激活成本最低</option>
                  <option value="registrationCost">注册成本最低</option>
                </select>
                <ChevronDown className="select-icon" size={15} />
              </div>
            ) : null}
            {showingKeywords && hasKeywords ? (
              <Segmented
                value={roiFilter}
                onChange={(value) =>
                  setRoiFilter(
                    ["high", "middle", "low"].includes(value)
                      ? (value as RoiFilter)
                      : "all"
                  )
                }
                options={[
                  { value: "all", label: "全部" },
                  { value: "high", label: "总ROI≥100%" },
                  { value: "middle", label: "总ROI 30%-100%" },
                  { value: "low", label: "总ROI<30%" }
                ]}
              />
            ) : null}
            {showingDaily && hasDailyRows ? (
              <Segmented
                value={dailyRoiFilter}
                onChange={(value) =>
                  setDailyRoiFilter(
                    ["high", "middle", "low"].includes(value)
                      ? (value as RoiFilter)
                      : "all"
                  )
                }
                options={[
                  { value: "all", label: "全部" },
                  { value: "high", label: "总ROI≥100%" },
                  { value: "middle", label: "总ROI 30%-100%" },
                  { value: "low", label: "总ROI<30%" }
                ]}
              />
            ) : null}
            {showingCampaigns && hasCampaigns ? (
              <Segmented
                value={campaignRoiFilter}
                onChange={(value) =>
                  setCampaignRoiFilter(
                    ["high", "middle", "low"].includes(value)
                      ? (value as RoiFilter)
                      : "all"
                  )
                }
                options={[
                  { value: "all", label: "全部" },
                  { value: "high", label: "总ROI≥100%" },
                  { value: "middle", label: "总ROI 30%-100%" },
                  { value: "low", label: "总ROI<30%" }
                ]}
              />
            ) : null}
            {showingCampaigns && hasCampaigns ? (
              <div className="field-control compact-select campaign-scale-select">
                <select
                  aria-label={`选择${ui.parentEntity}规模筛选`}
                  value={campaignScaleFilter}
                  onChange={(event) =>
                    setCampaignScaleFilter(
                      event.target.value as CampaignScaleFilter
                    )
                  }
                >
                  <option value="all">全部规模</option>
                  <option value="highCost">高消耗{ui.parentEntity}</option>
                  <option value="spentNoRevenue">有消耗无收益</option>
                  <option value="clickLowActivation">有点击低转化</option>
                </select>
                <ChevronDown className="select-icon" size={15} />
              </div>
            ) : null}
            {showingKeywords && hasKeywords ? (
              <div className="field-control table-search">
                <Search size={16} />
                <input
                  aria-label={`搜索${ui.childEntity}列表`}
                  type="search"
                  placeholder={`搜索${ui.childEntity} / ${ui.parentEntity}`}
                  value={keywordSearch}
                  onChange={(event) => setKeywordSearch(event.target.value)}
                />
              </div>
            ) : null}
            {showingKeywords && keywordScope.type !== "all" ? (
              <button
                className="ghost-button table-scope-button"
                type="button"
                onClick={onClearKeywordScope}
              >
                全部{ui.childEntity}
              </button>
            ) : null}
            {showingCampaigns && hasCampaigns ? (
              <div className="field-control table-search">
                <Search size={16} />
                <input
                  aria-label={`搜索${ui.parentEntity}`}
                  type="search"
                  placeholder={
                    ui.hasChildEntity ? `搜索${ui.parentEntity}名 / ID` : "搜索计划名 / ID"
                  }
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            ) : null}
            {showingDaily && hasDailyRows ? (
              <div className="field-control table-search">
                <Search size={16} />
                <input
                  aria-label="搜索日期"
                  type="search"
                  placeholder="搜索日期"
                  value={dailySearch}
                  onChange={(event) => setDailySearch(event.target.value)}
                />
              </div>
            ) : null}
            {loading ? <span className="loading-pill">加载中</span> : null}
            {scopedDateKeywordLoading && showingKeywords ? (
              <span className="loading-pill">读取{ui.childEntity}</span>
            ) : null}
          </div>
        </div>
        {showingKeywords ? (
          <KeywordTable
            rows={visibleKeywords}
            summary={keywordSummary}
            query={query}
            latestDateMs={latestDateMs}
            summaryAvailableDays={summaryAvailableDays}
            onOpen={onOpenKeyword}
          />
        ) : showingCampaigns ? (
          <CampaignTable
            rows={visibleRows}
            summary={campaignSummary}
            query={query}
            latestDateMs={latestDateMs}
            summaryAvailableDays={summaryAvailableDays}
            onOpen={onOpen}
            onOpenKeywords={ui.hasChildEntity ? onOpenCampaignKeywords : undefined}
          />
        ) : (
          <DailyCampaignTable
            rows={visibleDailyRows}
            summary={dailySummary}
            maturityRows={dailyRows}
            dataAsOfDate={data?.dataAsOfDate}
            platform={query.platform}
            onOpenKeywords={ui.hasChildEntity ? onOpenDateKeywords : undefined}
          />
        )}
      </section>
    </>
  );
}
