import type { MiddlewareState } from "@floating-ui/react";

export function getSafeAreaPadding(gap = 0) {
  return ({ elements }: MiddlewareState) => {
    const style = getComputedStyle(
      elements.floating.ownerDocument.documentElement,
    );
    const inset = (edge: string) =>
      (Number.parseFloat(style.getPropertyValue(`--safe-area-${edge}`)) || 0) +
      gap;
    return {
      padding: {
        top: inset("top"),
        right: inset("right"),
        bottom: inset("bottom"),
        left: inset("left"),
      },
    };
  };
}
