import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 部署在子路径(如 nginx 反代到 http://IP/asa/)时，前端资源/接口都要带这个前缀。
// 单一事实来源：ASA_BASE_URL。优先取 shell 环境变量(便于临时覆盖)，
// 否则自动读取 .env.local —— 所以服务器上配好 .env.local 后直接 `npm run build` 即可。
// 都没有(本地 dev / 根路径部署)时 base="/"，行为与以前完全一致。
function deriveBase(): string {
  let raw = process.env.ASA_BASE_URL;
  if (!raw) {
    try {
      process.loadEnvFile(".env.local");
      raw = process.env.ASA_BASE_URL;
    } catch {
      // 没有 .env.local 时忽略
    }
  }
  if (!raw) return "/";
  try {
    const p = new URL(raw).pathname.replace(/\/+$/, "");
    return p ? `${p}/` : "/";
  } catch {
    return "/";
  }
}

export default defineConfig({
  base: deriveBase(),
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4173",
        changeOrigin: true
      },
      "/auth": {
        target: "http://127.0.0.1:4173",
        changeOrigin: true
      }
    }
  }
});
