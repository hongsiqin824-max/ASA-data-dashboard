# ASA 关键词 ROI — 真实数仓 SQL（第一阶段交付）

这一份是交给**开发**在数仓（Hive / Spark）里跑的 SQL，目的是把后台从演示数据切换到真实 ROI。
本阶段只算**核心字段**，App 暂不直接连库（先把 SQL 跑通验证）。

## 文件

| 文件 | 作用 |
|---|---|
| `01_探查_口径确认.sql` | 6 段探查，先跑这个，确认文档里 ⚠️ 不确定的口径值 |
| `02_关键词ROI_核心字段.sql` | 主查询，keyword 级 ROI，可上卷 campaign / adgroup |

## 使用顺序（给开发）

1. **跑 `01`**：把每段单独执行，记录结果：
   - 探查1 → 会员 `pay_status` 哪些值是已支付
   - 探查2 → 充值 `pay_status` 哪些值是已支付
   - 探查3 → 充值 `refund_status` 哪些值是已退款（要排除）
   - 探查4 → 充值 `client_type` 是否要只取 iOS、iOS 是哪个值
   - 探查5 → `attr.uuid` 和 `taku.dqd_uuid` 能不能对上（matched 数接近 0 就是对不上，广告收入会偏低/为 0，要找映射）
   - 探查6 → 花费币种是不是都 RMB
2. **填 `02` 的占位符**：用上面结果替换 `{START_DAY} {END_DAY} {VIP_PAID_STATUS} {TOKEN_PAID_STATUS} {TOKEN_REFUND_EXCLUDE}`；若充值要只取 iOS，取消那行 `client_type` 注释并填值。
3. **跑 `02`**：输出每个关键词的 花费 / 安装 / 广告收入 / 会员收入 / 充值收入 / 总收益 / ROI。

## 本轮覆盖的字段

花费、展示、点击、安装、广告收入、会员收入、充值收入、付费收入、总收益、ROI（keyword 级，可上卷 campaign/adgroup）。

**原始建模 SQL 暂不产出**（文档未给数据源）：留存(2/3/7/14/30留)、LTV、LTV倍率、ARPU、ARPPU、广告展现、人均展现、eCPM、广告展现率、D1~D7 ROI。成品表接口已接入激活 `new_user_cnt` 与注册 `new_register_cnt`。

## 口径假设（已在 SQL 里落实）

- 币种统一 RMB：花费取 `local_spend.amount`，广告收入取 `cny_estimate_revenue`（不是美元的 `estimate_revenue`）。
- 收入归属用归因时间窗 `[uuid_begin_time, uuid_end_time)`，左闭右开。
- 归因表取最新 `day` 分区即全量，并加 `DISTINCT` 防快照重复行导致收入翻倍。
- 广告收入按 `day` 当天 0 点对齐归因窗（Taku 只到天粒度，属合理近似）。
- 花费区间 = 收入归属区间 = 同一统计区间（最简单口径，见下方待确认）。

## 待业务/开发确认（影响数字准确性）

- [ ] 探查5 若 uuid 对不上 → 广告收入要改用 idfa/idfv 等映射
- [ ] ROI 时间窗：全生命周期 还是 安装后固定 N 天？（当前按统计区间内的收入）
- [ ] 花费区间与收入归属区间如何对齐（如"某月花费"对"这批设备安装后 N 天收入"）
- [ ] 会员表软删除字段 `deleted_at` 的"未删除"判断（当前按 NULL 或空串）

## 下一步（拿到结果之后）

开发跑通、ROI 数字核对无误后，再做 App live 接入：服务端拿一个能传 SQL / 返回结果的查询接口，把 `server/index.ts` 的 `unconfigured` 模式换成真实查询。这部分等连接方式确定再做。
