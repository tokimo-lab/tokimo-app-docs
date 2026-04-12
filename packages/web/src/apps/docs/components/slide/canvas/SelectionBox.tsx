import type { SelectionRect } from "../hooks/use-mouse-selection";

interface SelectionBoxProps {
  rect: SelectionRect | null;
}

export function SelectionBox({ rect }: SelectionBoxProps) {
  if (!rect) return null;

  return (
    <div
      className="pointer-events-none absolute z-40"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        border: "1px solid #4A90D9",
        backgroundColor: "rgba(74, 144, 217, 0.1)",
      }}
    />
  );
}
