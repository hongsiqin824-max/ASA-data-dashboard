// AI 出价建议的「分析范围」规则：有消耗词筛选 + 场景三识别 + 相关上限。
// 前端（CampaignListPage）与后端预生成脚本（pregenerate-advice）共用同一套规则，
// 避免两边各写一份导致缓存指纹对不上、预生成白跑。
import type { KeywordRow } from "./types";

// 头部批词数：进入「建议」tab 自动生成消耗最高的前 N 个（也用于账户级诊断的取词范围）。
export const ADVICE_HEAD_LIMIT = 20;
// 场景三池上限：曝光充足但零消耗零转化的无效词，单独计额度，最多分析前 N 个。
export const SCENE3_LIMIT = 20;

type Scene3Fields = Pick<KeywordRow, "impressions" | "cost" | "installs">;

// 场景三：曝光≥50 且消耗=0 且转化(installs)=0 的无效投放词（《ASA出价工具.md》场景三）。
export function isScene3Row(row: Scene3Fields): boolean {
  return row.impressions >= 50 && row.cost === 0 && row.installs === 0;
}

// 有消耗词（cost>0），按消耗降序。主建议池。
export function selectCostRows<T extends KeywordRow>(rows: T[]): T[] {
  return rows
    .filter((row) => row.cost > 0)
    .slice()
    .sort((a, b) => b.cost - a.cost);
}

// 场景三池（规则命中 + 上限截断）。
export function selectScene3Rows<T extends KeywordRow>(rows: T[]): T[] {
  return rows.filter((row) => isScene3Row(row)).slice(0, SCENE3_LIMIT);
}
