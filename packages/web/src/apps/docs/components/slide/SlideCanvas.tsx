import { useCallback, useEffect, useRef, useState } from "react";
import { AlignmentLines } from "./canvas/AlignmentLines";
import { ContextMenu } from "./canvas/ContextMenu";
import { ElementWrapper } from "./canvas/ElementWrapper";
import { SelectionBox } from "./canvas/SelectionBox";
import { ImageElement } from "./elements/ImageElement";
import { LineElement } from "./elements/LineElement";
import { ShapeElement } from "./elements/ShapeElement";
import { TextElement } from "./elements/TextElement";
import { useAlignmentLines } from "./hooks/use-alignment-lines";
import { useCanvasPan } from "./hooks/use-canvas-pan";
import { useHotkeys } from "./hooks/use-hotkeys";
import { useMouseSelection } from "./hooks/use-mouse-selection";
import { useResizeElement } from "./hooks/use-resize-element";
import { useRotateElement } from "./hooks/use-rotate-element";
import type { Slide, SlideElement } from "./types";
import {
  createTextElement,
  generateId,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
} from "./types";
import { useSlideStore } from "./use-slide-store";

interface SlideCanvasProps {
  slide: Slide;
  zoom?: number;
}

export function SlideCanvas({ slide, zoom }: SlideCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const selectedIds = useSlideStore((s) => s.selectedElementIds);
  const setSelectedIds = useSlideStore((s) => s.setSelectedElementIds);
  const updateElement = useSlideStore((s) => s.updateElement);
  const pushHistory = useSlideStore((s) => s.pushHistory);
  const addElement = useSlideStore((s) => s.addElement);

  // Hooks
  const { handleResizeStart } = useResizeElement(scale);
  const { handleRotateStart, rotateAngle } = useRotateElement(scale);
  const { lines, computeLines, clearLines } = useAlignmentLines();
  const { selectionRect, handleSelectionStart } = useMouseSelection(scale);
  const { offset, isPanning, handlePanStart, isSpaceHeld } = useCanvasPan();
  useHotkeys(slide);

  // Auto-scale from container
  useEffect(() => {
    if (zoom) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const padding = 40;
        const s = Math.min(
          (width - padding * 2) / VIEWPORT_WIDTH,
          (height - padding * 2) / VIEWPORT_HEIGHT,
        );
        setScale(Math.max(0.1, s));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [zoom]);

  // Manual zoom override
  useEffect(() => {
    if (zoom) setScale(zoom / 100);
  }, [zoom]);

  // Click empty space → deselect or start marquee selection
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Pan takes priority
      if (handlePanStart(e)) return;

      const isViewportOrContainer =
        e.target === e.currentTarget ||
        (e.target as HTMLElement).dataset.viewport === "true";

      if (isViewportOrContainer && e.button === 0) {
        setSelectedIds([]);
        // Start marquee selection
        if (viewportRef.current) {
          handleSelectionStart(e, viewportRef.current, slide.elements);
        }
      }
    },
    [handlePanStart, setSelectedIds, handleSelectionStart, slide.elements],
  );

  // Double-click on empty canvas → create text element
  const handleCanvasDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const isViewportOrContainer =
        e.target === e.currentTarget ||
        (e.target as HTMLElement).dataset.viewport === "true";

      if (!isViewportOrContainer) return;
      if (!viewportRef.current) return;

      const rect = viewportRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;

      const textEl = createTextElement("body");
      textEl.id = generateId();
      textEl.left = Math.max(0, Math.round(x - textEl.width / 2));
      textEl.top = Math.max(0, Math.round(y - textEl.height / 2));

      addElement(textEl);
    },
    [scale, addElement],
  );

  // Element select
  const handleSelectElement = useCallback(
    (id: string, append: boolean) => {
      if (append) {
        setSelectedIds(
          selectedIds.includes(id)
            ? selectedIds.filter((eid) => eid !== id)
            : [...selectedIds, id],
        );
      } else {
        setSelectedIds([id]);
      }
    },
    [selectedIds, setSelectedIds],
  );

  // Drag with alignment snapping
  const dragRef = useRef<{
    elementId: string;
    startX: number;
    startY: number;
    origLeft: number;
    origTop: number;
    pushed: boolean;
  } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (!drag.pushed) {
        pushHistory();
        drag.pushed = true;
      }
      const dx = (e.clientX - drag.startX) / scale;
      const dy = (e.clientY - drag.startY) / scale;

      let newLeft = Math.round(drag.origLeft + dx);
      let newTop = Math.round(drag.origTop + dy);

      // Find this element for dimensions
      const element = slide.elements.find(
        (el: SlideElement) => el.id === drag.elementId,
      );
      if (element) {
        const otherElements = slide.elements.filter(
          (el: SlideElement) => el.id !== drag.elementId,
        );
        const { snapX, snapY } = computeLines(
          {
            left: newLeft,
            top: newTop,
            width: element.width,
            height: "height" in element ? (element.height as number) : 0,
          },
          otherElements,
        );
        if (snapX !== null) newLeft = Math.round(snapX);
        if (snapY !== null) newTop = Math.round(snapY);
      }

      updateElement(drag.elementId, { left: newLeft, top: newTop });
    };
    const onUp = () => {
      dragRef.current = null;
      clearLines();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [
    scale,
    updateElement,
    pushHistory,
    slide.elements,
    computeLines,
    clearLines,
  ]);

  const handleElementMouseDown = useCallback(
    (e: React.MouseEvent, element: SlideElement) => {
      if ((e.target as HTMLElement).contentEditable === "true") return;
      if (element.lock) return;
      e.preventDefault();
      dragRef.current = {
        elementId: element.id,
        startX: e.clientX,
        startY: e.clientY,
        origLeft: element.left,
        origTop: element.top,
        pushed: false,
      };
    },
    [],
  );

  // Background style
  const bgStyle: React.CSSProperties = {};
  const bg = slide.background;
  if (bg) {
    if (bg.type === "solid" && bg.color) bgStyle.backgroundColor = bg.color;
    else if (bg.type === "image" && bg.imageUrl) {
      bgStyle.backgroundImage = `url(${bg.imageUrl})`;
      bgStyle.backgroundSize = "cover";
      bgStyle.backgroundPosition = "center";
    } else if (bg.type === "gradient" && bg.gradient) {
      const stops = bg.gradient.colors
        .map((c) => `${c.color} ${c.offset * 100}%`)
        .join(", ");
      bgStyle.background =
        bg.gradient.type === "linear"
          ? `linear-gradient(${bg.gradient.angle ?? 0}deg, ${stops})`
          : `radial-gradient(circle, ${stops})`;
    }
  }

  // Resize/rotate handlers that pass through to hooks
  const onResizeStart = useCallback(
    (
      e: React.MouseEvent,
      element: SlideElement,
      direction: Parameters<typeof handleResizeStart>[2],
    ) => {
      handleResizeStart(e, element, direction);
    },
    [handleResizeStart],
  );

  const onRotateStart = useCallback(
    (e: React.MouseEvent, element: SlideElement) => {
      if (!viewportRef.current) return;
      handleRotateStart(e, element, viewportRef.current);
    },
    [handleRotateStart],
  );

  // Render element
  const renderElement = (el: SlideElement) => {
    const isSelected = selectedIds.includes(el.id);
    const handleMouseDown = (e: React.MouseEvent) =>
      handleElementMouseDown(e, el);

    const elementNode = (() => {
      switch (el.type) {
        case "text":
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: slide element needs mouse interaction
            <div key={el.id} onMouseDown={handleMouseDown}>
              <TextElement
                element={el}
                selected={isSelected}
                scale={scale}
                onSelect={handleSelectElement}
                onUpdate={updateElement}
              />
            </div>
          );
        case "image":
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: slide element needs mouse interaction
            <div key={el.id} onMouseDown={handleMouseDown}>
              <ImageElement
                element={el}
                selected={isSelected}
                onSelect={handleSelectElement}
              />
            </div>
          );
        case "shape":
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: slide element needs mouse interaction
            <div key={el.id} onMouseDown={handleMouseDown}>
              <ShapeElement
                element={el}
                selected={isSelected}
                onSelect={handleSelectElement}
              />
            </div>
          );
        case "line":
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: slide element needs mouse interaction
            <div key={el.id} onMouseDown={handleMouseDown}>
              <LineElement
                element={el}
                selected={isSelected}
                onSelect={handleSelectElement}
              />
            </div>
          );
        default:
          return null;
      }
    })();

    return (
      <ElementWrapper
        key={el.id}
        element={el}
        selected={isSelected}
        showRotateTooltip={isSelected && selectedIds.length === 1}
        rotateAngle={rotateAngle}
        onResizeStart={onResizeStart}
        onRotateStart={onRotateStart}
      >
        {elementNode}
      </ElementWrapper>
    );
  };

  const cursorStyle = isPanning
    ? "grabbing"
    : isSpaceHeld()
      ? "grab"
      : undefined;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: canvas area needs mouse interaction
    <div
      ref={containerRef}
      className="relative flex flex-1 items-center justify-center overflow-hidden bg-neutral-300 dark:bg-neutral-800"
      style={{ cursor: cursorStyle }}
      onMouseDown={handleCanvasMouseDown}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: viewport needs mouse interaction */}
      <div
        ref={viewportRef}
        data-viewport="true"
        className="relative bg-white shadow-xl"
        style={{
          width: VIEWPORT_WIDTH,
          height: VIEWPORT_HEIGHT,
          transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
          transformOrigin: "center center",
          ...bgStyle,
        }}
        onMouseDown={handleCanvasMouseDown}
        onDoubleClick={handleCanvasDoubleClick}
      >
        {slide.elements.map(renderElement)}
        <AlignmentLines lines={lines} />
        <SelectionBox rect={selectionRect} />
      </div>
      <ContextMenu viewportRef={viewportRef} />
    </div>
  );
}
