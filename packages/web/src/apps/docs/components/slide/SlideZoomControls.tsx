import { Minus, Plus } from "lucide-react";

interface SlideZoomControlsProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

export function SlideZoomControls({
  zoom,
  onZoomChange,
}: SlideZoomControlsProps) {
  const zoomIn = () => onZoomChange(Math.min(zoom + 10, 200));
  const zoomOut = () => onZoomChange(Math.max(zoom - 10, 30));

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        className="cursor-pointer rounded p-1 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30"
        onClick={zoomOut}
        disabled={zoom <= 30}
      >
        <Minus size={14} />
      </button>
      <span className="min-w-[40px] text-center text-xs tabular-nums text-fg-muted">
        {zoom}%
      </span>
      <button
        type="button"
        className="cursor-pointer rounded p-1 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30"
        onClick={zoomIn}
        disabled={zoom >= 200}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
