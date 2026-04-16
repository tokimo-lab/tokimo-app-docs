import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
} from "react";

/**
 * Tracks whether the parent scroll container is actively scrolling.
 * When scrolling (+ 1s cooldown), embedded viewers should not capture
 * wheel events — otherwise scrolling the page accidentally zooms images.
 */

const COOLDOWN_MS = 1000;

export const ScrollGuardContext = createContext<
  React.RefObject<boolean> | undefined
>(undefined);

/**
 * Hook for the scroll container: attach to onScroll.
 * Returns a stable ref whose `.current` is `true` while scrolling
 * and for `COOLDOWN_MS` after the last scroll event.
 */
export function useScrollGuardProvider() {
  const scrollingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const onScroll = () => {
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

  return { scrollingRef, onScroll };
}

/**
 * Hook for embedded viewers: returns true while the parent is scrolling.
 * Falls back to `false` if there's no provider (standalone viewer windows).
 */
export function useScrollGuard(): React.RefObject<boolean> {
  const ref = useContext(ScrollGuardContext);
  const fallback = useRef(false);
  return ref ?? fallback;
}

/**
 * Wrapper that blocks wheel events from reaching children while the parent
 * scroll container is actively scrolling. Useful for Monaco, iframe-based
 * viewers, and any component with internal scroll that can't consume the
 * ScrollGuardContext directly.
 */
export function ScrollGuardShield({ children }: { children: ReactNode }) {
  const guardRef = useScrollGuard();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (guardRef.current) {
        e.stopPropagation();
      }
    };
    // Capture phase so we intercept before children handle the event
    el.addEventListener("wheel", handler, { capture: true });
    return () => el.removeEventListener("wheel", handler, { capture: true });
  }, [guardRef]);

  return (
    <div ref={containerRef} className="h-full w-full">
      {children}
    </div>
  );
}
