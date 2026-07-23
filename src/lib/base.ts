// src/lib/base.ts
// 部署在子路径(如 nginx 反代 http://IP/asa/)时的前缀处理。
// base 由 vite 注入到 import.meta.env.BASE_URL，其值来自构建时的 ASA_BASE_URL：
//   构建带 ASA_BASE_URL=http://IP/asa  → BASE_URL="/asa/"
//   本地 dev / 根路径部署              → BASE_URL="/"，下面两个函数都是恒等变换。
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, ""); // "/asa" 或 ""

// 给应用内绝对路径加部署前缀：withBase("/api/me") → "/asa/api/me"
export function withBase(path: string): string {
  if (!path.startsWith("/")) return path;
  return `${BASE}${path}`;
}

// 从浏览器 pathname 去掉部署前缀，供路由匹配：
//   stripBase("/asa/keywords/abc") → "/keywords/abc"
//   stripBase("/asa")              → "/"
export function stripBase(pathname: string): string {
  if (!BASE) return pathname;
  if (pathname === BASE) return "/";
  if (pathname.startsWith(`${BASE}/`)) return pathname.slice(BASE.length);
  return pathname;
}
