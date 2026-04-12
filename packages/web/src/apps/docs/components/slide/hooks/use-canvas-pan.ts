import { useCallback, useEffect, useRef, useState } from "react";

export interface CanvasOffset {
  x: number;
  y: number;
}

export function useCanvasPan() {
  const [offset, setOffset] = useState<CanvasOffset>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const spaceHeldRef = useRef(false);
  const panRef = useRef<{
    startX: number;
    startY: number;
    origOffsetX: number;
    origOffsetY: number;
  } | null>(null);

  // Track space key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        // Don't capture if user is typing in an input
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if ((e.target as HTMLElement).contentEditable === "true") return;
        e.preventDefault();
        spaceHeldRef.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceHeldRef.current = false;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const handlePanStart = useCallback(
    (e: React.MouseEvent) => {
      // Space + left click or middle mouse button
      const isMiddleButton = e.button === 1;
      const isSpaceDrag = spaceHeldRef.current && e.button === 0;
      if (!isMiddleButton && !isSpaceDrag) return false;

      e.preventDefault();
      setIsPanning(true);

      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origOffsetX: offset.x,
        origOffsetY: offset.y,
      };

      const onMove = (ev: MouseEvent) => {
        const pan = panRef.current;
        if (!pan) return;
        const dx = ev.clientX - pan.startX;
        const dy = ev.clientY - pan.startY;
        setOffset({
          x: pan.origOffsetX + dx,
          y: pan.origOffsetY + dy,
        });
      };

      const onUp = () => {
        panRef.current = null;
        setIsPanning(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      return true;
    },
    [offset],
  );

  const isSpaceHeld = useCallback(() => spaceHeldRef.current, []);

  return { offset, isPanning, handlePanStart, isSpaceHeld };
}
