import { useSlideStore } from "../use-slide-store";
import { SlidePanelElement } from "./SlidePanelElement";
import { SlidePanelNoSelection } from "./SlidePanelNoSelection";

export function SlidePanel() {
  const selectedIds = useSlideStore((s) => s.selectedElementIds);
  const hasSelection = selectedIds.length > 0;

  return (
    <div className="flex w-[280px] shrink-0 flex-col border-l border-border-subtle bg-white dark:bg-neutral-900">
      {hasSelection ? <SlidePanelElement /> : <SlidePanelNoSelection />}
    </div>
  );
}
