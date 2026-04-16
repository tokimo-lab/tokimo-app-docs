import type { PlateElementProps } from "platejs/react";
import { PlateElement, useElement } from "platejs/react";
import { useRef } from "react";
import { BlockDragHandle } from "../components/BlockDragHandle";
import { useBlockDrag } from "../hooks/use-block-drag";

export function ImageElement(props: PlateElementProps) {
  const element = useElement();
  const url = (element as Record<string, unknown>).url as string;
  const caption = (
    (element as Record<string, unknown>).caption as
      | Array<{ text: string }>
      | undefined
  )?.[0]?.text;
  const width = (element as Record<string, unknown>).width as
    | number
    | undefined;
  const containerRef = useRef<HTMLDivElement>(null);
  const { isDragging, handleDragPointerDown } = useBlockDrag(containerRef);

  return (
    <PlateElement className="my-4" {...props}>
      <div
        ref={containerRef}
        contentEditable={false}
        className={`group relative transition-opacity ${isDragging ? "opacity-30" : ""}`}
      >
        <BlockDragHandle
          label="图片"
          isDragging={isDragging}
          onPointerDown={handleDragPointerDown}
        />
        <figure className="flex flex-col items-center">
          {url ? (
            <img
              src={url}
              alt={caption || ""}
              className="max-w-full rounded"
              style={width ? { width } : undefined}
            />
          ) : (
            <div className="flex h-32 w-full items-center justify-center rounded border-2 border-dashed border-border-base text-fg-muted">
              Click to add image
            </div>
          )}
          {caption && (
            <figcaption className="mt-1 text-center text-xs text-fg-muted">
              {caption}
            </figcaption>
          )}
        </figure>
      </div>
      {props.children}
    </PlateElement>
  );
}
