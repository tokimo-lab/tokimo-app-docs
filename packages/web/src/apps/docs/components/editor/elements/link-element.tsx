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
        className="cursor-pointer text-[var(--accent)] underline decoration-[var(--accent)]/50 underline-offset-2 transition-colors hover:text-[var(--accent-hover)] hover:decoration-[var(--accent)] dark:text-[var(--accent)] dark:decoration-[var(--accent)]/40 dark:hover:text-[var(--accent-text)]"
      >
        {children}
      </a>
    </PlateElement>
  );
}
