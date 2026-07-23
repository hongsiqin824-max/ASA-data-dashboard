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
