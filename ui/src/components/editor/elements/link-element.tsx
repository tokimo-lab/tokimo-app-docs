import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";

export function LinkElement({
  element,
  children,
  ...props
}: PlateElementProps) {
  return (
    <PlateElement
      as="a"
      element={element}
      className="cursor-pointer text-[var(--accent)] underline decoration-[var(--accent)]/50 underline-offset-2 transition-colors hover:text-[var(--accent-hover)] hover:decoration-[var(--accent)] dark:text-[var(--accent)] dark:decoration-[var(--accent)]/40 dark:hover:text-[var(--accent-text)]"
      {...props}
    >
      {children}
    </PlateElement>
  );
}
