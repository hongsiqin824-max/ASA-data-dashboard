import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Filter, RotateCcw, Search } from "lucide-react";
import type { QueryParams } from "../lib/api";
import { DATA_PLATFORMS, platformLabel, platformUi } from "../lib/platform";
import { initialQuery } from "../lib/route";
import type { DashboardResponse, DataPlatform } from "../lib/types";
import { Field } from "./ui/Field";

type PresetRange = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
};

const CUSTOM_RANGE_ID = "custom";

function beijingDate(dayOffset = 0): string {
  const ms = Date.now() + (8 * 60 + dayOffset * 24 * 60) * 60 * 1000;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatUtcDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthRange(offset: number) {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + offset;
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return {
    startDate: formatUtcDate(start),
    endDate: formatUtcDate(end)
  };
}

function buildPresetRanges(): PresetRange[] {
  return [
    { id: "7d", label: "近7天", startDate: beijingDate(-6), endDate: beijingDate(0) },
    { id: "14d", label: "近14天", startDate: beijingDate(-13), endDate: beijingDate(0) },
    { id: "30d", label: "近30天", startDate: beijingDate(-30), endDate: beijingDate(0) },
    { id: "this-month", label: "本月", ...monthRange(0) },
    { id: "last-month", label: "上月", ...monthRange(-1) }
  ];
}

function sameQuery(a: QueryParams, b: QueryParams) {
  return (
    a.startDate === b.startDate &&
    a.endDate === b.endDate &&
    a.platform === b.platform &&
    a.channel === b.channel &&
    a.channelGroup === b.channelGroup &&
    a.campaignId === b.campaignId &&
    a.adGroupId === b.adGroupId &&
    a.keyword === b.keyword &&
    a.status === b.status &&
    a.grain === b.grain &&
    a.revenueMode === b.revenueMode
  );
}

function findMatchingPreset(draft: QueryParams, presets: PresetRange[]) {
  return presets.find(
    (preset) =>
      draft.startDate === preset.startDate && draft.endDate === preset.endDate
  );
}

type DateInputElement = HTMLInputElement & {
  showPicker?: () => void;
};

function openNativeDatePicker(input: HTMLInputElement) {
  try {
    (input as DateInputElement).showPicker?.();
  } catch {
    // Some browsers only allow showPicker during direct pointer activation.
  }
}

export function FilterBar({
  query,
  data,
  onChange,
  onPlatformChange
}: {
  query: QueryParams;
  data: DashboardResponse | null;
  onChange: (next: Partial<QueryParams>) => void;
  onPlatformChange: (platform: DataPlatform) => void;
}) {
  const ui = platformUi(query.platform);
  const presets = useMemo(() => buildPresetRanges(), []);
  const [draftState, setDraftState] = useState(() => ({
    query,
    draft: query,
    forceCustomRange: false
  }));
  let draft = draftState.draft;
  let forceCustomRange = draftState.forceCustomRange;
  if (draftState.query !== query) {
    draft = query;
    forceCustomRange = false;
    setDraftState({ query, draft: query, forceCustomRange: false });
  }

  const dateInvalid =
    !draft.startDate || !draft.endDate || draft.startDate > draft.endDate;
  const changed = !sameQuery(draft, query);
  const matchingRange = findMatchingPreset(draft, presets);
  const selectedRangeId =
    forceCustomRange || !matchingRange ? CUSTOM_RANGE_ID : matchingRange.id;
  const showCustomRange = selectedRangeId === CUSTOM_RANGE_ID;
  const rangeSummary = `${draft.startDate} 至 ${draft.endDate}`;

  function updateDraft(next: Partial<QueryParams>) {
    setDraftState((current) => ({
      ...current,
      draft: { ...current.draft, ...next }
    }));
  }

  function apply(next = draft) {
    if (!next.startDate || !next.endDate || next.startDate > next.endDate) return;
    onChange(next);
  }

  function applyPreset(preset: PresetRange) {
    const next = {
      ...draft,
      startDate: preset.startDate,
      endDate: preset.endDate
    };
    setDraftState((current) => ({
      ...current,
      draft: next,
      forceCustomRange: false
    }));
    apply(next);
  }

  function selectRange(rangeId: string) {
    if (rangeId === CUSTOM_RANGE_ID) {
      setDraftState((current) => ({ ...current, forceCustomRange: true }));
      return;
    }

    const preset = presets.find((item) => item.id === rangeId);
    if (preset) applyPreset(preset);
  }

  function updateCustomDate(next: Pick<Partial<QueryParams>, "startDate" | "endDate">) {
    setDraftState((current) => ({
      ...current,
      forceCustomRange: true,
      draft: { ...current.draft, ...next }
    }));
  }

  function reset() {
    const next = { ...initialQuery, platform: query.platform };
    setDraftState((current) => ({
      ...current,
      draft: next,
      forceCustomRange: false
    }));
    onChange(next);
  }

  return (
    <section className="filter-bar enhanced-filter-bar" aria-label="筛选条件">
      <div className="filter-row">
        <div className="field field-sm platform-field">
          <span>数据平台</span>
          <div
            className="segmented platform-switch"
            role="group"
            aria-label="数据平台"
          >
            {DATA_PLATFORMS.map((platform) => (
              <button
                key={platform}
                type="button"
                className={query.platform === platform ? "active" : ""}
                aria-pressed={query.platform === platform}
                onClick={() => onPlatformChange(platform)}
              >
                {platformLabel(platform)}
              </button>
            ))}
          </div>
        </div>
        <Field label="日期范围" size="md">
          <CalendarDays size={16} />
          <select
            aria-label="日期范围"
            value={selectedRangeId}
            onChange={(event) => selectRange(event.target.value)}
          >
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
            <option value={CUSTOM_RANGE_ID}>自定义</option>
          </select>
          <ChevronDown size={16} className="select-icon" />
        </Field>
        {showCustomRange ? (
          <>
            <Field label="开始日期" size="sm">
              <CalendarDays size={16} />
              <input
                className="date-input"
                aria-label="开始日期"
                type="date"
                value={draft.startDate}
                onClick={(event) => openNativeDatePicker(event.currentTarget)}
                onInput={(event) =>
                  updateCustomDate({ startDate: event.currentTarget.value })
                }
                onChange={(event) => updateCustomDate({ startDate: event.target.value })}
              />
            </Field>
            <Field label="结束日期" size="sm">
              <CalendarDays size={16} />
              <input
                className="date-input"
                aria-label="结束日期"
                type="date"
                value={draft.endDate}
                onClick={(event) => openNativeDatePicker(event.currentTarget)}
                onInput={(event) =>
                  updateCustomDate({ endDate: event.currentTarget.value })
                }
                onChange={(event) => updateCustomDate({ endDate: event.target.value })}
              />
            </Field>
          </>
        ) : null}
        <Field label="ROI 分层" size="sm">
          <Filter size={16} />
          <select
            aria-label="ROI 分层"
            value={draft.status}
            onChange={(event) => updateDraft({ status: event.target.value })}
          >
            <option value="">全部分层</option>
            {data?.filters.statuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.name}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="select-icon" />
        </Field>
        <Field label={ui.childEntity} size="md">
          <Search size={16} />
          <input
            aria-label={ui.childEntity}
            type="search"
            placeholder={`搜索${ui.parentEntity}名称`}
            value={draft.keyword}
            onInput={(event) => updateDraft({ keyword: event.currentTarget.value })}
            onChange={(event) => updateDraft({ keyword: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") apply();
            }}
          />
        </Field>
        <div className="filter-actions">
          <button
            className="primary-button"
            type="button"
            onClick={() => apply()}
            disabled={dateInvalid}
          >
            查询
          </button>
          <button className="ghost-button" type="button" onClick={reset}>
            <RotateCcw size={15} />
            重置
          </button>
        </div>
      </div>
      <div className="filter-feedback" aria-live="polite">
        <span className="range-summary">{rangeSummary}</span>
        {changed ? <span className="filter-dirty">有未查询的筛选修改</span> : null}
        {dateInvalid ? <span className="filter-error">结束日期不能早于开始日期</span> : null}
      </div>
    </section>
  );
}
