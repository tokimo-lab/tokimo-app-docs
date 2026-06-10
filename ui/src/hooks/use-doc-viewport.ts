import { useCallback, useEffect, useRef } from "react";
import { api } from "@/generated/rust-api";

export function useDocViewport(
  spaceId: string | undefined,
  relPath: string | undefined,
) {
  const enabled = !!spaceId && !!relPath;
  const { data: savedState, isLoading } = api.docs.getViewState.useQuery(
    { spaceId: spaceId ?? "", relPath: relPath ?? "" },
    { enabled, staleTime: Number.POSITIVE_INFINITY },
  );

  const mutation = api.docs.putViewState.useMutation({ onError: () => {} });
  const mutateRef = useRef(mutation.mutate);
  mutateRef.current = mutation.mutate;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<Record<string, unknown> | null>(null);
  const keyRef = useRef({ spaceId, relPath });
  keyRef.current = { spaceId, relPath };

  const flush = useCallback(() => {
    const latest = latestRef.current;
    const key = keyRef.current;
    if (key.spaceId && key.relPath && latest) {
      mutateRef.current({
        spaceId: key.spaceId,
        relPath: key.relPath,
        viewState: latest,
      });
    }
  }, []);

  const saveViewport = useCallback(
    (state: Record<string, unknown>) => {
      latestRef.current = state;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        flush();
        timerRef.current = null;
      }, 2000);
    },
    [flush],
  );

  useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        flush();
      }
    },
    [flush],
  );

  const viewState =
    savedState && typeof savedState === "object" && !Array.isArray(savedState)
      ? (savedState as Record<string, unknown>)
      : null;
  return { viewState, isLoading, saveViewport };
}
