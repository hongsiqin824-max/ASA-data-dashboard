import "./env";
import mysql from "mysql2/promise";
import { resolvePlatformSource } from "./platform";
import { compareRequiredColumns } from "./platform-schema";
import type { DataPlatform } from "./types";

const platforms: readonly DataPlatform[] = ["iOS", "HarmonyOS"];

const connection = await mysql.createConnection({
  host: process.env.ASA_DB_HOST ?? "172.21.0.148",
  port: Number(process.env.ASA_DB_PORT ?? 9030),
  user: process.env.ASA_DB_USER,
  password: process.env.ASA_DB_PASSWORD,
  connectTimeout: 15_000,
  decimalNumbers: true
});

let failed = false;

for (const platform of platforms) {
  const source = resolvePlatformSource(platform);
  try {
    const [columnRows] = await connection.query(`DESCRIBE ${source.table}`);
    const columns = (columnRows as Array<Record<string, unknown>>).map((row) =>
      String(row.Field ?? "")
    );
    const check = compareRequiredColumns(platform, columns);
    const [statRows] = await connection.query(
      `SELECT MIN(day) AS min_day, MAX(day) AS max_day, COUNT(*) AS row_count FROM ${source.table}`
    );
    const stats = (statRows as Array<Record<string, unknown>>)[0] ?? {};

    console.log(
      JSON.stringify(
        {
          platform,
          table: source.table,
          columnCount: columns.length,
          ok: check.ok,
          missing: check.missing,
          minDay: stats.min_day ?? null,
          maxDay: stats.max_day ?? null,
          rowCount: stats.row_count ?? 0
        },
        null,
        2
      )
    );
    if (!check.ok) failed = true;
  } catch (error) {
    failed = true;
    console.error(
      JSON.stringify(
        {
          platform,
          table: source.table,
          error: error instanceof Error ? error.message : String(error)
        },
        null,
        2
      )
    );
  }
}

await connection.end();
if (failed) process.exitCode = 1;
