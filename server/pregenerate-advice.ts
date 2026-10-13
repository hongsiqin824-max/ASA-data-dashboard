// AI 出价建议「预生成」脚本（独立进程运行，与 web 进程隔离）。
// 作用：每天数仓更新后，按前端默认区间（滚动近 7 天）自查数仓、对全部有消耗词 +
// 场景三词分批调大模型，把结果写入持久化缓存。用户进页面即逐词命中、秒开。
//
// 用法：  npx tsx server/pregenerate-advice.ts
// 定时：  由 pm2 / crontab 每天在数仓出数后触发一次。
import "./env";
import { generateKeywordAdvice, type AdviceKeywordInput } from "./advice";
import { adviceCacheFlush } from "./advice-cache";
import { isLlmConfigured } from "./llm";
import { fetchLiveData } from "./starrocks";
import { beijingCompactDate } from "./shared";
import {
  ADVICE_HEAD_LIMIT,
  selectCostRows,
  selectScene3Rows
} from "../src/lib/advice-scope";
import type { DataPlatform, KeywordRow } from "./types";

const PLATFORM: DataPlatform = "iOS"; // ASA 仅 iOS
const BATCH_SIZE = Number(process.env.ASA_ADVICE_PREGEN_BATCH ?? 8);
const CONCURRENCY = Number(process.env.ASA_ADVICE_PREGEN_CONCURRENCY ?? 6);

// 仅用于本脚本内部标记场景三词的集合键（三元组唯一定位一个关键词）。
function rowKey(
  row: Pick<KeywordRow, "campaignId" | "adGroupId" | "keywordId">
): string {
  return `${row.campaignId}\u0000${row.adGroupId}\u0000${row.keywordId}`;
}

function log(msg: string) {
  console.log(`[pregenerate-advice] ${new Date().toISOString()} ${msg}`);
}

function buildAdviceInput(
  row: KeywordRow,
  scene3Keys: Set<string>
): AdviceKeywordInput {
  return {
    campaignId: row.campaignId,
    adGroupId: row.adGroupId,
    keywordId: row.keywordId,
    keyword: row.keyword,
    campaignName: row.campaignName,
    currentBid: row.currentBid ?? null,
    cpt: row.cpt,
    cpa: row.cpa,
    cost: row.cost,
    impressions: row.impressions,
    taps: row.taps,
    installs: row.installs,
    activeDays: row.historyActiveDays ?? row.activeDays ?? 0,
    roi: row.roi,
    d1Roi: row.d1Roi,
    d3Roi: row.d3Roi,
    d7Roi: row.d7Roi,
    d30Roi: row.d30Roi,
    scene3: scene3Keys.has(rowKey(row))
  };
}

// 并发跑若干批（每批调一次 generateKeywordAdvice，内部会逐词写缓存）。
async function runBatches(
  batches: AdviceKeywordInput[][],
  withDiagnosisOnFirst: boolean
): Promise<void> {
  let cursor = 0;
  let done = 0;
  const total = batches.length;
  const worker = async () => {
    while (cursor < batches.length) {
      const index = cursor++;
      const batch = batches[index];
      try {
        await generateKeywordAdvice(PLATFORM, batch, {
          forceRefresh: false,
          withDiagnosis: withDiagnosisOnFirst && index === 0
        });
      } catch (error) {
        log(
          `批 ${index} 生成失败：${
            error instanceof Error ? error.message : String(error)
          }`
        );
      } finally {
        done += 1;
        if (done % 5 === 0 || done === total) {
          log(`进度 ${done}/${total} 批`);
        }
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker)
  );
}

async function main() {
  const startedAt = Date.now();
  if (!isLlmConfigured()) {
    log("未配置大模型（LLM_API_KEY / LLM_BASE_URL / LLM_MODEL），终止。");
    process.exitCode = 1;
    return;
  }

  // 与前端默认区间一致：滚动近 7 天（北京时间今天往前 6 天 ~ 今天）。
  const startDate = beijingCompactDate(-6);
  const endDate = beijingCompactDate(0);
  log(`区间 ${startDate}~${endDate}，平台 ${PLATFORM}，开始查询数仓…`);

  const data = await fetchLiveData({
    platform: PLATFORM,
    startDate,
    endDate,
    keyword: "",
    campaignId: "",
    adGroupId: "",
    revenueMode: "all"
  });

  const rows = data.rows;
  const costRows = selectCostRows(rows);
  const scene3Rows = selectScene3Rows(rows);
  const scene3Keys = new Set(scene3Rows.map((row) => rowKey(row)));
  log(
    `共 ${rows.length} 词，有消耗 ${costRows.length} 词，场景三 ${scene3Rows.length} 词`
  );

  if (costRows.length === 0 && scene3Rows.length === 0) {
    log("无可分析关键词，结束。");
    return;
  }

  // 头部批（带账户级诊断），与前端 runHeadAdvice 的 headRows 完全一致。
  const headRows = costRows.slice(0, ADVICE_HEAD_LIMIT);
  const headBatch = headRows.map((row) => buildAdviceInput(row, scene3Keys));
  log(`生成头部批（${headBatch.length} 词，含账户级诊断）…`);
  await runBatches([headBatch], true);

  // 其余有消耗词 + 场景三池，分批并发生成（不带诊断）。
  const restRows = costRows.slice(ADVICE_HEAD_LIMIT);
  const restBatches: AdviceKeywordInput[][] = [];
  for (let i = 0; i < restRows.length; i += BATCH_SIZE) {
    restBatches.push(
      restRows.slice(i, i + BATCH_SIZE).map((row) => buildAdviceInput(row, scene3Keys))
    );
  }
  if (scene3Rows.length > 0) {
    restBatches.push(scene3Rows.map((row) => buildAdviceInput(row, scene3Keys)));
  }
  if (restBatches.length > 0) {
    log(`生成其余 ${restBatches.length} 批（并发 ${CONCURRENCY}）…`);
    await runBatches(restBatches, false);
  }

  adviceCacheFlush();
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  log(`完成，缓存已落盘。总耗时 ${seconds}s。`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    log(`异常退出：${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    process.exit(1);
  });
