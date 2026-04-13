import type { ResizeDirection } from "../hooks/use-resize-element";
import type { SlideElement } from "../types";
import { ResizeHandles } from "./ResizeHandles";
import { RotateHandle } from "./RotateHandle";

interface ElementWrapperProps {
  element: SlideElement;
  selected: boolean;
  showRotateTooltip: boolean;
  rotateAngle: number | null;
  onResizeStart: (
    e: React.MouseEvent,
    element: SlideElement,
    direction: ResizeDirection,
  ) => void;
  onRotateStart: (e: React.MouseEvent, element: SlideElement) => void;
  children: React.ReactNode;
}

export function ElementWrapper({
  element,
  selected,
  showRotateTooltip,
  rotateAngle,
  onResizeStart,
  onRotateStart,
  children,
}: ElementWrapperProps) {
  if (!selected || element.type === "line") {
    return <>{children}</>;
  }

  const rotateDeg = `rotate(${element.rotate}deg)`;

  return (
    <div className="contents">
      {children}
      <div
        className="pointer-events-none absolute"
        style={{
          left: element.left,
          top: element.top,
          width: element.width,
          height: element.height,
          transform: rotateDeg,
        }}
      >
        <div className="pointer-events-none relative h-full w-full">
          <ResizeHandles
            onResizeStart={(e, dir) => onResizeStart(e, element, dir)}
          />
          <RotateHandle
            onRotateStart={(e) => onRotateStart(e, element)}
            angle={showRotateTooltip ? rotateAngle : null}
          />
        </div>
      </div>
    </div>
  );
}
