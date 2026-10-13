// AI 出价建议：按《ASA出价工具.md》的规则构造提示词，交给大模型，解析成结构化建议。
// 规则要点：单次调价幅度 ≤ ±20%；需 7 天以上历史数据；对应四类场景。

import { callLlm, extractJson } from "./llm";
import {
  adviceCacheGet,
  adviceCacheHash,
  adviceCacheSet
} from "./advice-cache";
import type {
  AccountDiagnosisItem,
  DataPlatform,
  KeywordAdvice,
  KeywordAdviceAction
} from "./types";

// 单个关键词喂给模型的指标（前端裁剪后传入，控制 token 体量）。
export type AdviceKeywordInput = {
  campaignId: string;
  adGroupId: string;
  keywordId: string;
  keyword: string;
  campaignName: string;
  currentBid: number | null;
  cpt: number;
  cpa: number;
  cost: number;
  impressions: number;
  taps: number;
  installs: number;
  // 全历史投放天数（前端/预生成已传入 historyActiveDays），用于「需 7 天以上历史」门槛。
  activeDays: number;
  roi: number;
  d1Roi: number;
  d3Roi: number;
  d7Roi: number;
  d30Roi: number;
  // true=前端规则命中场景三（曝光≥50 且消耗=0 且转化=0）的无效投放词。
  scene3?: boolean;
};

// 单次发给模型的关键词上限：主池(≤20) + 场景三池(≤20)，故放到 40，避免场景三词被截断。
const MAX_KEYWORDS = 40;

const SYSTEM_PROMPT = `你是资深 Apple Search Ads（ASA 苹果搜索广告）出价与投放优化专家，拥有多年实操经验。
我会给你「同一批」关键词的历史投放数据（JSON 数组），请你同时产出两部分结果：

【A. 每个关键词的出价建议 keywords】严格遵守：
1. 单次调价幅度不超过 ±20%：recommendedBid 必须落在 currentBid（缺失时用 cpt 作为基准）的 80%~120% 之间。
2. 需 7 天及以上历史数据（activeDays>=7）才调价；不足则 action=hold、维持原价。
3. 四类场景：场景一 ROI 优异→小幅上调 up；场景二 转化成本高/ROI 偏低→适度下调控本 down；场景三 曝光充足但无消耗/无转化→大幅降价或暂停 pause；场景四 样本不足（7天点击<10）→维持观察 hold。
   特别地：输入中带 "scene3": true 的词，是前端已判定的「曝光≥50 且消耗=0 且转化=0」无效投放词，必须 action=pause、recommendedBid=null，理由按场景三说明「有曝光但零消耗零转化、属无效占位，建议暂停释放预算」。
4. reason ≤200 字，用「- 」分点先讲问题（结合 ROI/CPA/点击/留存等），最后用「动作：xxx」给出可直接落地的操作；务实、不空话，可用换行。

【B. 账户级优化诊断 diagnosis】3~6 条，面向整个这批关键词做跨词/跨计划诊断，要像实战复盘：
- 贴合 ASA 后台逻辑：计划/广告组分层（品牌词/竞品词/通用词）、Search Match 拓词、否定词、关键词匹配、重复词/错别字变体、两计划抢同一词互相抬价等；
- 每条含：title（诊断对象/主题）、summary（如「花费 ¥x | ROI y」，没有就空字符串）、points（问题分点数组）、action（落地动作）；
- 只分析有消耗的关键词，剔除理论空话，投放团队可直接执行。

只输出一个 JSON 对象，形如：
{"keywords":[{"keywordId":"","campaignId":"","adGroupId":"","recommendedBid":数字或null,"action":"up|down|pause|hold","reason":"- 问题...\\n动作：..."}],"diagnosis":[{"title":"","summary":"","points":["",""],"action":""}]}
不要输出 JSON 以外的任何文字。`;

function buildUserPrompt(
  keywords: AdviceKeywordInput[],
  withDiagnosis: boolean
): string {
  const rows = keywords.map((k) => ({
    keywordId: k.keywordId,
    campaignId: k.campaignId,
    adGroupId: k.adGroupId,
    keyword: k.keyword,
    campaignName: k.campaignName,
    currentBid: k.currentBid,
    cpt: k.cpt,
    cpa: k.cpa,
    cost: k.cost,
    impressions: k.impressions,
    taps: k.taps,
    installs: k.installs,
    activeDays: k.activeDays,
    roi: k.roi,
    d1Roi: k.d1Roi,
    d3Roi: k.d3Roi,
    d7Roi: k.d7Roi,
    d30Roi: k.d30Roi,
    scene3: k.scene3 ?? false
  }));
  const diagnosisInstruction = withDiagnosis
    ? "请按系统要求同时产出每个关键词的出价建议 keywords 和账户级诊断 diagnosis"
    : "本批只需产出每个关键词的出价建议 keywords，diagnosis 直接返回空数组 []（不要生成账户级诊断）";
  return `以下是待分析的同一批关键词投放数据（JSON 数组）。${diagnosisInstruction}：\n${JSON.stringify(rows)}`;
}

function normalizeAction(value: unknown): KeywordAdviceAction {
  return value === "up" || value === "down" || value === "pause" || value === "hold"
    ? value
    : "hold";
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// 一次生成的完整结果：逐词出价建议 + 账户级诊断。
export type GeneratedAdvice = {
  advices: KeywordAdvice[];
  diagnosis: AccountDiagnosisItem[];
};

// ───────── 建议结果缓存（词级粒度 + 账户级诊断单独缓存，落盘持久化）─────────
// 词级：每个关键词按「平台 + 该词指标指纹」单独缓存，与分批方式/日期区间解耦——
// 预生成逐词写好后，前端任意分批请求都能逐词命中。指标一变 → 指纹变 → 自动重算。
const ADVICE_CACHE_TTL_MS =
  Number(process.env.ASA_ADVICE_CACHE_MINUTES ?? 360) * 60 * 1000;

// 影响单词建议的关键字段指纹（含 campaign/adGroup 防同名 keywordId 串味）。
function wordSignature(k: AdviceKeywordInput): string {
  return [
    k.keywordId,
    k.campaignId,
    k.adGroupId,
    k.currentBid ?? "",
    k.cost,
    k.taps,
    k.installs,
    k.cpt,
    k.cpa,
    k.roi,
    k.d7Roi,
    k.d30Roi,
    k.activeDays,
    k.scene3 ? 1 : 0
  ].join(":");
}

function wordCacheKey(platform: DataPlatform, k: AdviceKeywordInput): string {
  return `kw\u0000${platform}\u0000${adviceCacheHash(wordSignature(k))}`;
}

// 账户级诊断是跨词结果：按「这批词集合的指纹」单独缓存。
function diagnosisCacheKey(
  platform: DataPlatform,
  keywords: AdviceKeywordInput[]
): string {
  const sig = keywords.map(wordSignature).join("|");
  return `diag\u0000${platform}\u0000${adviceCacheHash(sig)}`;
}

function adviceInputLookupKey(
  k: Pick<AdviceKeywordInput, "campaignId" | "adGroupId" | "keywordId">
): string {
  return `${k.campaignId}\u0000${k.adGroupId}\u0000${k.keywordId}`;
}

// 正在调用大模型的请求去重：key = 缺失词集合 + 是否要诊断。
const adviceInFlight = new Map<string, Promise<GeneratedAdvice>>();

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter((item) => item.length > 0)
    .slice(0, 8);
}

async function callAndParse(
  keywords: AdviceKeywordInput[],
  withDiagnosis: boolean
): Promise<GeneratedAdvice> {
  // 高并发下模型偶发返回不完整/不规范 JSON；解析失败时重试整次调用（最多 2 次）。
  let lastError: unknown;
  for (let attempt = 0; attempt <= 2; attempt += 1) {
    const content = await callLlm([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(keywords, withDiagnosis) }
    ]);
    try {
      return parseAdviceContent(content, keywords);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("大模型返回无法解析");
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// 把 LLM 给的出价夹逼到基准价的 80%~120%；无有效基准价时原样返回。
function clampBid(bid: number, base: number | null): number {
  if (base == null || base <= 0) return round2(bid);
  const min = base * 0.8;
  const max = base * 1.2;
  if (bid < min) return round2(min);
  if (bid > max) return round2(max);
  return round2(bid);
}

function parseAdviceContent(
  content: string,
  inputs: AdviceKeywordInput[]
): GeneratedAdvice {
  const parsed = extractJson<{
    keywords?: Array<{
      keywordId?: string;
      campaignId?: string;
      adGroupId?: string;
      recommendedBid?: unknown;
      action?: unknown;
      reason?: unknown;
    }>;
    diagnosis?: Array<{
      title?: unknown;
      summary?: unknown;
      points?: unknown;
      action?: unknown;
    }>;
  }>(content);

  // 按 keywordId 建索引，用于对每条建议做业务规则兜底（±20% 夹逼 / 7天门槛 / pause 互斥 / 场景三）。
  const inputMap = new Map<string, AdviceKeywordInput>();
  inputs.forEach((k) => inputMap.set(k.keywordId, k));

  const advices: KeywordAdvice[] = (parsed.keywords ?? []).map((item) => {
    const keywordId = String(item.keywordId ?? "");
    const input = inputMap.get(keywordId);
    // 基准价：优先当前出价，缺失时退化到 cpt（与提示词口径一致）。
    const base = input ? input.currentBid ?? input.cpt : null;

    // 先记下模型原始值（兜底前），用于前端对比展示与审计。
    const rawAction = normalizeAction(item.action);
    const rawRecommendedBid = toNumberOrNull(item.recommendedBid);

    let action = rawAction;
    let recommendedBid = rawRecommendedBid;
    const adjustments: string[] = [];

    if (input) {
      // 规则 1：场景三（曝光≥50 且消耗=0 且转化=0）强制暂停，不接受模型给的其它动作。
      if (input.scene3) {
        if (rawAction !== "pause") {
          adjustments.push("曝光≥50 且零消耗零转化，按场景三规则强制暂停");
        }
        action = "pause";
      } else if (input.activeDays < 7) {
        // 规则 2：历史不足 7 天不调价，强制维持观察、出价维持原价（基准价）。
        adjustments.push(
          `历史投放仅 ${input.activeDays} 天（<7天），不满足调价条件，维持原价${
            base != null ? ` ${round2(base)}` : ""
          }、动作改为观察`
        );
        action = "hold";
        recommendedBid = base;
      }
    }

    // 规则 3：暂停与出价互斥——pause 一律不给出价。
    if (action === "pause") {
      if (rawRecommendedBid != null) {
        adjustments.push(
          `暂停动作不保留出价，已清除模型给的出价 ${round2(rawRecommendedBid)}`
        );
      }
      recommendedBid = null;
    } else if (recommendedBid != null) {
      // 规则 4：非暂停时，把出价夹逼到基准价 ±20%，代码兜底不依赖提示词自律。
      const clamped = clampBid(recommendedBid, base);
      if (base != null && base > 0 && clamped !== round2(recommendedBid)) {
        const bound = clamped > round2(recommendedBid) ? "下限" : "上限";
        adjustments.push(
          `模型建议 ${round2(recommendedBid)}，超出当前出价 ±20% 区间（${round2(
            base * 0.8
          )}~${round2(base * 1.2)}），已按${bound}修正为 ${clamped}`
        );
      }
      recommendedBid = clamped;
    }

    return {
      campaignId: String(item.campaignId ?? ""),
      adGroupId: String(item.adGroupId ?? ""),
      keywordId,
      recommendedBid,
      action,
      reason: String(item.reason ?? "").slice(0, 220),
      rawAction,
      rawRecommendedBid,
      adjustments
    };
  });

  const diagnosis: AccountDiagnosisItem[] = (parsed.diagnosis ?? [])
    .map((item) => ({
      title: String(item.title ?? "").slice(0, 60),
      summary: String(item.summary ?? "").slice(0, 60),
      points: toStringArray(item.points),
      action: String(item.action ?? "").slice(0, 200)
    }))
    .filter((item) => item.title || item.points.length > 0 || item.action)
    .slice(0, 6);

  return { advices, diagnosis };
}

export type AdviceResult = GeneratedAdvice & {
  cached: boolean;
};

// 写入词级缓存：把模型返回的逐词建议，按输入词的指纹落盘。
function writeWordCache(
  platform: DataPlatform,
  inputs: AdviceKeywordInput[],
  advices: KeywordAdvice[]
): void {
  const byLookup = new Map(inputs.map((k) => [adviceInputLookupKey(k), k]));
  for (const advice of advices) {
    const input = byLookup.get(adviceInputLookupKey(advice));
    if (!input) continue;
    adviceCacheSet(
      wordCacheKey(platform, input),
      advice,
      ADVICE_CACHE_TTL_MS
    );
  }
}

export async function generateKeywordAdvice(
  platform: DataPlatform,
  keywords: AdviceKeywordInput[],
  options: { forceRefresh?: boolean; withDiagnosis?: boolean } = {}
): Promise<AdviceResult> {
  const withDiagnosis = options.withDiagnosis ?? true;
  const limited = keywords.slice(0, MAX_KEYWORDS);
  if (limited.length === 0) {
    return { advices: [], diagnosis: [], cached: false };
  }

  // 1) 逐词查缓存，分出命中与缺失。
  const cachedAdviceByLookup = new Map<string, KeywordAdvice>();
  const missing: AdviceKeywordInput[] = [];
  for (const k of limited) {
    const hit = options.forceRefresh
      ? undefined
      : adviceCacheGet<KeywordAdvice>(wordCacheKey(platform, k));
    if (hit) {
      cachedAdviceByLookup.set(adviceInputLookupKey(k), hit);
    } else {
      missing.push(k);
    }
  }

  // 2) 诊断单独查缓存（仅在需要诊断时）。
  const diagKey = diagnosisCacheKey(platform, limited);
  let diagnosis: AccountDiagnosisItem[] | undefined = withDiagnosis
    ? options.forceRefresh
      ? undefined
      : adviceCacheGet<AccountDiagnosisItem[]>(diagKey)
    : [];
  const needDiagnosis = withDiagnosis && diagnosis === undefined;

  // 3) 全部命中且诊断满足 → 直接返回，不调模型。
  if (missing.length === 0 && !needDiagnosis) {
    const advices = limited
      .map((k) => cachedAdviceByLookup.get(adviceInputLookupKey(k)))
      .filter((a): a is KeywordAdvice => Boolean(a));
    return { advices, diagnosis: diagnosis ?? [], cached: true };
  }

  // 4) 需要调模型。要诊断则传整批（保证跨词诊断质量）；否则只传缺失词省 token。
  const callInputs = needDiagnosis ? limited : missing;
  const callDiagnosis = needDiagnosis;
  const inFlightKey = `${platform}\u0000${callDiagnosis ? "D" : "N"}\u0000${adviceCacheHash(
    callInputs.map(wordCacheKey.bind(null, platform)).join("|")
  )}`;

  let task = adviceInFlight.get(inFlightKey);
  if (!task) {
    task = callAndParse(callInputs, callDiagnosis);
    adviceInFlight.set(inFlightKey, task);
    // 清理 in-flight 记录。finally 会派生一个新 promise，它继承 task 的 rejection，
    // 必须用 .catch 兜底，否则大模型调用失败时该派生 promise 无人处理 →
    // unhandledRejection（Node 默认会让进程崩溃）。原始 task 的 rejection 仍由下面的 await 接住。
    void task.finally(() => adviceInFlight.delete(inFlightKey)).catch(() => {});
  }
  const fresh = await task;

  // 5) 落盘词级缓存 + 诊断缓存。
  writeWordCache(platform, callInputs, fresh.advices);
  if (callDiagnosis) {
    diagnosis = fresh.diagnosis;
    adviceCacheSet(diagKey, fresh.diagnosis, ADVICE_CACHE_TTL_MS);
  }

  // 6) 合并：命中缓存的 + 本次新生成的，按输入顺序输出。
  const freshByLookup = new Map(
    fresh.advices.map((a) => [adviceInputLookupKey(a), a])
  );
  const advices = limited
    .map(
      (k) =>
        cachedAdviceByLookup.get(adviceInputLookupKey(k)) ??
        freshByLookup.get(adviceInputLookupKey(k))
    )
    .filter((a): a is KeywordAdvice => Boolean(a));

  return { advices, diagnosis: diagnosis ?? [], cached: false };
}
