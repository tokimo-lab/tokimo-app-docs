import { useState } from "react";
import type { SlideElement } from "../types";
import { useSlideStore } from "../use-slide-store";
import { AnimationPanel } from "./AnimationPanel";
import { ChartStylePanel } from "./ChartStylePanel";
import { ImageStylePanel } from "./ImageStylePanel";
import { LatexStylePanel } from "./LatexStylePanel";
import { LineStylePanel } from "./LineStylePanel";
import { MultiSelectPanel } from "./MultiSelectPanel";
import { PanelTabs } from "./PanelTabs";
import { PositionPanel } from "./PositionPanel";
import { ShapeStylePanel } from "./ShapeStylePanel";
import { TableStylePanel } from "./TableStylePanel";
import { TextStylePanel } from "./TextStylePanel";

const TABS = [
  { key: "style", label: "样式" },
  { key: "position", label: "位置" },
  { key: "animation", label: "动画" },
];

function StyleTabContent({
  element,
  multiSelect,
}: {
  element: SlideElement | undefined;
  multiSelect: boolean;
}) {
  if (multiSelect) return <MultiSelectPanel />;
  if (!element) {
    return (
      <div className="p-4 text-sm text-fg-muted">选择元素查看样式选项</div>
    );
  }

  switch (element.type) {
    case "text":
      return <TextStylePanel element={element} />;
    case "image":
      return <ImageStylePanel element={element} />;
    case "shape":
      return <ShapeStylePanel element={element} />;
    case "line":
      return <LineStylePanel element={element} />;
    case "table":
      return <TableStylePanel element={element} />;
    case "chart":
      return <ChartStylePanel element={element} />;
    case "latex":
      return <LatexStylePanel element={element} />;
    default:
      return (
        <div className="p-4 text-sm text-fg-muted">选择元素查看样式选项</div>
      );
  }
}

export function SlidePanelElement() {
  const [activeTab, setActiveTab] = useState("style");
  const selectedIds = useSlideStore((s) => s.selectedElementIds);
  const currentSlide = useSlideStore((s) => s.currentSlide());

  const selectedElement = currentSlide?.elements.find(
    (el) => el.id === selectedIds[0],
  );

  return (
    <>
      <PanelTabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 overflow-y-auto">
        {activeTab === "style" && (
          <StyleTabContent
            element={selectedElement}
            multiSelect={selectedIds.length > 1}
          />
        )}
        {activeTab === "position" && <PositionPanel />}
        {activeTab === "animation" && <AnimationPanel />}
      </div>
    </>
  );
}
