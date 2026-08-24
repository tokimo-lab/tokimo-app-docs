import { cn } from "@tokimo/ui";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";

interface BlockToolbarProps {
  isDragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  children?: ReactNode;
}

export function BlockToolbar({
  isDragging,
  onPointerDown,
  children,
}: BlockToolbarProps) {
  return (
    <div className="absolute bottom-full left-1 z-20 pb-1">
      <div
        className={cn(
          "flex items-center gap-0.5 rounded-md border border-base bg-surface-overlay px-0.5 py-0.5 text-fg-on-overlay shadow-md backdrop-blur-glass",
          "opacity-0 transition-opacity group-hover/block:opacity-100",
          isDragging && "opacity-100",
        )}
      >
        <button
          type="button"
          onPointerDown={onPointerDown}
          className="flex h-5 w-5 cursor-grab items-center justify-center rounded text-fg-muted hover:bg-fill-tertiary hover:text-fg-secondary active:cursor-grabbing"
        >
          <GripVertical size={12} />
        </button>
        {children}
      </div>
    </div>
  );
}
