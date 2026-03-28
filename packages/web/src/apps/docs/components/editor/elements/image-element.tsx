import type { PlateElementProps } from "platejs/react";
import { PlateElement, useElement } from "platejs/react";

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

  return (
    <PlateElement className="my-4" {...props}>
      <figure contentEditable={false} className="flex flex-col items-center">
        {url ? (
          <img
            src={url}
            alt={caption || ""}
            className="max-w-full rounded"
            style={width ? { width } : undefined}
            draggable={false}
          />
        ) : (
          <div className="flex h-32 w-full items-center justify-center rounded border-2 border-dashed border-zinc-300 text-zinc-400 dark:border-zinc-600">
            Click to add image
          </div>
        )}
        {caption && (
          <figcaption className="mt-1 text-center text-xs text-zinc-400">
            {caption}
          </figcaption>
        )}
      </figure>
      {props.children}
    </PlateElement>
  );
}
