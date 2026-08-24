import { cn } from "@tokimo/ui";
import {
  AreaChart,
  BarChart3,
  BarChartHorizontal,
  CircleDot,
  LineChart,
  PieChart,
  Radar,
  ScatterChart,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SlideChartElement } from "../types";
import { useSlideStore } from "../use-slide-store";

const sectionClass = "border-b border-border-subtle px-4 py-3";
const labelClass = "mb-3 text-xs font-medium text-fg-muted";

const CHART_TYPES: {
  type: SlideChartElement["chartType"];
  icon: typeof BarChart3;
  i18nKey: string;
}[] = [
  { type: "column", icon: BarChart3, i18nKey: "docs.chartBar" },
  { type: "bar", icon: BarChartHorizontal, i18nKey: "docs.chartColumn" },
  { type: "line", icon: LineChart, i18nKey: "docs.chartLine" },
  { type: "area", icon: AreaChart, i18nKey: "docs.chartArea" },
  { type: "scatter", icon: ScatterChart, i18nKey: "docs.chartScatter" },
  { type: "pie", icon: PieChart, i18nKey: "docs.chartPie" },
  { type: "doughnut", icon: CircleDot, i18nKey: "docs.chartDoughnut" },
  { type: "radar", icon: Radar, i18nKey: "docs.chartRadar" },
];

export function ChartStylePanel({ element }: { element: SlideChartElement }) {
  const { t } = useTranslation();
  const updateElement = useSlideStore((s) => s.updateElement);
  const pushHistory = useSlideStore((s) => s.pushHistory);

  const update = (changes: Partial<SlideChartElement>) => {
    pushHistory();
    updateElement(element.id, changes);
  };

  const handleEditChart = () => {
    window.dispatchEvent(
      new CustomEvent("slide:edit-chart", {
        detail: { elementId: element.id },
      }),
    );
  };

  return (
    <div className="flex flex-col gap-0 pb-4">
      {/* 图表类型 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>{t("docs.chartTypeLabel")}</h3>
        <div className="grid grid-cols-4 gap-1">
          {CHART_TYPES.map(({ type, icon: Icon, i18nKey }) => {
            const label = t(i18nKey);
            return (
              <button
                key={type}
                type="button"
                title={label}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-1 rounded p-2 text-xs hover:bg-black/5 dark:hover:bg-white/5",
                  element.chartType === type &&
                    "bg-accent-subtle text-accent-text",
                )}
                onClick={() => update({ chartType: type })}
              >
                <Icon size={18} />
                <span className="truncate text-[10px]">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 操作 */}
      <div className={sectionClass}>
        <button
          type="button"
          className="h-8 w-full cursor-pointer rounded bg-accent text-xs font-medium text-fg-on-accent hover:bg-accent-hover"
          onClick={handleEditChart}
        >
          {t("docs.editChartData")}
        </button>
      </div>
    </div>
  );
}
