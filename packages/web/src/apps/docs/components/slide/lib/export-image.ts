import { toJpeg, toPng } from "html-to-image";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "../types";

export type ImageFormat = "png" | "jpeg";

/**
 * Export a slide viewport element as a data URL image.
 * Clones the element at native 960×540 to avoid CSS scale distortion.
 */
export async function exportSlideAsImage(
  element: HTMLElement,
  format: ImageFormat = "png",
  quality = 0.95,
): Promise<string> {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.transform = "none";
  clone.style.width = `${VIEWPORT_WIDTH}px`;
  clone.style.height = `${VIEWPORT_HEIGHT}px`;
  clone.style.position = "absolute";
  clone.style.left = "-9999px";
  clone.style.top = "-9999px";
  document.body.appendChild(clone);

  try {
    const fn = format === "png" ? toPng : toJpeg;
    return await fn(clone, {
      quality,
      pixelRatio: 2,
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
    });
  } finally {
    document.body.removeChild(clone);
  }
}

/** Trigger a browser download from a data URL. */
export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

/** Export and download a single slide as an image file. */
export async function downloadSlideAsImage(
  element: HTMLElement,
  slideName: string,
  format: ImageFormat = "png",
  quality?: number,
) {
  const dataUrl = await exportSlideAsImage(element, format, quality);
  const ext = format === "png" ? "png" : "jpg";
  downloadDataUrl(dataUrl, `${slideName}.${ext}`);
}
