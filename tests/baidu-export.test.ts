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
  ["推广计划汇总", () => exportCampaignRows([fakeRow<CampaignRow>()], "Baidu")],
  ["推广单元汇总", () => exportKeywordRows([fakeRow<KeywordRow>()], "Baidu")],
  ["单元日明细", () => exportDailyRows([fakeRow<DailyKeywordRow>()], "x", "Baidu")],
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
      headers.some((h) => /付费率|下载|安装|关键词|留存|广告收入|LTV/.test(h)),
      false
    );
  });
}
