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
  points: [LinePoint, LinePoint];
}

export type SlideElement =
  | SlideTextElement
  | SlideImageElement
  | SlideShapeElement
  | SlideLineElement;

// Slide
export interface Slide {
  id: string;
  elements: SlideElement[];
  background?: SlideBackground;
  transition?: SlideTransition;
  notes?: string;
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

export function isSlidePresentation(v: unknown): v is SlidePresentation {
  return (
    typeof v === "object" &&
    v !== null &&
    "slides" in v &&
    Array.isArray((v as SlidePresentation).slides) &&
    "theme" in v
  );
}
