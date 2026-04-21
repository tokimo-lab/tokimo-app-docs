import { cn } from "@tokimo/ui";
import { Minus, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SlideTableElement } from "../types";
import { useSlideStore } from "../use-slide-store";

const sectionClass = "border-b border-border-subtle px-4 py-3";
const labelClass = "mb-3 text-xs font-medium text-fg-muted";
const iconBtnClass =
  "flex cursor-pointer items-center justify-center rounded p-1.5 hover:bg-black/5 dark:hover:bg-white/5";
const numberInputClass =
  "h-7 w-14 rounded border border-border-subtle bg-transparent px-2 text-center text-xs text-fg-default outline-none focus:border-[var(--accent)] dark:bg-neutral-800";

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-xs text-fg-muted">{label}</span>
      <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded border border-border-subtle">
        <input
          type="color"
          className="absolute -inset-1 h-10 w-10 cursor-pointer"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <span className="text-xs text-fg-muted">{value}</span>
    </div>
  );
}

function CounterRow({
  label,
  value,
  min,
  max,
  onIncrement,
  onDecrement,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-xs text-fg-muted">{label}</span>
      <button
        type="button"
        className={cn(
          iconBtnClass,
          value <= min && "cursor-not-allowed opacity-30",
        )}
        disabled={value <= min}
        onClick={onDecrement}
      >
        <Minus size={14} />
      </button>
      <input
        type="number"
        className={numberInputClass}
        value={value}
        readOnly
      />
      <button
        type="button"
        className={cn(
          iconBtnClass,
          value >= max && "cursor-not-allowed opacity-30",
        )}
        disabled={value >= max}
        onClick={onIncrement}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

export function TableStylePanel({ element }: { element: SlideTableElement }) {
  const { t } = useTranslation();
  const updateElement = useSlideStore((s) => s.updateElement);
  const pushHistory = useSlideStore((s) => s.pushHistory);

  const update = (changes: Partial<SlideTableElement>) => {
    pushHistory();
    updateElement(element.id, changes);
  };

  const theme = element.theme ?? {};

  // ── Row operations ──
  const addRow = () => {
    const newRow = Array.from({ length: element.cols }, () => ({
      content: "",
    }));
    update({
      rows: element.rows + 1,
      data: [...element.data, newRow],
    });
  };

  const removeRow = () => {
    if (element.rows <= 1) return;
    update({
      rows: element.rows - 1,
      data: element.data.slice(0, -1),
    });
  };

  // ── Column operations ──
  const addCol = () => {
    const newData = element.data.map((row) => [...row, { content: "" }]);
    const totalWidth = element.colWidths.reduce((a, b) => a + b, 0);
    const factor = element.cols / (element.cols + 1);
    const newWidth = totalWidth / (element.cols + 1);
    const newWidths = [...element.colWidths.map((w) => w * factor), newWidth];
    update({
      cols: element.cols + 1,
      data: newData,
      colWidths: newWidths,
    });
  };

  const removeCol = () => {
    if (element.cols <= 1) return;
    const newData = element.data.map((row) => row.slice(0, -1));
    const removedWidth = element.colWidths[element.colWidths.length - 1];
    const redistribute = removedWidth / (element.cols - 1);
    const newWidths = element.colWidths
      .slice(0, -1)
      .map((w) => w + redistribute);
    update({
      cols: element.cols - 1,
      data: newData,
      colWidths: newWidths,
    });
  };

  const updateTheme = (
    patch: Partial<NonNullable<SlideTableElement["theme"]>>,
  ) => {
    update({ theme: { ...theme, ...patch } });
  };

  const hasHeader = !!theme.headerBg;
  const hasStriped = !!theme.stripedBg;

  return (
    <div className="flex flex-col gap-0 pb-4">
      {/* 行列 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>{t("docs.tableRowsCols")}</h3>
        <div className="flex flex-col gap-2">
          <CounterRow
            label={t("docs.tableRows")}
            value={element.rows}
            min={1}
            max={20}
            onIncrement={addRow}
            onDecrement={removeRow}
          />
          <CounterRow
            label={t("docs.tableCols")}
            value={element.cols}
            min={1}
            max={20}
            onIncrement={addCol}
            onDecrement={removeCol}
          />
        </div>
      </div>

      {/* 样式 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>{t("docs.tableStyle")}</h3>
        <div className="flex flex-col gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-fg-default">
            <input
              type="checkbox"
              className="cursor-pointer accent-[var(--accent)]"
              checked={hasHeader}
              onChange={(e) => {
                if (e.target.checked) {
                  updateTheme({
                    headerBg: "#4472C4",
                    headerColor: "#ffffff",
                  });
                } else {
                  updateTheme({
                    headerBg: undefined,
                    headerColor: undefined,
                  });
                }
              }}
            />
            {t("docs.tableHeaderRow")}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-fg-default">
            <input
              type="checkbox"
              className="cursor-pointer accent-[var(--accent)]"
              checked={hasStriped}
              onChange={(e) => {
                if (e.target.checked) {
                  updateTheme({ stripedBg: "#f0f4f8" });
                } else {
                  updateTheme({ stripedBg: undefined });
                }
              }}
            />
            {t("docs.tableStripedRows")}
          </label>
        </div>
      </div>

      {/* 主题 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>{t("docs.tableTheme")}</h3>
        <div className="flex flex-col gap-3">
          {hasHeader && (
            <>
              <ColorInput
                label={t("docs.tableHeaderBg")}
                value={theme.headerBg ?? "#4472C4"}
                onChange={(c) => updateTheme({ headerBg: c })}
              />
              <ColorInput
                label={t("docs.tableHeaderColor")}
                value={theme.headerColor ?? "#ffffff"}
                onChange={(c) => updateTheme({ headerColor: c })}
              />
            </>
          )}
          <ColorInput
            label={t("docs.tableBorderColor")}
            value={theme.borderColor ?? "#d0d0d0"}
            onChange={(c) => updateTheme({ borderColor: c })}
          />
          {hasStriped && (
            <ColorInput
              label={t("docs.tableStripedBg")}
              value={theme.stripedBg ?? "#f0f4f8"}
              onChange={(c) => updateTheme({ stripedBg: c })}
            />
          )}
        </div>
      </div>
    </div>
  );
}
