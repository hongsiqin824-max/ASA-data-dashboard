import assert from "node:assert/strict";
import test from "node:test";
import { dataModelForPlatform } from "../server/data-model";

test("鸿蒙数据模型只声明鸿蒙成品表，不复用 iOS 归因链路", () => {
  const table = "hive.ads.ads_ad_hm_roi_di";
  const model = dataModelForPlatform("HarmonyOS", table);
  const serialized = JSON.stringify(model);

  assert.match(serialized, /ads_ad_hm_roi_di/);
  assert.doesNotMatch(serialized, /dwd_ad_ios_ads_attribution_df/);
  assert.deepEqual(model.grain, ["task", "sub_task", "day"]);
  assert.deepEqual(model.unresolvedItems, []);
});
