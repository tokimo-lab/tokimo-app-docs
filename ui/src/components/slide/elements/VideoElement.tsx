import { Play } from "lucide-react";
import { useCallback } from "react";
import type { SlideVideoElement } from "../types";

interface VideoElementProps {
  element: SlideVideoElement;
  selected: boolean;
  onSelect: (id: string, append: boolean) => void;
}

export function VideoElement({
  element,
  selected,
  onSelect,
}: VideoElementProps) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      onSelect(element.id, e.shiftKey);
    },
    [element.id, onSelect],
  );

  const hasSrc = element.src.length > 0;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: slide element interaction
    <div
      data-element-id={element.id}
      className="absolute overflow-hidden"
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
        borderRadius: 4,
        background: "#000",
      }}
      onMouseDown={handleMouseDown}
    >
      {hasSrc ? (
        <>
          <video
            src={element.src}
            poster={element.poster}
            className="pointer-events-none h-full w-full object-contain"
            muted={element.muted}
            loop={element.loop}
            preload="metadata"
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/80">
              <Play size={24} className="ml-0.5 text-neutral-800" />
            </div>
          </div>
        </>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-neutral-900 text-white/60">
          <Play size={32} />
          <span className="text-xs">视频</span>
          <span className="text-[10px] text-white/40">双击设置视频源</span>
        </div>
      )}
    </div>
  );
}
