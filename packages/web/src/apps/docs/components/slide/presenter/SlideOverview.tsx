import type { Slide } from "../types";
import { getBackgroundStyle } from "./slide-utils";

interface SlideOverviewProps {
  slides: Slide[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}

export function SlideOverview({
  slides,
  currentIndex,
  onSelect,
  onClose,
}: SlideOverviewProps) {
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: escape handled by parent
    // biome-ignore lint/a11y/noStaticElementInteractions: overview modal backdrop
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center overflow-auto bg-black/80 p-8 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="grid w-full max-w-[960px] grid-cols-4 gap-4">
        {slides.map((slide, index) => (
          // biome-ignore lint/a11y/useKeyWithClickEvents: thumbnail click navigation
          // biome-ignore lint/a11y/noStaticElementInteractions: thumbnail click navigation
          <div
            key={slide.id}
            className={`cursor-pointer overflow-hidden rounded-lg transition-all hover:ring-2 hover:ring-blue-400 ${
              index === currentIndex ? "ring-2 ring-blue-500" : ""
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(index);
            }}
          >
            <div
              className="aspect-video w-full"
              style={getBackgroundStyle(slide.background)}
            />
            <div className="bg-black/60 px-2 py-1 text-center text-xs text-white/80">
              {index + 1}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
