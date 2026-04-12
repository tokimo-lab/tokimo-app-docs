/**
 * Floating toggle that switches between mind map and outline view.
 * Two stacked icon buttons in a rounded pill, Feishu-style.
 */

import { List, Network } from "lucide-react";
import { useTranslation } from "react-i18next";

type ViewMode = "mindmap" | "outline";

interface MindViewSwitcherProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}

export function MindViewSwitcher({
  mode,
  onModeChange,
}: MindViewSwitcherProps) {
  const { t } = useTranslation("docs");

  return (
    <div className="absolute top-3 left-3 z-50 flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-600 dark:bg-[#2b2f36]">
      <button
        type="button"
        className={`cursor-pointer p-1.5 transition-colors ${
          mode === "outline"
            ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        }`}
        title={t("outlineView")}
        onClick={() => onModeChange("outline")}
      >
        <List size={16} />
      </button>
      <div className="border-t border-gray-200 dark:border-gray-600" />
      <button
        type="button"
        className={`cursor-pointer p-1.5 transition-colors ${
          mode === "mindmap"
            ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        }`}
        title={t("mindMapView")}
        onClick={() => onModeChange("mindmap")}
      >
        <Network size={16} />
      </button>
    </div>
  );
}
