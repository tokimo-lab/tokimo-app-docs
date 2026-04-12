import { useCallback, useEffect, useRef, useState } from "react";
import { AlignmentLines } from "./canvas/AlignmentLines";
import { ContextMenu } from "./canvas/ContextMenu";
import { ElementWrapper } from "./canvas/ElementWrapper";
import { SelectionBox } from "./canvas/SelectionBox";
import { AudioElement } from "./elements/AudioElement";
import { ChartElement } from "./elements/ChartElement";
import { ImageElement } from "./elements/ImageElement";
import { LaTeXElement } from "./elements/LaTeXElement";
import { LineElement } from "./elements/LineElement";
import { ShapeElement } from "./elements/ShapeElement";
import { TableElement } from "./elements/TableElement";
import { TextElement } from "./elements/TextElement";
import { VideoElement } from "./elements/VideoElement";
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
  const updateElements = useSlideStore((s) => s.updateElements);
  const pushHistory = useSlideStore((s) => s.pushHistory);
  const addElement = useSlideStore((s) => s.addElement);
  const formatPainterMode = useSlideStore((s) => s.formatPainterMode);
  const applyFormatPainter = useSlideStore((s) => s.applyFormatPainter);

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

  // Element select (with group auto-selection)
  const handleSelectElement = useCallback(
    (id: string, append: boolean) => {
      const clickedEl = slide.elements.find((el) => el.id === id);
      const groupId = clickedEl?.groupId;

      if (append) {
        if (groupId) {
          const groupIds = slide.elements
            .filter((el) => el.groupId === groupId)
            .map((el) => el.id);
          const allInSelection = groupIds.every((gid) =>
            selectedIds.includes(gid),
          );
          if (allInSelection) {
            setSelectedIds(
              selectedIds.filter((eid) => !groupIds.includes(eid)),
            );
          } else {
            setSelectedIds([...new Set([...selectedIds, ...groupIds])]);
          }
        } else {
          setSelectedIds(
            selectedIds.includes(id)
              ? selectedIds.filter((eid) => eid !== id)
              : [...selectedIds, id],
          );
        }
      } else {
        if (groupId) {
          const groupIds = slide.elements
            .filter((el) => el.groupId === groupId)
            .map((el) => el.id);
          setSelectedIds(groupIds);
        } else {
          setSelectedIds([id]);
        }
      }
    },
    [selectedIds, setSelectedIds, slide.elements],
  );

  // Drag with alignment snapping (group-aware)
  const dragRef = useRef<{
    elementId: string;
    startX: number;
    startY: number;
    origPositions: Map<string, { left: number; top: number }>;
    dragIds: string[];
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

      if (drag.dragIds.length === 1) {
        const orig = drag.origPositions.get(drag.elementId);
        if (!orig) return;
        let newLeft = Math.round(orig.left + dx);
        let newTop = Math.round(orig.top + dy);

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
      } else {
        const updates = drag.dragIds.map((id) => {
          const orig = drag.origPositions.get(id);
          return {
            id,
            changes: {
              left: Math.round((orig?.left ?? 0) + dx),
              top: Math.round((orig?.top ?? 0) + dy),
            } as Partial<SlideElement>,
          };
        });
        updateElements(updates);
      }
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
    updateElements,
    pushHistory,
    slide.elements,
    computeLines,
    clearLines,
  ]);

  const handleElementMouseDown = useCallback(
    (e: React.MouseEvent, element: SlideElement) => {
      if ((e.target as HTMLElement).contentEditable === "true") return;
      if (element.lock) return;

      // Format painter intercept
      if (formatPainterMode !== "off") {
        e.preventDefault();
        applyFormatPainter(element.id);
        return;
      }

      e.preventDefault();

      // Collect all element IDs that should move together
      let dragIds: string[];
      if (element.groupId) {
        dragIds = slide.elements
          .filter((el) => el.groupId === element.groupId)
          .map((el) => el.id);
      } else if (selectedIds.includes(element.id) && selectedIds.length > 1) {
        dragIds = selectedIds;
      } else {
        dragIds = [element.id];
      }

      const origPositions = new Map<string, { left: number; top: number }>();
      for (const id of dragIds) {
        const el = slide.elements.find((el) => el.id === id);
        if (el) {
          origPositions.set(id, { left: el.left, top: el.top });
        }
      }

      dragRef.current = {
        elementId: element.id,
        startX: e.clientX,
        startY: e.clientY,
        origPositions,
        dragIds,
        pushed: false,
      };
    },
    [slide.elements, selectedIds, formatPainterMode, applyFormatPainter],
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
        case "chart":
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: slide element needs mouse interaction
            <div key={el.id} onMouseDown={handleMouseDown}>
              <ChartElement
                element={el}
                selected={isSelected}
                onSelect={handleSelectElement}
              />
            </div>
          );
        case "video":
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: slide element needs mouse interaction
            <div key={el.id} onMouseDown={handleMouseDown}>
              <VideoElement
                element={el}
                selected={isSelected}
                onSelect={handleSelectElement}
              />
            </div>
          );
        case "audio":
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: slide element needs mouse interaction
            <div key={el.id} onMouseDown={handleMouseDown}>
              <AudioElement
                element={el}
                selected={isSelected}
                onSelect={handleSelectElement}
              />
            </div>
          );
        case "latex":
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: slide element needs mouse interaction
            <div key={el.id} onMouseDown={handleMouseDown}>
              <LaTeXElement
                element={el}
                selected={isSelected}
                onSelect={handleSelectElement}
                onUpdate={updateElement}
              />
            </div>
          );
        case "table":
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: slide element needs mouse interaction
            <div key={el.id} onMouseDown={handleMouseDown}>
              <TableElement
                element={el}
                selected={isSelected}
                onSelect={handleSelectElement}
                onUpdate={updateElement}
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

  // Compute group bounding boxes for dashed outlines
  const groupBoundingBoxes = (() => {
    const groupIds = new Set<string>();
    for (const id of selectedIds) {
      const el = slide.elements.find((e) => e.id === id);
      if (el?.groupId) groupIds.add(el.groupId);
    }
    const boxes: Array<{
      groupId: string;
      left: number;
      top: number;
      width: number;
      height: number;
    }> = [];
    for (const gid of groupIds) {
      const groupEls = slide.elements.filter((el) => el.groupId === gid);
      if (groupEls.length < 2) continue;
      let minLeft = Number.POSITIVE_INFINITY;
      let minTop = Number.POSITIVE_INFINITY;
      let maxRight = Number.NEGATIVE_INFINITY;
      let maxBottom = Number.NEGATIVE_INFINITY;
      for (const el of groupEls) {
        minLeft = Math.min(minLeft, el.left);
        minTop = Math.min(minTop, el.top);
        const w = el.width;
        const h = "height" in el ? (el.height as number) : 0;
        maxRight = Math.max(maxRight, el.left + w);
        maxBottom = Math.max(maxBottom, el.top + h);
      }
      boxes.push({
        groupId: gid,
        left: minLeft,
        top: minTop,
        width: maxRight - minLeft,
        height: maxBottom - minTop,
      });
    }
    return boxes;
  })();

  const cursorStyle = isPanning
    ? "grabbing"
    : isSpaceHeld()
      ? "grab"
      : formatPainterMode !== "off"
        ? "crosshair"
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
        {groupBoundingBoxes.map((box) => (
          <div
            key={`group-${box.groupId}`}
            className="pointer-events-none absolute border-2 border-dashed border-blue-400"
            style={{
              left: box.left - 4,
              top: box.top - 4,
              width: box.width + 8,
              height: box.height + 8,
            }}
          />
        ))}
        <AlignmentLines lines={lines} />
        <SelectionBox rect={selectionRect} />
      </div>
      <ContextMenu viewportRef={viewportRef} />
    </div>
  );
}
