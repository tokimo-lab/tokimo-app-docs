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

// ═══════════════════════════════════════════════════════════════════════════
// Layer 1: Time-based scroll guard (secondary protection)
// While the editor is scrolling (+ 500ms cooldown), embedded viewers should
// not capture wheel events — prevents accidental zoom during fast scrolling.
// ═══════════════════════════════════════════════════════════════════════════

const COOLDOWN_MS = 500;

export const ScrollGuardContext = createContext<
  React.RefObject<boolean> | undefined
>(undefined);

/** Provider hook — returns a ref + onScroll callback for the scroll container. */
export function useScrollGuardProvider() {
  const scrollingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const onScrollGuard = () => {
    scrollingRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      scrollingRef.current = false;
    }, COOLDOWN_MS);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { scrollingRef, onScrollGuard };
}

/** Consumer hook — returns ref whose `.current` is true while parent scrolls. */
export function useScrollGuard(): React.RefObject<boolean> {
  const ref = useContext(ScrollGuardContext);
  const fallback = useRef(false);
  return ref ?? fallback;
}

// ═══════════════════════════════════════════════════════════════════════════
// Layer 2: Focus-based block activation (primary protection)
// Preview content has `pointer-events: none` until user clicks the block.
// Only activated block receives wheel/pointer events.
// ═══════════════════════════════════════════════════════════════════════════

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

/** Provider hook — call in DocEditorArea, pass scrollRef. */
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

  // Auto-deactivate when clicking outside the block
  useEffect(() => {
    if (!isActivated || !observeRef.current) return;
    const el = observeRef.current;
    const handlePointerDown = (e: PointerEvent) => {
      if (!el.contains(e.target as Node)) {
        if (blockKey) ctx?.deactivate(blockKey);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
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
