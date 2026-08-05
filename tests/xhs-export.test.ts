import assert from "node:assert/strict";
import test from "node:test";
import {
  XHS_CAMPAIGN_EXPORT_HEADERS,
  XHS_DAILY_EXPORT_HEADERS
} from "../src/lib/export";

test("小红书导出只包含真实计划和转化字段", () => {
  const headers = [...XHS_CAMPAIGN_EXPORT_HEADERS, ...XHS_DAILY_EXPORT_HEADERS];

  assert.ok(headers.includes("广告主ID"));
  assert.ok(headers.includes("推广计划ID"));
  assert.ok(headers.includes("付费UV"));
  assert.ok(headers.includes("D6 ROI"));
  assert.equal(
    headers.some((header) =>
      /广告组|关键词|子任务|安装|下载|付费率|LTV|ARPU|广告收入|D60/.test(header)
    ),
    false
  );
});
