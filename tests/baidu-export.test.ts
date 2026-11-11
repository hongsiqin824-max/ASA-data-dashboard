import assert from "node:assert/strict";
import test from "node:test";
import {
  exportCampaignRows,
  exportDailyRows,
  exportDailySummaryRows,
  exportKeywordRows
} from "../src/lib/export";
import type {
  CampaignRow,
  DailyCampaignRow,
  DailyKeywordRow,
  KeywordRow
} from "../src/lib/types";

// 拦截浏览器下载，拿到 CSV 文本按行/列拆开校验。
function captureCsv(run: () => void): { filename: string; lines: string[][] } {
  let filename = "";
  let csv = "";
  const g = globalThis as Record<string, unknown>;
  const saved = { Blob: g.Blob, URL: g.URL, document: g.document };
  g.Blob = class {
    constructor(parts: string[]) {
      csv = parts.join("").replace(/^\uFEFF/, "");
    }
  };
  g.URL = { createObjectURL: () => "blob:x", revokeObjectURL: () => {} };
  g.document = {
    createElement: () => {
      const link: Record<string, unknown> = { click: () => {}, remove: () => {} };
      return new Proxy(link, {
        set(target, key, value) {
          if (key === "download") filename = String(value);
          target[key as string] = value;
          return true;
        }
      });
    },
    body: { append: () => {} }
  };
  try {
    run();
  } finally {
    Object.assign(g, saved);
  }
  const lines = csv
    .split("\n")
    .map((line) => line.slice(1, -1).split('","'));
  return { filename, lines };
}

// 用 Proxy 造一行：任意字段都返回 1，status 返回合法枚举。
function fakeRow<T>(): T {
  return new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (key === "status" ? "pause" : 1)
  }) as T;
}

const cases = [
  ["计划汇总", () => exportCampaignRows([fakeRow<CampaignRow>()], "Baidu")],
  ["关键词汇总", () => exportKeywordRows([fakeRow<KeywordRow>()], "Baidu")],
  ["关键词日明细", () => exportDailyRows([fakeRow<DailyKeywordRow>()], "x", "Baidu")],
  ["日期汇总", () => exportDailySummaryRows([fakeRow<DailyCampaignRow>()], "Baidu")]
] as const;

for (const [name, run] of cases) {
  test(`百度导出「${name}」表头与数据列数一致且不含无数据列`, () => {
    const { filename, lines } = captureCsv(run);
    assert.match(filename, /^baidu-/);
    const [headers, body] = lines;
    assert.equal(body.length, headers.length);
    assert.ok(headers.includes("付费UV"));
    assert.equal(
      headers.some((h) => /付费率|下载|安装|留存|广告收入|LTV/.test(h)),
      false
    );
  });
}

test("百度关键词汇总 / 日明细导出带关键词和单元两层，表头用简称", () => {
  for (const run of [cases[1][1], cases[2][1]]) {
    const [headers] = captureCsv(run).lines;
    for (const column of ["关键词ID", "关键词", "单元ID", "单元名", "计划名"]) {
      assert.ok(headers.includes(column), column);
    }
    assert.equal(headers.some((h) => h.includes("推广")), false);
  }
  const campaignHeaders = captureCsv(cases[0][1]).lines[0];
  assert.ok(campaignHeaders.includes("单元数"));
  assert.ok(campaignHeaders.includes("关键词数"));
});
