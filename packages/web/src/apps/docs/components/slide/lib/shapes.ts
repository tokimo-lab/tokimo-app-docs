export interface ShapeDefinition {
  name: string;
  label: string;
  viewBox: [number, number];
  path: string;
}

export const SHAPES: ShapeDefinition[] = [
  {
    name: "rect",
    label: "矩形",
    viewBox: [200, 200],
    path: "M 0 0 L 200 0 L 200 200 L 0 200 Z",
  },
  {
    name: "roundedRect",
    label: "圆角矩形",
    viewBox: [200, 200],
    path: "M 20 0 L 180 0 Q 200 0 200 20 L 200 180 Q 200 200 180 200 L 20 200 Q 0 200 0 180 L 0 20 Q 0 0 20 0 Z",
  },
  {
    name: "circle",
    label: "圆形",
    viewBox: [200, 200],
    path: "M 100 0 A 100 100 0 1 1 100 200 A 100 100 0 1 1 100 0 Z",
  },
  {
    name: "triangle",
    label: "三角形",
    viewBox: [200, 200],
    path: "M 100 0 L 200 200 L 0 200 Z",
  },
  {
    name: "star",
    label: "五角星",
    viewBox: [200, 200],
    path: "M 100 0 L 123 72 L 200 78 L 141 126 L 159 200 L 100 160 L 41 200 L 59 126 L 0 78 L 77 72 Z",
  },
  {
    name: "arrowRight",
    label: "右箭头",
    viewBox: [200, 200],
    path: "M 0 50 L 120 50 L 120 0 L 200 100 L 120 200 L 120 150 L 0 150 Z",
  },
  {
    name: "diamond",
    label: "菱形",
    viewBox: [200, 200],
    path: "M 100 0 L 200 100 L 100 200 L 0 100 Z",
  },
  {
    name: "hexagon",
    label: "六边形",
    viewBox: [200, 200],
    path: "M 50 0 L 150 0 L 200 100 L 150 200 L 50 200 L 0 100 Z",
  },
];
