/**
 * ECharts option generator — ported from PPTist's chartOption.ts
 * Adapted for our ChartData format (datasets[] instead of series[][])
 */
import type {
  BarSeriesOption,
  LineSeriesOption,
  PieSeriesOption,
  RadarSeriesOption,
  ScatterSeriesOption,
} from "echarts/charts";
import type { ComposeOption } from "echarts/core";
import type { ChartData, SlideChartElement } from "../types";

type EChartOption = ComposeOption<
  | BarSeriesOption
  | LineSeriesOption
  | PieSeriesOption
  | ScatterSeriesOption
  | RadarSeriesOption
>;

const DEFAULT_COLORS = [
  "#5B9BD5",
  "#ED7D31",
  "#A5A5A5",
  "#FFC000",
  "#4472C4",
  "#70AD47",
  "#FF6384",
  "#36A2EB",
];

/** Convert our ChartData.datasets to PPTist-style 2D series array */
function toSeries(data: ChartData): number[][] {
  return data.datasets.map((ds) => ds.data);
}

/** Get legend names from datasets */
function toLegends(data: ChartData): string[] {
  return data.datasets.map((ds) => ds.label);
}

export interface ChartOptionPayload {
  chartType: SlideChartElement["chartType"];
  data: ChartData;
  themeColors?: string[];
}

export function getChartOption({
  chartType,
  data,
  themeColors,
}: ChartOptionPayload): EChartOption | null {
  const colors = themeColors?.length ? themeColors : DEFAULT_COLORS;
  const series = toSeries(data);
  const legends = toLegends(data);

  const legend =
    series.length > 1
      ? {
          top: "bottom" as const,
        }
      : undefined;

  if (chartType === "bar") {
    return {
      color: colors,
      legend,
      xAxis: {
        type: "category",
        data: data.labels,
      },
      yAxis: {
        type: "value",
      },
      series: series.map((item, index) => ({
        data: item,
        name: legends[index],
        type: "bar" as const,
        label: { show: true },
        itemStyle: { borderRadius: [2, 2, 0, 0] },
      })),
    };
  }

  if (chartType === "column") {
    return {
      color: colors,
      legend,
      yAxis: {
        type: "category",
        data: data.labels,
      },
      xAxis: {
        type: "value",
      },
      series: series.map((item, index) => ({
        data: item,
        name: legends[index],
        type: "bar" as const,
        label: { show: true },
        itemStyle: { borderRadius: [0, 2, 2, 0] },
      })),
    };
  }

  if (chartType === "line") {
    return {
      color: colors,
      legend,
      xAxis: {
        type: "category",
        data: data.labels,
      },
      yAxis: {
        type: "value",
      },
      series: series.map((item, index) => ({
        data: item,
        name: legends[index],
        type: "line" as const,
        label: { show: true },
      })),
    };
  }

  if (chartType === "area") {
    return {
      color: colors,
      legend,
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: data.labels,
      },
      yAxis: {
        type: "value",
      },
      series: series.map((item, index) => ({
        data: item,
        name: legends[index],
        type: "line" as const,
        areaStyle: {},
        label: { show: true },
      })),
    };
  }

  if (chartType === "scatter") {
    const formattedData: [number, number][] = [];
    for (let i = 0; i < (series[0]?.length ?? 0); i++) {
      const x = series[0][i];
      const y = series[1] ? series[1][i] : x;
      formattedData.push([x, y]);
    }
    return {
      color: colors,
      xAxis: {},
      yAxis: {},
      series: [
        {
          symbolSize: 12,
          data: formattedData,
          type: "scatter" as const,
        },
      ],
    };
  }

  if (chartType === "pie") {
    return {
      color: colors,
      legend: { top: "bottom" as const },
      series: [
        {
          data: (series[0] ?? []).map((value, index) => ({
            value,
            name: data.labels[index],
          })),
          type: "pie" as const,
          radius: "70%",
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: "rgba(0, 0, 0, 0.5)",
            },
            label: { show: true, fontSize: 14, fontWeight: "bold" },
          },
        },
      ],
    };
  }

  if (chartType === "doughnut") {
    return {
      color: colors,
      legend: { top: "bottom" as const },
      series: [
        {
          data: (series[0] ?? []).map((value, index) => ({
            value,
            name: data.labels[index],
          })),
          type: "pie" as const,
          radius: ["40%", "70%"],
          padAngle: 1,
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 4 },
          emphasis: {
            label: { show: true, fontSize: 14, fontWeight: "bold" },
          },
        },
      ],
    };
  }

  if (chartType === "radar") {
    return {
      color: colors,
      legend,
      radar: {
        indicator: data.labels.map((name) => ({ name })),
      },
      series: [
        {
          data: series.map((item, index) => ({
            value: item,
            name: legends[index],
          })),
          type: "radar" as const,
        },
      ],
    };
  }

  return null;
}
