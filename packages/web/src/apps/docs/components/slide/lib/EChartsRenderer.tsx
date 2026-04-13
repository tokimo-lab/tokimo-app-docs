import {
  BarChart,
  LineChart,
  PieChart,
  RadarChart,
  ScatterChart,
} from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  RadarComponent,
  TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";
import type { ChartData, SlideChartElement } from "../types";
import { getChartOption } from "./chart-options";

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  RadarChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  RadarComponent,
  SVGRenderer,
]);

interface EChartsRendererProps {
  width: number;
  height: number;
  chartType: SlideChartElement["chartType"];
  data: ChartData;
  themeColors?: string[];
  /** If true, enables hover/click/tooltip interactions */
  interactive?: boolean;
  /** If true, disables animation (for thumbnails / static rendering) */
  noAnimation?: boolean;
}

export function EChartsRenderer({
  width,
  height,
  chartType,
  data,
  themeColors,
  interactive,
  noAnimation,
}: EChartsRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  // Initialize chart
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = echarts.init(el, undefined, { renderer: "svg" });
    chartRef.current = chart;

    return () => {
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  // Update option when data/type changes
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const option = getChartOption({ chartType, data, themeColors });
    if (option) {
      // Enable tooltip only in interactive mode
      if (interactive) {
        (option as Record<string, unknown>).tooltip = {
          trigger:
            chartType === "pie" || chartType === "doughnut" ? "item" : "axis",
        };
      }
      chart.setOption(option, true);
    }
  }, [chartType, data, themeColors, interactive]);

  // Handle animation setting
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption({ animation: !noAnimation }, false);
  }, [noAnimation]);

  // Resize when dimensions change
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.resize({ width, height });
  }, [width, height]);

  return (
    <div
      ref={containerRef}
      className={interactive ? undefined : "pointer-events-none"}
      style={{ width, height }}
    />
  );
}
