// Viewport constants
export const VIEWPORT_WIDTH = 960;
export const VIEWPORT_HEIGHT = 540;

// Element outline
export interface ElementOutline {
  color: string;
  width: number;
  style: "solid" | "dashed" | "dotted";
}

// Element shadow
export interface ElementShadow {
  offsetX: number;
  offsetY: number;
  blur: number;
  color: string;
}

// Gradient
export interface Gradient {
  type: "linear" | "radial";
  colors: Array<{ offset: number; color: string }>;
  angle?: number;
}

// Shape text overlay
export interface ShapeText {
  content: string;
  defaultFontName: string;
  defaultColor: string;
  align: "left" | "center" | "right";
}

// Line point type
export type LinePoint = "" | "arrow" | "dot";

// Element base
export interface SlideElementBase {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
  rotate: number;
  lock?: boolean;
  groupId?: string;
  opacity?: number;
}

// Text element
export interface SlideTextElement extends SlideElementBase {
  type: "text";
  content: string;
  defaultFontName: string;
  defaultColor: string;
  fill?: string;
  outline?: ElementOutline;
  lineHeight?: number;
  wordSpace?: number;
  shadow?: ElementShadow;
  vertical?: boolean;
}

// Image element
export interface SlideImageElement extends SlideElementBase {
  type: "image";
  src: string;
  fixedRatio: boolean;
  flipH?: boolean;
  flipV?: boolean;
  outline?: ElementOutline;
  shadow?: ElementShadow;
  radius?: number;
}

// Shape element
export interface SlideShapeElement extends SlideElementBase {
  type: "shape";
  viewBox: [number, number];
  path: string;
  fill: string;
  gradient?: Gradient;
  outline?: ElementOutline;
  shadow?: ElementShadow;
  text?: ShapeText;
}

// Line element
export interface SlideLineElement
  extends Omit<SlideElementBase, "height" | "rotate"> {
  type: "line";
  start: [number, number];
  end: [number, number];
  style: "solid" | "dashed" | "dotted";
  color: string;
  strokeWidth?: number;
  points: [LinePoint, LinePoint];
  lineType?: "straight" | "polyline" | "curve";
  controlPoints?: [number, number][];
}

// Chart data
export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    color?: string;
  }>;
}

// Chart element
export interface SlideChartElement extends SlideElementBase {
  type: "chart";
  chartType:
    | "bar"
    | "column"
    | "line"
    | "area"
    | "scatter"
    | "pie"
    | "doughnut"
    | "radar";
  data: ChartData;
  options?: Record<string, unknown>;
}

// Video element
export interface SlideVideoElement extends SlideElementBase {
  type: "video";
  src: string;
  poster?: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
}

// Audio element
export interface SlideAudioElement extends SlideElementBase {
  type: "audio";
  src: string;
  autoplay?: boolean;
  loop?: boolean;
  showIcon?: boolean;
}

// LaTeX element
export interface SlideLatexElement extends SlideElementBase {
  type: "latex";
  formula: string;
  fontSize?: number;
  color?: string;
}

// Table cell
export interface TableCell {
  content: string;
  rowSpan?: number;
  colSpan?: number;
  style?: {
    bold?: boolean;
    color?: string;
    bgColor?: string;
    align?: "left" | "center" | "right";
  };
}

// Table element
export interface SlideTableElement extends SlideElementBase {
  type: "table";
  rows: number;
  cols: number;
  data: TableCell[][];
  colWidths: number[];
  theme?: {
    headerBg?: string;
    headerColor?: string;
    borderColor?: string;
    stripedBg?: string;
  };
}

export type SlideElement =
  | SlideTextElement
  | SlideImageElement
  | SlideShapeElement
  | SlideLineElement
  | SlideChartElement
  | SlideVideoElement
  | SlideAudioElement
  | SlideLatexElement
  | SlideTableElement;

// Animation types
export type AnimationType = "entrance" | "exit" | "emphasis";

export type AnimationEffect =
  // Entrance
  | "fadeIn"
  | "fadeInUp"
  | "fadeInDown"
  | "fadeInLeft"
  | "fadeInRight"
  | "zoomIn"
  | "bounceIn"
  | "slideInUp"
  | "slideInDown"
  | "slideInLeft"
  | "slideInRight"
  // Exit
  | "fadeOut"
  | "fadeOutUp"
  | "fadeOutDown"
  | "fadeOutLeft"
  | "fadeOutRight"
  | "zoomOut"
  | "bounceOut"
  | "slideOutUp"
  | "slideOutDown"
  | "slideOutLeft"
  | "slideOutRight"
  // Emphasis
  | "pulse"
  | "bounce"
  | "shake"
  | "swing"
  | "tada"
  | "flash"
  | "rubberBand";

export type AnimationTrigger = "onClick" | "withPrevious" | "afterPrevious";

export interface ElementAnimation {
  id: string;
  elementId: string;
  type: AnimationType;
  effect: AnimationEffect;
  trigger: AnimationTrigger;
  duration: number;
  delay: number;
  order: number;
}

// Slide
export interface Slide {
  id: string;
  elements: SlideElement[];
  background?: SlideBackground;
  transition?: SlideTransition;
  notes?: string;
  animations?: ElementAnimation[];
}

// Background
export type SlideBackgroundType = "solid" | "image" | "gradient";
export interface SlideBackground {
  type: SlideBackgroundType;
  color?: string;
  imageUrl?: string;
  gradient?: Gradient;
}

// Transition
export type TransitionType =
  | "none"
  | "fade"
  | "slideLeft"
  | "slideRight"
  | "slideUp"
  | "slideDown"
  | "scale"
  | "cover"
  | "push"
  | "reveal";
export interface SlideTransition {
  type: TransitionType;
  duration: number;
}

// Theme
export interface SlideTheme {
  backgroundColor: string;
  themeColors: string[];
  fontColor: string;
  fontName: string;
}

// Top-level presentation
export interface SlidePresentation {
  slides: Slide[];
  theme: SlideTheme;
  viewportSize: { width: number; height: number };
}

// Factory functions
export function generateId(): string {
  return crypto.randomUUID();
}

export function createBlankSlide(): Slide {
  return { id: generateId(), elements: [] };
}

export function createDefaultPresentation(): SlidePresentation {
  return {
    slides: [createBlankSlide()],
    theme: {
      backgroundColor: "#ffffff",
      themeColors: [
        "#5B9BD5",
        "#ED7D31",
        "#A5A5A5",
        "#FFC000",
        "#4472C4",
        "#70AD47",
      ],
      fontColor: "#333333",
      fontName: "Microsoft YaHei",
    },
    viewportSize: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
  };
}

export function createTextElement(
  textType: "title" | "subtitle" | "body" | "heading" | "small",
): SlideTextElement {
  const configs: Record<
    string,
    { width: number; height: number; content: string; fontSize: number }
  > = {
    title: {
      width: 600,
      height: 80,
      content: '<p style="font-size:36px;text-align:center">标题</p>',
      fontSize: 36,
    },
    subtitle: {
      width: 500,
      height: 56,
      content: '<p style="font-size:24px;text-align:center">副标题</p>',
      fontSize: 24,
    },
    body: {
      width: 600,
      height: 200,
      content: '<p style="font-size:16px">正文内容</p>',
      fontSize: 16,
    },
    heading: {
      width: 500,
      height: 64,
      content: '<p style="font-size:28px;font-weight:bold">标题文本</p>',
      fontSize: 28,
    },
    small: {
      width: 300,
      height: 40,
      content: '<p style="font-size:14px">小号文本</p>',
      fontSize: 14,
    },
  };
  const cfg = configs[textType];
  return {
    id: generateId(),
    type: "text",
    left: (VIEWPORT_WIDTH - cfg.width) / 2,
    top: (VIEWPORT_HEIGHT - cfg.height) / 2,
    width: cfg.width,
    height: cfg.height,
    rotate: 0,
    content: cfg.content,
    defaultFontName: "Microsoft YaHei",
    defaultColor: "#333333",
    lineHeight: 1.5,
  };
}

export function createImageElement(
  src: string,
  width = 400,
  height = 300,
): SlideImageElement {
  return {
    id: generateId(),
    type: "image",
    left: (VIEWPORT_WIDTH - width) / 2,
    top: (VIEWPORT_HEIGHT - height) / 2,
    width,
    height,
    rotate: 0,
    src,
    fixedRatio: true,
  };
}

// Layout template type
export interface SlideLayout {
  id: string;
  name: string;
  elements: SlideElement[];
}

export function createChartElement(
  chartType: SlideChartElement["chartType"],
): SlideChartElement {
  const defaultData: ChartData = {
    labels: ["A", "B", "C", "D"],
    datasets: [
      { label: "数据系列 1", data: [40, 60, 30, 80], color: "#5B9BD5" },
    ],
  };
  return {
    id: generateId(),
    type: "chart",
    left: (VIEWPORT_WIDTH - 400) / 2,
    top: (VIEWPORT_HEIGHT - 300) / 2,
    width: 400,
    height: 300,
    rotate: 0,
    chartType,
    data: defaultData,
  };
}

export function createVideoElement(src = ""): SlideVideoElement {
  return {
    id: generateId(),
    type: "video",
    left: (VIEWPORT_WIDTH - 480) / 2,
    top: (VIEWPORT_HEIGHT - 270) / 2,
    width: 480,
    height: 270,
    rotate: 0,
    src,
  };
}

export function createAudioElement(src = ""): SlideAudioElement {
  return {
    id: generateId(),
    type: "audio",
    left: (VIEWPORT_WIDTH - 280) / 2,
    top: (VIEWPORT_HEIGHT - 80) / 2,
    width: 280,
    height: 80,
    rotate: 0,
    src,
    showIcon: true,
  };
}

export function createLatexElement(formula = "E = mc^2"): SlideLatexElement {
  return {
    id: generateId(),
    type: "latex",
    left: (VIEWPORT_WIDTH - 300) / 2,
    top: (VIEWPORT_HEIGHT - 80) / 2,
    width: 300,
    height: 80,
    rotate: 0,
    formula,
    fontSize: 24,
    color: "#333333",
  };
}

export function createTableElement(rows = 3, cols = 3): SlideTableElement {
  const data: TableCell[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      content: r === 0 ? `标题 ${c + 1}` : "",
    })),
  );
  const colWidths = Array.from({ length: cols }, () => 100 / cols);
  return {
    id: generateId(),
    type: "table",
    left: (VIEWPORT_WIDTH - 500) / 2,
    top: (VIEWPORT_HEIGHT - 200) / 2,
    width: 500,
    height: 200,
    rotate: 0,
    rows,
    cols,
    data,
    colWidths,
    theme: {
      headerBg: "#4472C4",
      headerColor: "#ffffff",
      borderColor: "#d0d0d0",
      stripedBg: "#f0f4fa",
    },
  };
}

export function isSlidePresentation(v: unknown): v is SlidePresentation {
  return (
    typeof v === "object" &&
    v !== null &&
    "slides" in v &&
    Array.isArray((v as SlidePresentation).slides) &&
    "theme" in v
  );
}
