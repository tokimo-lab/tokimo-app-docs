import { useTocElementState } from "@platejs/toc/react";
import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";
import { useRef } from "react";
import { BlockToolbar } from "../components/BlockToolbar";
import { useBlockDrag } from "../hooks/use-block-drag";

export function TocElement(props: PlateElementProps) {
  const state = useTocElementState();
  const headings = state?.headingList ?? [];
  const containerRef = useRef<HTMLDivElement>(null);
  const { isDragging, handleDragPointerDown } = useBlockDrag(containerRef);

  return (
    <PlateElement className="my-4" {...props}>
      <div
        contentEditable={false}
        className={`group/block relative rounded-lg border border-border-base p-4 transition-opacity select-none ${isDragging ? "opacity-30" : ""}`}
      >
        <div ref={containerRef}>
          <BlockToolbar
            isDragging={isDragging}
            onPointerDown={handleDragPointerDown}
          />
        </div>
        <div className="mb-2 text-xs font-semibold text-fg-muted uppercase">
          Table of Contents
        </div>
        {headings.length === 0 ? (
          <div className="text-sm text-fg-muted italic">
            Add headings to see table of contents
          </div>
        ) : (
          <nav className="flex flex-col gap-1">
            {headings.map((h) => (
              <button
                key={h.id}
                type="button"
                className="cursor-pointer text-left text-sm text-blue-600 hover:underline dark:text-blue-400"
                style={{ paddingLeft: `${(h.depth - 1) * 16}px` }}
                onClick={() => {
                  const el = document.getElementById(h.id);
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {h.title}
              </button>
            ))}
          </nav>
        )}
      </div>
      {props.children}
    </PlateElement>
  );
}
