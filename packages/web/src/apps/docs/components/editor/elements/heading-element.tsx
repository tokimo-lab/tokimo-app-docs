import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";

const TAG_MAP: Record<string, keyof HTMLElementTagNameMap> = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  h5: "h5",
  h6: "h6",
};

const STYLE_MAP: Record<string, string> = {
  h1: "mt-8 mb-4 text-3xl font-bold text-zinc-900 dark:text-zinc-50",
  h2: "mt-6 mb-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50",
  h3: "mt-4 mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100",
  h4: "mt-3 mb-1.5 text-lg font-semibold text-zinc-900 dark:text-zinc-100",
  h5: "mt-2 mb-1 text-base font-semibold text-zinc-900 dark:text-zinc-200",
  h6: "mt-2 mb-1 text-sm font-semibold text-fg-muted",
};

export function HeadingElement({ element, ...props }: PlateElementProps) {
  const type = element.type as string;
  const tag = TAG_MAP[type] ?? "h3";
  const className = STYLE_MAP[type] ?? STYLE_MAP.h3;

  return (
    <PlateElement as={tag} element={element} className={className} {...props} />
  );
}
