import { Volume2 } from "lucide-react";
import { useCallback } from "react";
import type { SlideAudioElement } from "../types";

interface AudioElementProps {
  element: SlideAudioElement;
  selected: boolean;
  onSelect: (id: string, append: boolean) => void;
}

const WAVEFORM_BARS = [
  0.3, 0.6, 0.9, 0.5, 0.8, 1, 0.7, 0.4, 0.85, 0.55, 0.75, 0.95, 0.45, 0.65,
  0.35,
];

export function AudioElement({
  element,
  selected,
  onSelect,
}: AudioElementProps) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(element.id, e.shiftKey);
    },
    [element.id, onSelect],
  );

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
        borderRadius: 8,
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="flex h-full items-center gap-2 px-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
          <Volume2 size={20} className="text-white" />
        </div>
        <div className="flex flex-1 items-center justify-center gap-[2px]">
          {WAVEFORM_BARS.map((h, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static decorative bars
              key={i}
              className="w-[3px] rounded-full bg-white/70"
              style={{ height: `${h * 32}px` }}
            />
          ))}
        </div>
      </div>
      {element.src && (
        <div className="absolute bottom-1 left-3 right-3 truncate text-[10px] text-white/50">
          {element.src.split("/").pop()}
        </div>
      )}
    </div>
  );
}
