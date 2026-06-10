import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  GalleryHorizontal,
  GalleryVertical,
  Group,
  RectangleHorizontal,
  RectangleVertical,
  Square,
  Ungroup,
} from "lucide-react";
import type { SlideElement } from "../types";
import { useSlideStore } from "../use-slide-store";

const sectionClass = "border-b border-border-subtle px-4 py-3";
const labelClass = "mb-3 text-xs font-medium text-fg-muted";
const iconBtnClass =
  "flex cursor-pointer items-center justify-center rounded p-1.5 hover:bg-black/5 dark:hover:bg-white/5";

export function MultiSelectPanel() {
  const selectedIds = useSlideStore((s) => s.selectedElementIds);
  const currentSlide = useSlideStore((s) => s.currentSlide());
  const alignElements = useSlideStore((s) => s.alignElements);
  const distributeElements = useSlideStore((s) => s.distributeElements);
  const matchElementSize = useSlideStore((s) => s.matchElementSize);
  const groupElements = useSlideStore((s) => s.groupElements);
  const ungroupElements = useSlideStore((s) => s.ungroupElements);

  const elements =
    currentSlide?.elements.filter((el: SlideElement) =>
      selectedIds.includes(el.id),
    ) ?? [];

  // Find common groupId if all selected share one
  const groupIds = new Set(elements.map((el) => el.groupId).filter(Boolean));
  const commonGroupId = groupIds.size === 1 ? [...groupIds][0] : undefined;

  if (elements.length < 2) return null;

  return (
    <div className="flex flex-col gap-0 pb-4">
      {/* 对齐 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>对齐</h3>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className={iconBtnClass}
            title="左对齐"
            onClick={() => alignElements(selectedIds, "left")}
          >
            <AlignStartVertical size={16} />
          </button>
          <button
            type="button"
            className={iconBtnClass}
            title="水平居中"
            onClick={() => alignElements(selectedIds, "center")}
          >
            <AlignCenterVertical size={16} />
          </button>
          <button
            type="button"
            className={iconBtnClass}
            title="右对齐"
            onClick={() => alignElements(selectedIds, "right")}
          >
            <AlignEndVertical size={16} />
          </button>
          <button
            type="button"
            className={iconBtnClass}
            title="顶部对齐"
            onClick={() => alignElements(selectedIds, "top")}
          >
            <AlignStartHorizontal size={16} />
          </button>
          <button
            type="button"
            className={iconBtnClass}
            title="垂直居中"
            onClick={() => alignElements(selectedIds, "middle")}
          >
            <AlignCenterHorizontal size={16} />
          </button>
          <button
            type="button"
            className={iconBtnClass}
            title="底部对齐"
            onClick={() => alignElements(selectedIds, "bottom")}
          >
            <AlignEndHorizontal size={16} />
          </button>
        </div>
      </div>

      {/* 分布 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>分布</h3>
        <div className="flex gap-1">
          <button
            type="button"
            className={iconBtnClass}
            title="水平等距分布"
            onClick={() => distributeElements(selectedIds, "horizontal")}
          >
            <GalleryHorizontal size={16} />
          </button>
          <button
            type="button"
            className={iconBtnClass}
            title="垂直等距分布"
            onClick={() => distributeElements(selectedIds, "vertical")}
          >
            <GalleryVertical size={16} />
          </button>
        </div>
      </div>

      {/* 同尺寸 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>同尺寸</h3>
        <div className="flex gap-1">
          <button
            type="button"
            className={iconBtnClass}
            title="相同宽度"
            onClick={() => matchElementSize(selectedIds, "width")}
          >
            <RectangleVertical size={16} />
          </button>
          <button
            type="button"
            className={iconBtnClass}
            title="相同高度"
            onClick={() => matchElementSize(selectedIds, "height")}
          >
            <RectangleHorizontal size={16} />
          </button>
          <button
            type="button"
            className={iconBtnClass}
            title="相同尺寸"
            onClick={() => matchElementSize(selectedIds, "both")}
          >
            <Square size={16} />
          </button>
        </div>
      </div>

      {/* 组合 */}
      <div className="px-4 py-3">
        <h3 className={labelClass}>组合</h3>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border-subtle px-3 py-1.5 text-xs text-fg-default transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            onClick={() => groupElements(selectedIds)}
          >
            <Group size={14} />
            组合
          </button>
          {commonGroupId && (
            <button
              type="button"
              className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border-subtle px-3 py-1.5 text-xs text-fg-default transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              onClick={() => ungroupElements(commonGroupId)}
            >
              <Ungroup size={14} />
              取消组合
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
