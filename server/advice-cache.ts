// AI 出价建议的持久化缓存：内存 Map + JSON 文件落盘。
// 目的：① 进程重启（pm2 restart）后缓存不丢；② 独立的预生成进程写盘后，
// 运行中的 web 进程能通过文件 mtime 变化感知并合并，读到预生成结果。
//
// 选用 JSON 文件而非 SQLite：词量不大（iOS 数千词），单进程 pm2 部署，
// 零原生依赖、零编译，部署最省心。
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type CacheEntry<T = unknown> = {
  value: T;
  cachedAt: number;
  expiresAt: number;
};

type DiskShape = {
  version: 1;
  entries: Array<[string, CacheEntry]>;
};

const CACHE_FILE = path.resolve(
  process.env.ASA_ADVICE_CACHE_FILE ?? "./.cache/advice-cache.json"
);
const MAX_ITEMS = Number(process.env.ASA_ADVICE_CACHE_MAX_ITEMS ?? 20000);
const FLUSH_DEBOUNCE_MS = 800;

const store = new Map<string, CacheEntry>();
let loadedMtimeMs = 0; // 最近一次从磁盘加载时文件的 mtime，用于判断是否需要重载
let flushTimer: NodeJS.Timeout | null = null;
let dirty = false;

function fileMtimeMs(): number {
  try {
    return fs.statSync(CACHE_FILE).mtimeMs;
  } catch {
    return 0;
  }
}

// 把磁盘内容合并进内存：仅当磁盘条目更新（cachedAt 更大）或内存中不存在时覆盖，
// 避免丢掉本进程运行期间写入的更新。过期条目跳过。
function mergeFromDisk(): void {
  let raw: string;
  try {
    raw = fs.readFileSync(CACHE_FILE, "utf8");
  } catch {
    return; // 文件不存在，忽略
  }
  let parsed: DiskShape;
  try {
    parsed = JSON.parse(raw) as DiskShape;
  } catch {
    return; // 文件损坏（极少数写入中断），忽略，下次写入会覆盖
  }
  if (!parsed || !Array.isArray(parsed.entries)) return;
  const now = Date.now();
  for (const [key, entry] of parsed.entries) {
    if (!entry || entry.expiresAt <= now) continue;
    const existing = store.get(key);
    if (!existing || entry.cachedAt > existing.cachedAt) {
      store.set(key, entry);
    }
  }
}

function ensureLoaded(): void {
  const mtime = fileMtimeMs();
  if (mtime > loadedMtimeMs) {
    mergeFromDisk();
    loadedMtimeMs = mtime;
  }
}

function prune(): void {
  const now = Date.now();
  store.forEach((entry, key) => {
    if (entry.expiresAt <= now) store.delete(key);
  });
  if (store.size <= MAX_ITEMS) return;
  // 超容量：按 cachedAt 升序淘汰最旧的。
  const oldestFirst = Array.from(store.entries()).sort(
    (a, b) => a[1].cachedAt - b[1].cachedAt
  );
  oldestFirst
    .slice(0, store.size - MAX_ITEMS)
    .forEach(([key]) => store.delete(key));
}

// 原子落盘：先写临时文件再 rename，避免写入中途被读到半截。
// 写前再 merge 一次磁盘，尽量不覆盖别的进程（如预生成）刚写入的内容。
function flushNow(): void {
  dirty = false;
  mergeFromDisk();
  prune();
  const payload: DiskShape = {
    version: 1,
    entries: Array.from(store.entries())
  };
  const dir = path.dirname(CACHE_FILE);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = `${CACHE_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(payload), "utf8");
    fs.renameSync(tmp, CACHE_FILE);
    loadedMtimeMs = fileMtimeMs();
  } catch {
    // 落盘失败不影响内存缓存可用性；下次写入再试。
  }
}

function scheduleFlush(): void {
  dirty = true;
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    if (dirty) flushNow();
  }, FLUSH_DEBOUNCE_MS);
}

// 进程退出前尽量落盘（预生成脚本跑完 / web 进程被 pm2 停止时）。
let exitHookInstalled = false;
function installExitHook(): void {
  if (exitHookInstalled) return;
  exitHookInstalled = true;
  const onExit = () => {
    if (dirty) flushNow();
  };
  process.once("exit", onExit);
  process.once("SIGINT", () => {
    onExit();
    process.exit(0);
  });
  process.once("SIGTERM", () => {
    onExit();
    process.exit(0);
  });
}

export function adviceCacheGet<T>(key: string): T | undefined {
  ensureLoaded();
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function adviceCacheSet<T>(key: string, value: T, ttlMs: number): void {
  installExitHook();
  const cachedAt = Date.now();
  store.set(key, { value, cachedAt, expiresAt: cachedAt + ttlMs });
  scheduleFlush();
}

// 立即落盘（供预生成脚本在结束前强制写入）。
export function adviceCacheFlush(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  flushNow();
}

// 生成稳定内容指纹（供建议缓存 key 使用）。
export function adviceCacheHash(input: string): string {
  return createHash("sha1").update(input).digest("hex");
}
