import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";

export function LinkElement({
  element,
  children,
  ...props
}: PlateElementProps) {
  const url = (element as Record<string, unknown>).url as string | undefined;

  return (
    <PlateElement as="a" element={element} {...props}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="cursor-pointer text-blue-600 underline decoration-blue-400/50 underline-offset-2 transition-colors hover:text-blue-800 hover:decoration-blue-600 dark:text-blue-400 dark:decoration-blue-400/40 dark:hover:text-blue-300"
      >
        {children}
      </a>
    </PlateElement>
  );
}
