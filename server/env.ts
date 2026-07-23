// server/env.ts
// 必须在其它模块之前被 import：ESM 会先求值被导入模块的顶层代码，
// 而 auth.ts / starrocks.ts 在顶层就读取 process.env。
// 把 .env.local 的加载放在这里、并让 index.ts 第一行 import 它，
// 才能保证后续模块顶层读到的环境变量是已加载的。
try {
  process.loadEnvFile(".env.local");
} catch {
  // 没有 .env.local 时按默认（unconfigured）运行
}
