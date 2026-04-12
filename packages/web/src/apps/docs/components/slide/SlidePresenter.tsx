import { useCallback, useEffect, useRef, useState } from "react";
import { ImageElement } from "./elements/ImageElement";
import { LineElement } from "./elements/LineElement";
import { ShapeElement } from "./elements/ShapeElement";
import { TextElement } from "./elements/TextElement";
import type { Slide } from "./types";
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
  const [showNumber, setShowNumber] = useState(true);

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, []);

  const prevIndexRef = useRef(currentIndex);
  useEffect(() => {
    if (prevIndexRef.current !== currentIndex) {
      prevIndexRef.current = currentIndex;
    }
    setShowNumber(true);
    const timer = setTimeout(() => setShowNumber(false), 2000);
    return () => clearTimeout(timer);
  }, [currentIndex]);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, slides.length - 1));
  }, [slides.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onExit();
        return;
      }
      if (e.key === "ArrowRight" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        goNext();
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, onExit]);

  const handleClick = useCallback(() => {
    if (currentIndex < slides.length - 1) goNext();
    else onExit();
  }, [currentIndex, slides.length, goNext, onExit]);

  const slide = slides[currentIndex];
  if (!slide) {
    onExit();
    return null;
  }

  const screenW = window.innerWidth;
  const screenH = window.innerHeight;
  const scale = Math.min(screenW / VIEWPORT_WIDTH, screenH / VIEWPORT_HEIGHT);

  const bgStyle: React.CSSProperties = { backgroundColor: "#fff" };
  const bg = slide.background;
  if (bg?.type === "solid" && bg.color) bgStyle.backgroundColor = bg.color;
  else if (bg?.type === "gradient" && bg.gradient) {
    const stops = bg.gradient.colors
      .map((c) => `${c.color} ${c.offset * 100}%`)
      .join(", ");
    bgStyle.background =
      bg.gradient.type === "linear"
        ? `linear-gradient(${bg.gradient.angle ?? 0}deg, ${stops})`
        : `radial-gradient(circle, ${stops})`;
  }

  const renderElement = (el: Slide["elements"][number]) => {
    switch (el.type) {
      case "text":
        return (
          <TextElement
            key={el.id}
            element={el}
            selected={false}
            scale={scale}
            onSelect={noop}
            onUpdate={noop}
          />
        );
      case "image":
        return (
          <ImageElement
            key={el.id}
            element={el}
            selected={false}
            onSelect={noop}
          />
        );
      case "shape":
        return (
          <ShapeElement
            key={el.id}
            element={el}
            selected={false}
            onSelect={noop}
          />
        );
      case "line":
        return (
          <LineElement
            key={el.id}
            element={el}
            selected={false}
            onSelect={noop}
          />
        );
      default:
        return null;
    }
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard navigation handled via global keydown listener
    // biome-ignore lint/a11y/noStaticElementInteractions: presentation overlay needs click to advance
    <div
      className="fixed inset-0 z-[9999] flex cursor-pointer items-center justify-center bg-black"
      onClick={handleClick}
    >
      <div
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
      </div>

      <div
        className="absolute bottom-4 right-4 text-sm text-white/60 transition-opacity"
        style={{ opacity: showNumber ? 1 : 0 }}
      >
        {currentIndex + 1} / {slides.length}
      </div>
    </div>
  );
}
