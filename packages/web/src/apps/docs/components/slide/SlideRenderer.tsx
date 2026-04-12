import type {
  Slide,
  SlideElement,
  SlideImageElement,
  SlideLineElement,
  SlideShapeElement,
  SlideTextElement,
} from "./types";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "./types";

interface SlideRendererProps {
  slide: Slide;
  width: number;
  height: number;
}

/**
 * Non-interactive miniature slide renderer using CSS transform scale.
 * Used for thumbnails and overview grids — renders all element types faithfully.
 */
export function SlideRenderer({ slide, width, height }: SlideRendererProps) {
  const scaleX = width / VIEWPORT_WIDTH;
  const scaleY = height / VIEWPORT_HEIGHT;
  const scale = Math.min(scaleX, scaleY);

  const bgStyle = buildBackgroundStyle(slide);

  return (
    <div
      className="relative overflow-hidden"
      style={{ width, height, ...bgStyle }}
    >
      {/* Use CSS zoom instead of transform: scale() — zoom affects layout dimensions */}
      <div
        className="pointer-events-none relative"
        style={{
          width: VIEWPORT_WIDTH,
          height: VIEWPORT_HEIGHT,
          zoom: scale,
        }}
      >
        {slide.elements.map((el) => (
          <StaticElement key={el.id} element={el} />
        ))}
      </div>
    </div>
  );
}

function StaticElement({ element }: { element: SlideElement }) {
  switch (element.type) {
    case "text":
      return <StaticText element={element} />;
    case "image":
      return <StaticImage element={element} />;
    case "shape":
      return <StaticShape element={element} />;
    case "line":
      return <StaticLine element={element} />;
    default:
      return <StaticFallback element={element} />;
  }
}

function StaticText({ element }: { element: SlideTextElement }) {
  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left: element.left,
        top: element.top,
        width: element.width,
        height: element.height,
        transform: element.rotate ? `rotate(${element.rotate}deg)` : undefined,
        opacity: element.opacity ?? 1,
        backgroundColor: element.fill,
        fontFamily: element.defaultFontName,
        color: element.defaultColor,
        lineHeight: element.lineHeight ?? 1.5,
      }}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: thumbnail preview of slide text
      dangerouslySetInnerHTML={{ __html: element.content }}
    />
  );
}

function StaticImage({ element }: { element: SlideImageElement }) {
  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left: element.left,
        top: element.top,
        width: element.width,
        height: element.height,
        transform: element.rotate ? `rotate(${element.rotate}deg)` : undefined,
        opacity: element.opacity ?? 1,
        borderRadius: element.radius ?? 0,
      }}
    >
      <img
        src={element.src}
        alt=""
        className="h-full w-full object-cover"
        style={{
          transform: `scaleX(${element.flipH ? -1 : 1}) scaleY(${element.flipV ? -1 : 1})`,
        }}
        draggable={false}
      />
    </div>
  );
}

function StaticShape({ element }: { element: SlideShapeElement }) {
  const [vw, vh] = element.viewBox;
  const gradId = `thumb-grad-${element.id}`;

  return (
    <div
      className="absolute"
      style={{
        left: element.left,
        top: element.top,
        width: element.width,
        height: element.height,
        transform: element.rotate ? `rotate(${element.rotate}deg)` : undefined,
        opacity: element.opacity ?? 1,
      }}
    >
      <svg
        viewBox={`0 0 ${vw} ${vh}`}
        className="h-full w-full"
        preserveAspectRatio="none"
      >
        {element.gradient ? (
          <>
            <defs>
              {element.gradient.type === "linear" ? (
                <linearGradient
                  id={gradId}
                  gradientTransform={`rotate(${element.gradient.angle ?? 0})`}
                >
                  {element.gradient.colors.map((c) => (
                    <stop
                      key={`${c.offset}-${c.color}`}
                      offset={`${c.offset * 100}%`}
                      stopColor={c.color}
                    />
                  ))}
                </linearGradient>
              ) : (
                <radialGradient id={gradId}>
                  {element.gradient.colors.map((c) => (
                    <stop
                      key={`${c.offset}-${c.color}`}
                      offset={`${c.offset * 100}%`}
                      stopColor={c.color}
                    />
                  ))}
                </radialGradient>
              )}
            </defs>
            <path
              d={element.path}
              fill={`url(#${gradId})`}
              stroke={element.outline?.color}
              strokeWidth={element.outline?.width}
            />
          </>
        ) : (
          <path
            d={element.path}
            fill={element.fill}
            stroke={element.outline?.color}
            strokeWidth={element.outline?.width}
          />
        )}
      </svg>
      {element.text && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
          style={{
            fontFamily: element.text.defaultFontName,
            color: element.text.defaultColor,
            textAlign: element.text.align,
          }}
        >
          {element.text.content}
        </div>
      )}
    </div>
  );
}

function StaticLine({ element }: { element: SlideLineElement }) {
  const lineType = element.lineType ?? "straight";
  const controlPoints = element.controlPoints ?? [];
  const [sx, sy] = element.start;
  const [ex, ey] = element.end;
  const allPoints: [number, number][] = [[sx, sy], ...controlPoints, [ex, ey]];

  const minX = Math.min(...allPoints.map((p) => p[0]));
  const minY = Math.min(...allPoints.map((p) => p[1]));
  const maxX = Math.max(...allPoints.map((p) => p[0]));
  const maxY = Math.max(...allPoints.map((p) => p[1]));
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;

  const lsx = sx - minX;
  const lsy = sy - minY;
  const lex = ex - minX;
  const ley = ey - minY;

  const dashArray =
    element.style === "dashed"
      ? "8 4"
      : element.style === "dotted"
        ? "2 2"
        : undefined;

  const markerId = `thumb-arrow-${element.id}`;
  const markerStartId = `thumb-arrow-s-${element.id}`;

  const commonProps = {
    stroke: element.color,
    strokeWidth: element.strokeWidth ?? 2,
    strokeDasharray: dashArray,
    fill: "none" as const,
    markerStart:
      element.points[0] === "arrow" ? `url(#${markerStartId})` : undefined,
    markerEnd: element.points[1] === "arrow" ? `url(#${markerId})` : undefined,
  };

  const renderLinePath = () => {
    if (lineType === "polyline" && controlPoints.length > 0) {
      const pts = allPoints
        .map((p) => `${p[0] - minX},${p[1] - minY}`)
        .join(" ");
      return <polyline points={pts} {...commonProps} />;
    }
    if (lineType === "curve" && controlPoints.length > 0) {
      if (controlPoints.length === 1) {
        const [cx, cy] = controlPoints[0];
        const d = `M${lsx},${lsy} Q${cx - minX},${cy - minY} ${lex},${ley}`;
        return <path d={d} {...commonProps} />;
      }
      const [c1x, c1y] = controlPoints[0];
      const [c2x, c2y] = controlPoints[1];
      const d = `M${lsx},${lsy} C${c1x - minX},${c1y - minY} ${c2x - minX},${c2y - minY} ${lex},${ley}`;
      return <path d={d} {...commonProps} />;
    }
    return <line x1={lsx} y1={lsy} x2={lex} y2={ley} {...commonProps} />;
  };

  return (
    <div
      className="absolute"
      style={{
        left: element.left + minX,
        top: element.top + minY,
        width: w,
        height: h,
        opacity: element.opacity ?? 1,
      }}
    >
      <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full overflow-visible">
        <defs>
          {element.points[0] === "arrow" && (
            <marker
              id={markerStartId}
              markerWidth="10"
              markerHeight="7"
              refX="0"
              refY="3.5"
              orient="auto"
            >
              <polygon points="10 0, 0 3.5, 10 7" fill={element.color} />
            </marker>
          )}
          {element.points[1] === "arrow" && (
            <marker
              id={markerId}
              markerWidth="10"
              markerHeight="7"
              refX="10"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill={element.color} />
            </marker>
          )}
        </defs>
        {renderLinePath()}
      </svg>
    </div>
  );
}

function StaticFallback({ element }: { element: SlideElement }) {
  if (!("width" in element) || !("height" in element)) return null;
  const el = element as SlideElement & { width: number; height: number };
  const rotate = "rotate" in el ? (el as { rotate: number }).rotate : 0;
  return (
    <div
      className="absolute flex items-center justify-center rounded bg-neutral-200 text-[10px] text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400"
      style={{
        left: el.left,
        top: el.top,
        width: el.width,
        height: el.height,
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
        opacity: el.opacity ?? 1,
      }}
    >
      {el.type}
    </div>
  );
}

function buildBackgroundStyle(slide: Slide): React.CSSProperties {
  const bg = slide.background;
  const style: React.CSSProperties = { backgroundColor: "#fff" };
  if (!bg) return style;
  if (bg.type === "solid" && bg.color) {
    style.backgroundColor = bg.color;
  } else if (bg.type === "image" && bg.imageUrl) {
    style.backgroundImage = `url(${bg.imageUrl})`;
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
  } else if (bg.type === "gradient" && bg.gradient) {
    const stops = bg.gradient.colors
      .map((c) => `${c.color} ${c.offset * 100}%`)
      .join(", ");
    style.background =
      bg.gradient.type === "linear"
        ? `linear-gradient(${bg.gradient.angle ?? 0}deg, ${stops})`
        : `radial-gradient(circle, ${stops})`;
  }
  return style;
}
