import { cn } from "@tokiomo/components";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";

interface BlockDragHandleProps {
  label: string;
  icon?: ReactNode;
  isDragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  children?: ReactNode;
}

export function BlockDragHandle({
  label,
  icon,
  isDragging,
  onPointerDown,
  children,
}: BlockDragHandleProps) {
  return (
    <div
      onPointerDown={onPointerDown}
      className={cn(
        "flex cursor-grab items-center gap-1.5 px-2 py-1 select-none active:cursor-grabbing",
        "rounded-t text-xs text-fg-muted",
        "opacity-0 transition-opacity group-hover:opacity-100",
        isDragging && "opacity-100",
      )}
    >
      <GripVertical size={12} className="shrink-0" />
      {icon}
      <span className="truncate">{label}</span>
      {children && (
        <div className="ml-auto flex items-center gap-0.5">{children}</div>
      )}
    </div>
  );
}
