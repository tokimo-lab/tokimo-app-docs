import { cn } from "@tokiomo/components";
import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { ChartData, SlideChartElement } from "../types";
import { createEmptyGrid, type Grid, SpreadsheetGrid } from "./SpreadsheetGrid";

const GRID_COLS = 7;
const GRID_ROWS = 15;

type ChartType = SlideChartElement["chartType"];

interface ChartEditDialogProps {
  data: ChartData;
  chartType?: ChartType;
  onChange: (data: ChartData) => void;
  onChartTypeChange?: (type: ChartType) => void;
  onClose: () => void;
}

const CHART_TYPES: Array<{ type: ChartType; icon: string }> = [
  { type: "bar", icon: "M4 20V10h3v10H4Zm5 0V4h3v16H9Zm5 0V13h3v7h-3Z" },
  { type: "column", icon: "M4 4h10v3H4V4Zm0 5h16v3H4V9Zm0 5h7v3H4v-3Z" },
  { type: "line", icon: "M3 17l5-6 4 3 5-7 3 4" },
  { type: "area", icon: "M3 17l5-6 4 3 5-7 3 4V20H3Z" },
  {
    type: "scatter",
    icon: "M5 15a1.5 1.5 0 110-3 1.5 1.5 0 010 3Zm4-6a1.5 1.5 0 110-3 1.5 1.5 0 010 3Zm5 3a1.5 1.5 0 110-3 1.5 1.5 0 010 3Zm4-5a1.5 1.5 0 110-3 1.5 1.5 0 010 3Z",
  },
  {
    type: "pie",
    icon: "M12 2a10 10 0 100 20 10 10 0 000-20Zm0 2v8l6.93 4A8 8 0 0012 4Z",
  },
  {
    type: "doughnut",
    icon: "M12 2a10 10 0 100 20 10 10 0 000-20Zm0 4a6 6 0 110 12 6 6 0 010-12Zm0-2v2m0 12v2",
  },
  {
    type: "radar",
    icon: "M12 2l8 6v8l-8 6-8-6V8l8-6Zm0 4l-4 3v4l4 3 4-3v-4l-4-3Z",
  },
];

function chartDataToGrid(data: ChartData): Grid {
  const grid = createEmptyGrid(GRID_COLS, GRID_ROWS);
  for (let c = 0; c < data.datasets.length && c < GRID_COLS - 1; c++) {
    grid[0][c + 1] = data.datasets[c].label;
  }
  for (let r = 0; r < data.labels.length && r < GRID_ROWS - 1; r++) {
    grid[r + 1][0] = data.labels[r];
  }
  for (let c = 0; c < data.datasets.length && c < GRID_COLS - 1; c++) {
    const ds = data.datasets[c];
    for (let r = 0; r < ds.data.length && r < GRID_ROWS - 1; r++) {
      grid[r + 1][c + 1] = String(ds.data[r]);
    }
  }
  return grid;
}

function gridToChartData(
  grid: Grid,
  existingDatasets: ChartData["datasets"],
): ChartData {
  const dataRows = grid.slice(1);
  const labels = dataRows.map((row) => row[0]).filter(Boolean);
  const labelCount = labels.length;
  if (labelCount === 0) return { labels: [], datasets: [] };

  const cols = grid[0].length;
  const datasets: ChartData["datasets"] = [];
  for (let s = 1; s < cols; s++) {
    const name = grid[0][s] || `Series ${s}`;
    const values = dataRows.slice(0, labelCount).map((row) => {
      const val = Number.parseFloat(row[s] || "");
      return Number.isNaN(val) ? 0 : val;
    });
    if (values.some((v) => v !== 0) || grid[0][s]) {
      datasets.push({
        label: name,
        data: values,
        color: existingDatasets[s - 1]?.color,
      });
    }
  }
  return { labels, datasets };
}

export function ChartEditDialog({
  data,
  chartType,
  onChange,
  onChartTypeChange,
  onClose,
}: ChartEditDialogProps) {
  const { t } = useTranslation();
  const [grid, setGrid] = useState<Grid>(() => chartDataToGrid(data));
  const [showTypePicker, setShowTypePicker] = useState(false);
  const originalRef = useRef(data);
  const typePickerRef = useRef<HTMLDivElement>(null);

  const currentTypeInfo = useMemo(
    () => CHART_TYPES.find((ct) => ct.type === chartType) ?? CHART_TYPES[0],
    [chartType],
  );

  const handleGridChange = useCallback(
    (newGrid: Grid) => {
      setGrid(newGrid);
      const newData = gridToChartData(newGrid, data.datasets);
      onChange(newData);
    },
    [data.datasets, onChange],
  );

  const handleCancel = useCallback(() => {
    onChange(originalRef.current);
    onClose();
  }, [onChange, onClose]);

  const handleConfirm = useCallback(() => {
    const newData = gridToChartData(grid, data.datasets);
    onChange(newData);
    onClose();
  }, [grid, data.datasets, onChange, onClose]);

  const handleClear = useCallback(() => {
    const cleared = createEmptyGrid(GRID_COLS, GRID_ROWS);
    setGrid(cleared);
    onChange({ labels: [], datasets: [] });
  }, [onChange]);

  const handleChartTypeSelect = useCallback(
    (type: ChartType) => {
      onChartTypeChange?.(type);
      setShowTypePicker(false);
    },
    [onChartTypeChange],
  );

  const handleBackdropKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" && !showTypePicker) handleCancel();
      if (e.key === "Escape" && showTypePicker) setShowTypePicker(false);
    },
    [handleCancel, showTypePicker],
  );

  return createPortal(
    // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
      onKeyDown={handleBackdropKey}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: dialog container */}
      <div
        className="flex max-h-[85vh] w-[720px] flex-col rounded-lg bg-white shadow-2xl dark:bg-neutral-800"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-5 py-3 dark:border-neutral-600">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
            {t("docs.editChartData")}
          </span>
          {chartType && onChartTypeChange && (
            <div className="relative" ref={typePickerRef}>
              <button
                type="button"
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-neutral-200 px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-700"
                onClick={() => setShowTypePicker((v) => !v)}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d={currentTypeInfo.icon} />
                </svg>
                {t(`docs.chart${capitalize(currentTypeInfo.type)}`)}
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3 w-3"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              {showTypePicker && (
                <div className="absolute right-0 top-full z-10 mt-1 grid grid-cols-4 gap-1 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-600 dark:bg-neutral-750">
                  {CHART_TYPES.map((ct) => (
                    <button
                      key={ct.type}
                      type="button"
                      className={cn(
                        "flex cursor-pointer flex-col items-center gap-1 rounded-md px-2 py-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20",
                        ct.type === chartType
                          ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                          : "text-neutral-600 dark:text-neutral-300",
                      )}
                      onClick={() => handleChartTypeSelect(ct.type)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path d={ct.icon} />
                      </svg>
                      <span className="whitespace-nowrap">
                        {t(`docs.chart${capitalize(ct.type)}`)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Grid */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          <SpreadsheetGrid grid={grid} onGridChange={handleGridChange} />
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-neutral-200 px-5 py-3 dark:border-neutral-600">
          <button
            type="button"
            className="cursor-pointer rounded px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={handleClear}
          >
            {t("docs.clearData")}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              className="cursor-pointer rounded px-4 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700"
              onClick={handleCancel}
            >
              {t("docs.cancel")}
            </button>
            <button
              type="button"
              className="cursor-pointer rounded bg-blue-500 px-4 py-1.5 text-sm text-white hover:bg-blue-600"
              onClick={handleConfirm}
            >
              {t("docs.confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
