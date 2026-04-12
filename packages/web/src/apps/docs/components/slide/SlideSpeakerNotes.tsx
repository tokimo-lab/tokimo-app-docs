import { useCallback, useRef, useState } from "react";
import { useSlideStore } from "./use-slide-store";

const MIN_HEIGHT = 40;
const MAX_HEIGHT = 200;
const DEFAULT_HEIGHT = 80;

export function SlideSpeakerNotes() {
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const currentSlide = useSlideStore((s) => s.currentSlide());
  const updateSlideNotes = useSlideStore((s) => s.updateSlideNotes);
  const dragStartRef = useRef<{
    startY: number;
    startHeight: number;
  } | null>(null);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragStartRef.current = { startY: e.clientY, startHeight: height };

      const onMove = (ev: MouseEvent) => {
        if (!dragStartRef.current) return;
        const dy = dragStartRef.current.startY - ev.clientY;
        const newHeight = Math.min(
          MAX_HEIGHT,
          Math.max(MIN_HEIGHT, dragStartRef.current.startHeight + dy),
        );
        setHeight(newHeight);
      };
      const onUp = () => {
        dragStartRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [height],
  );

  return (
    <div
      className="flex flex-col border-t border-border-subtle bg-white dark:bg-neutral-900"
      style={{ height }}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: drag handle for resizing */}
      <div
        className="flex h-5 shrink-0 cursor-row-resize items-center justify-center hover:bg-black/5 dark:hover:bg-white/5"
        onMouseDown={handleDragStart}
      >
        <div className="flex flex-col gap-[2px]">
          <div className="h-[1.5px] w-4 rounded-full bg-neutral-400" />
          <div className="h-[1.5px] w-4 rounded-full bg-neutral-400" />
          <div className="h-[1.5px] w-4 rounded-full bg-neutral-400" />
        </div>
      </div>
      <textarea
        className="min-h-0 flex-1 resize-none bg-transparent px-3 pb-2 text-sm text-fg-default outline-none placeholder:text-fg-muted"
        placeholder="点击添加演示者备注"
        value={currentSlide?.notes ?? ""}
        onChange={(e) => updateSlideNotes(e.target.value)}
      />
    </div>
  );
}
