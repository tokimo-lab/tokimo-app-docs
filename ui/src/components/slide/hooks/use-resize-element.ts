import { useCallback, useRef } from "react";
import type { SlideElement } from "../types";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "../types";
import { useSlideStore } from "../use-slide-store";

export type ResizeDirection = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

interface ResizeDragState {
  elementId: string;
  direction: ResizeDirection;
  startX: number;
  startY: number;
  origLeft: number;
  origTop: number;
  origWidth: number;
  origHeight: number;
  pushed: boolean;
  fixedRatio: boolean;
  aspectRatio: number;
}

export function useResizeElement(scale: number) {
  const updateElement = useSlideStore((s) => s.updateElement);
  const pushHistory = useSlideStore((s) => s.pushHistory);
  const dragRef = useRef<ResizeDragState | null>(null);
  const callbacksRef = useRef<{
    onResizing: boolean;
  }>({ onResizing: false });

  const handleResizeStart = useCallback(
    (
      e: React.MouseEvent,
      element: SlideElement,
      direction: ResizeDirection,
    ) => {
      if (element.type === "line") return;
      e.preventDefault();
      e.stopPropagation();
      const isFixedRatio =
        e.shiftKey || (element.type === "image" && element.fixedRatio);
      dragRef.current = {
        elementId: element.id,
        direction,
        startX: e.clientX,
        startY: e.clientY,
        origLeft: element.left,
        origTop: element.top,
        origWidth: element.width,
        origHeight: element.height,
        pushed: false,
        fixedRatio: isFixedRatio,
        aspectRatio: element.height > 0 ? element.width / element.height : 1,
      };
      callbacksRef.current.onResizing = true;

      const onMove = (ev: MouseEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        if (!drag.pushed) {
          pushHistory();
          drag.pushed = true;
        }
        // Update fixedRatio on shift key state
        drag.fixedRatio =
          ev.shiftKey || (element.type === "image" && element.fixedRatio);

        const dx = (ev.clientX - drag.startX) / scale;
        const dy = (ev.clientY - drag.startY) / scale;

        let newLeft = drag.origLeft;
        let newTop = drag.origTop;
        let newWidth = drag.origWidth;
        let newHeight = drag.origHeight;

        const minSize = 20;

        switch (drag.direction) {
          case "se":
            newWidth = Math.max(minSize, drag.origWidth + dx);
            newHeight = Math.max(minSize, drag.origHeight + dy);
            break;
          case "sw":
            newWidth = Math.max(minSize, drag.origWidth - dx);
            newHeight = Math.max(minSize, drag.origHeight + dy);
            newLeft = drag.origLeft + drag.origWidth - newWidth;
            break;
          case "ne":
            newWidth = Math.max(minSize, drag.origWidth + dx);
            newHeight = Math.max(minSize, drag.origHeight - dy);
            newTop = drag.origTop + drag.origHeight - newHeight;
            break;
          case "nw":
            newWidth = Math.max(minSize, drag.origWidth - dx);
            newHeight = Math.max(minSize, drag.origHeight - dy);
            newLeft = drag.origLeft + drag.origWidth - newWidth;
            newTop = drag.origTop + drag.origHeight - newHeight;
            break;
          case "n":
            newHeight = Math.max(minSize, drag.origHeight - dy);
            newTop = drag.origTop + drag.origHeight - newHeight;
            break;
          case "s":
            newHeight = Math.max(minSize, drag.origHeight + dy);
            break;
          case "e":
            newWidth = Math.max(minSize, drag.origWidth + dx);
            break;
          case "w":
            newWidth = Math.max(minSize, drag.origWidth - dx);
            newLeft = drag.origLeft + drag.origWidth - newWidth;
            break;
        }

        if (drag.fixedRatio) {
          const ratio = drag.aspectRatio;
          if (drag.direction === "n" || drag.direction === "s") {
            newWidth = newHeight * ratio;
          } else if (drag.direction === "e" || drag.direction === "w") {
            newHeight = newWidth / ratio;
          } else {
            // Corner: use the larger delta
            const widthFromHeight = newHeight * ratio;
            const heightFromWidth = newWidth / ratio;
            if (newWidth / drag.origWidth > newHeight / drag.origHeight) {
              newHeight = heightFromWidth;
            } else {
              newWidth = widthFromHeight;
            }
          }

          // Re-clamp after ratio
          newWidth = Math.max(minSize, newWidth);
          newHeight = Math.max(minSize, newHeight);

          // Adjust position for anchored corners
          if (
            drag.direction === "nw" ||
            drag.direction === "ne" ||
            drag.direction === "n"
          ) {
            newTop = drag.origTop + drag.origHeight - newHeight;
          }
          if (
            drag.direction === "nw" ||
            drag.direction === "sw" ||
            drag.direction === "w"
          ) {
            newLeft = drag.origLeft + drag.origWidth - newWidth;
          }
        }

        // Clamp to viewport
        newLeft = Math.max(0, Math.min(newLeft, VIEWPORT_WIDTH - minSize));
        newTop = Math.max(0, Math.min(newTop, VIEWPORT_HEIGHT - minSize));

        updateElement(drag.elementId, {
          left: Math.round(newLeft),
          top: Math.round(newTop),
          width: Math.round(newWidth),
          height: Math.round(newHeight),
        });
      };

      const onUp = () => {
        dragRef.current = null;
        callbacksRef.current.onResizing = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [scale, updateElement, pushHistory],
  );

  return {
    handleResizeStart,
    isResizing: () => callbacksRef.current.onResizing,
  };
}
