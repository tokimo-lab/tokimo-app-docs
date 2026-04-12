import { useCallback, useEffect, useRef, useState } from "react";
import { ImageElement } from "./elements/ImageElement";
import { LineElement } from "./elements/LineElement";
import { ShapeElement } from "./elements/ShapeElement";
import { TextElement } from "./elements/TextElement";
import type { Slide, SlideElement } from "./types";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "./types";
import { useSlideStore } from "./use-slide-store";

interface SlideCanvasProps {
  slide: Slide;
}

export function SlideCanvas({ slide }: SlideCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const selectedIds = useSlideStore((s) => s.selectedElementIds);
  const setSelectedIds = useSlideStore((s) => s.setSelectedElementIds);
  const updateElement = useSlideStore((s) => s.updateElement);
  const deleteElements = useSlideStore((s) => s.deleteElements);
  const undo = useSlideStore((s) => s.undo);
  const redo = useSlideStore((s) => s.redo);
  const pushHistory = useSlideStore((s) => s.pushHistory);

  // Scale to fit
  useEffect(() => {
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
  }, []);

  // Click empty space → deselect
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (
        e.target === e.currentTarget ||
        (e.target as HTMLElement).dataset.viewport === "true"
      ) {
        setSelectedIds([]);
      }
    },
    [setSelectedIds],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).contentEditable === "true") return;

      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedIds.length > 0
      ) {
        e.preventDefault();
        deleteElements(selectedIds);
      }
      if (e.key === "z" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (
        (e.key === "z" && (e.metaKey || e.ctrlKey) && e.shiftKey) ||
        (e.key === "y" && (e.metaKey || e.ctrlKey))
      ) {
        e.preventDefault();
        redo();
      }
      if (e.key === "a" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSelectedIds(slide.elements.map((el) => el.id));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIds, deleteElements, undo, redo, setSelectedIds, slide.elements]);

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

  // Drag
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
      updateElement(drag.elementId, {
        left: Math.round(drag.origLeft + dx),
        top: Math.round(drag.origTop + dy),
      });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [scale, updateElement, pushHistory]);

  const handleElementMouseDown = useCallback(
    (e: React.MouseEvent, element: SlideElement) => {
      if ((e.target as HTMLElement).contentEditable === "true") return;
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

  // Render element
  const renderElement = (el: SlideElement) => {
    const isSelected = selectedIds.includes(el.id);
    const wrapperProps = {
      key: el.id,
      onMouseDown: (e: React.MouseEvent) => handleElementMouseDown(e, el),
    };

    switch (el.type) {
      case "text":
        return (
          <div {...wrapperProps}>
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
          <div {...wrapperProps}>
            <ImageElement
              element={el}
              selected={isSelected}
              onSelect={handleSelectElement}
            />
          </div>
        );
      case "shape":
        return (
          <div {...wrapperProps}>
            <ShapeElement
              element={el}
              selected={isSelected}
              onSelect={handleSelectElement}
            />
          </div>
        );
      case "line":
        return (
          <div {...wrapperProps}>
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
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: canvas area needs mouse interaction for element deselection
    <div
      ref={containerRef}
      className="relative flex flex-1 items-center justify-center overflow-hidden bg-neutral-200 dark:bg-neutral-800"
      onMouseDown={handleCanvasClick}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: viewport area needs mouse interaction for element deselection */}
      <div
        data-viewport="true"
        className="relative bg-white shadow-lg"
        style={{
          width: VIEWPORT_WIDTH,
          height: VIEWPORT_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          ...bgStyle,
        }}
        onMouseDown={handleCanvasClick}
      >
        {slide.elements.map(renderElement)}
      </div>
    </div>
  );
}
