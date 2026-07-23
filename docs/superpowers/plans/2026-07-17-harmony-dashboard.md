# iOS / 鸿蒙双平台 ROI 看板实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 ROI 数据后台中增加独立的鸿蒙看板，并确保 iOS 与鸿蒙的数据源、缓存、明细、导出和页面状态完全隔离。

**Architecture:** 前后端共用 `iOS | HarmonyOS` 平台枚举，后端通过固定白名单把平台解析为可信数仓表，所有 SQL 查询显式接收平台；前端继续复用现有页面组件，仅增加平台切换和平台化文案。缓存键、详情请求键和响应元数据全部加入平台，防止两端数据串用。

**Tech Stack:** React 19、TypeScript 5.9、Vite 7、Express 5、mysql2、Node 内置 `node:test`、tsx。

## 当前实施状态（2026-07-17）

- 已完成：平台类型与可信表映射、服务端和浏览器缓存隔离、全部 API 查询路径平台化、平台化数据模型与 SQL 元数据、双平台预热隔离、前端平台切换、详情作用域隔离和导出文件名隔离。
- 已验证：11 项自动化测试、ESLint、TypeScript 与 Vite 生产构建全部通过；本地未配置数仓模式下，iOS 与鸿蒙接口分别返回正确的平台和表名，非法平台返回 400，鸿蒙 SQL 不引用 iOS 表；查询与刷新契约已有回归测试。
- 未完成：生产鸿蒙表的字段、类型、日期范围、行数及代表样本核验。本机连接 StarRocks 超时，SSH 在认证前被远端关闭。
- 未部署：在表结构准入和真实数据对比通过前，不上传生产服务器。

## 全局约束

- 仅提供 `iOS` 与 `鸿蒙` 两个独立视图，本期不做“全部平台”汇总。
- iOS 默认数据表为 `hive.ads.ads_ad_ios_asa_roi_di`；鸿蒙业务表为 `ads.ads_ad_hm_roi_di`，启用前必须确认生产环境中的完整限定名。
- HTTP 请求不能直接提供表名，只能提供 `platform=iOS` 或 `platform=HarmonyOS`。
- 查询只读取当前平台缓存，缓存未命中时提示刷新；刷新才读取数仓并只覆盖当前平台缓存。
- 鸿蒙缺失字段不得用 iOS 数据、零值或推算值补齐；字段不兼容时停止启用鸿蒙入口。
- 保留现有 ROI 收益口径、精度和成熟度判断，不改变 iOS 已验证结果。
- 所有新增项目文档使用中文；代码标识、类型名和命令保留英文。
- 当前目录不是 Git 仓库，计划中的提交步骤只在后续初始化 Git 后执行，本次开发不伪造提交记录。

---

### Task 1: 建立平台类型和可信数据源映射

**Files:**
- Create: `server/platform.ts`
- Create: `src/lib/platform.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/api.ts`
- Modify: `server/types.ts`
- Modify: `src/lib/route.ts`
- Create: `tests/platform.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `DataPlatform = "iOS" | "HarmonyOS"`
- Produces: `parseDataPlatform(value: unknown): DataPlatform | null`
- Produces: `resolvePlatformSource(platform: DataPlatform): PlatformSource`
- Produces: `platformLabel(platform: DataPlatform): "iOS" | "鸿蒙"`

- [x] **Step 1: 添加测试命令和失败测试**

在 `package.json` 增加：

```json
"test": "tsx --test tests/*.test.ts"
```

创建 `tests/platform.test.ts`：

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  parseDataPlatform,
  resolvePlatformSource
} from "../server/platform";

test("平台参数只接受 iOS 和 HarmonyOS", () => {
  assert.equal(parseDataPlatform(undefined), "iOS");
  assert.equal(parseDataPlatform("iOS"), "iOS");
  assert.equal(parseDataPlatform("HarmonyOS"), "HarmonyOS");
  assert.equal(parseDataPlatform("android"), null);
});

test("平台通过固定映射解析为不同数据表", () => {
  const ios = resolvePlatformSource("iOS");
  const harmony = resolvePlatformSource("HarmonyOS");
  assert.equal(ios.label, "iOS");
  assert.equal(harmony.label, "鸿蒙");
  assert.notEqual(ios.table, harmony.table);
  assert.match(ios.table, /ads_ad_ios_asa_roi_di$/);
  assert.match(harmony.table, /ads_ad_hm_roi_di$/);
});
```

- [x] **Step 2: 运行测试并确认失败**

Run: `npm test`

Expected: FAIL，提示找不到 `server/platform.ts` 或导出函数。

- [x] **Step 3: 实现服务端平台解析与数据源白名单**

`server/platform.ts` 的核心实现：

```ts
import type { DataPlatform } from "./types";

export type PlatformSource = {
  platform: DataPlatform;
  label: "iOS" | "鸿蒙";
  table: string;
};

const sources: Record<DataPlatform, PlatformSource> = {
  iOS: {
    platform: "iOS",
    label: "iOS",
    table: process.env.ASA_DB_TABLE_IOS ?? "hive.ads.ads_ad_ios_asa_roi_di"
  },
  HarmonyOS: {
    platform: "HarmonyOS",
    label: "鸿蒙",
    table: process.env.ASA_DB_TABLE_HARMONY ?? "hive.ads.ads_ad_hm_roi_di"
  }
};

export function parseDataPlatform(value: unknown): DataPlatform | null {
  if (value === undefined || value === null || value === "") return "iOS";
  if (value === "iOS" || value === "HarmonyOS") return value;
  return null;
}

export function resolvePlatformSource(platform: DataPlatform) {
  return sources[platform];
}
```

- [x] **Step 4: 实现前端平台标签和类型**

在 `src/lib/types.ts` 增加 `DataPlatform`，把 `KeywordRow.platform` 从字面量 `"iOS"` 改为 `DataPlatform`，并让 `DashboardResponse` 增加：

```ts
platform: DataPlatform;
```

在 `src/lib/platform.ts` 提供：

```ts
import type { DataPlatform } from "./types";

export const DATA_PLATFORMS: readonly DataPlatform[] = ["iOS", "HarmonyOS"];

export function platformLabel(platform: DataPlatform) {
  return platform === "HarmonyOS" ? "鸿蒙" : "iOS";
}

export function clientPlatform(value: string | null): DataPlatform {
  return value === "HarmonyOS" ? "HarmonyOS" : "iOS";
}
```

`server/types.ts` 同步导出 `DataPlatform`。`src/lib/api.ts` 把 `QueryParams.platform` 从 `string` 改为 `DataPlatform`。`src/lib/route.ts` 的默认值保留 `iOS`，URL 解析使用 `clientPlatform`，非法值回退 iOS。

- [x] **Step 5: 运行测试、类型检查和 lint**

Run: `npm test && npm run lint && npx tsc -b`

Expected: 全部通过。

- [x] **Step 6: 记录任务提交**

当前目录无 Git，记录“Task 1 完成”到计划进度；若后续初始化 Git，则提交信息使用：

```bash
git add package.json server/platform.ts server/types.ts src/lib/platform.ts src/lib/types.ts src/lib/api.ts src/lib/route.ts tests/platform.test.ts
git commit -m "feat: add dashboard platform model"
```

---

### Task 2: 隔离服务端缓存和响应平台

**Files:**
- Modify: `server/dashboard-cache.ts`
- Modify: `server/index.ts`
- Modify: `src/lib/dashboard-cache.ts`
- Create: `tests/dashboard-cache.test.ts`

**Interfaces:**
- Consumes: `DataPlatform`、`parseDataPlatform`
- Produces: `buildDashboardServerCacheKey({ platform, ...filters })`
- Produces: 每个 `DashboardResponse` 的 `platform` 字段

- [ ] **Step 1: 写缓存隔离失败测试**

创建 `tests/dashboard-cache.test.ts`：

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildDashboardServerCacheKey } from "../server/dashboard-cache";

const base = {
  startDate: "20260701",
  endDate: "20260707",
  keyword: "",
  campaignId: "",
  adGroupId: "",
  status: "",
  revenueMode: "all" as const
};

test("同一筛选条件下不同平台不能共用服务端缓存键", () => {
  const ios = buildDashboardServerCacheKey({ ...base, platform: "iOS" });
  const harmony = buildDashboardServerCacheKey({ ...base, platform: "HarmonyOS" });
  assert.notEqual(ios, harmony);
});
```

- [ ] **Step 2: 运行测试并确认类型或断言失败**

Run: `npm test`

Expected: FAIL，`DashboardCacheKeyInput` 尚未接受 `platform`。

- [ ] **Step 3: 将平台加入服务端缓存键**

修改 `server/dashboard-cache.ts`：

```ts
type DashboardCacheKeyInput = {
  platform: DataPlatform;
  startDate: string;
  endDate: string;
  keyword: string;
  campaignId: string;
  adGroupId: string;
  status: string;
  revenueMode: RevenueMode;
};

export function buildDashboardServerCacheKey(input: DashboardCacheKeyInput) {
  return JSON.stringify({
    platform: input.platform,
    startDate: input.startDate,
    endDate: input.endDate,
    keyword: input.keyword,
    campaignId: input.campaignId,
    adGroupId: input.adGroupId,
    status: input.status,
    revenueMode: input.revenueMode
  });
}
```

- [ ] **Step 4: API 统一校验平台并写入响应**

在三个接口入口先执行：

```ts
const platform = parseDataPlatform(req.query.platform);
if (!platform) {
  res.status(400).json({ error: "platform 仅支持 iOS 或 HarmonyOS" });
  return;
}
```

所有 `DashboardResponse`（缓存未命中占位、真实响应、预热响应）都写入 `platform`。调用 `buildDashboardServerCacheKey` 时必须传入平台。

- [ ] **Step 5: 升级浏览器缓存并验证响应平台**

把 `src/lib/dashboard-cache.ts` 的版本从 9 升为 10，并在 `isDashboardResponse` 中要求：

```ts
(data.platform === "iOS" || data.platform === "HarmonyOS")
```

- [ ] **Step 6: 运行测试和静态检查**

Run: `npm test && npm run lint && npx tsc -b`

Expected: 全部通过，缓存测试证明 iOS 与鸿蒙键不同。

- [ ] **Step 7: 记录任务提交**

```bash
git add server/dashboard-cache.ts server/index.ts src/lib/dashboard-cache.ts tests/dashboard-cache.test.ts
git commit -m "fix: isolate dashboard cache by platform"
```

当前目录无 Git 时仅更新计划进度。

---

### Task 3: 核验鸿蒙表结构并平台化 StarRocks 查询

**Files:**
- Create: `server/platform-schema.ts`
- Create: `server/check-platform-schema.ts`
- Modify: `server/starrocks.ts`
- Modify: `package.json`
- Create: `tests/platform-schema.test.ts`

**Interfaces:**
- Consumes: `resolvePlatformSource(platform)`
- Produces: `compareRequiredColumns(columns): SchemaCheckResult`
- Produces: `fetchLiveData({ platform, ...filters })`
- Produces: `fetchLiveDailyRows({ platform, ...filters })`

- [ ] **Step 1: 为必需字段检查写失败测试**

`tests/platform-schema.test.ts`：

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  compareRequiredColumns,
  REQUIRED_SOURCE_COLUMNS
} from "../server/platform-schema";

test("缺少成本或 ROI 核心字段时结构检查失败", () => {
  const result = compareRequiredColumns(["day", "campaign_id", "ad_group_id", "keyword_id"]);
  assert.equal(result.ok, false);
  assert.ok(result.missing.includes("spend"));
  assert.ok(result.missing.includes("revenue_total"));
});

test("当前查询需要的字段全部存在时通过", () => {
  const result = compareRequiredColumns(REQUIRED_SOURCE_COLUMNS);
  assert.equal(result.ok, true);
  assert.deepEqual(result.missing, []);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test`

Expected: FAIL，尚无 `server/platform-schema.ts`。

- [ ] **Step 3: 实现纯函数结构检查和只读检查脚本**

`server/platform-schema.ts` 导出以下完整字段清单和检查函数：

```ts
export const REQUIRED_SOURCE_COLUMNS = [
  "day",
  "campaign_id",
  "campaign_name",
  "ad_group_id",
  "ad_group_name",
  "keyword_id",
  "keyword",
  "impressions",
  "taps",
  "tap_installs",
  "tap_new_downloads",
  "tap_redownloads",
  "total_installs",
  "total_new_downloads",
  "total_redownloads",
  "new_user_cnt",
  "new_register_cnt",
  "spend",
  "cost_per_activation",
  "cost_per_register",
  "pay_uv",
  "pay_uv_1d",
  "cost_per_pay",
  "revenue_total",
  "revenue_vip_total",
  "revenue_charge_total",
  "ad_revenue_total",
  "revenue_1d",
  "revenue_2d",
  "revenue_3d",
  "revenue_4d",
  "revenue_5d",
  "revenue_6d",
  "revenue_7d",
  "revenue_15d",
  "revenue_30d",
  "revenue_vip_1d",
  "revenue_vip_2d",
  "revenue_vip_3d",
  "revenue_vip_4d",
  "revenue_vip_5d",
  "revenue_vip_6d",
  "revenue_vip_7d",
  "revenue_vip_15d",
  "revenue_vip_30d",
  "revenue_charge_1d",
  "revenue_charge_2d",
  "revenue_charge_3d",
  "revenue_charge_4d",
  "revenue_charge_5d",
  "revenue_charge_6d",
  "revenue_charge_7d",
  "revenue_charge_15d",
  "revenue_charge_30d",
  "ad_revenue_1d",
  "ad_revenue_2d",
  "ad_revenue_3d",
  "ad_revenue_4d",
  "ad_revenue_5d",
  "ad_revenue_6d",
  "ad_revenue_7d",
  "ad_revenue_15d",
  "ad_revenue_30d"
] as const;
```

检查函数：

```ts
export function compareRequiredColumns(columns: readonly string[]) {
  const available = new Set(columns);
  const missing = REQUIRED_SOURCE_COLUMNS.filter((column) => !available.has(column));
  return { ok: missing.length === 0, missing };
}
```

`server/check-platform-schema.ts` 使用现有 `.env.local` 和 mysql2，分别执行：

```sql
DESCRIBE <allowlisted table>
SELECT MIN(day) AS min_day, MAX(day) AS max_day, COUNT(*) AS row_count
FROM <allowlisted table>
```

只输出表名、字段数、缺失字段、日期范围和行数，不输出连接凭证。`package.json` 增加：

```json
"check:platform-schema": "tsx server/check-platform-schema.ts"
```

- [ ] **Step 4: 执行生产只读结构核验**

Run: `npm run check:platform-schema`

Expected: 两张表均 `ok: true`，并确认鸿蒙表在生产环境可解析为 `hive.ads.ads_ad_hm_roi_di`；若只有 `ads.ads_ad_hm_roi_di` 可用，则把 `ASA_DB_TABLE_HARMONY` 写入服务器现有 `.env.local`，不修改或上传本地环境文件。

若连接仍超时，继续完成代码但保持鸿蒙入口未部署，并在交付中标记该唯一上线阻塞项。

- [ ] **Step 5: StarRocks 查询显式接收平台**

给 `LiveQueryParams` 增加：

```ts
platform: DataPlatform;
```

移除模块级固定 `TABLE`。每个查询函数开头解析：

```ts
const { table } = resolvePlatformSource(params.platform);
```

把所有 `FROM ${TABLE}` 替换为 `FROM ${table}`。`mapSummaryRow` 接收 `platform` 并写入 `KeywordRow.platform`；`mapDailyRow` 同样写入 `DailyKeywordRow.platform`。历史首投日、全局数据截至日、广告组、日期汇总和每日明细必须使用同一平台表。

- [ ] **Step 6: 运行测试和静态检查**

Run: `npm test && npm run lint && npx tsc -b`

Expected: 全部通过，源码中不再存在用于实时查询的单一 `const TABLE`。

- [ ] **Step 7: 记录任务提交**

```bash
git add package.json server/platform-schema.ts server/check-platform-schema.ts server/starrocks.ts tests/platform-schema.test.ts
git commit -m "feat: query platform-specific roi sources"
```

当前目录无 Git 时仅更新计划进度。

---

### Task 4: 平台化 API、数据模型、预热和错误信息

**Files:**
- Modify: `server/index.ts`
- Modify: `server/data-model.ts`
- Modify: `server/sql-generator.ts`
- Modify: `server/platform.ts`
- Modify: `src/lib/types.ts`
- Create: `tests/platform-source-note.test.ts`

**Interfaces:**
- Consumes: `DataPlatform`、`PlatformSource`
- Produces: `sourceNote(platform, hasRows)`
- Produces: 平台化 dashboard、daily 和 SQL metadata 响应

- [ ] **Step 1: 写平台数据源文案失败测试**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { platformSourceNote } from "../server/platform";

test("数据源文案明确标识平台和表", () => {
  assert.match(platformSourceNote("iOS", true), /iOS.*ads_ad_ios_asa_roi_di/);
  assert.match(platformSourceNote("HarmonyOS", true), /鸿蒙.*ads_ad_hm_roi_di/);
  assert.match(platformSourceNote("HarmonyOS", false), /暂无数据/);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test`

Expected: FAIL，`platformSourceNote` 尚未实现。

- [ ] **Step 3: 实现平台数据源文案和响应模型**

`platformSourceNote` 只读取 `resolvePlatformSource`，返回：

```text
实时数仓 iOS · hive.ads.ads_ad_ios_asa_roi_di：已返回真实数据
实时数仓 鸿蒙 · hive.ads.ads_ad_hm_roi_di：该区间暂无数据
```

`DashboardResponse.source` 增加 `table` 字段，真实响应写入实际 allowlisted 表名。缓存占位响应也写入当前平台和表。

- [ ] **Step 4: API 所有数据调用传入平台**

Dashboard、daily、SQL metadata 和预热调用都传：

```ts
await fetchLiveData({ platform, startDate, endDate, ...filters });
await fetchLiveDailyRows({ platform, startDate, endDate, ...filters });
```

错误返回改为：

```ts
error: `${platformLabel} 数仓读取失败：${message}`
```

- [ ] **Step 5: 预热两个平台且错误隔离**

把单平台预热改为顺序循环：

```ts
for (const platform of ["iOS", "HarmonyOS"] satisfies DataPlatform[]) {
  try {
    await prewarmPlatformDashboardCache(platform);
  } catch (error) {
    console.warn(`${platform} dashboard cache prewarm failed:`, error);
  }
}
```

同一平台的 cache key、响应 platform 和数据源表必须一致。

- [ ] **Step 6: 避免鸿蒙返回 iOS 数据模型说明**

`server/data-model.ts` 改为 `dataModelForPlatform(platform, table)`。iOS 保留现有明细；鸿蒙仅声明成品表、粒度、币种和 `ROI = 归因收入 / 广告花费`，不复用 iOS 归因表清单。SQL metadata 对鸿蒙返回基于成品表和当前筛选条件的只读核验 SQL，不生成 iOS 的归因链路 SQL。

- [ ] **Step 7: 运行测试和静态检查**

Run: `npm test && npm run lint && npx tsc -b`

Expected: 全部通过。

- [ ] **Step 8: 记录任务提交**

```bash
git add server/index.ts server/data-model.ts server/sql-generator.ts server/platform.ts src/lib/types.ts tests/platform-source-note.test.ts
git commit -m "feat: expose platform-aware roi api"
```

当前目录无 Git 时仅更新计划进度。

---

### Task 5: 增加前端平台切换并隔离详情状态

**Files:**
- Modify: `src/components/FilterBar.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/Topbar.tsx`
- Modify: `src/components/DataStatus.tsx`
- Modify: `src/App.tsx`
- Modify: `src/lib/api.ts`
- Modify: `src/lib/daily-keywords.ts`
- Modify: `src/lib/export.ts`
- Modify: `src/styles.css`
- Create: `tests/client-platform.test.ts`

**Interfaces:**
- Consumes: `DataPlatform`、`platformLabel`
- Produces: `FilterBar.onPlatformChange(platform)`
- Produces: 平台化详情请求键和导出文件名

- [ ] **Step 1: 写前端平台标签失败测试**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { clientPlatform, platformExportPrefix, platformLabel } from "../src/lib/platform";

test("前端平台展示、URL 回退和导出前缀稳定", () => {
  assert.equal(platformLabel("HarmonyOS"), "鸿蒙");
  assert.equal(clientPlatform("HarmonyOS"), "HarmonyOS");
  assert.equal(clientPlatform("bad-value"), "iOS");
  assert.equal(platformExportPrefix("iOS"), "ios");
  assert.equal(platformExportPrefix("HarmonyOS"), "harmony");
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test`

Expected: FAIL，缺少 `platformExportPrefix`。

- [ ] **Step 3: 在筛选栏增加分段平台控件**

`FilterBar` 增加：

```tsx
<div className="platform-switch" role="group" aria-label="数据平台">
  {DATA_PLATFORMS.map((platform) => (
    <button
      key={platform}
      type="button"
      className={query.platform === platform ? "active" : ""}
      aria-pressed={query.platform === platform}
      onClick={() => onPlatformChange(platform)}
    >
      {platformLabel(platform)}
    </button>
  ))}
</div>
```

控件放在日期范围前，使用现有蓝色主色、固定高度和 8px 以内圆角，不增加新卡片。

- [ ] **Step 4: App 实现即时平台切换和状态隔离**

`App.tsx` 的切换函数：

```ts
function changePlatform(platform: DataPlatform) {
  const next = {
    ...query,
    platform,
    campaignId: "",
    adGroupId: ""
  };
  setKeywordScope({ type: "all" });
  setRoute({ page: "campaigns" });
  updateQuery(next);
}
```

`dailyScopeKey`、`dateKeywordScopeKey` 必须包含 `query.platform`。`dailyKeywordRowsToKeywordRows` 使用行内平台或显式平台参数，不再硬编码 `iOS`。

- [ ] **Step 5: 平台化标题、来源、空状态和导出**

- Sidebar 活动菜单显示 `${platformLabel(query.platform)} 计划 ROI`。
- Topbar 首页标题显示 `${platformLabel(query.platform)} 计划 ROI 总览`。
- DataStatus 保留缓存状态，但来源描述使用 API 返回的当前平台表。
- CSV 文件名使用 `ios-...csv` 或 `harmony-...csv`，函数调用显式传入当前平台。
- API 收到的 `payload.platform` 与请求平台不一致时抛出“平台响应不匹配”，不得渲染。

- [ ] **Step 6: 运行单测、lint 和构建**

Run: `npm test && npm run lint && npm run build`

Expected: 全部通过，Vite 生成生产资源。

- [ ] **Step 7: 记录任务提交**

```bash
git add src/components/FilterBar.tsx src/components/Sidebar.tsx src/components/Topbar.tsx src/components/DataStatus.tsx src/App.tsx src/lib/api.ts src/lib/daily-keywords.ts src/lib/export.ts src/lib/platform.ts src/styles.css tests/client-platform.test.ts
git commit -m "feat: add ios and harmony dashboard switch"
```

当前目录无 Git 时仅更新计划进度。

---

### Task 6: 本地数据、交互和回归验证

**Files:**
- Modify: `PROJECT_CONTEXT.md`
- Modify: `docs/superpowers/plans/2026-07-17-harmony-dashboard.md`

**Interfaces:**
- Consumes: 完整双平台 API 和 UI
- Produces: 可供用户验收的本地构建与中文交接记录

- [ ] **Step 1: 运行完整自动检查**

Run: `npm test && npm run lint && npm run build`

Expected: 单测、ESLint、TypeScript 和 Vite 构建全部通过。

- [ ] **Step 2: 启动本地应用并验证 API**

Run: `npm run dev`

分别请求：

```text
/api/asa/keyword-roi?platform=iOS&startDate=<有效日期>&endDate=<有效日期>&forceRefresh=true
/api/asa/keyword-roi?platform=HarmonyOS&startDate=<有效日期>&endDate=<有效日期>&forceRefresh=true
/api/asa/keyword-roi?platform=Android&startDate=<有效日期>&endDate=<有效日期>
```

Expected: 前两个响应的 `platform`、`source.table` 和行内平台一致；非法平台返回 400。

- [ ] **Step 3: 直接数仓对账**

对两个平台各选一个有数据日期和关键词/计划，直接聚合并与 API 对照：成本、广告收入、付费收入、总收益、总 ROI、D1-D7、D15、D30。允许的唯一差异是界面百分比格式化，不允许数据源或分母不同。

- [ ] **Step 4: 浏览器验证双平台切换**

在桌面视口检查：

- iOS 与鸿蒙按钮不会改变筛选栏高度；
- 切换后 URL、标题、数据源、缓存时间和表格数据同步变化；
- iOS -> 鸿蒙 -> iOS 不串缓存；
- 关键词、计划、日期、详情页和导出均属于当前平台；
- 无数据和错误状态不会沿用上一平台表格；
- iOS 既有 ROI 精度和成熟度样本不回归。

- [ ] **Step 5: 更新中文项目交接文档**

在 `PROJECT_CONTEXT.md` 记录：平台入口、两张数据表、缓存隔离、查询/刷新语义、schema 核验结果、测试结果和待部署状态。

- [ ] **Step 6: 等待用户本地验收和部署授权**

本任务完成后提供本地访问地址和核验摘要。用户明确说“上传”或“部署”前，不修改生产服务器。

---

### Task 7: 用户授权后部署生产环境

**Files:**
- Modify: `PROJECT_CONTEXT.md`

**Interfaces:**
- Consumes: 用户明确部署授权、通过的 schema 对账和本地构建
- Produces: 线上双平台看板和可回滚备份

- [ ] **Step 1: 部署前复跑检查**

Run: `npm test && npm run lint && npm run build`

Expected: 全部通过。

- [ ] **Step 2: 备份服务器项目目录**

在服务器创建带时间戳的 `/root/asa-roi-dashboard-backup-YYYYMMDD_HHMMSS.tar.gz`，确认备份文件存在后再同步。

- [ ] **Step 3: 同步源码并保护服务器配置**

使用既有 rsync 流程，排除 `.env*`、`node_modules`、`dist`、`.git` 和 `.DS_Store`。若生产完整表名需要环境变量，只在服务器原有 `.env.local` 中追加 `ASA_DB_TABLE_HARMONY`，不上传本地配置覆盖它。

- [ ] **Step 4: 构建并重启服务**

服务器执行：

```bash
cd /root/asa-roi-dashboard
npm install
npm test
npm run build
pm2 restart asa-roi --update-env
pm2 save
```

- [ ] **Step 5: 生产验证**

确认健康检查、pm2、静态资源、iOS API、鸿蒙 API、缓存隔离和浏览器平台切换全部正常；分别执行一次强制刷新并核对数仓样本。

- [ ] **Step 6: 同步部署记录**

把备份路径、资源 hash、生产样本、数据截至日和验证结果写入中文 `PROJECT_CONTEXT.md`，再单独同步该文档到服务器。
