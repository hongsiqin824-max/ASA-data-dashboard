import { RevenueBar } from "./ui/RevenueBar";

// 收益结构卡片：广告 / 会员 / 充值三柱拆分。计划总览页与计划详情页共用。
// 后端收入列回填前三项都是 0 → 落到「暂无真实收益数据」占位。
export function RevenueStructureCard({
  adRevenue,
  vipRevenue,
  rechargeRevenue,
  totalRevenue,
  hasRows,
  subtitle
}: {
  adRevenue: number;
  vipRevenue: number;
  rechargeRevenue: number;
  totalRevenue: number;
  hasRows: boolean;
  subtitle?: string;
}) {
  const hasRevenueSplit =
    hasRows && adRevenue + vipRevenue + rechargeRevenue > 0;

  return (
    <div className="panel revenue-panel">
      <div className="panel-header">
        <div>
          <h2>收益结构</h2>
          <p>{subtitle ?? "用于确认 ROI 贡献来自广告收入还是用户付费收入"}</p>
        </div>
      </div>
      {hasRevenueSplit ? (
        <div className="revenue-bars">
          <RevenueBar
            label="广告收入"
            value={adRevenue}
            total={totalRevenue}
            color="blue"
          />
          <RevenueBar
            label="会员收入"
            value={vipRevenue}
            total={totalRevenue}
            color="green"
          />
          <RevenueBar
            label="充值收入"
            value={rechargeRevenue}
            total={totalRevenue}
            color="amber"
          />
        </div>
      ) : hasRows ? (
        <div className="panel-empty">
          当前数据源未拆分广告 / 会员 / 充值收入，待上游回填收入列后展示
        </div>
      ) : (
        <div className="panel-empty">暂无真实收益数据</div>
      )}
    </div>
  );
}
