import type { PlateElementProps } from "platejs/react";
import { PlateElement, useElement } from "platejs/react";
import { useRef } from "react";
import { BlockDragHandle } from "../components/BlockDragHandle";
import { useBlockDrag } from "../hooks/use-block-drag";

const VARIANT_STYLES: Record<
  string,
  { bg: string; border: string; icon: string }
> = {
  info: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    icon: "ℹ️",
  },
  warning: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    icon: "⚠️",
  },
  tip: {
    bg: "bg-green-50 dark:bg-green-950/30",
    border: "border-green-200 dark:border-green-800",
    icon: "💡",
  },
  danger: {
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
    icon: "🚨",
  },
};

const VARIANT_LABELS: Record<string, string> = {
  info: "提示",
  warning: "警告",
  tip: "技巧",
  danger: "危险",
};

export function CalloutElement(props: PlateElementProps) {
  const element = useElement();
  const variant =
    ((element as Record<string, unknown>).variant as string) || "info";
  const style = VARIANT_STYLES[variant] || VARIANT_STYLES.info;
  const containerRef = useRef<HTMLDivElement>(null);
  const { isDragging, handleDragPointerDown } = useBlockDrag(containerRef);

  return (
    <PlateElement
      className={`group relative my-3 flex gap-2 rounded-lg border p-4 pt-8 transition-opacity ${style.bg} ${style.border} ${isDragging ? "opacity-30" : ""}`}
      {...props}
    >
      <div
        ref={containerRef}
        contentEditable={false}
        className="absolute top-0 right-0 left-0 z-10"
      >
        <BlockDragHandle
          label={VARIANT_LABELS[variant] || "提示"}
          isDragging={isDragging}
          onPointerDown={handleDragPointerDown}
        />
      </div>
      <span className="shrink-0 select-none text-lg" contentEditable={false}>
        {((element as Record<string, unknown>).icon as string) || style.icon}
      </span>
      <div className="min-w-0 flex-1">{props.children}</div>
    </PlateElement>
  );
}
