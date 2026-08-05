# ASA 数据后台

公司内部投放 ROI 数据看板，当前支持 iOS ASA、鸿蒙和小红书投放数据。iOS 提供关键词/计划维度，鸿蒙提供任务/子任务维度，小红书按推广计划/日期维度展示成本、收益、转化及 D1-D7、D15、D30、总 ROI。

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
ASA_DB_TABLE_XHS
ASA_BASE_URL
ASA_HOST
API_PORT
```

## 数据源

```text
iOS：hive.ads.ads_ad_ios_asa_roi_di
鸿蒙：hive.ads.ads_ad_hm_roi_di
小红书：hive.ads.ads_ad_xhs_roi_di
```

项目只展示数仓查询返回的真实数据，不对缺失 ROI 窗口补值或沿用前一窗口数据。小红书源表没有广告组、关键词或子任务字段，因此页面和导出不会构造这些下级维度。

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

同步源码时必须使用仓库内的 `.deployignore` 排除清单，避免覆盖服务器 `.env.local`，也避免上传依赖、构建产物、个人本地上下文和开发过程记录。
