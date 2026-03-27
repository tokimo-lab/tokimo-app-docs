import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";

export function CodeBlockElement({ element, ...props }: PlateElementProps) {
  const lang = (element as Record<string, unknown>).lang as string | undefined;

  return (
    <PlateElement
      as="pre"
      element={element}
      {...props}
      className="relative my-4 overflow-x-auto rounded-lg bg-zinc-950 p-4 font-mono text-sm text-zinc-100 dark:bg-zinc-900"
    >
      {lang && (
        <span className="absolute top-2 right-3 select-none text-xs text-zinc-500">
          {lang}
        </span>
      )}
      <code>{props.children}</code>
    </PlateElement>
  );
}
