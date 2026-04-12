import { useCallback, useEffect, useRef, useState } from "react";

interface LaserPointerProps {
  active: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

interface TrailPoint {
  x: number;
  y: number;
  time: number;
}

const TRAIL_MAX = 20;
const TRAIL_LIFETIME_MS = 500;
const DOT_SIZE = 12;

export function LaserPointer({ active, containerRef }: LaserPointerProps) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const trailRef = useRef<TrailPoint[]>([]);
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const rafRef = useRef<number>(0);

  const updateTrail = useCallback(() => {
    const now = Date.now();
    trailRef.current = trailRef.current.filter(
      (p) => now - p.time < TRAIL_LIFETIME_MS,
    );
    setTrail([...trailRef.current]);
    if (active) {
      rafRef.current = requestAnimationFrame(updateTrail);
    }
  }, [active]);

  useEffect(() => {
    if (!active) {
      setPosition(null);
      trailRef.current = [];
      setTrail([]);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    rafRef.current = requestAnimationFrame(updateTrail);

    const onMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setPosition({ x, y });
      trailRef.current.push({ x, y, time: Date.now() });
      if (trailRef.current.length > TRAIL_MAX) {
        trailRef.current.shift();
      }
    };

    container.addEventListener("pointermove", onMove);
    return () => {
      container.removeEventListener("pointermove", onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, containerRef, updateTrail]);

  if (!active || !position) return null;

  const now = Date.now();

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 50 }}
    >
      {trail.map((point, i) => {
        const age = now - point.time;
        const opacity = Math.max(0, 1 - age / TRAIL_LIFETIME_MS) * 0.5;
        const size = DOT_SIZE * Math.max(0.3, 1 - age / TRAIL_LIFETIME_MS);
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: trail points have no stable id
            key={`${point.time}-${i}`}
            className="absolute rounded-full bg-red-500"
            style={{
              left: point.x - size / 2,
              top: point.y - size / 2,
              width: size,
              height: size,
              opacity,
            }}
          />
        );
      })}
      <div
        className="absolute rounded-full bg-red-500"
        style={{
          left: position.x - DOT_SIZE / 2,
          top: position.y - DOT_SIZE / 2,
          width: DOT_SIZE,
          height: DOT_SIZE,
          boxShadow: "0 0 12px 4px rgba(239,68,68,0.6)",
        }}
      />
    </div>
  );
}
