// 预热鸿蒙新增设备缓存：每天把「昨天 + 最近 7 天」的单天结果算好写入缓存，
// 让用户来拉时直接命中缓存、秒回，避免首次冷扫等待。
// 建议配 crontab 每天跑一次（见部署手册第 10 节）。
import "./env";
import { getHarmonyNewDevices } from "./harmony-device-service";
import { beijingCompactDate } from "./shared";

function dashed(compact: string): string {
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

async function main() {
  // 昨天=-1 ... 最近第7天=-7，均为「过去日期」，结果会被长期缓存。
  const offsets = [1, 2, 3, 4, 5, 6, 7];
  let ok = 0;
  for (const off of offsets) {
    const date = dashed(beijingCompactDate(-off));
    const startedAt = Date.now();
    try {
      // forceRefresh：预热阶段强制从数仓取最新完整数据并刷新缓存。
      const r = await getHarmonyNewDevices(
        { startDate: date, endDate: date, onlyValidOaid: false },
        { forceRefresh: true }
      );
      ok += 1;
      console.log(
        `预热 ${date}：${r.devices.length} 条，耗时 ${((Date.now() - startedAt) / 1000).toFixed(1)}s`
      );
    } catch (error) {
      console.warn(
        `预热 ${date} 失败：`,
        error instanceof Error ? error.message : error
      );
    }
  }
  console.log(`鸿蒙设备缓存预热完成：成功 ${ok}/${offsets.length} 天。`);
  process.exit(0);
}

void main();
