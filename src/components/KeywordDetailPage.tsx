import { ArrowLeft, BarChart3, Database, TrendingUp } from "lucide-react";
import { formatCurrency, formatNumber, formatRoi } from "../lib/format";
import type { DailyKeywordRow, KeywordRow } from "../lib/types";
import { platformUi } from "../lib/platform";
import { DailyKeywordTable } from "./DailyKeywordTable";
import { Metric } from "./ui/Metric";

export function KeywordDetailPage({
  keyword,
  rows,
  loading = false,
  error = "",
  dataAsOfDate,
  onBack,
  backLabel = "返回计划详情"
}: {
  keyword: KeywordRow;
  rows: DailyKeywordRow[];
  loading?: boolean;
  error?: string;
  dataAsOfDate: string | null;
  onBack: () => void;
  backLabel?: string;
}) {
  const ui = platformUi(keyword.platform);
  return (
    <section className="detail-page">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={17} />
        {backLabel}
      </button>

      <div className="detail-hero">
        <div>
          <p className="eyebrow">{ui.childEntity}详情</p>
          <h2>{keyword.keyword}</h2>
          <span>
            {[keyword.keywordId, keyword.campaignName, keyword.adGroupName]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
        <div className="detail-metrics">
          <Metric
            label="总 ROI"
            value={formatRoi(keyword.roi)}
            trend="汇总周期表现"
            icon={<TrendingUp size={19} />}
          />
          <Metric
            label="投放消耗"
            value={formatCurrency(keyword.cost)}
            trend={`${ui.installMetric} ${formatNumber(keyword.installs)}`}
            icon={<BarChart3 size={19} />}
          />
          <Metric
            label="总收益"
            value={formatCurrency(keyword.totalRevenue)}
            trend={ui.hasAdRevenue ? "广告收入 + 付费收入" : "会员收入 + 充值收入"}
            icon={<Database size={19} />}
            detail={
              <>
                {ui.hasAdRevenue ? (
                  <>
                    <div>
                      <span>广告收入</span>
                      <strong>{formatCurrency(keyword.adRevenue)}</strong>
                    </div>
                    <div>
                      <span>付费收入</span>
                      <strong>{formatCurrency(keyword.payRevenue)}</strong>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span>会员收入</span>
                      <strong>{formatCurrency(keyword.vipRevenue)}</strong>
                    </div>
                    <div>
                      <span>充值收入</span>
                      <strong>{formatCurrency(keyword.rechargeRevenue)}</strong>
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
            <h2>每日投放明细</h2>
            <p>
              {loading
                ? `正在按需读取该${ui.childEntity}的每日投放明细`
                : error
                  ? error
                  : `当前${ui.childEntity}共 ${formatNumber(rows.length)} 条日明细，用于判断具体日期的投放强弱`}
            </p>
          </div>
        </div>
        <DailyKeywordTable
          rows={rows}
          dataAsOfDate={dataAsOfDate}
          platform={keyword.platform}
          showAllRetention
          showAllRoi
        />
      </section>
    </section>
  );
}
