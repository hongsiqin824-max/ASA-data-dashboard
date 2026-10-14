// 鸿蒙新增设备查询的服务层：在数仓查询之上包一层「过去日期结果缓存」。
// - 查询区间不含今天（endDate < 北京今天）：过去数据不变，命中缓存直接返回；未命中则查一次并落盘。
// - 查询区间含今天：当天数据仍在变，始终实时查、不缓存。
import { fetchHarmonyNewDevices, type HarmonyNewDevice } from "./starrocks";
import { beijingCompactDate } from "./shared";
import {
  buildHarmonyDeviceCacheKey,
  readHarmonyDeviceCache,
  writeHarmonyDeviceCache
} from "./harmony-device-cache";

export type GetHarmonyDevicesParams = {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  onlyValidOaid: boolean;
};

export type GetHarmonyDevicesResult = {
  snapshotDay: string;
  devices: HarmonyNewDevice[];
  cached: boolean;
};

export async function getHarmonyNewDevices(
  params: GetHarmonyDevicesParams,
  options?: { forceRefresh?: boolean }
): Promise<GetHarmonyDevicesResult> {
  const today = beijingCompactDate(0); // YYYYMMDD
  const endCompact = params.endDate.replace(/-/g, "");
  const includesToday = endCompact >= today;
  const forceRefresh = options?.forceRefresh === true;
  const key = buildHarmonyDeviceCacheKey(
    params.startDate,
    params.endDate,
    params.onlyValidOaid
  );

  // 过去日期且非强制刷新：命中缓存直接返回。
  if (!includesToday && !forceRefresh) {
    const cached = readHarmonyDeviceCache(key);
    if (cached) {
      return {
        snapshotDay: cached.snapshotDay,
        devices: cached.devices as HarmonyNewDevice[],
        cached: true
      };
    }
  }

  const fresh = await fetchHarmonyNewDevices(params);

  // 只缓存「完整的过去日期」结果；含今天的不缓存。
  if (!includesToday) {
    writeHarmonyDeviceCache(key, {
      cachedAt: new Date().toISOString(),
      snapshotDay: fresh.snapshotDay,
      devices: fresh.devices
    });
  }

  return { snapshotDay: fresh.snapshotDay, devices: fresh.devices, cached: false };
}
