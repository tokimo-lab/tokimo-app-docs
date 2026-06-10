import type { SlideElement, SlidePresentation } from "../types";

function stripHtmlTags(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent ?? "";
}

function elementToMarkdown(el: SlideElement): string {
  switch (el.type) {
    case "text": {
      const text = stripHtmlTags(el.content).trim();
      if (!text) return "";
      if (
        el.content.includes("font-size:36px") ||
        el.content.includes("font-size:28px")
      ) {
        return `## ${text}`;
      }
      if (el.content.includes("<li>")) {
        const div = document.createElement("div");
        div.innerHTML = el.content;
        const items = div.querySelectorAll("li");
        if (items.length > 0) {
          return Array.from(items)
            .map((li) => `- ${li.textContent?.trim() ?? ""}`)
            .join("\n");
        }
      }
      return text;
    }
    case "image":
      return `![Image](${el.src})`;
    case "table": {
      const { data, cols } = el;
      if (data.length === 0) return "";
      const header = data[0].map((c) => c.content || " ").join(" | ");
      const separator = Array.from({ length: cols }, () => "------").join(
        " | ",
      );
      const bodyRows = data
        .slice(1)
        .map((row) => row.map((c) => c.content || " ").join(" | "));
      return [
        `| ${header} |`,
        `| ${separator} |`,
        ...bodyRows.map((r) => `| ${r} |`),
      ].join("\n");
    }
    case "latex":
      return `$$${el.formula}$$`;
    case "chart":
      return `[Chart: ${el.chartType} - ${el.data.labels.join(", ")}]`;
    case "video":
      return `[Video: ${el.src}]`;
    case "audio":
      return `[Audio: ${el.src}]`;
    case "shape":
      return el.text?.content ? `[Shape: ${el.text.content}]` : "";
    case "line":
      return "";
    default:
      return "";
  }
}

export function exportPresentationAsMarkdown(
  presentation: SlidePresentation,
): string {
  const parts: string[] = [];

  for (let i = 0; i < presentation.slides.length; i++) {
    const slide = presentation.slides[i];
    parts.push(`# Slide ${i + 1}`);
    parts.push("");

    for (const el of slide.elements) {
      const md = elementToMarkdown(el);
      if (md) {
        parts.push(md);
        parts.push("");
      }
    }

    if (slide.notes) {
      parts.push(`> Speaker notes: ${slide.notes}`);
      parts.push("");
    }

    if (i < presentation.slides.length - 1) {
      parts.push("---");
      parts.push("");
    }
  }

  return parts.join("\n");
}

export function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
