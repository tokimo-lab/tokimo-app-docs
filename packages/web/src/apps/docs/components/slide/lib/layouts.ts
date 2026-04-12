import type { SlideElement, SlideLayout } from "../types";
import { generateId, VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "../types";

function text(
  content: string,
  left: number,
  top: number,
  width: number,
  height: number,
  fontSize: number,
  align = "left",
  bold = false,
): SlideElement {
  const fontWeight = bold ? "font-weight:bold;" : "";
  return {
    id: generateId(),
    type: "text" as const,
    left,
    top,
    width,
    height,
    rotate: 0,
    content: `<p style="font-size:${fontSize}px;text-align:${align};${fontWeight}">${content}</p>`,
    defaultFontName: "Microsoft YaHei",
    defaultColor: "#333333",
    lineHeight: 1.5,
  };
}

function imagePlaceholder(
  left: number,
  top: number,
  width: number,
  height: number,
): SlideElement {
  return {
    id: generateId(),
    type: "shape" as const,
    left,
    top,
    width,
    height,
    rotate: 0,
    viewBox: [width, height] as [number, number],
    path: `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`,
    fill: "#e8e8e8",
    text: {
      content: "图片",
      defaultFontName: "Microsoft YaHei",
      defaultColor: "#999",
      align: "center" as const,
    },
  };
}

function createLayout(
  id: string,
  name: string,
  factory: () => SlideElement[],
): SlideLayout {
  return {
    id,
    name,
    get elements() {
      return factory();
    },
  };
}

export const SLIDE_LAYOUTS: SlideLayout[] = [
  createLayout("blank", "空白", () => []),
  createLayout("title", "标题", () => [
    text(
      "标题",
      (VIEWPORT_WIDTH - 600) / 2,
      VIEWPORT_HEIGHT / 2 - 50,
      600,
      80,
      36,
      "center",
      true,
    ),
  ]),
  createLayout("title-list", "标题与列表", () => [
    text("标题", 60, 40, 840, 60, 28, "left", true),
    text("• 内容项 1\n• 内容项 2\n• 内容项 3", 60, 120, 840, 360, 18, "left"),
  ]),
  createLayout("cover-title", "封面图与标题", () => [
    imagePlaceholder(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT),
    text(
      "封面标题",
      (VIEWPORT_WIDTH - 600) / 2,
      VIEWPORT_HEIGHT - 140,
      600,
      80,
      36,
      "center",
      true,
    ),
  ]),
  createLayout("title-image", "标题与图片", () => [
    text("标题", 40, 40, 420, 60, 28, "left", true),
    text("描述文本", 40, 110, 420, 200, 16, "left"),
    imagePlaceholder(500, 40, 420, 460),
  ]),
  createLayout("title-two-col", "标题与两栏内容", () => [
    text("标题", 60, 40, 840, 60, 28, "left", true),
    text("左栏内容", 60, 120, 400, 360, 16, "left"),
    text("右栏内容", 500, 120, 400, 360, 16, "left"),
  ]),
  createLayout("title-three-col", "标题与三栏内容", () => [
    text("标题", 60, 40, 840, 60, 28, "left", true),
    text("第一栏", 60, 120, 260, 360, 16, "left"),
    text("第二栏", 350, 120, 260, 360, 16, "left"),
    text("第三栏", 640, 120, 260, 360, 16, "left"),
  ]),
  createLayout("title-four-col", "标题与四栏内容", () => [
    text("标题", 60, 40, 840, 60, 28, "left", true),
    text("第一栏", 40, 120, 200, 360, 14, "left"),
    text("第二栏", 260, 120, 200, 360, 14, "left"),
    text("第三栏", 480, 120, 200, 360, 14, "left"),
    text("第四栏", 700, 120, 200, 360, 14, "left"),
  ]),
  createLayout("photo-wall", "照片墙", () => [
    imagePlaceholder(30, 30, 290, 235),
    imagePlaceholder(340, 30, 290, 235),
    imagePlaceholder(650, 30, 280, 235),
    imagePlaceholder(30, 280, 290, 235),
    imagePlaceholder(340, 280, 290, 235),
    imagePlaceholder(650, 280, 280, 235),
  ]),
  createLayout("title-body", "标题与正文", () => [
    text("标题", 60, 40, 840, 60, 28, "left", true),
    text(
      "正文内容。在此输入详细说明文字，支持多行文本编辑。",
      60,
      120,
      840,
      380,
      18,
      "left",
    ),
  ]),
];
