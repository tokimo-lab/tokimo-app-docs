import { useCallback, useRef, useState } from "react";
import type { SlideElement } from "../types";
import { useSlideStore } from "../use-slide-store";

export interface SelectionRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function useMouseSelection(scale: number) {
  const setSelectedIds = useSlideStore((s) => s.setSelectedElementIds);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(
    null,
  );
  const dragRef = useRef<{
    startX: number;
    startY: number;
    viewportLeft: number;
    viewportTop: number;
    elements: SlideElement[];
  } | null>(null);

  const handleSelectionStart = useCallback(
    (
      e: React.MouseEvent,
      viewportEl: HTMLElement,
      elements: SlideElement[],
    ) => {
      const rect = viewportEl.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;

      dragRef.current = {
        startX: x,
        startY: y,
        viewportLeft: rect.left,
        viewportTop: rect.top,
        elements,
      };

      const onMove = (ev: MouseEvent) => {
        const drag = dragRef.current;
        if (!drag) return;

        const curX = (ev.clientX - drag.viewportLeft) / scale;
        const curY = (ev.clientY - drag.viewportTop) / scale;

        const selRect: SelectionRect = {
          left: Math.min(drag.startX, curX),
          top: Math.min(drag.startY, curY),
          width: Math.abs(curX - drag.startX),
          height: Math.abs(curY - drag.startY),
        };

        setSelectionRect(selRect);

        // Find elements within selection
        const selectedIds = drag.elements
          .filter((el) => {
            const elRight = el.left + el.width;
            const elH = "height" in el ? (el.height as number) : 0;
            const elBottom = el.top + elH;
            const selRight = selRect.left + selRect.width;
            const selBottom = selRect.top + selRect.height;
            return (
              el.left < selRight &&
              elRight > selRect.left &&
              el.top < selBottom &&
              elBottom > selRect.top
            );
          })
          .map((el) => el.id);

        setSelectedIds(selectedIds);
      };

      const onUp = () => {
        dragRef.current = null;
        setSelectionRect(null);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [scale, setSelectedIds],
  );

  return { selectionRect, handleSelectionStart };
}
