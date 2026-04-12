import { useCallback, useEffect, useRef, useState } from "react";
import { SlideCanvas } from "./SlideCanvas";
import { SlidePresenter } from "./SlidePresenter";
import { SlideThumbnailPanel } from "./SlideThumbnailPanel";
import { SlideToolbar } from "./SlideToolbar";
import { createDefaultPresentation, isSlidePresentation } from "./types";
import { useSlideCollab } from "./use-slide-collab";
import { useSlideStore } from "./use-slide-store";

interface SlideEditorProps {
  content: unknown;
  onChange: (data: unknown) => void;
  nodeId: string;
  userName?: string;
}

export function SlideEditor({
  content,
  onChange,
  nodeId,
  userName,
}: SlideEditorProps) {
  const presentation = useSlideStore((s) => s.presentation);
  const currentSlideIndex = useSlideStore((s) => s.currentSlideIndex);
  const setPresentation = useSlideStore((s) => s.setPresentation);
  const [presenting, setPresenting] = useState(false);
  const isReplayingRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Init from content — intentionally run only once on mount.
  // Content is captured at mount time and collab will handle further syncing.
  const contentRef = useRef(content);
  useEffect(() => {
    const data = isSlidePresentation(contentRef.current)
      ? contentRef.current
      : createDefaultPresentation();
    setPresentation(data);
  }, [setPresentation]);

  // Debounced save
  useEffect(() => {
    const unsub = useSlideStore.subscribe(() => {
      const current = useSlideStore.getState();
      if (isReplayingRef.current) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        onChangeRef.current(current.presentation);
      }, 800);
    });
    return () => {
      unsub();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Collab
  useSlideCollab({
    nodeId,
    userName: userName ?? "Anonymous",
    getPresentation: () => useSlideStore.getState().presentation,
    setPresentation: (p) => {
      isReplayingRef.current = true;
      setPresentation(p);
      isReplayingRef.current = false;
    },
    isReplayingRef,
  });

  const currentSlide = presentation.slides[currentSlideIndex];

  const handlePresent = useCallback(() => setPresenting(true), []);
  const handleExitPresent = useCallback(() => {
    setPresenting(false);
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  if (presenting) {
    return (
      <SlidePresenter
        slides={presentation.slides}
        startIndex={currentSlideIndex}
        onExit={handleExitPresent}
      />
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <SlideToolbar onPresent={handlePresent} />
      <div className="flex min-h-0 min-w-0 flex-1">
        <SlideThumbnailPanel />
        {currentSlide ? (
          <SlideCanvas slide={currentSlide} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-fg-muted">
            无幻灯片
          </div>
        )}
      </div>
    </div>
  );
}
