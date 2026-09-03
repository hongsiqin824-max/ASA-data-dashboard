import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  clientPlatform,
  ensurePlatformResponse,
  keywordEntityOrder,
  platformExportPrefix,
  platformLabel,
  platformUi
} from "../src/lib/platform";
import { filterRowsByPlanSelection } from "../src/lib/plan-filter";

test("计划多选只过滤 iOS 关键词，其他平台保持原数据", () => {
  const rows = [
    { campaignId: "ios-a", value: 1 },
    { campaignId: "ios-b", value: 2 }
  ];

  assert.deepEqual(
    filterRowsByPlanSelection(rows, "iOS", ["ios-b"]),
    [{ campaignId: "ios-b", value: 2 }]
  );
  assert.deepEqual(
    filterRowsByPlanSelection(rows, "HarmonyOS", ["ios-b"]),
    rows
  );
  assert.deepEqual(
    filterRowsByPlanSelection(rows, "Xiaohongshu", []),
    rows
  );
  assert.deepEqual(filterRowsByPlanSelection(rows, "iOS", null), rows);
});

test("前端平台展示、URL 回退和导出前缀稳定", () => {
  assert.equal(platformLabel("HarmonyOS"), "鸿蒙");
  assert.equal(clientPlatform("HarmonyOS"), "HarmonyOS");
  assert.equal(clientPlatform("bad-value"), "iOS");
  assert.equal(platformExportPrefix("iOS"), "ios");
  assert.equal(platformExportPrefix("HarmonyOS"), "harmony");
  assert.equal(platformLabel("Xiaohongshu"), "小红书");
  assert.equal(clientPlatform("Xiaohongshu"), "Xiaohongshu");
  assert.equal(platformExportPrefix("Xiaohongshu"), "xhs");
});

test("小红书只展示计划级真实能力", () => {
  const ui = platformUi("Xiaohongshu");

  assert.equal(ui.parentEntity, "推广计划");
  assert.equal(ui.hasChildEntity, false);
  assert.equal(ui.hasInstallMetric, false);
  assert.equal(ui.hasPaymentRate, false);
  assert.equal(ui.hasAdRevenue, false);
  assert.equal(ui.hasFullRoiWindows, true);
});

test("鸿蒙界面使用任务和子任务语义并隐藏缺失指标", () => {
  const ui = platformUi("HarmonyOS");

  assert.equal(ui.parentEntity, "任务");
  assert.equal(ui.childEntity, "子任务");
  assert.equal(ui.installMetric, "下载");
  assert.equal(ui.hasAdRevenue, false);
  assert.equal(ui.hasIosInstallBreakdown, false);
});

test("鸿蒙任务列排在子任务前并作为首列，iOS 保持原顺序", () => {
  assert.deepEqual(keywordEntityOrder("HarmonyOS"), ["parent", "child"]);
  assert.deepEqual(keywordEntityOrder("iOS"), ["child", "parent"]);
});

test("请求平台与响应平台不一致时拒绝渲染", () => {
  assert.doesNotThrow(() => ensurePlatformResponse("HarmonyOS", "HarmonyOS"));
  assert.throws(
    () => ensurePlatformResponse("HarmonyOS", "iOS"),
    /平台响应不匹配/
  );
});

test("平台切换按钮等宽铺满整个点击框", () => {
  const styles = readFileSync(
    new URL("../src/styles.css", import.meta.url),
    "utf8"
  );

  assert.match(
    styles,
    /\.segmented\.platform-switch button\s*\{[^}]*flex:\s*1 1 0;[^}]*min-width:\s*0;/s
  );
});

test("三个平台共用日期预设，平台切换保持当前日期", () => {
  const filterBar = readFileSync(
    new URL("../src/components/FilterBar.tsx", import.meta.url),
    "utf8"
  );
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../src/lib/route.ts", import.meta.url), "utf8");
  const serverIndex = readFileSync(
    new URL("../server/index.ts", import.meta.url),
    "utf8"
  );
  const starrocks = readFileSync(
    new URL("../server/starrocks.ts", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(filterBar, /id:\s*["']world-cup["']/);
  assert.doesNotMatch(filterBar, /XHS_WORLD_CUP_RANGE/);
  assert.match(
    filterBar,
    /const next = \{\s*\.\.\.initialQuery,\s*platform: query\.platform/s
  );
  assert.doesNotMatch(app, /platformDateRanges|XHS_WORLD_CUP_RANGE/);
  assert.match(app, /updateQuery\(\{\s*platform,\s*campaignId:/s);
  assert.doesNotMatch(route, /XHS_WORLD_CUP_RANGE|platform === ["']Xiaohongshu["']/);
  assert.doesNotMatch(serverIndex, /XHS_WORLD_CUP_RANGE/);
  assert.match(serverIndex, /const startDate = beijingCompactDate\(-6\)/);
  assert.match(serverIndex, /const endDate = beijingCompactDate\(0\)/);
  assert.doesNotMatch(starrocks, /XHS_WORLD_CUP_RANGE/);
  assert.match(
    starrocks,
    /const values:\s*Array<string>\s*=\s*\[params\.startDate,\s*params\.endDate\]/
  );
});
