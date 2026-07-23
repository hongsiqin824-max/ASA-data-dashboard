import assert from "node:assert/strict";
import test from "node:test";
import { platformSourceNote } from "../server/platform";

test("数据源文案明确标识平台和表", () => {
  assert.match(
    platformSourceNote("iOS", true),
    /iOS.*ads_ad_ios_asa_roi_di/
  );
  assert.match(
    platformSourceNote("HarmonyOS", true),
    /鸿蒙.*ads_ad_hm_roi_di/
  );
  assert.match(platformSourceNote("HarmonyOS", false), /暂无数据/);
});
