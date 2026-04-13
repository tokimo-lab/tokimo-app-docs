import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ChartData } from "../types";

interface ChartEditDialogProps {
  data: ChartData;
  onChange: (data: ChartData) => void;
  onClose: () => void;
}

export function ChartEditDialog({
  data,
  onChange,
  onClose,
}: ChartEditDialogProps) {
  const [labels, setLabels] = useState(() => data.labels.join(", "));
  const [values, setValues] = useState(
    () => data.datasets[0]?.data.join(", ") ?? "",
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  const emitChange = useCallback(
    (newLabels: string, newValues: string) => {
      const parsedLabels = newLabels
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const parsedValues = newValues
        .split(",")
        .map((s) => Number.parseFloat(s.trim()))
        .filter((n) => !Number.isNaN(n));
      if (parsedLabels.length > 0 && parsedValues.length > 0) {
        onChange({
          labels: parsedLabels,
          datasets: [{ ...(data.datasets[0] ?? {}), data: parsedValues }],
        });
      }
    },
    [data.datasets, onChange],
  );

  const handleLabelsChange = useCallback(
    (val: string) => {
      setLabels(val);
      emitChange(val, values);
    },
    [emitChange, values],
  );

  const handleValuesChange = useCallback(
    (val: string) => {
      setValues(val);
      emitChange(labels, val);
    },
    [emitChange, labels],
  );

  return createPortal(
    // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: dialog container */}
      <div
        className="flex w-[420px] flex-col gap-3 rounded-lg bg-white p-5 shadow-2xl dark:bg-neutral-800"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
          Edit Chart Data
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            Labels (comma separated)
          </span>
          <input
            ref={inputRef}
            className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100"
            value={labels}
            onChange={(e) => handleLabelsChange(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            Values (comma separated)
          </span>
          <input
            className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100"
            value={values}
            onChange={(e) => handleValuesChange(e.target.value)}
          />
        </label>
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-400">
            Esc to close · changes apply live
          </span>
          <button
            type="button"
            className="cursor-pointer rounded bg-blue-500 px-4 py-1.5 text-sm text-white hover:bg-blue-600"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
