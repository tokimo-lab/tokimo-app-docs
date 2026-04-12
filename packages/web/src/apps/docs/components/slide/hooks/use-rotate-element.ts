import { useCallback, useRef, useState } from "react";
import type { SlideElement } from "../types";
import { useSlideStore } from "../use-slide-store";

interface RotateDragState {
  elementId: string;
  centerX: number;
  centerY: number;
  startAngle: number;
  origRotate: number;
  pushed: boolean;
}

export function useRotateElement(scale: number) {
  const updateElement = useSlideStore((s) => s.updateElement);
  const pushHistory = useSlideStore((s) => s.pushHistory);
  const dragRef = useRef<RotateDragState | null>(null);
  const [rotateAngle, setRotateAngle] = useState<number | null>(null);

  const handleRotateStart = useCallback(
    (e: React.MouseEvent, element: SlideElement, viewportEl: HTMLElement) => {
      if (element.type === "line") return;
      e.preventDefault();
      e.stopPropagation();

      const rect = viewportEl.getBoundingClientRect();
      const elCenterX = rect.left + (element.left + element.width / 2) * scale;
      const elCenterY = rect.top + (element.top + element.height / 2) * scale;

      const startAngle = Math.atan2(
        e.clientY - elCenterY,
        e.clientX - elCenterX,
      );

      dragRef.current = {
        elementId: element.id,
        centerX: elCenterX,
        centerY: elCenterY,
        startAngle,
        origRotate: element.rotate,
        pushed: false,
      };

      const onMove = (ev: MouseEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        if (!drag.pushed) {
          pushHistory();
          drag.pushed = true;
        }

        const currentAngle = Math.atan2(
          ev.clientY - drag.centerY,
          ev.clientX - drag.centerX,
        );
        const deltaAngleDeg =
          ((currentAngle - drag.startAngle) * 180) / Math.PI;
        let newRotate = drag.origRotate + deltaAngleDeg;

        // Shift: snap to 15° increments
        if (ev.shiftKey) {
          newRotate = Math.round(newRotate / 15) * 15;
        }

        // Normalize to 0-360
        newRotate = ((newRotate % 360) + 360) % 360;

        setRotateAngle(Math.round(newRotate));
        updateElement(drag.elementId, {
          rotate: Math.round(newRotate),
        });
      };

      const onUp = () => {
        dragRef.current = null;
        setRotateAngle(null);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [scale, updateElement, pushHistory],
  );

  return { handleRotateStart, rotateAngle };
}
