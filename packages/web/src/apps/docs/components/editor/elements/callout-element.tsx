import type { PlateElementProps } from "platejs/react";
import { PlateElement, useElement } from "platejs/react";
import { useRef } from "react";
import { BlockToolbar } from "../components/BlockToolbar";
import { useBlockDrag } from "../hooks/use-block-drag";

const VARIANT_STYLES: Record<
  string,
  { bg: string; border: string; icon: string }
> = {
  info: {
    bg: "bg-[var(--accent-subtle)] dark:bg-[var(--accent-subtle)]",
    border: "border-[var(--accent)]/30 dark:border-[var(--accent)]/40",
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

export function CalloutElement(props: PlateElementProps) {
  const element = useElement();
  const variant =
    ((element as Record<string, unknown>).variant as string) || "info";
  const style = VARIANT_STYLES[variant] || VARIANT_STYLES.info;
  const containerRef = useRef<HTMLDivElement>(null);
  const { isDragging, handleDragPointerDown } = useBlockDrag(containerRef);

  return (
    <PlateElement
      className={`group/block relative my-3 flex gap-2 rounded-lg border p-4 transition-opacity ${style.bg} ${style.border} ${isDragging ? "opacity-50" : ""}`}
      {...props}
    >
      <div ref={containerRef} contentEditable={false}>
        <BlockToolbar
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
