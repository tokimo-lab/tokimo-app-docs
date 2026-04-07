import type { AppManifest } from "../_framework/types";

export const manifest: AppManifest = {
  id: "docs",
  name: "文档",
  category: "page",
  supportedTypes: ["docs"],
  fullBleed: true,
  defaultSize: { width: 1200, height: 800 },
  component: () => import("./pages/DocsAppPage"),
};
