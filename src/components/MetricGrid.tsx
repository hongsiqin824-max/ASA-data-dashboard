import { Activity, BarChart3, Database, TrendingUp } from "lucide-react";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRoi
} from "../lib/format";
import type { DashboardResponse } from "../lib/types";
import { platformUi } from "../lib/platform";
import { Metric } from "./ui/Metric";

export function MetricGrid({
  data,
  hasKeywordRows
}: {
  data: DashboardResponse | null;
  hasKeywordRows: boolean;
}) {
  const ui = platformUi(data?.platform ?? "iOS");

  return (
    <section className="metric-grid" aria-label="核心指标">
      <Metric
        label="总 ROI"
        value={data && hasKeywordRows ? formatRoi(data.summary.roi) : "--"}
        trend={hasKeywordRows ? "收益 / 成本" : "暂无真实数据"}
        icon={<TrendingUp size={19} />}
      />
      <Metric
        label="投放成本"
        value={
          data && hasKeywordRows ? formatCurrency(data.summary.cost) : "--"
        }
        trend={hasKeywordRows ? ui.spendSource : "暂无真实数据"}
        icon={<BarChart3 size={19} />}
      />
      <Metric
        label="总收益"
        value={
          data && hasKeywordRows
            ? formatCurrency(data.summary.totalRevenue)
            : "--"
        }
        trend={
          hasKeywordRows
            ? ui.hasAdRevenue
              ? "广告收入 + 付费收入"
              : "会员收入 + 充值收入"
            : "暂无真实数据"
        }
        icon={<Database size={19} />}
        detail={
          data && hasKeywordRows ? (
            <>
              {ui.hasAdRevenue ? (
                <>
                  <div>
                    <span>广告收入</span>
                    <strong>{formatCurrency(data.summary.adRevenue)}</strong>
                  </div>
                  <div>
                    <span>付费收入</span>
                    <strong>{formatCurrency(data.summary.payRevenue)}</strong>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span>会员收入</span>
                    <strong>{formatCurrency(data.summary.vipRevenue ?? 0)}</strong>
                  </div>
                  <div>
                    <span>充值收入</span>
                    <strong>{formatCurrency(data.summary.rechargeRevenue ?? 0)}</strong>
                  </div>
                </>
              )}
            </>
          ) : null
        }
      />
      <Metric
        label={`${ui.installMetric} / 激活`}
        value={
          data && hasKeywordRows
            ? `${formatNumber(data.summary.installs)} / ${formatNumber(
                data.summary.activations
              )}`
            : "--"
        }
        trend={
          data && hasKeywordRows
            ? `激活率 ${formatPercent(data.summary.activationRate)}`
            : "暂无真实数据"
        }
        icon={<Activity size={19} />}
      />
    </section>
  );
}
