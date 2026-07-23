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
  const harmony = buildDashboardServerCacheKey({
    ...base,
    platform: "HarmonyOS"
  });

  assert.notEqual(ios, harmony);
});
