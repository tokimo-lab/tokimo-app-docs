import PptxGenJS from "pptxgenjs";
import type { SlideElement, SlidePresentation } from "../types";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "../types";

// Convert slide px to inches (10" wide standard)
const SLIDE_WIDTH_IN = 10;
const SLIDE_HEIGHT_IN = (VIEWPORT_HEIGHT / VIEWPORT_WIDTH) * SLIDE_WIDTH_IN;
const PX_TO_IN = SLIDE_WIDTH_IN / VIEWPORT_WIDTH;

function pxToIn(px: number): number {
  return px * PX_TO_IN;
}

function addElementToSlide(pptSlide: PptxGenJS.Slide, el: SlideElement) {
  const basePos = {
    x: pxToIn(el.left),
    y: pxToIn(el.top),
    w: pxToIn(el.width),
    h: "height" in el ? pxToIn(el.height as number) : undefined,
    rotate: "rotate" in el ? (el.rotate as number) || undefined : undefined,
  };

  switch (el.type) {
    case "text": {
      const div = document.createElement("div");
      div.innerHTML = el.content;
      const text = div.textContent ?? "";
      pptSlide.addText(text, {
        ...basePos,
        fontSize: 14,
        fontFace: el.defaultFontName || "Microsoft YaHei",
        color: el.defaultColor?.replace("#", "") || "333333",
        fill: el.fill ? { color: el.fill.replace("#", "") } : undefined,
        valign: "top",
        wrap: true,
      });
      break;
    }
    case "image": {
      if (el.src) {
        pptSlide.addImage({
          data: el.src.startsWith("data:") ? el.src : undefined,
          path: el.src.startsWith("data:") ? undefined : el.src,
          ...basePos,
        });
      }
      break;
    }
    case "table": {
      const tableRows: PptxGenJS.TableRow[] = el.data.map(
        (row, ri) =>
          row.map((cell) => ({
            text: cell.content,
            options: {
              bold: cell.style?.bold || ri === 0,
              color:
                (
                  cell.style?.color ??
                  (ri === 0 ? el.theme?.headerColor : undefined)
                )?.replace("#", "") || undefined,
              fill: {
                color:
                  (
                    cell.style?.bgColor ??
                    (ri === 0 ? el.theme?.headerBg : undefined)
                  )?.replace("#", "") || "FFFFFF",
              },
              align: cell.style?.align ?? (ri === 0 ? "center" : "left"),
              fontSize: 10,
            } satisfies PptxGenJS.TableCellProps,
          })) as PptxGenJS.TableRow,
      );
      pptSlide.addTable(tableRows, {
        x: basePos.x,
        y: basePos.y,
        w: basePos.w,
        border: {
          color: el.theme?.borderColor?.replace("#", "") ?? "D0D0D0",
          pt: 1,
        },
        colW: el.colWidths.map((pct) => (pct / 100) * pxToIn(el.width)),
      });
      break;
    }
    case "shape": {
      pptSlide.addText(el.text?.content ?? "", {
        ...basePos,
        fill: {
          color: el.fill?.replace("#", "") || "5B9BD5",
        },
        align: el.text?.align || "center",
        valign: "middle",
        fontSize: 14,
      });
      break;
    }
    case "chart": {
      const chartData = el.data.datasets.map((ds) => ({
        name: ds.label,
        labels: el.data.labels,
        values: ds.data,
      }));
      const chartTypeMap: Record<string, PptxGenJS.CHART_NAME> = {
        bar: "bar",
        column: "bar",
        line: "line",
        area: "area",
        scatter: "scatter",
        pie: "pie",
        doughnut: "doughnut",
        radar: "radar",
      } as Record<string, PptxGenJS.CHART_NAME>;
      const pptChartType = (chartTypeMap[el.chartType] ??
        "bar") as PptxGenJS.CHART_NAME;
      try {
        pptSlide.addChart(pptChartType, chartData, {
          x: basePos.x,
          y: basePos.y,
          w: basePos.w,
          h: basePos.h,
          showTitle: false,
          showLegend: true,
        });
      } catch {
        pptSlide.addText(`[Chart: ${el.chartType}]`, {
          ...basePos,
          fontSize: 12,
          color: "888888",
          align: "center",
          valign: "middle",
        });
      }
      break;
    }
    case "video": {
      pptSlide.addText(`[Video: ${el.src || "no source"}]`, {
        ...basePos,
        fontSize: 12,
        color: "888888",
        align: "center",
        valign: "middle",
        fill: { color: "F0F0F0" },
      });
      break;
    }
    case "audio": {
      pptSlide.addText(`[Audio: ${el.src || "no source"}]`, {
        ...basePos,
        fontSize: 12,
        color: "888888",
        align: "center",
        valign: "middle",
      });
      break;
    }
    case "latex": {
      pptSlide.addText(el.formula, {
        ...basePos,
        fontSize: el.fontSize ?? 24,
        fontFace: "Cambria Math",
        color: el.color?.replace("#", "") || "333333",
        align: "center",
        valign: "middle",
      });
      break;
    }
    case "line":
      break;
  }
}

export async function exportPresentationAsPPTX(
  presentation: SlidePresentation,
): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({
    name: "CUSTOM",
    width: SLIDE_WIDTH_IN,
    height: SLIDE_HEIGHT_IN,
  });
  pptx.layout = "CUSTOM";

  for (const slide of presentation.slides) {
    const pptSlide = pptx.addSlide();

    // Background
    const bg = slide.background;
    if (bg) {
      if (bg.type === "solid" && bg.color) {
        pptSlide.background = { fill: bg.color.replace("#", "") };
      } else if (bg.type === "image" && bg.imageUrl) {
        if (bg.imageUrl.startsWith("data:")) {
          pptSlide.background = { data: bg.imageUrl };
        } else {
          pptSlide.background = { path: bg.imageUrl };
        }
      }
    }

    // Elements
    for (const el of slide.elements) {
      addElementToSlide(pptSlide, el);
    }

    // Notes
    if (slide.notes) {
      pptSlide.addNotes(slide.notes);
    }
  }

  await pptx.writeFile({ fileName: "presentation.pptx" });
}
