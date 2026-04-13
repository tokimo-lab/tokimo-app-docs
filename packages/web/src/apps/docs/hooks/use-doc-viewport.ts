import { useCallback, useEffect, useRef } from "react";
import { api } from "@/generated/rust-api";

/**
 * Per-user per-document viewport state persistence.
 * Debounces saves to avoid flooding the API (~2s).
 */
export function useDocViewport(nodeId: string | undefined) {
  const { data: savedState, isLoading } = api.docs.getViewState.useQuery(
    { nodeId: nodeId! },
    { enabled: !!nodeId, staleTime: Number.POSITIVE_INFINITY },
  );

  const mutation = api.docs.putViewState.useMutation({
    onError: () => {},
  });

  const mutateRef = useRef(mutation.mutate);
  mutateRef.current = mutation.mutate;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<Record<string, unknown> | null>(null);
  const nodeIdRef = useRef(nodeId);
  nodeIdRef.current = nodeId;

  const saveViewport = useCallback((state: Record<string, unknown>) => {
    latestRef.current = state;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const nid = nodeIdRef.current;
      const s = latestRef.current;
      if (nid && s) {
        mutateRef.current({ nodeId: nid, viewState: s });
      }
      timerRef.current = null;
    }, 2000);
  }, []);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        const nid = nodeIdRef.current;
        const s = latestRef.current;
        if (nid && s) {
          mutateRef.current({ nodeId: nid, viewState: s });
        }
      }
    };
  }, []);

  const viewState =
    savedState && typeof savedState === "object" && !Array.isArray(savedState)
      ? (savedState as Record<string, unknown>)
      : null;

  return { viewState, isLoading, saveViewport };
}
