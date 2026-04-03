import type { AppManifest } from "../_framework/types";

export const manifest: AppManifest = {
  id: "docs",
  name: "Document Editor",
  category: "page",
  supportedTypes: ["document"],
  fullBleed: true,
  defaultSize: { width: 1200, height: 800 },
  component: () => import("./pages/DocAppPage"),
};
