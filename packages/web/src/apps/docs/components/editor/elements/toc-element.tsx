import { useTocElementState } from "@platejs/toc/react";
import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";

export function TocElement(props: PlateElementProps) {
  const state = useTocElementState();
  const headings = state?.headingList ?? [];

  return (
    <PlateElement
      className="my-4 rounded-lg border border-border-base p-4"
      {...props}
    >
      <div contentEditable={false} className="select-none">
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
                className="text-left text-sm text-blue-600 hover:underline dark:text-blue-400"
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
