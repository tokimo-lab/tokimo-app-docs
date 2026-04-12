interface RotateHandleProps {
  onRotateStart: (e: React.MouseEvent) => void;
  angle: number | null;
}

const HANDLE_SIZE = 8;
const STEM_LENGTH = 24;

export function RotateHandle({ onRotateStart, angle }: RotateHandleProps) {
  return (
    <>
      {/* Stem line from top center going up */}
      <div
        className="pointer-events-none absolute z-10"
        style={{
          left: "50%",
          top: -STEM_LENGTH,
          width: 0,
          height: STEM_LENGTH,
          borderLeft: "1px dashed #4A90D9",
          marginLeft: -0.5,
        }}
      />
      {/* Circular handle */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: rotate handle needs mouse interaction */}
      <div
        className="absolute z-10"
        style={{
          left: "50%",
          top: -(STEM_LENGTH + HANDLE_SIZE),
          width: HANDLE_SIZE,
          height: HANDLE_SIZE,
          marginLeft: -(HANDLE_SIZE / 2),
          borderRadius: "50%",
          backgroundColor: "white",
          border: "1px solid #4A90D9",
          cursor: "grab",
        }}
        onMouseDown={onRotateStart}
      />
      {/* Angle tooltip */}
      {angle !== null && (
        <div
          className="pointer-events-none absolute z-20 rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-white whitespace-nowrap"
          style={{
            left: "50%",
            top: -(STEM_LENGTH + HANDLE_SIZE + 24),
            transform: "translateX(-50%)",
          }}
        >
          {angle}°
        </div>
      )}
    </>
  );
}
