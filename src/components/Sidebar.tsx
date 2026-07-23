import { Activity, BarChart3 } from "lucide-react";
import { platformLabel, platformUi } from "../lib/platform";
import type { DashboardResponse, DataPlatform } from "../lib/types";

function sourceLabel(mode?: DashboardResponse["source"]["mode"]) {
  if (mode === "live") return "Live API";
  return "真实数据未接入";
}

export function Sidebar({
  data,
  platform,
  onHome
}: {
  data: DashboardResponse | null;
  platform: DataPlatform;
  onHome: () => void;
}) {
  const ui = platformUi(platform);
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <BarChart3 size={22} />
        </div>
        <div>
          <strong>数据中心</strong>
          <span>{platformLabel(platform)} ROI</span>
        </div>
      </div>
      <nav className="nav-list" aria-label="主导航">
        <button className="nav-item active" type="button" onClick={onHome}>
          <Activity size={17} />
          {platformLabel(platform)} {ui.parentEntity} ROI
        </button>
      </nav>
      <div className="sidebar-note">
        <span>当前数据源</span>
        <strong>{sourceLabel(data?.source.mode)}</strong>
        <p>{data?.source.note ?? "正在读取数据"}</p>
      </div>
    </aside>
  );
}
