import { useState } from "react";
import { Sparkles } from "lucide-react";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRoi
} from "../lib/format";
import type {
  AccountDiagnosisItem,
  KeywordAdvice,
  KeywordAdviceAction,
  KeywordRow
} from "../lib/types";

export function adviceKey(
  row: Pick<KeywordRow, "campaignId" | "adGroupId" | "keywordId">
) {
  return `${row.campaignId}\u0000${row.adGroupId}\u0000${row.keywordId}`;
}

const ACTION_LABEL: Record<KeywordAdviceAction, string> = {
  up: "提价",
  down: "降价",
  pause: "暂停",
  hold: "维持"
};

// 表格一次渲染的最大行数，超出点「显示更多」，避免上千行一次性渲染卡顿。
const RENDER_STEP = 200;

function formatBid(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : formatCurrency(value);
}

export function AdviceTable({
  rows,
  advices,
  diagnosis,
  scene3Keys,
  loading,
  fullLoading,
  progress,
  remainingCount,
  error,
  onGenerate,
  onGenerateAll
}: {
  rows: KeywordRow[];
  advices: Map<string, KeywordAdvice>;
  diagnosis: AccountDiagnosisItem[];
  scene3Keys: Set<string>;
  loading: boolean;
  fullLoading: boolean;
  progress: { done: number; total: number };
  remainingCount: number;
  error: string;
  onGenerate: () => void;
  onGenerateAll: () => void;
}) {
  const hasRows = rows.length > 0;
  const [renderLimit, setRenderLimit] = useState(RENDER_STEP);
  const visibleRows = rows.slice(0, renderLimit);
  const busy = loading || fullLoading;

  return (
    <div className="advice-table-wrap">
      <div className="advice-toolbar">
        <div className="advice-toolbar-text">
          <p>
            默认展示近 7 天全部有消耗词的建议（已预生成、秒出）；切到自定义日期时自动生成消耗最高的头部关键词，
            其余可点「生成全部」补齐（遵守 ±20% 调价约束、需 7 天以上历史数据）。
          </p>
          {fullLoading ? (
            <span className="advice-generated-pill">
              分批生成中 {formatNumber(progress.done)}/{formatNumber(progress.total)} 批
            </span>
          ) : loading ? (
            <span className="advice-generated-pill">AI 生成中…</span>
          ) : advices.size > 0 ? (
            <span className="advice-generated-pill">
              已生成 {formatNumber(advices.size)} 条建议
            </span>
          ) : null}
        </div>
        <div className="advice-toolbar-actions">
          {remainingCount > 0 ? (
            <button
              className="primary-button"
              type="button"
              onClick={onGenerateAll}
              disabled={busy || !hasRows}
              title="对全部有消耗词分批生成建议（有缓存的秒出）"
            >
              <Sparkles size={15} />
              {fullLoading
                ? `生成中 ${formatNumber(progress.done)}/${formatNumber(progress.total)}`
                : `生成全部（剩 ${formatNumber(remainingCount)} 个）`}
            </button>
          ) : null}
          <button
            className="ghost-button"
            type="button"
            onClick={onGenerate}
            disabled={busy || !hasRows}
            title="忽略缓存，强制重新生成头部"
          >
            <Sparkles size={15} />
            {loading ? "AI 生成中…" : "重新生成"}
          </button>
        </div>
      </div>

      {error ? <div className="error-state">{error}</div> : null}

      {diagnosis.length > 0 ? (
        <section className="advice-diagnosis" aria-label="账户级优化诊断">
          <h3 className="advice-diagnosis-title">账户级优化诊断</h3>
          <div className="advice-diagnosis-list">
            {diagnosis.map((item, index) => (
              <article className="advice-diagnosis-card" key={`${item.title}-${index}`}>
                <header className="advice-diagnosis-head">
                  <span className="advice-diagnosis-index">{index + 1}</span>
                  <span className="advice-diagnosis-name">{item.title}</span>
                  {item.summary ? (
                    <span className="advice-diagnosis-summary">{item.summary}</span>
                  ) : null}
                </header>
                {item.points.length > 0 ? (
                  <ul className="advice-diagnosis-points">
                    {item.points.map((point, pi) => (
                      <li key={pi}>{point}</li>
                    ))}
                  </ul>
                ) : null}
                {item.action ? (
                  <p className="advice-diagnosis-action">
                    <span className="advice-diagnosis-action-label">动作</span>
                    {item.action}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="table-scroll">
        <table className="advice-table">
          <thead>
            <tr>
              <th>关键词ID</th>
              <th>关键词</th>
              <th>计划</th>
              <th>广告组</th>
              <th className="num">总安装</th>
              <th className="num">激活</th>
              <th className="num">注册</th>
              <th className="num">消耗</th>
              <th className="num">付费率</th>
              <th className="num">广告收入</th>
              <th className="num">会员收入</th>
              <th className="num">充值收入</th>
              <th className="num">付费收入</th>
              <th className="num">总收益</th>
              <th className="num">总 ROI</th>
              <th className="num">当前出价</th>
              <th className="num">出价建议</th>
              <th>AI 优化建议</th>
            </tr>
          </thead>
          <tbody>
            {hasRows ? (
              visibleRows.map((row) => {
                const advice = advices.get(adviceKey(row));
                const isScene3 = scene3Keys.has(adviceKey(row));
                return (
                  <tr key={adviceKey(row)} className={isScene3 ? "advice-row-scene3" : undefined}>
                    <td className="advice-id">{row.keywordId}</td>
                    <td className="advice-keyword">
                      {row.keyword || row.keywordId}
                      {isScene3 ? (
                        <span className="advice-scene3-tag">零消耗高曝光</span>
                      ) : null}
                    </td>
                    <td className="advice-campaign">{row.campaignName || row.campaignId}</td>
                    <td className="advice-campaign">{row.adGroupName || row.adGroupId}</td>
                    <td className="num">{formatNumber(row.installs)}</td>
                    <td className="num">{formatNumber(row.activations)}</td>
                    <td className="num">{formatNumber(row.registrations)}</td>
                    <td className="num">{formatCurrency(row.cost)}</td>
                    <td className="num">{formatPercent(row.paymentRate)}</td>
                    <td className="num">{formatCurrency(row.adRevenue)}</td>
                    <td className="num">{formatCurrency(row.vipRevenue)}</td>
                    <td className="num">{formatCurrency(row.rechargeRevenue)}</td>
                    <td className="num">{formatCurrency(row.payRevenue)}</td>
                    <td className="num">{formatCurrency(row.totalRevenue)}</td>
                    <td className="num">{formatRoi(row.roi)}</td>
                    <td className="num">{formatBid(row.currentBid)}</td>
                    <td className="num advice-reco-bid">
                      {advice ? (
                        <span className="advice-bid-cell">
                          <span className="advice-bid-main">
                            {formatBid(advice.recommendedBid)}
                            <span className={`advice-action advice-action-${advice.action}`}>
                              {ACTION_LABEL[advice.action]}
                            </span>
                          </span>
                          {advice.adjustments.length > 0 ? (
                            <span className="advice-bid-raw">
                              模型原建议 {formatBid(advice.rawRecommendedBid)}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="advice-pending">{loading ? "生成中" : "—"}</span>
                      )}
                    </td>
                    <td className="advice-reason">
                      {advice ? (
                        <div className="advice-reason-cell">
                          <span className="advice-reason-text">{advice.reason}</span>
                          {advice.adjustments.length > 0 ? (
                            <div className="advice-adjustments">
                              <span className="advice-adjustments-label">规则修正</span>
                              <ul className="advice-adjustments-list">
                                {advice.adjustments.map((text, ai) => (
                                  <li key={ai}>{text}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="advice-pending">
                          {loading ? "AI 生成中…" : "暂无建议"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={18} className="advice-empty">
                  当前筛选下暂无关键词数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rows.length > visibleRows.length ? (
        <div className="advice-load-more">
          <span>
            已显示 {formatNumber(visibleRows.length)} / {formatNumber(rows.length)} 行
          </span>
          <button
            className="ghost-button"
            type="button"
            onClick={() => setRenderLimit((limit) => limit + RENDER_STEP)}
          >
            显示更多
          </button>
        </div>
      ) : null}
    </div>
  );
}
