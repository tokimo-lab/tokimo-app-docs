import {
  autoUpdate,
  flip,
  type Placement,
  shift,
  size,
  useFloating,
} from "@floating-ui/react";
import { useLayoutEffect } from "react";
import { getSafeAreaPadding } from "./safe-area";

interface MenuAnchor {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

/** Body menus use the same safe viewport bounds as the app's content. */
export function useSafeFloatingMenu(
  anchor: MenuAnchor | null,
  placement: Placement = "right-start",
) {
  const floating = useFloating({
    open: !!anchor,
    strategy: "fixed",
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [
      flip(getSafeAreaPadding(8)),
      shift((state) => ({
        ...getSafeAreaPadding(8)(state),
        crossAxis: true,
      })),
      size((state) => ({
        ...getSafeAreaPadding(8)(state),
        apply({ availableWidth, availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            maxWidth: `${Math.max(0, availableWidth)}px`,
            maxHeight: `${Math.max(0, availableHeight)}px`,
            overflowY: "auto",
          });
        },
      })),
    ],
  });
  const { setReference } = floating.refs;
  const x = anchor?.x;
  const y = anchor?.y;
  const width = anchor?.width ?? 0;
  const height = anchor?.height ?? 0;
  useLayoutEffect(() => {
    setReference(
      x === undefined || y === undefined
        ? null
        : {
            getBoundingClientRect: () =>
              DOMRect.fromRect({ x, y, width, height }),
          },
    );
  }, [setReference, x, y, width, height]);
  return floating;
}
