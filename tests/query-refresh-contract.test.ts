import assert from "node:assert/strict";
import test from "node:test";
import { dashboardRequestOptions } from "../src/lib/load-state";

test("查询只读缓存，刷新才强制读取数仓", () => {
  assert.deepEqual(dashboardRequestOptions("query"), { cacheOnly: true });
  assert.deepEqual(dashboardRequestOptions("refresh"), { forceRefresh: true });
});
