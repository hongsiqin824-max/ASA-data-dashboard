import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  clientPlatform,
  ensurePlatformResponse,
  keywordEntityOrder,
  platformExportPrefix,
  platformLabel,
  platformUi,
  XHS_WORLD_CUP_RANGE
} from "../src/lib/platform";

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

test("小红书只展示计划级真实能力并使用世界杯默认区间", () => {
  const ui = platformUi("Xiaohongshu");

  assert.equal(ui.parentEntity, "推广计划");
  assert.equal(ui.hasChildEntity, false);
  assert.equal(ui.hasInstallMetric, false);
  assert.equal(ui.hasPaymentRate, false);
  assert.equal(ui.hasAdRevenue, false);
  assert.equal(ui.hasFullRoiWindows, true);
  assert.deepEqual(XHS_WORLD_CUP_RANGE, {
    startDate: "2026-06-11",
    endDate: "2026-07-19"
  });
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
