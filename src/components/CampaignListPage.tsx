import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { AdviceKeywordInput, QueryParams } from "../lib/api";
import { fetchKeywordAdvice } from "../lib/api";
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
import { aggregateExtendedRoi } from "../lib/roi-columns";
import { platformUi } from "../lib/platform";
import { filterRowsByPlanSelection } from "../lib/plan-filter";
import type {
  AccountDiagnosisItem,
  CampaignRow,
  DailyCampaignRow,
  DashboardResponse,
  KeywordAdvice,
  KeywordRow
} from "../lib/types";
import { CampaignTable } from "./CampaignTable";
import { DailyCampaignTable } from "./DailyCampaignTable";
import type { DailyCampaignTableSummary } from "./DailyCampaignTable";
import { KeywordTable } from "./KeywordTable";
import { AdviceTable, adviceKey } from "./AdviceTable";
import { Segmented } from "./ui/Segmented";
import { PlanMultiSelect, type PlanOption, type PlanSelection } from "./ui/PlanMultiSelect";
import {
  ADVICE_HEAD_LIMIT,
  selectCostRows,
  selectScene3Rows
} from "../lib/advice-scope";

export type HomeView = "keywords" | "campaigns" | "daily" | "advice";
export type KeywordListScope =
  | { type: "all" }
  | { type: "campaign"; campaignId: string; label: string }
  | { type: "date"; date: string; label: string };
type RoiFilter = "all" | "high" | "middle" | "low";

const emptyKeywordRows: DashboardResponse["rows"] = [];
const emptyDailyRows: DailyCampaignRow[] = [];

// 建议 tab 全量「生成全部」时每批词数：批越小单批越快。
const FULL_BATCH_SIZE = 8;
// 全量分批的并发度：浏览器对同一后端 HTTP/1.1 同时最多 6 个请求，取 6 吃满。
const FULL_CONCURRENCY = 6;

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
  const sumNullable = (
    pick: (row: DailyCampaignRow) => number | null | undefined
  ) => {
    let total = 0;
    let hasValue = false;
    rows.forEach((row) => {
      const value = pick(row);
      if (value === null || value === undefined) return;
      total += value;
      hasValue = true;
    });
    return hasValue ? total : null;
  };
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
    retainUv1d: sumNullable((row) => row.retainUv1d),
    retainUv2d: sumNullable((row) => row.retainUv2d),
    retainUv3d: sumNullable((row) => row.retainUv3d),
    retainUv4d: sumNullable((row) => row.retainUv4d),
    retainUv5d: sumNullable((row) => row.retainUv5d),
    retainUv6d: sumNullable((row) => row.retainUv6d),
    retainUv7d: sumNullable((row) => row.retainUv7d),
    retainUv8d: sumNullable((row) => row.retainUv8d),
    retainUv9d: sumNullable((row) => row.retainUv9d),
    retainUv10d: sumNullable((row) => row.retainUv10d),
    retainUv11d: sumNullable((row) => row.retainUv11d),
    retainUv12d: sumNullable((row) => row.retainUv12d),
    retainUv13d: sumNullable((row) => row.retainUv13d),
    retainUv14d: sumNullable((row) => row.retainUv14d),
    retainUv15d: sumNullable((row) => row.retainUv15d),
    retainUv16d: sumNullable((row) => row.retainUv16d),
    retainUv17d: sumNullable((row) => row.retainUv17d),
    retainUv18d: sumNullable((row) => row.retainUv18d),
    retainUv19d: sumNullable((row) => row.retainUv19d),
    retainUv20d: sumNullable((row) => row.retainUv20d),
    retainUv21d: sumNullable((row) => row.retainUv21d),
    retainUv22d: sumNullable((row) => row.retainUv22d),
    retainUv23d: sumNullable((row) => row.retainUv23d),
    retainUv24d: sumNullable((row) => row.retainUv24d),
    retainUv25d: sumNullable((row) => row.retainUv25d),
    retainUv26d: sumNullable((row) => row.retainUv26d),
    retainUv27d: sumNullable((row) => row.retainUv27d),
    retainUv28d: sumNullable((row) => row.retainUv28d),
    retainUv29d: sumNullable((row) => row.retainUv29d),
    retainUv30d: sumNullable((row) => row.retainUv30d),
    retainUv40d: sumNullable((row) => row.retainUv40d),
    retainUv50d: sumNullable((row) => row.retainUv50d),
    retainUv60d: sumNullable((row) => row.retainUv60d),
    retainUv70d: sumNullable((row) => row.retainUv70d),
    retainUv80d: sumNullable((row) => row.retainUv80d),
    retainUv90d: sumNullable((row) => row.retainUv90d),
    retainUv100d: sumNullable((row) => row.retainUv100d),
    retainUv110d: sumNullable((row) => row.retainUv110d),
    retainUv120d: sumNullable((row) => row.retainUv120d),
    retainUv130d: sumNullable((row) => row.retainUv130d),
    retainUv140d: sumNullable((row) => row.retainUv140d),
    retainUv150d: sumNullable((row) => row.retainUv150d),
    retainUv160d: sumNullable((row) => row.retainUv160d),
    retainUv170d: sumNullable((row) => row.retainUv170d),
    retainUv180d: sumNullable((row) => row.retainUv180d),
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
    d30Roi: weightedRoi((row) => row.d30Roi),
    d60Roi: weightedRoi((row) => row.d60Roi),
    ...aggregateExtendedRoi(rows, (row) => row.cost)
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

  // AI 出价建议（仅 iOS）：按 keyword scope key 存每个关键词的建议。
  const [advices, setAdvices] = useState<Map<string, KeywordAdvice>>(new Map());
  const [diagnosis, setDiagnosis] = useState<AccountDiagnosisItem[]>([]);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [adviceError, setAdviceError] = useState("");
  // 全量分批生成（点「生成全部」触发）的进行态与进度。
  const [adviceFullLoading, setAdviceFullLoading] = useState(false);
  const [adviceProgress, setAdviceProgress] = useState({ done: 0, total: 0 });
  // 当前 advices 对应的关键词集合指纹；用于判断条件是否变化、避免重复生成。
  const adviceLoadedSigRef = useRef("");
  // 请求序号：条件变化中途返回的旧响应作废，避免覆盖最新结果。
  const adviceReqIdRef = useRef(0);

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
  const adviceEnabled = query.platform === "iOS";
  const showingAdvice = adviceEnabled && view === "advice";
  const showingKeywords = ui.hasChildEntity && view === "keywords";
  const showingCampaigns = !ui.hasChildEntity || (view === "campaigns" && !showingAdvice);
  const showingDaily = view === "daily";

  // 全量「有消耗」关键词（cost>0），按消耗降序。用于展示与「生成全部」。
  const allCostRows = useMemo(
    () => selectCostRows(visibleKeywords),
    [visibleKeywords]
  );
  // 头部批：消耗最高的前 N，进入 tab 自动生成。
  const headRows = useMemo(
    () => allCostRows.slice(0, ADVICE_HEAD_LIMIT),
    [allCostRows]
  );
  // 场景三池：曝光≥50 且消耗=0 且转化=0 的无效投放词，单独计额度。
  const scene3Rows = useMemo(
    () => selectScene3Rows(visibleKeywords),
    [visibleKeywords]
  );
  const scene3KeySet = useMemo(
    () => new Set(scene3Rows.map((row) => adviceKey(row))),
    [scene3Rows]
  );
  // 表格展示的完整集合：全量有消耗词在前、场景三词在后。
  const adviceRows = useMemo(
    () => [...allCostRows, ...scene3Rows],
    [allCostRows, scene3Rows]
  );
  // 还未生成建议、可通过「生成全部」补齐的有消耗词数量（排除已自动生成的头部）。
  const remainingCostCount = Math.max(allCostRows.length - headRows.length, 0);

  // 自动触发指纹：只覆盖头部批 + 场景三（自动只生成这部分）。
  const adviceSignature = useMemo(
    () =>
      [...headRows, ...scene3Rows]
        .map((row) =>
          [
            row.keywordId,
            row.currentBid ?? "",
            row.cost,
            row.taps,
            row.installs,
            row.cpt,
            row.cpa,
            row.roi,
            row.d7Roi,
            row.d30Roi,
            row.activeDays ?? 0,
            scene3KeySet.has(adviceKey(row)) ? 1 : 0
          ].join(":")
        )
        .join("|"),
    [headRows, scene3Rows, scene3KeySet]
  );

  function buildAdviceInput(row: KeywordRow): AdviceKeywordInput {
    return {
      campaignId: row.campaignId,
      adGroupId: row.adGroupId,
      keywordId: row.keywordId,
      keyword: row.keyword,
      campaignName: row.campaignName,
      currentBid: row.currentBid ?? null,
      cpt: row.cpt,
      cpa: row.cpa,
      cost: row.cost,
      impressions: row.impressions,
      taps: row.taps,
      installs: row.installs,
      activeDays: row.historyActiveDays ?? row.activeDays ?? 0,
      roi: row.roi,
      d1Roi: row.d1Roi,
      d3Roi: row.d3Roi,
      d7Roi: row.d7Roi,
      d30Roi: row.d30Roi,
      scene3: scene3KeySet.has(adviceKey(row))
    };
  }

  // 把若干批（每批一组关键词行）并发跑完；批 0 可带账户级诊断，其余只出逐词建议。
  // reqId 作废机制：条件变化时正在进行的批次结果丢弃。
  async function runAdviceBatches(
    batches: KeywordRow[][],
    opts: {
      force: boolean;
      reset: boolean;
      track: boolean;
      concurrency: number;
      diagnosisOnFirst: boolean;
    }
  ) {
    const nonEmpty = batches.filter((batch) => batch.length > 0);
    if (nonEmpty.length === 0) return;
    const reqId = adviceReqIdRef.current + 1;
    adviceReqIdRef.current = reqId;
    setAdviceError("");
    if (opts.reset) {
      setAdvices(new Map());
      setDiagnosis([]);
    }
    if (opts.track) {
      setAdviceFullLoading(true);
      setAdviceProgress({ done: 0, total: nonEmpty.length });
    } else {
      setAdviceLoading(true);
    }

    let done = 0;
    let cursor = 0;
    const worker = async () => {
      while (cursor < nonEmpty.length) {
        const index = cursor++;
        const batch = nonEmpty[index];
        try {
          const result = await fetchKeywordAdvice(
            query.platform,
            batch.map(buildAdviceInput),
            {
              forceRefresh: opts.force,
              withDiagnosis: opts.diagnosisOnFirst && index === 0
            }
          );
          if (reqId !== adviceReqIdRef.current) return;
          setAdvices((prev) => {
            const next = new Map(prev);
            result.advices.forEach((item) => next.set(adviceKey(item), item));
            return next;
          });
          if (opts.diagnosisOnFirst && index === 0 && result.diagnosis.length > 0) {
            setDiagnosis(result.diagnosis);
          }
        } catch (err) {
          if (reqId !== adviceReqIdRef.current) return;
          setAdviceError(err instanceof Error ? err.message : "AI 建议生成失败");
        } finally {
          if (reqId === adviceReqIdRef.current) {
            done += 1;
            if (opts.track) setAdviceProgress({ done, total: nonEmpty.length });
          }
        }
      }
    };

    try {
      await Promise.all(
        Array.from({ length: Math.min(opts.concurrency, nonEmpty.length) }, worker)
      );
      if (reqId === adviceReqIdRef.current) adviceLoadedSigRef.current = adviceSignature;
    } finally {
      if (reqId === adviceReqIdRef.current) {
        setAdviceLoading(false);
        setAdviceFullLoading(false);
      }
    }
  }

  // 头部自动：头部批（带诊断）+ 场景三批，小并发即可。
  function runHeadAdvice(force: boolean) {
    void runAdviceBatches([headRows, scene3Rows], {
      force,
      reset: true,
      track: false,
      concurrency: 2,
      diagnosisOnFirst: true
    });
  }

  // 生成全部：所有有消耗词按小批拆分 + 场景三批，高并发跑完（诊断沿用头部批的结果）。
  function runAllAdvice() {
    const batches: KeywordRow[][] = [];
    for (let i = 0; i < allCostRows.length; i += FULL_BATCH_SIZE) {
      batches.push(allCostRows.slice(i, i + FULL_BATCH_SIZE));
    }
    batches.push(scene3Rows);
    void runAdviceBatches(batches, {
      force: false,
      reset: false,
      track: true,
      concurrency: FULL_CONCURRENCY,
      diagnosisOnFirst: false
    });
  }

  // 进入「建议」tab 自动生成头部；条件变化后自动重算（防抖 500ms）。
  // 同条件已生成则不重复调用；命中后端缓存会很快返回。
  useEffect(() => {
    if (!showingAdvice || headRows.length + scene3Rows.length === 0) return;
    if (adviceLoadedSigRef.current === adviceSignature) return;
    const timer = window.setTimeout(() => {
      runHeadAdvice(false);
    }, 500);
    return () => window.clearTimeout(timer);
    // runHeadAdvice 读取的是最新渲染闭包，无需进依赖；仅按触发条件重跑。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showingAdvice, adviceSignature, adviceRows.length]);

  const title = showingAdvice
    ? "AI 出价建议"
    : showingKeywords
      ? ui.childEntity
      : showingCampaigns
        ? ui.parentEntity
        : "日期";
  const subtitle = showingAdvice
    ? `有消耗词共 ${formatNumber(allCostRows.length)} 个（已出建议 ${formatNumber(advices.size)} 个）${scene3Rows.length > 0 ? `，含场景三(曝光≥50 零消耗) ${formatNumber(scene3Rows.length)} 个` : ""}`
    : showingKeywords
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
                      : value === "advice"
                        ? "advice"
                        : "keywords";
                onViewChange(nextView);
              }}
              options={
                ui.hasChildEntity
                  ? [
                      { value: "keywords", label: ui.childEntity },
                      { value: "campaigns", label: ui.parentEntity },
                      { value: "daily", label: "日期" },
                      ...(adviceEnabled
                        ? [{ value: "advice", label: "建议" }]
                        : [])
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
        {showingAdvice ? (
          <AdviceTable
            rows={adviceRows}
            advices={advices}
            diagnosis={diagnosis}
            scene3Keys={scene3KeySet}
            loading={adviceLoading}
            fullLoading={adviceFullLoading}
            progress={adviceProgress}
            remainingCount={remainingCostCount}
            error={adviceError}
            onGenerate={() => runHeadAdvice(true)}
            onGenerateAll={runAllAdvice}
          />
        ) : showingKeywords ? (
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
            showOverallRetention={query.platform === "iOS"}
            onOpenKeywords={ui.hasChildEntity ? onOpenDateKeywords : undefined}
          />
        )}
      </section>
    </>
  );
}
