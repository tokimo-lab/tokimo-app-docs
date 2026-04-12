import { Maximize } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SearchReplace } from "./components/SearchReplace";
import { SlidePanel } from "./panels/SlidePanel";
import { SlideCanvas } from "./SlideCanvas";
import { SlidePresenter } from "./SlidePresenter";
import { SlideSpeakerNotes } from "./SlideSpeakerNotes";
import { SlideThumbnailPanel } from "./SlideThumbnailPanel";
import { SlideToolbar } from "./SlideToolbar";
import { SlideZoomControls } from "./SlideZoomControls";
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
  const [zoom, setZoom] = useState(0);
  const isReplayingRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Init from content — intentionally run only once on mount.
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

  const handlePresent = useCallback(() => setPresenting(true), []);
  const handleExitPresent = useCallback(() => {
    setPresenting(false);
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const currentSlide = presentation.slides[currentSlideIndex];

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
      {/* Top bar: toolbar + zoom + present */}
      <div className="flex items-center border-b border-border-subtle bg-white px-2 dark:bg-neutral-900">
        <SlideToolbar />
        <div className="flex-1" />
        <SlideZoomControls zoom={zoom || 100} onZoomChange={setZoom} />
        <div className="mx-2 h-4 w-px bg-border-subtle" />
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 rounded bg-blue-500 px-3 py-1 text-xs text-white transition-colors hover:bg-blue-600"
          onClick={handlePresent}
        >
          <Maximize size={14} />
          演示
        </button>
      </div>

      {/* Main area */}
      <div className="flex min-h-0 flex-1">
        <SlideThumbnailPanel />
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {currentSlide ? (
            <SlideCanvas slide={currentSlide} zoom={zoom} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-fg-muted">
              无幻灯片
            </div>
          )}
          <SearchReplace />
          <SlideSpeakerNotes />
        </div>
        <SlidePanel />
      </div>
    </div>
  );
}
