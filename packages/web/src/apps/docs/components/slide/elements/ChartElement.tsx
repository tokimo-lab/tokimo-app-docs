import { useCallback, useMemo, useRef, useState } from "react";
import type { SlideChartElement } from "../types";

interface ChartElementProps {
  element: SlideChartElement;
  selected: boolean;
  onSelect: (id: string, append: boolean) => void;
  onUpdate?: (id: string, patch: Partial<SlideChartElement>) => void;
}

export function ChartElement({
  element,
  selected,
  onSelect,
  onUpdate,
}: ChartElementProps) {
  const [editing, setEditing] = useState(false);
  const [draftLabels, setDraftLabels] = useState("");
  const [draftValues, setDraftValues] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      onSelect(element.id, e.shiftKey);
    },
    [element.id, onSelect],
  );

  const handleDoubleClick = useCallback(() => {
    if (!onUpdate) return;
    setDraftLabels(element.data.labels.join(", "));
    setDraftValues((element.data.datasets[0]?.data ?? []).join(", "));
    setEditing(true);
  }, [element.data, onUpdate]);

  const handleSave = useCallback(() => {
    setEditing(false);
    if (!onUpdate) return;
    const labels = draftLabels
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const values = draftValues
      .split(",")
      .map((s) => Number.parseFloat(s.trim()))
      .filter((n) => !Number.isNaN(n));
    if (labels.length > 0 && values.length > 0) {
      onUpdate(element.id, {
        data: {
          labels,
          datasets: [
            {
              ...(element.data.datasets[0] ?? {}),
              data: values,
            },
          ],
        },
      });
    }
  }, [draftLabels, draftValues, element.data.datasets, element.id, onUpdate]);

  const handleCancel = useCallback(() => {
    setEditing(false);
  }, []);

  const chartSvg = useMemo(() => {
    const { chartType, data } = element;
    const w = element.width;
    const h = element.height;
    const padding = 40;
    const colors = [
      "#5B9BD5",
      "#ED7D31",
      "#A5A5A5",
      "#FFC000",
      "#4472C4",
      "#70AD47",
      "#FF6384",
      "#36A2EB",
    ];

    if (chartType === "pie" || chartType === "doughnut") {
      const values = data.datasets[0]?.data ?? [1, 1, 1, 1];
      const total = values.reduce((s, v) => s + v, 0) || 1;
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(cx, cy) - padding;
      const innerR = chartType === "doughnut" ? r * 0.5 : 0;
      let startAngle = -Math.PI / 2;
      const paths: React.ReactNode[] = [];

      for (let i = 0; i < values.length; i++) {
        const angle = (values[i] / total) * Math.PI * 2;
        const endAngle = startAngle + angle;
        const largeArc = angle > Math.PI ? 1 : 0;
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const fill =
          data.datasets[0]?.color && i === 0
            ? data.datasets[0].color
            : colors[i % colors.length];

        if (innerR > 0) {
          const ix1 = cx + innerR * Math.cos(startAngle);
          const iy1 = cy + innerR * Math.sin(startAngle);
          const ix2 = cx + innerR * Math.cos(endAngle);
          const iy2 = cy + innerR * Math.sin(endAngle);
          paths.push(
            <path
              key={i}
              d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1} Z`}
              fill={fill}
              opacity={0.85}
            />,
          );
        } else {
          paths.push(
            <path
              key={i}
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
              fill={fill}
              opacity={0.85}
            />,
          );
        }
        startAngle = endAngle;
      }
      return (
        <svg width={w} height={h} className="pointer-events-none">
          {paths}
        </svg>
      );
    }

    // Shared data
    const values = data.datasets[0]?.data ?? [40, 60, 30, 80];
    const labels = data.labels;
    const maxVal = Math.max(...values, 1);
    const barArea = {
      x: padding,
      y: 20,
      w: w - padding - 20,
      h: h - padding - 20,
    };
    const color = data.datasets[0]?.color ?? "#5B9BD5";

    if (
      chartType === "line" ||
      chartType === "area" ||
      chartType === "scatter"
    ) {
      const points = values.map((v, i) => ({
        x: barArea.x + (barArea.w / (values.length - 1 || 1)) * i,
        y: barArea.y + barArea.h - (v / maxVal) * barArea.h,
      }));
      const linePath = points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
        .join(" ");
      const areaPath =
        chartType === "area"
          ? `${linePath} L ${points[points.length - 1].x} ${barArea.y + barArea.h} L ${points[0].x} ${barArea.y + barArea.h} Z`
          : "";

      return (
        <svg width={w} height={h} className="pointer-events-none">
          <line
            x1={barArea.x}
            y1={barArea.y + barArea.h}
            x2={barArea.x + barArea.w}
            y2={barArea.y + barArea.h}
            stroke="#ccc"
            strokeWidth={1}
          />
          <line
            x1={barArea.x}
            y1={barArea.y}
            x2={barArea.x}
            y2={barArea.y + barArea.h}
            stroke="#ccc"
            strokeWidth={1}
          />
          {chartType === "area" && (
            <path d={areaPath} fill={color} opacity={0.2} />
          )}
          <path d={linePath} fill="none" stroke={color} strokeWidth={2} />
          {points.map((p, i) => (
            <circle
              // biome-ignore lint/suspicious/noArrayIndexKey: computed chart points
              key={i}
              cx={p.x}
              cy={p.y}
              r={chartType === "scatter" ? 5 : 3}
              fill={color}
            />
          ))}
          {labels.map((label, i) => (
            <text
              key={label}
              x={points[i]?.x ?? 0}
              y={barArea.y + barArea.h + 14}
              textAnchor="middle"
              fontSize={10}
              fill="#888"
            >
              {label}
            </text>
          ))}
        </svg>
      );
    }

    // Default: bar/column chart
    const barWidth = (barArea.w / values.length) * 0.6;
    const gap = (barArea.w / values.length) * 0.4;

    return (
      <svg width={w} height={h} className="pointer-events-none">
        <line
          x1={barArea.x}
          y1={barArea.y + barArea.h}
          x2={barArea.x + barArea.w}
          y2={barArea.y + barArea.h}
          stroke="#ccc"
          strokeWidth={1}
        />
        <line
          x1={barArea.x}
          y1={barArea.y}
          x2={barArea.x}
          y2={barArea.y + barArea.h}
          stroke="#ccc"
          strokeWidth={1}
        />
        {values.map((v, i) => {
          const barH = (v / maxVal) * barArea.h;
          const x = barArea.x + (barWidth + gap) * i + gap / 2;
          const y = barArea.y + barArea.h - barH;
          return (
            <g key={labels[i] ?? i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                fill={color}
                opacity={0.85}
                rx={2}
              />
              {labels[i] && (
                <text
                  x={x + barWidth / 2}
                  y={barArea.y + barArea.h + 14}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#888"
                >
                  {labels[i]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    );
  }, [element]);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: slide element interaction
    <div
      data-element-id={element.id}
      className="absolute"
      style={{
        left: element.left,
        top: element.top,
        width: element.width,
        height: element.height,
        transform: `rotate(${element.rotate}deg)`,
        opacity: element.opacity ?? 1,
        outline: selected ? "2px solid #4A90D9" : undefined,
        outlineOffset: 2,
        cursor: "move",
        background: "#fafafa",
        borderRadius: 4,
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {chartSvg}
      {editing && (
        // biome-ignore lint/a11y/noStaticElementInteractions: chart data editor
        <div
          ref={editorRef}
          className="absolute inset-0 z-10 flex flex-col gap-2 rounded bg-white p-3 shadow-lg dark:bg-neutral-800"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Edit Chart Data
          </div>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-neutral-600 dark:text-neutral-300">
              Labels (comma separated)
            </span>
            <input
              className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-700"
              value={draftLabels}
              onChange={(e) => setDraftLabels(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-neutral-600 dark:text-neutral-300">
              Values (comma separated)
            </span>
            <input
              className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-700"
              value={draftValues}
              onChange={(e) => setDraftValues(e.target.value)}
            />
          </label>
          <div className="mt-auto flex justify-end gap-2">
            <button
              type="button"
              className="cursor-pointer rounded px-3 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="cursor-pointer rounded bg-blue-500 px-3 py-1 text-xs text-white hover:bg-blue-600"
              onClick={handleSave}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
