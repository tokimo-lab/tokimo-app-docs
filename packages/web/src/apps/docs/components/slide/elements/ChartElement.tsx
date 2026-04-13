import { useCallback, useEffect, useState } from "react";
import { ChartEditDialog } from "../canvas/ChartEditDialog";
import { EChartsRenderer } from "../lib/EChartsRenderer";
import type { ChartData, SlideChartElement } from "../types";

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

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ elementId: string }>).detail;
      if (detail.elementId === element.id && onUpdate) {
        setEditing(true);
      }
    };
    window.addEventListener("slide:edit-chart", handler);
    return () => window.removeEventListener("slide:edit-chart", handler);
  }, [element.id, onUpdate]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      onSelect(element.id, e.shiftKey);
    },
    [element.id, onSelect],
  );

  const handleDoubleClick = useCallback(() => {
    if (onUpdate) setEditing(true);
  }, [onUpdate]);

  const handleDataChange = useCallback(
    (data: ChartData) => {
      onUpdate?.(element.id, { data });
    },
    [element.id, onUpdate],
  );

  const handleChartTypeChange = useCallback(
    (type: SlideChartElement["chartType"]) => {
      onUpdate?.(element.id, { chartType: type });
    },
    [element.id, onUpdate],
  );

  const handleClose = useCallback(() => {
    setEditing(false);
  }, []);

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
      <EChartsRenderer
        width={element.width}
        height={element.height}
        chartType={element.chartType}
        data={element.data}
        interactive
      />
      {editing && (
        <ChartEditDialog
          data={element.data}
          chartType={element.chartType}
          onChange={handleDataChange}
          onChartTypeChange={handleChartTypeChange}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
