import { Maximize } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useWindowActions, useWindowId } from "@tokimo/sdk";
import { useDocViewport } from "../../hooks/use-doc-viewport";
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
  spaceId: string;
  nodeId: string;
  relPath: string;
  userName?: string;
}

export function SlideEditor({
  content,
  onChange,
  spaceId,
  nodeId,
  relPath,
  userName,
}: SlideEditorProps) {
  const presentation = useSlideStore((s) => s.presentation);
  const currentSlideIndex = useSlideStore((s) => s.currentSlideIndex);
  const setPresentation = useSlideStore((s) => s.setPresentation);
  const setCurrentSlideIndex = useSlideStore((s) => s.setCurrentSlideIndex);
  const [presenting, setPresenting] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { t } = useTranslation();
  const isReplayingRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const pendingPresentationRef = useRef<typeof presentation | null>(null);
  const windowActions = useWindowActions();
  const toggleFullscreen = (windowActions as unknown as { toggleFullscreen?: (id: string, flag?: boolean) => void }).toggleFullscreen ?? (() => {});
  const windowId = useWindowId();

  // Viewport state persistence
  const {
    viewState: savedViewport,
    isLoading: viewportLoading,
    saveViewport,
  } = useDocViewport(spaceId, relPath);
  const viewportRestoredRef = useRef(false);

  // Init from content — intentionally run only once on mount.
  const contentRef = useRef(content);
  useEffect(() => {
    const data = isSlidePresentation(contentRef.current)
      ? contentRef.current
      : createDefaultPresentation();
    setPresentation(data);
  }, [setPresentation]);

  const flushPendingSave = useCallback(() => {
    const pending = pendingPresentationRef.current;
    if (!pending || isReplayingRef.current) return;
    pendingPresentationRef.current = null;
    onChangeRef.current(pending);
  }, []);

  // Debounced save
  useEffect(() => {
    const unsub = useSlideStore.subscribe(() => {
      const current = useSlideStore.getState();
      if (isReplayingRef.current) return;
      pendingPresentationRef.current = current.presentation;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        flushPendingSave();
      }, 800);
    });
    return () => {
      unsub();
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        flushPendingSave();
      }
    };
  }, [flushPendingSave]);

  // Collab
  useSlideCollab({
    spaceId,
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

  // ── Viewport restore ─────────────────────────────────────────────────
  useEffect(() => {
    if (viewportLoading || viewportRestoredRef.current) return;
    if (!presentation.slides.length) return;
    viewportRestoredRef.current = true;

    const sv = savedViewport as {
      currentSlideIndex?: number;
      zoom?: number;
    } | null;
    if (sv?.currentSlideIndex != null) {
      const idx = Math.min(
        sv.currentSlideIndex,
        presentation.slides.length - 1,
      );
      setCurrentSlideIndex(idx);
    }
    if (sv?.zoom != null) {
      setZoom(sv.zoom);
    }
  }, [
    viewportLoading,
    savedViewport,
    presentation.slides.length,
    setCurrentSlideIndex,
  ]);

  // ── Track slide/zoom changes ──────────────────────────────────────────
  const prevSlideRef = useRef(currentSlideIndex);
  const prevZoomRef = useRef(zoom);
  useEffect(() => {
    if (
      currentSlideIndex !== prevSlideRef.current ||
      zoom !== prevZoomRef.current
    ) {
      prevSlideRef.current = currentSlideIndex;
      prevZoomRef.current = zoom;
      saveViewport({ currentSlideIndex, zoom });
    }
  }, [currentSlideIndex, zoom, saveViewport]);

  const handlePresent = useCallback(() => setPresenting(true), []);
  const handleExitPresent = useCallback(() => {
    setPresenting(false);
    // Force exit app-level fullscreen
    if (windowId) toggleFullscreen(windowId, false);
  }, [windowId, toggleFullscreen]);

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
      <div className="flex items-center border-b border-border-subtle bg-surface-base px-2">
        <SlideToolbar />
        <div className="flex-1" />
        <SlideZoomControls zoom={zoom || 100} onZoomChange={setZoom} />
        <div className="mx-2 h-4 w-px bg-border-subtle" />
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 rounded bg-accent px-3 py-1 text-xs text-fg-on-accent transition-colors hover:bg-accent-hover"
          onClick={handlePresent}
        >
          <Maximize size={14} />
          {t("docs.slidePresent")}
        </button>
      </div>

      {/* Main area */}
      <div className="flex min-h-0 flex-1">
        <SlideThumbnailPanel
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        />
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {currentSlide ? (
            <SlideCanvas slide={currentSlide} zoom={zoom} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-fg-muted">
              {t("docs.slideEmpty")}
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
