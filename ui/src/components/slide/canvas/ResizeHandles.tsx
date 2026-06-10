import type { ResizeDirection } from "../hooks/use-resize-element";

interface ResizeHandlesProps {
  onResizeStart: (e: React.MouseEvent, direction: ResizeDirection) => void;
}

const HANDLE_SIZE = 8;
const HALF = HANDLE_SIZE / 2;

const handles: Array<{
  direction: ResizeDirection;
  style: React.CSSProperties;
  cursor: string;
}> = [
  // Corners
  {
    direction: "nw",
    style: { top: -HALF, left: -HALF },
    cursor: "nw-resize",
  },
  {
    direction: "ne",
    style: { top: -HALF, right: -HALF },
    cursor: "ne-resize",
  },
  {
    direction: "se",
    style: { bottom: -HALF, right: -HALF },
    cursor: "se-resize",
  },
  {
    direction: "sw",
    style: { bottom: -HALF, left: -HALF },
    cursor: "sw-resize",
  },
  // Edge midpoints
  {
    direction: "n",
    style: { top: -HALF, left: "50%", marginLeft: -HALF },
    cursor: "n-resize",
  },
  {
    direction: "s",
    style: { bottom: -HALF, left: "50%", marginLeft: -HALF },
    cursor: "s-resize",
  },
  {
    direction: "e",
    style: { top: "50%", right: -HALF, marginTop: -HALF },
    cursor: "e-resize",
  },
  {
    direction: "w",
    style: { top: "50%", left: -HALF, marginTop: -HALF },
    cursor: "w-resize",
  },
];

export function ResizeHandles({ onResizeStart }: ResizeHandlesProps) {
  return (
    <>
      {handles.map((h) => (
        // biome-ignore lint/a11y/noStaticElementInteractions: resize handle needs mouse interaction
        <div
          key={h.direction}
          className="pointer-events-auto absolute z-10"
          style={{
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            backgroundColor: "white",
            border: "1px solid #4A90D9",
            cursor: h.cursor,
            ...h.style,
          }}
          onMouseDown={(e) => onResizeStart(e, h.direction)}
        />
      ))}
    </>
  );
}
