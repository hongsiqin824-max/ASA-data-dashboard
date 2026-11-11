# ASA 数据后台

公司内部投放 ROI 数据看板，当前支持 iOS ASA、鸿蒙和小红书投放数据。iOS 提供关键词/计划维度，鸿蒙提供任务/子任务维度，小红书按推广计划/日期维度展示成本、收益、转化及 D1-D7、D15、D30、总 ROI。

## 这个项目能做什么

- **多平台 ROI 看板**：在一个界面查看 iOS ASA、鸿蒙、小红书三端的成本、收益、转化与 D1-D7/D15/D30/总 ROI。
- **多维度下钻**：iOS 支持关键词/计划维度，鸿蒙支持任务/子任务维度，小红书按推广计划/日期维度展示。
- **留存展示与导出**：次日/3 日/7 日/14 日/30 日留存率展示，支持导出 CSV。
- **AI 出价建议（仅 iOS）**：逐词调用大模型给出出价建议，带规则兜底、持久化缓存和预生成，进页面即秒开。
- **iOS 自然量对照（仅 iOS）**：首页「自然量」tab，按天展示剔除 ASA 归因后的 iPhone 自然量激活/注册/留存，并与同日 ASA 激活/注册对照、给出自然量占比；支持导出 CSV。
- **鸿蒙新增设备接口**：`GET /api/harmony/new-devices`，token 鉴权，按单天/区间返回鸿蒙新增设备明细（含 oaid），供外部做转化回传。
- **真实数据原则**：只展示数仓返回的真实数据，缺失窗口不补值、不沿用前值，异常宁可显式报错也不返回残缺数据。

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
ASA_DB_TABLE_BAIDU
ASA_BASE_URL
ASA_HOST
API_PORT

# AI 出价建议（仅 iOS，必须配置，否则「建议」tab 报未配置大模型）
LLM_API_KEY
LLM_BASE_URL          # OpenAI 兼容网关，如 https://ai.flashapi.top
LLM_MODEL             # 如 claude-opus-4
LLM_MAX_TOKENS        # 可选，默认 8192

# AI 出价建议缓存 / 预生成（均可选，有默认值）
ASA_DB_TABLE_IOS_BID         # iOS 出价明细表，默认 hive.dwd.dwd_ad_asa_keyword_report_di
ASA_DB_TABLE_IOS_NATURAL     # iOS 自然量按天表，默认 hive.ads.ads_ad_ios_natural_user_di
ASA_ADVICE_CACHE_FILE        # 持久化缓存文件，默认 ./.cache/advice-cache.json
ASA_ADVICE_CACHE_MINUTES     # 缓存 TTL，默认 360（6 小时）
ASA_ADVICE_CACHE_MAX_ITEMS   # 缓存最大条目，默认 20000
ASA_ADVICE_PREGEN_BATCH      # 预生成每批词数，默认 8
ASA_ADVICE_PREGEN_CONCURRENCY# 预生成并发批数，默认 6
```

## 数据源

```text
iOS：hive.ads.ads_ad_ios_asa_roi_di
iOS 自然量（附属）：hive.ads.ads_ad_ios_natural_user_di
鸿蒙：hive.ads.ads_ad_hm_roi_di
小红书：hive.ads.ads_ad_xhs_roi_di
百度：hive.ads.ads_ad_baidu_roi_di（推广计划 → 推广单元 → 关键词，界面简称计划 / 单元；无留存/广告收入）
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

## AI 出价建议预生成（可选但推荐）

AI 建议实时逐词调用大模型，首次生成较慢。为让用户进页面即秒开，提供预生成脚本：
按前端默认区间（滚动近 7 天）自查数仓、对全部 iOS 有消耗词 + 场景三词分批生成建议，
写入持久化缓存（`./.cache/advice-cache.json`，`pm2 restart` 不丢；预生成进程写盘后
web 进程会按文件 mtime 自动合并读到）。

手动执行：

```bash
npm run pregenerate-advice
```

定时执行（每天数仓出数后跑一次，用 pm2 cron 或系统 crontab，与 web 进程隔离）。
例如系统 crontab 每天 08:30（北京时间）：

```cron
30 8 * * * cd /path/to/asa && npm run pregenerate-advice >> .cache/pregenerate.log 2>&1
```

注意：预生成必须和前端默认区间一致才能命中缓存，脚本已复用同一套「近 7 天 + 有消耗词
筛选 + 场景三识别」逻辑（`src/lib/advice-scope.ts`），请勿单独修改其中一端。

## 文件说明

| 文件/目录 | 作用 |
|---|---|
| `src/` | 前端（React + Vite）：页面组件、UI 组件、数据处理 `lib/` |
| `server/` | 后端（Express）：路由、StarRocks 取数、缓存、AI 建议、鸿蒙设备接口 |
| `server/index.ts` | API 入口与路由（含 `/api/harmony/new-devices`） |
| `server/starrocks.ts` | StarRocks 查询与字段映射 |
| `sql/` | 口径确认与核心字段的探查 SQL |
| `tests/` | 口径/契约/取数等单元测试（`npm run test`） |
| `鸿蒙新增设备接口-交接与追溯记录.md` | 鸿蒙设备接口的需求、构造、注意事项与遗留项 |
| `ASA部署与更新手册.md` | 生产部署与更新流程 |
| `00_项目管理/` | 内部进度/交接/工作日志（非对外文档） |

## 重要限制 / 前提

- **数据有一天延迟**：数仓快照通常截至昨天/前天；查询晚于快照日的日期会显式报错，而非返回半截数据。
- **鸿蒙无设备级广告归因**：鸿蒙新增设备接口返回的是「广告 + 自然量」混合设备，不是纯广告转化设备。
- **AI 建议需配置大模型**：未配置 `LLM_*` 时「建议」tab 会报未配置。
- **令牌保密**：鸿蒙设备接口令牌泄露等于设备数据裸奔，对接优先走 header `x-api-token`。
- **环境文件不入库**：`.env.local` 含账号密码，禁止提交。

## 后续规划

- [ ] 鸿蒙设备接口付费类字段（卡在数据团队授权订单表 + 老板确认付费口径，详见交接记录第 8 节）。
- [ ] 确认「转化」口径（激活 vs 付费）与回传目标平台/格式。

---

## 维护说明（改动请同步到这里）
> 每次有功能/行为变更，在下方「变更记录」追加一行，保持本 README 与代码一致。

### 变更记录
- 2026-11-04：新增第四个平台「百度」（`platform=Baidu`），接入 `hive.ads.ads_ad_baidu_roi_di`；推广计划映射为计划、推广单元映射为下级（同鸿蒙任务/子任务），付费 UV 与其他平台一致取 `pay_uv`；表中无安装数，付费率列改显示付费 UV；支持列表/日期视图与 CSV 导出，纳入 `check:platform-schema` 与启动预热。
- 2026-11-10：百度改为关键词粒度（数仓表新增 `keyword_id` / `keyword`），按 iOS 样式显示，界面把「推广计划 / 推广单元」简称「计划 / 单元」：关键词列表为「关键词 | 计划 | 单元」，计划表同时显示单元数与关键词数（不单独做单元页签，需要时再加）；`keyword_id` 为 -1 / 空（自动扩量、无关键词、归因缺失）的行同 iOS 按推广单元归成一行 -1「未匹配关键词」（数仓 20261110 分区起才按关键词拆分，之前分区全是 -1，也归在这一行，所以文案不写「自动扩量」）；搜索框同时匹配关键词和计划名；4 个百度导出补上关键词 / 单元列，表头同样用简称；前端缓存升到 v15。
- 2026-10-24：iOS 新增「自然量」tab，接入 `hive.ads.ads_ad_ios_natural_user_di`（自然量激活/注册/8 档留存），与同日 ASA 激活/注册对照并给出占比；数据随 `/api/asa/keyword-roi` 响应附带（`naturalDailyRows` / `naturalDataAsOfDate`），复用服务端缓存与查询/刷新语义；前端缓存版本升至 v13。
- 2026-10-15：补全 README 能力概览、文件说明、重要限制与后续规划章节。
