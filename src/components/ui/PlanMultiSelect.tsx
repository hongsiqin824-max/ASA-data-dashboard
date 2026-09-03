import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ListFilter } from "lucide-react";

export type PlanOption = {
  id: string;
  label: string;
};

export type PlanSelection = string[] | null;

/**
 * Controlled plan filter. `null` means no plan restriction (all plans), while
 * an empty array means that no plan is selected. This distinction keeps the
 * clear action predictable and lets the parent decide how rows are filtered.
 */
export function PlanMultiSelect({
  options,
  selectedIds,
  onChange,
  disabled = false,
  loading = false,
  label = "计划"
}: {
  options: PlanOption[];
  selectedIds: PlanSelection;
  onChange: (next: PlanSelection) => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionIds = useMemo(() => options.map((option) => option.id), [options]);
  const selectedSet = useMemo(
    () => new Set(selectedIds ?? []),
    [selectedIds]
  );
  const selectedCount =
    selectedIds === null
      ? options.length
      : optionIds.reduce((count, id) => count + (selectedSet.has(id) ? 1 : 0), 0);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function toggleOption(id: string) {
    const next = new Set(selectedIds === null ? optionIds : selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }

  function selectAll() {
    onChange([...optionIds]);
  }

  function invertSelection() {
    const current = selectedIds === null ? new Set(optionIds) : selectedSet;
    onChange(optionIds.filter((id) => !current.has(id)));
  }

  function clearSelection() {
    // Clearing the filter means returning to all plans, not an empty result.
    onChange(null);
  }

  const triggerLabel = loading
    ? `${label}加载中`
    : selectedIds === null
      ? `${label}（全部）`
      : selectedCount === 0
        ? `${label}（未选）`
        : `${label}（${selectedCount}）`;

  return (
    <div className="plan-multi-select" ref={rootRef}>
      <button
        ref={triggerRef}
        className={`plan-multi-select-trigger${open ? " open" : ""}`}
        type="button"
        aria-label={`筛选${label}：${triggerLabel}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <ListFilter size={15} aria-hidden="true" />
        <span>{triggerLabel}</span>
        <ChevronDown className="plan-multi-select-chevron" size={15} aria-hidden="true" />
      </button>
      {open ? (
        <div
          className="plan-multi-select-popover"
          role="dialog"
          aria-label={`${label}筛选`}
        >
          <div className="plan-multi-select-actions" role="group" aria-label={`${label}批量操作`}>
            <button type="button" onClick={selectAll} disabled={options.length === 0}>
              全选
            </button>
            <button type="button" onClick={invertSelection} disabled={options.length === 0}>
              反选
            </button>
            <button type="button" onClick={clearSelection}>
              清空
            </button>
          </div>
          <div className="plan-multi-select-summary" aria-live="polite">
            {selectedIds === null
              ? `全部计划（${options.length}）`
              : `已选 ${selectedCount} / ${options.length}`}
          </div>
          <div className="plan-multi-select-options">
            {options.length === 0 ? (
              <div className="plan-multi-select-empty">
                {loading ? "正在读取计划" : "暂无计划"}
              </div>
            ) : (
              options.map((option) => {
                const checked = selectedIds === null || selectedSet.has(option.id);
                return (
                  <label className="plan-multi-select-option" key={option.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      aria-label={option.label}
                      onChange={() => toggleOption(option.id)}
                    />
                    <span className="plan-multi-select-check" aria-hidden="true">
                      {checked ? <Check size={13} /> : null}
                    </span>
                    <span className="plan-multi-select-option-label" title={option.label}>
                      {option.label}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
