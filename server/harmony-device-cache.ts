// 鸿蒙新增设备接口的结果缓存（磁盘）。
// 只缓存「完整的过去日期」结果：过去某天的新增设备不会再变，可长期复用；
// 含「今天」的查询不缓存（当天还在持续新增，避免存下半天的不完整数据）。
import fs from "node:fs";
import path from "node:path";

const CACHE_DIR = path.resolve(process.cwd(), ".cache", "harmony-devices");

export type HarmonyDeviceCachePayload = {
  cachedAt: string;
  snapshotDay: string;
  devices: unknown[];
};

export function buildHarmonyDeviceCacheKey(
  startDate: string,
  endDate: string,
  onlyValidOaid: boolean
): string {
  return `${startDate}__${endDate}__${onlyValidOaid ? "oaid1" : "oaid0"}`;
}

function keyToFile(key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(CACHE_DIR, `${safe}.json`);
}

export function readHarmonyDeviceCache(
  key: string
): HarmonyDeviceCachePayload | null {
  try {
    const file = keyToFile(key);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8")) as HarmonyDeviceCachePayload;
  } catch {
    return null;
  }
}

export function writeHarmonyDeviceCache(
  key: string,
  payload: HarmonyDeviceCachePayload
): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(keyToFile(key), JSON.stringify(payload));
  } catch {
    // 缓存写入失败不影响主流程，忽略即可。
  }
}
