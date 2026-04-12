import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageElement } from "./elements/ImageElement";
import { LineElement } from "./elements/LineElement";
import { ShapeElement } from "./elements/ShapeElement";
import { TextElement } from "./elements/TextElement";
import { createAnimationPlayer } from "./lib/animation-player";
import { DrawingCanvas } from "./presenter/DrawingCanvas";
import { LaserPointer } from "./presenter/LaserPointer";
import { PresenterToolbar } from "./presenter/PresenterToolbar";
import { SlideOverview } from "./presenter/SlideOverview";
import {
  getBackgroundStyle,
  getClickGroups,
  getTransitionEnterStyle,
} from "./presenter/slide-utils";
import type { ElementAnimation, Slide } from "./types";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "./types";

interface SlidePresenterProps {
  slides: Slide[];
  startIndex?: number;
  onExit: () => void;
}

const noop = () => {};

export function SlidePresenter({
  slides,
  startIndex = 0,
  onExit,
}: SlidePresenterProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [animStep, setAnimStep] = useState(0);
  const slideContainerRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);

  // Presenter feature states
  const [penActive, setPenActive] = useState(false);
  const [laserActive, setLaserActive] = useState(false);
  const [blackout, setBlackout] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);

  // Transition state
  const [transitioning, setTransitioning] = useState(false);
  const [transitionEnter, setTransitionEnter] = useState(false);
  const directionRef = useRef<"forward" | "backward">("forward");

  // Number key accumulator
  const numberBufRef = useRef("");
  const numberTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // Toolbar auto-hide timer
  const toolbarTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // Track visible elements for animations
  const [visibleElements, setVisibleElements] = useState<Set<string>>(
    new Set(),
  );

  const slide = slides[currentIndex];

  const clickGroups = getClickGroups(slide);
  const totalSteps = clickGroups.length;

  // Reset animation state when slide changes
  useEffect(() => {
    setAnimStep(0);
    if (slide?.animations) {
      const entranceElementIds = new Set(
        slide.animations
          .filter((a) => a.type === "entrance")
          .map((a) => a.elementId),
      );
      const initialVisible = new Set<string>();
      for (const el of slide.elements) {
        if (!entranceElementIds.has(el.id)) {
          initialVisible.add(el.id);
        }
      }
      setVisibleElements(initialVisible);
    } else {
      setVisibleElements(new Set(slide?.elements.map((e) => e.id) ?? []));
    }
  }, [slide]);

  const playAnimGroup = useCallback((group: ElementAnimation[]) => {
    const container = slideContainerRef.current;
    if (!container) return;
    for (const anim of group) {
      if (anim.type === "entrance") {
        setVisibleElements((prev) => new Set([...prev, anim.elementId]));
      }
    }
    const player = createAnimationPlayer(group, (elementId) => {
      const el = container.querySelector(`[data-element-id="${elementId}"]`);
      return el instanceof HTMLElement ? el : null;
    });
    player.play().then(() => {
      for (const anim of group) {
        if (anim.type === "exit") {
          setVisibleElements((prev) => {
            const next = new Set(prev);
            next.delete(anim.elementId);
            return next;
          });
        }
      }
    });
  }, []);

  // Fullscreen on mount
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, []);

  // Toolbar auto-hide on mouse move
  const resetToolbarTimer = useCallback(() => {
    setShowToolbar(true);
    if (toolbarTimerRef.current) clearTimeout(toolbarTimerRef.current);
    toolbarTimerRef.current = setTimeout(() => setShowToolbar(false), 3000);
  }, []);

  useEffect(() => {
    resetToolbarTimer();
    return () => {
      if (toolbarTimerRef.current) clearTimeout(toolbarTimerRef.current);
    };
  }, [resetToolbarTimer]);

  const handleMouseMove = useCallback(() => {
    resetToolbarTimer();
  }, [resetToolbarTimer]);

  // Slide transition helper
  const transitionDuration = useMemo(
    () => slide?.transition?.duration ?? 400,
    [slide],
  );
  const transitionType = useMemo(
    () => slide?.transition?.type ?? "none",
    [slide],
  );

  const navigateToSlide = useCallback(
    (newIndex: number, direction: "forward" | "backward") => {
      if (newIndex < 0 || newIndex >= slides.length || transitioning) return;
      const targetSlide = slides[newIndex];
      const tType = targetSlide?.transition?.type ?? "none";
      directionRef.current = direction;

      if (tType === "none") {
        setCurrentIndex(newIndex);
        return;
      }

      setTransitionEnter(true);
      setTransitioning(true);
      setCurrentIndex(newIndex);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTransitionEnter(false);
          setTimeout(() => {
            setTransitioning(false);
          }, targetSlide?.transition?.duration ?? 400);
        });
      });
    },
    [slides.length, transitioning, slides],
  );

  const goNext = useCallback(() => {
    if (animStep < totalSteps) {
      const group = clickGroups[animStep];
      if (group) playAnimGroup(group);
      setAnimStep((s) => s + 1);
    } else {
      if (currentIndex < slides.length - 1) {
        navigateToSlide(currentIndex + 1, "forward");
      }
    }
  }, [
    slides.length,
    animStep,
    totalSteps,
    clickGroups,
    playAnimGroup,
    currentIndex,
    navigateToSlide,
  ]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      navigateToSlide(currentIndex - 1, "backward");
    }
  }, [currentIndex, navigateToSlide]);

  const goToSlide = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, slides.length - 1));
      const direction = clamped >= currentIndex ? "forward" : "backward";
      navigateToSlide(clamped, direction);
    },
    [slides.length, currentIndex, navigateToSlide],
  );

  // Toggle helpers
  const togglePen = useCallback(() => {
    setPenActive((v) => {
      if (!v) setLaserActive(false);
      return !v;
    });
  }, []);

  const toggleLaser = useCallback(() => {
    setLaserActive((v) => {
      if (!v) setPenActive(false);
      return !v;
    });
  }, []);

  const toggleBlackout = useCallback(() => {
    setBlackout((v) => !v);
  }, []);

  const toggleOverview = useCallback(() => {
    setShowOverview((v) => !v);
  }, []);

  // Keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Number keys for slide jump
      if (e.key >= "0" && e.key <= "9") {
        numberBufRef.current += e.key;
        if (numberTimerRef.current) clearTimeout(numberTimerRef.current);
        numberTimerRef.current = setTimeout(() => {
          numberBufRef.current = "";
        }, 2000);
        return;
      }

      if (e.key === "Escape") {
        if (showOverview) {
          setShowOverview(false);
        } else if (penActive) {
          setPenActive(false);
        } else if (laserActive) {
          setLaserActive(false);
        } else {
          onExit();
        }
        return;
      }

      if (e.key === "Enter" && numberBufRef.current) {
        const num = Number.parseInt(numberBufRef.current, 10);
        numberBufRef.current = "";
        if (num >= 1 && num <= slides.length) {
          goToSlide(num - 1);
        }
        e.preventDefault();
        return;
      }

      if (
        e.key === "ArrowRight" ||
        e.key === " " ||
        e.key === "ArrowDown" ||
        e.key === "Enter" ||
        e.key === "PageDown"
      ) {
        e.preventDefault();
        goNext();
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goPrev();
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        goToSlide(0);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        goToSlide(slides.length - 1);
        return;
      }
      if (e.key === "b" || e.key === "B") {
        toggleBlackout();
        return;
      }
      if (e.key === "p" || e.key === "P") {
        togglePen();
        return;
      }
      if (e.key === "l" || e.key === "L") {
        toggleLaser();
        return;
      }
      if (e.key === "g" || e.key === "G") {
        toggleOverview();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    goNext,
    goPrev,
    goToSlide,
    onExit,
    slides.length,
    showOverview,
    penActive,
    laserActive,
    toggleBlackout,
    togglePen,
    toggleLaser,
    toggleOverview,
  ]);

  const handleClick = useCallback(() => {
    if (penActive || laserActive || showOverview) return;
    goNext();
  }, [penActive, laserActive, showOverview, goNext]);

  if (!slide) {
    onExit();
    return null;
  }

  const screenW = window.innerWidth;
  const screenH = window.innerHeight;
  const scale = Math.min(screenW / VIEWPORT_WIDTH, screenH / VIEWPORT_HEIGHT);

  const bgStyle = getBackgroundStyle(slide.background);

  // Transition styles
  const transitionStyle: React.CSSProperties =
    transitionType !== "none"
      ? {
          transition: transitionEnter
            ? "none"
            : `transform ${transitionDuration}ms ease, opacity ${transitionDuration}ms ease`,
          ...(transitionEnter
            ? getTransitionEnterStyle(
                transitionType,
                directionRef.current === "forward",
              )
            : {}),
        }
      : {};

  const renderElement = (el: Slide["elements"][number]) => {
    const isVisible = visibleElements.has(el.id);
    const wrapperStyle: React.CSSProperties = {
      visibility: isVisible ? "visible" : "hidden",
    };

    const wrapper = (child: React.ReactNode) => (
      <div key={el.id} data-element-id={el.id} style={wrapperStyle}>
        {child}
      </div>
    );

    switch (el.type) {
      case "text":
        return wrapper(
          <TextElement
            element={el}
            selected={false}
            scale={scale}
            onSelect={noop}
            onUpdate={noop}
          />,
        );
      case "image":
        return wrapper(
          <ImageElement element={el} selected={false} onSelect={noop} />,
        );
      case "shape":
        return wrapper(
          <ShapeElement element={el} selected={false} onSelect={noop} />,
        );
      case "line":
        return wrapper(
          <LineElement element={el} selected={false} onSelect={noop} />,
        );
      default:
        return null;
    }
  };

  const progressPercent = ((currentIndex + 1) / slides.length) * 100;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard navigation handled via global keydown listener
    // biome-ignore lint/a11y/noStaticElementInteractions: presentation overlay needs click to advance
    <div
      ref={outerRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
      style={{
        cursor: penActive ? "crosshair" : laserActive ? "none" : "pointer",
      }}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
    >
      {/* Slide content with transition */}
      <div style={transitionStyle}>
        <div
          ref={slideContainerRef}
          className="relative"
          style={{
            width: VIEWPORT_WIDTH,
            height: VIEWPORT_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            ...bgStyle,
          }}
        >
          {slide.elements.map(renderElement)}

          <DrawingCanvas
            active={penActive}
            slideIndex={currentIndex}
            viewportWidth={VIEWPORT_WIDTH}
            viewportHeight={VIEWPORT_HEIGHT}
            scale={scale}
          />
        </div>
      </div>

      {/* Laser pointer */}
      <LaserPointer active={laserActive} containerRef={outerRef} />

      {/* Blackout overlay */}
      {blackout && <div className="fixed inset-0 z-[9999] bg-black" />}

      {/* Progress bar */}
      <div className="fixed inset-x-0 bottom-0 z-[10001] h-[3px]">
        <div
          className="h-full bg-white/40 transition-[width] duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Toolbar */}
      <div
        className="fixed inset-x-0 bottom-4 z-[10001] flex justify-center transition-opacity duration-300"
        style={{
          opacity: showToolbar ? 1 : 0,
          pointerEvents: showToolbar ? "auto" : "none",
        }}
      >
        <PresenterToolbar
          currentIndex={currentIndex}
          totalSlides={slides.length}
          onPrev={goPrev}
          onNext={goNext}
          onExit={onExit}
          penActive={penActive}
          onTogglePen={togglePen}
          laserActive={laserActive}
          onToggleLaser={toggleLaser}
          blackout={blackout}
          onToggleBlackout={toggleBlackout}
          onShowOverview={toggleOverview}
        />
      </div>

      {/* Slide overview */}
      {showOverview && (
        <SlideOverview
          slides={slides}
          currentIndex={currentIndex}
          onSelect={(index) => {
            goToSlide(index);
            setShowOverview(false);
          }}
          onClose={() => setShowOverview(false)}
        />
      )}
    </div>
  );
}
