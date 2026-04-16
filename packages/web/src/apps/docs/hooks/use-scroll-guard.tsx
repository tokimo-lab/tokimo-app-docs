import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * Focus-based scroll protection for embedded viewers (images, PDFs, Monaco, etc).
 *
 * When a block is NOT activated, its preview content has `pointer-events: none`,
 * so wheel/click events pass through to the parent scroll container.
 * When a user clicks on the block, it becomes "activated" — the preview area
 * gains pointer-events and can capture wheel (zoom, internal scroll, etc).
 *
 * Activation clears when:
 * - Another block is activated (only one at a time)
 * - The block scrolls completely out of the editor viewport
 */

interface BlockFocusContextValue {
  activatedKey: string | null;
  activate: (key: string) => void;
  deactivate: (key: string) => void;
  /** The editor scroll container, used as IntersectionObserver root. */
  editorScrollRef: RefObject<HTMLDivElement | null>;
}

export const BlockFocusContext = createContext<BlockFocusContextValue | null>(
  null,
);

/**
 * Provider hook — call in DocEditorArea, pass scrollRef.
 */
export function useBlockFocusProvider(
  scrollRef: RefObject<HTMLDivElement | null>,
) {
  const [activatedKey, setActivatedKey] = useState<string | null>(null);

  const activate = useCallback((key: string) => setActivatedKey(key), []);
  const deactivate = useCallback(
    (key: string) => setActivatedKey((prev) => (prev === key ? null : prev)),
    [],
  );

  return {
    value: { activatedKey, activate, deactivate, editorScrollRef: scrollRef },
  };
}

/**
 * Consumer hook — call in any block that has embedded viewers.
 *
 * Returns activation state + a ref to attach to the block container
 * (used by IntersectionObserver to auto-deactivate when out of viewport).
 */
export function useBlockFocus(blockKey: string | undefined) {
  const ctx = useContext(BlockFocusContext);
  const isActivated = !!blockKey && ctx?.activatedKey === blockKey;

  const activate = useCallback(() => {
    if (blockKey) ctx?.activate(blockKey);
  }, [ctx, blockKey]);

  const deactivate = useCallback(() => {
    if (blockKey) ctx?.deactivate(blockKey);
  }, [ctx, blockKey]);

  // Auto-deactivate when block scrolls out of the editor viewport
  const observeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isActivated || !observeRef.current) return;
    const root = ctx?.editorScrollRef.current ?? null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && blockKey) {
          ctx?.deactivate(blockKey);
        }
      },
      { root, threshold: 0 },
    );
    observer.observe(observeRef.current);
    return () => observer.disconnect();
  }, [isActivated, blockKey, ctx]);

  return { isActivated, activate, deactivate, observeRef };
}

/**
 * Wrapper that blocks wheel events from reaching children when the block
 * is NOT activated. Used for iframe-based / Monaco / PDF viewers that can't
 * be controlled via `pointer-events: none` alone (e.g. already-mounted iframes).
 */
export function WheelCaptureShield({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || active) return;
    const handler = (e: WheelEvent) => {
      e.stopPropagation();
    };
    el.addEventListener("wheel", handler, { capture: true });
    return () => el.removeEventListener("wheel", handler, { capture: true });
  }, [active]);

  return (
    <div ref={containerRef} className="h-full w-full">
      {children}
    </div>
  );
}
