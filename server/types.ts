// 服务端只复用前端 API 合约类型，避免字段新增/删减时前后端漂移。
export type {
  DailyCampaignRow,
  DailyKeywordRow,
  DataPlatform,
  DashboardResponse,
  ExtendedRoiFields,
  KeywordRow,
  KeywordAdvice,
  KeywordAdviceAction,
  AccountDiagnosisItem,
  KeywordStatus,
  RetainUvFields
} from "../src/lib/types";
