# ASA 数据后台

公司内部投放 ROI 数据看板，当前支持 iOS ASA 与鸿蒙投放数据。系统提供关键词、计划、任务、子任务和日期等维度的成本、收益、转化漏斗及 D1-D7、D15、D30、总 ROI 分析。

## 技术栈

- 前端：React 19、TypeScript、Vite
- 后端：Express 5、TypeScript
- 数据源：StarRocks（MySQL 协议）
- 运行环境：Node.js 20

## 本地开发

安装依赖：

```bash
npm install
```

在本地创建 `.env.local` 并配置数据库连接信息。环境文件包含账号密码，禁止提交到仓库。

启动前端与 API：

```bash
npm run dev
```

默认命令：

```bash
npm run test
npm run lint
npm run build
```

## 主要环境变量

```text
ASA_DB_HOST
ASA_DB_PORT
ASA_DB_USER
ASA_DB_PASSWORD
ASA_DB_TABLE_IOS
ASA_DB_TABLE_HARMONY
ASA_BASE_URL
ASA_HOST
API_PORT
```

## 数据源

```text
iOS：hive.ads.ads_ad_ios_asa_roi_di
鸿蒙：hive.ads.ads_ad_hm_roi_di
```

项目只展示数仓查询返回的真实数据，不对缺失 ROI 窗口补值或沿用前一窗口数据。

## 缓存语义

- 点击「查询」：仅查询服务器缓存。
- 点击「刷新」：重新读取数仓并覆盖服务器缓存和浏览器缓存。

## 生产部署

生产环境由 Express 托管 `dist/`，线上路径前缀为 `/asa/`，pm2 进程名为 `asa-roi`。

```bash
npm install
npm run test
npm run build
pm2 restart asa-roi --update-env
```

部署时不要覆盖服务器 `.env.local`，也不要上传 `node_modules`、`dist` 和本地日志。

更完整的业务口径、功能状态与部署记录请阅读 [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)。
