import { cn } from "@tokiomo/components";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Field } from "../types";
import { FIELD_TYPE_LABELS } from "../utils";
import { FIELD_TYPE_ICON, FIELD_TYPES } from "./FieldConfigPanel";
import { SelectOptionsEditor } from "./SelectOptionsEditor";

interface FieldEditorPanelProps {
  field: Field;
  onUpdate: (partial: Partial<Field>) => void;
  onBack: () => void;
}

// ── Type-specific config definitions ────────────────────────────────────────

const NUMBER_FORMATS = [
  { key: "integer", label: "整数" },
  { key: "decimal1", label: "保留1位小数" },
  { key: "decimal2", label: "保留2位小数" },
  { key: "decimal3", label: "保留3位小数" },
  { key: "decimal4", label: "保留4位小数" },
];

const DATE_FORMATS = [
  { key: "YYYY/MM/DD", label: "YYYY/MM/DD" },
  { key: "YYYY-MM-DD", label: "YYYY-MM-DD" },
  { key: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { key: "MM/DD/YYYY", label: "MM/DD/YYYY" },
];

const CURRENCIES = [
  { key: "CNY", label: "CNY ¥" },
  { key: "USD", label: "USD $" },
  { key: "EUR", label: "EUR €" },
  { key: "GBP", label: "GBP £" },
  { key: "JPY", label: "JPY ¥" },
];

const CURRENCY_DECIMALS = [
  { key: "0", label: "0" },
  { key: "1", label: "1" },
  { key: "2", label: "2" },
];

const AUTO_NUMBER_FORMATS = [
  { key: "auto", label: "自增数字" },
  { key: "custom", label: "自定义编号" },
];

export function FieldEditorPanel({
  field,
  onUpdate,
  onBack,
}: FieldEditorPanelProps) {
  const [showTypePicker, setShowTypePicker] = useState(false);

  if (showTypePicker) {
    return (
      <div className="flex flex-col p-3">
        <button
          type="button"
          className="mb-2 flex cursor-pointer items-center gap-1 text-xs text-fg-muted hover:text-fg-secondary"
          onClick={() => setShowTypePicker(false)}
        >
          <ArrowLeft size={14} />
          返回
        </button>
        <div className="mb-2 text-xs font-medium text-fg-secondary">
          选择字段类型
        </div>
        <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
          {FIELD_TYPES.map((ft) => (
            <button
              key={ft}
              type="button"
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors",
                field.type === ft
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                  : "text-fg-secondary hover:bg-fill-tertiary",
              )}
              onClick={() => {
                onUpdate({ type: ft });
                setShowTypePicker(false);
              }}
            >
              <span className="shrink-0 text-fg-muted">
                {FIELD_TYPE_ICON[ft]}
              </span>
              {FIELD_TYPE_LABELS[ft]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header with back button */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <button
          type="button"
          className="cursor-pointer rounded p-0.5 text-fg-muted hover:bg-fill-tertiary"
          onClick={onBack}
        >
          <ArrowLeft size={16} />
        </button>
        <span className="text-xs font-medium text-fg-secondary">编辑字段</span>
      </div>

      <div className="max-h-[420px] overflow-y-auto px-3 pb-3">
        {/* Field name */}
        <div className="mb-1 text-xs text-fg-muted">字段名称</div>
        <input
          className="mb-3 w-full rounded border border-black/[0.06] dark:border-white/[0.08] bg-fill-tertiary dark:bg-white/[0.08] px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500"
          value={field.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
        />

        {/* Field type selector */}
        <div className="mb-1 text-xs text-fg-muted">字段类型</div>
        <button
          type="button"
          className="mb-3 flex w-full cursor-pointer items-center gap-2 rounded border border-black/[0.06] dark:border-white/[0.08] bg-fill-tertiary dark:bg-white/[0.08] px-2 py-1.5 text-sm hover:bg-fill-quaternary dark:hover:bg-white/[0.12]"
          onClick={() => setShowTypePicker(true)}
        >
          <span className="shrink-0 text-fg-muted">
            {FIELD_TYPE_ICON[field.type]}
          </span>
          <span className="flex-1 text-left">
            {FIELD_TYPE_LABELS[field.type]}
          </span>
          <ChevronRight size={14} className="text-fg-muted" />
        </button>

        {/* Type-specific configurations */}
        <TypeConfig field={field} onUpdate={onUpdate} />
      </div>

      {/* Bottom: done button */}
      <div className="border-t border-border-subtle px-3 py-2">
        <button
          type="button"
          className="w-full cursor-pointer rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
          onClick={onBack}
        >
          完成
        </button>
      </div>
    </div>
  );
}

// ── Type-specific config renderer ───────────────────────────────────────────

function TypeConfig({
  field,
  onUpdate,
}: {
  field: Field;
  onUpdate: (p: Partial<Field>) => void;
}) {
  switch (field.type) {
    case "number":
      return (
        <ConfigSection label="数字格式">
          <ConfigDropdown options={NUMBER_FORMATS} />
        </ConfigSection>
      );

    case "select":
    case "multiSelect":
      return (
        <ConfigSection label="选项">
          <SelectOptionsEditor
            options={field.options ?? []}
            onChange={(options) => onUpdate({ options })}
          />
        </ConfigSection>
      );

    case "date":
      return (
        <ConfigSection label="日期格式">
          <ConfigDropdown options={DATE_FORMATS} />
        </ConfigSection>
      );

    case "currency":
      return (
        <>
          <ConfigSection label="货币">
            <ConfigDropdown options={CURRENCIES} />
          </ConfigSection>
          <ConfigSection label="小数位数">
            <ConfigDropdown options={CURRENCY_DECIMALS} />
          </ConfigSection>
        </>
      );

    case "rating":
      return (
        <ConfigSection label="最大评分">
          <ConfigDropdown
            options={Array.from({ length: 10 }, (_, i) => ({
              key: String(i + 1),
              label: String(i + 1),
            }))}
          />
        </ConfigSection>
      );

    case "workflow":
      return (
        <ConfigSection label="流程节点">
          <SelectOptionsEditor
            options={field.options ?? []}
            onChange={(options) => onUpdate({ options })}
            addLabel="添加节点"
          />
        </ConfigSection>
      );

    case "autoNumber":
      return (
        <ConfigSection label="编号格式">
          <ConfigDropdown options={AUTO_NUMBER_FORMATS} />
        </ConfigSection>
      );

    default:
      return null;
  }
}

// ── Shared UI helpers ───────────────────────────────────────────────────────

function ConfigSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-xs text-fg-muted">{label}</div>
      {children}
    </div>
  );
}

function ConfigDropdown({
  options,
}: {
  options: { key: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(options[0]?.key ?? "");

  const selectedLabel =
    options.find((o) => o.key === selected)?.label ?? options[0]?.label ?? "";

  return (
    <div className="relative">
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between rounded border border-black/[0.06] dark:border-white/[0.08] bg-fill-tertiary dark:bg-white/[0.08] px-2 py-1.5 text-xs hover:bg-fill-quaternary dark:hover:bg-white/[0.12]"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{selectedLabel}</span>
        <ChevronRight
          size={12}
          className={cn(
            "text-fg-muted transition-transform",
            open && "rotate-90",
          )}
        />
      </button>
      {open && (
        <>
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: overlay */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: overlay */}
          <div
            className="fixed inset-0"
            style={{ zIndex: 1 }}
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute left-0 mt-1 w-full rounded border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-[rgba(38,38,58,0.88)] backdrop-blur-xl py-1 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
            style={{ zIndex: 2 }}
          >
            {options.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={cn(
                  "flex w-full cursor-pointer items-center px-2 py-1.5 text-left text-xs hover:bg-fill-tertiary",
                  selected === opt.key && "text-blue-600 dark:text-blue-400",
                )}
                onClick={() => {
                  setSelected(opt.key);
                  setOpen(false);
                }}
              >
                {opt.label}
                {selected === opt.key && (
                  <span className="ml-auto text-blue-600 dark:text-blue-400">
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
