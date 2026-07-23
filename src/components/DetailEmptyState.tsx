import { ArrowLeft } from "lucide-react";

export function DetailEmptyState({
  loading,
  onBack,
  backLabel,
  entity
}: {
  loading: boolean;
  onBack: () => void;
  backLabel: string;
  entity: string;
}) {
  return (
    <section className="empty-detail panel">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={17} />
        {backLabel}
      </button>
      <div>
        <h2>{loading ? `正在加载${entity}明细` : `未找到该${entity}`}</h2>
        <p>
          {loading
            ? `正在读取当前筛选条件下的${entity}数据。`
            : `该${entity}可能不在当前筛选条件中，可以返回重新选择。`}
        </p>
      </div>
    </section>
  );
}
