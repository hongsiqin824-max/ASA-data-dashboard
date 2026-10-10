import { useMemo, useState } from "react";
import { ArrowLeft, BarChart3, Database, TrendingUp } from "lucide-react";
import { formatCurrency, formatNumber, formatRoi } from "../lib/format";
import {
  analyzeKeywordRows,
  summarizeKeywordRows
} from "../lib/keyword-analysis";
import { latestRoiDateMs, roiDaysAvailable } from "../lib/roi-maturity";
import type {
  CampaignRow,
  DailyCampaignRow,
  KeywordRow
} from "../lib/types";
import type { QueryParams } from "../lib/api";
import { platformUi } from "../lib/platform";
import { DailyCampaignTable } from "./DailyCampaignTable";
import { KeywordTable } from "./KeywordTable";
import { Metric } from "./ui/Metric";
import { Segmented } from "./ui/Segmented";

export function CampaignDetailPage({
  campaign,
  dailyRows,
  dailyLoading = false,
  dailyError = "",
  keywordRows,
  query,
  dataAsOfDate,
  onBack,
  onOpenKeyword
}: {
  campaign: CampaignRow;
  dailyRows: DailyCampaignRow[];
  dailyLoading?: boolean;
  dailyError?: string;
  keywordRows: KeywordRow[];
  query: QueryParams;
  dataAsOfDate: string | null;
  onBack: () => void;
  onOpenKeyword: (keywordId: string, campaignId: string, adGroupId: string) => void;
}) {
  const ui = platformUi(query.platform);
  const [view, setView] = useState<"keywords" | "daily">(
    ui.hasChildEntity ? "keywords" : "daily"
  );
  const sortedKeywords = useMemo(
    () =>
      analyzeKeywordRows(keywordRows, []).sort(
        (a, b) => b.cost - a.cost || b.roi - a.roi
      ),
    [keywordRows]
  );
  const keywordSummary = useMemo(
    () => summarizeKeywordRows(sortedKeywords),
    [sortedKeywords]
  );
  const latestDateMs = useMemo(
    () =>
      latestRoiDateMs([
        dataAsOfDate,
        ...dailyRows.map((row) => row.date),
        ...keywordRows.map((row) => row.lastDate)
      ]),
    [dataAsOfDate, dailyRows, keywordRows]
  );
  const summaryAvailableDays = useMemo(() => {
    const dataDays = new Set(dailyRows.map((row) => row.date)).size;
    return dataDays > 0
      ? dataDays
      : roiDaysAvailable(query.startDate, latestDateMs);
  }, [dailyRows, latestDateMs, query.startDate]);
  const showingKeywords = ui.hasChildEntity && view === "keywords";

  return (
    <section className="detail-page">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={17} />
        返回{ui.parentEntity}总览
      </button>

      <div className="detail-hero">
        <div>
          <p className="eyebrow">{ui.parentEntity}详情</p>
          <h2>{campaign.label}</h2>
          <span>
            {[
              ...(campaign.advertiserId
                ? [`广告主ID ${campaign.advertiserId}`]
                : []),
              `${ui.parentEntity}ID ${campaign.campaignId}`,
              ...(ui.hasChildEntity
                ? [
                    `${formatNumber(campaign.adGroupCount)} 个${
                      ui.hasIosInstallBreakdown ? "广告组" : ui.childEntity
                    }`,
                    ...(ui.hasIosInstallBreakdown
                      ? [`${formatNumber(campaign.keywordCount)} 个关键词`]
                      : [])
                  ]
                : [])
            ].join(" · ")}
          </span>
        </div>
        <div className="detail-metrics">
          <Metric
            label="总 ROI"
            value={formatRoi(campaign.roi)}
            trend={`${ui.parentEntity}区间汇总`}
            icon={<TrendingUp size={19} />}
          />
          <Metric
            label="投放消耗"
            value={formatCurrency(campaign.cost)}
            trend={
              ui.hasInstallMetric
                ? `${ui.installMetric} ${formatNumber(campaign.installs)}`
                : `激活 ${formatNumber(campaign.activations)} · 注册 ${formatNumber(
                    campaign.registrations
                  )}`
            }
            icon={<BarChart3 size={19} />}
          />
          <Metric
            label="总收益"
            value={formatCurrency(campaign.totalRevenue)}
            trend={ui.hasAdRevenue ? "广告收入 + 付费收入" : "会员收入 + 充值收入"}
            icon={<Database size={19} />}
            detail={
              <>
                {ui.hasAdRevenue ? (
                  <>
                    <div>
                      <span>广告收入</span>
                      <strong>{formatCurrency(campaign.adRevenue)}</strong>
                    </div>
                    <div>
                      <span>付费收入</span>
                      <strong>{formatCurrency(campaign.payRevenue)}</strong>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span>会员收入</span>
                      <strong>{formatCurrency(campaign.vipRevenue)}</strong>
                    </div>
                    <div>
                      <span>充值收入</span>
                      <strong>{formatCurrency(campaign.rechargeRevenue)}</strong>
                    </div>
                  </>
                )}
              </>
            }
          />
        </div>
      </div>

      <section className="panel table-panel detail-panel">
        <div className="panel-header table-header">
          <div>
            <h2>{showingKeywords ? `${ui.parentEntity}下${ui.childEntity} ROI` : `${ui.parentEntity}逐日 ROI 趋势`}</h2>
            <p>
              {showingKeywords
                ? `当前${ui.parentEntity}共 ${formatNumber(sortedKeywords.length)} 个${ui.childEntity}，按消耗排序`
                : dailyLoading
                  ? `正在按需读取该${ui.parentEntity}的每日 ROI 明细`
                  : dailyError
                    ? dailyError
                    : `共 ${formatNumber(dailyRows.length)} 天，用于判断该${ui.parentEntity}每天的投放强弱与 ROI 波动`}
            </p>
          </div>
          {ui.hasChildEntity ? (
            <div className="table-header-tools">
              <Segmented
                value={view}
                onChange={(value) => setView(value === "daily" ? "daily" : "keywords")}
                options={[
                  { value: "keywords", label: ui.childEntity },
                  { value: "daily", label: "逐日趋势" }
                ]}
              />
            </div>
          ) : null}
        </div>
        {showingKeywords ? (
          <KeywordTable
            rows={sortedKeywords}
            summary={keywordSummary}
            query={query}
            latestDateMs={latestDateMs}
            summaryAvailableDays={summaryAvailableDays}
            onOpen={onOpenKeyword}
            showAllRetention
            showAllRoi
          />
        ) : (
          <DailyCampaignTable
            rows={dailyRows}
            dataAsOfDate={dataAsOfDate}
            platform={query.platform}
            showOverallRetention={query.platform === "iOS"}
            showAllRetention
            showAllRoi
          />
        )}
      </section>
    </section>
  );
}
