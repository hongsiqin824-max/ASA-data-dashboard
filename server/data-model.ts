import type { DataPlatform } from "./types";

export const dataModel = {
  version: "ios-asa-roi-model-2026-06-26",
  formula: "ROI = 归因收入 / ASA广告花费",
  grain: ["keyword", "adgroup", "campaign"],
  currency: "RMB",
  attributionWindow: "[uuid_begin_time, uuid_end_time)",
  tables: [
    {
      role: "cost",
      name: "ods.ods_api_asa_keyword_report_di",
      partition: "process_day",
      grain: "keyword x day",
      amountField:
        "CAST(get_json_object(local_spend, '$.amount') AS DECIMAL(18,4))"
    },
    {
      role: "attribution",
      name: "dwd.dwd_ad_ios_ads_attribution_df",
      partition: "day",
      grain: "device x attribution event",
      partitionRule: "每日全量，取最新 day 分区"
    },
    {
      role: "ad_revenue",
      name: "dwd.dwd_ad_taku_device_report_di",
      partition: "day",
      grain: "device x ad placement x day",
      amountField: "cny_estimate_revenue"
    },
    {
      role: "vip_revenue",
      name: "ods.ods_mysql_dqd_dedecms_zc_vip_purchorder_pt",
      partition: "process_day",
      grain: "order",
      amountField: "CAST(total AS DECIMAL(18,4))",
      partitionRule: "全量同步，取最新 process_day 分区"
    },
    {
      role: "recharge_revenue",
      name: "ods.ods_mysql_lottery_token_orders_pt",
      partition: "process_day",
      grain: "order",
      amountField: "CAST(price AS DECIMAL(18,4))",
      partitionRule: "全量同步，取最新 process_day 分区"
    }
  ],
  unresolvedItems: [
    "attr.uuid 与 taku.dqd_uuid 是否同一加密口径",
    "zc_vip.pay_status 哪些值代表已支付",
    "token.pay_status 哪些值代表已支付",
    "token.refund_status 哪些值代表已退款",
    "token.client_type 是否需要限制 iOS 以及 iOS 枚举值",
    "ROI 时间窗口是全生命周期还是安装后固定 N 天",
    "留存、广告展现、eCPM 等扩展观察字段的数据源",
    // 成品表仅存 1~7/15/30/60 共 10 个收入窗口，缺 8~14、16~29 天，ROI 无法连续展示。
    // 60 日之后（70~180）只建了 roi_Nd，没有对应的 revenue_Nd，因此前端只能展示到 D60。
    // 原始链路（归因表 + 广告/会员/充值三类收入表）数据齐全，见 sql/02_关键词ROI_核心字段.sql，
    // 需数仓在建表逻辑补 revenue_Nd / revenue_vip_Nd / revenue_charge_Nd / ad_revenue_Nd
    // 四类 x 20 个窗口 = 80 个字段并回刷历史。同一张表的 retain_uv_1d~30d 已是连续 30 天。
    "ROI 窗口缺 8~14、16~29 天：待数仓补 80 个收入字段并回刷历史"
  ]
} as const;

export function dataModelForPlatform(platform: DataPlatform, table: string) {
  if (platform === "iOS") return dataModel;

  if (platform === "Xiaohongshu") {
    return {
      version: "xhs-roi-campaign-model-2026-07-19",
      formula: "ROI =（会员收入 + 充值收入）/ 小红书广告花费",
      grain: ["advertiser", "campaign", "day"],
      currency: "RMB",
      attributionWindow: "由小红书 ROI 成品表字段定义",
      tables: [
        {
          role: "source",
          name: table,
          partition: "day",
          grain: "advertiser x campaign x day"
        }
      ],
      unresolvedItems: []
    } as const;
  }

  return {
    version: "hm-roi-task-model-2026-07-18",
    formula: "ROI = 归因收入 / 广告花费",
    grain: ["task", "sub_task", "day"],
    currency: "RMB",
    attributionWindow: "由鸿蒙 ROI 成品表字段定义",
    tables: [
      {
        role: "source",
        name: table,
        partition: "day",
        grain: "task x sub_task x day"
      }
    ],
    unresolvedItems: []
  } as const;
}
