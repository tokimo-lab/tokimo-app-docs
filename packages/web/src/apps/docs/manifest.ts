import { FileText } from "lucide-react";
import type { AppManifest } from "../_framework/types";

export const manifest: AppManifest = {
  id: "docs",
  name: "TokimoDocs",
  category: "system",
  fullBleed: true,
  defaultSize: { width: 1200, height: 800 },
  icon: FileText,
  image: "/page-icons/docs.png",
  color: "#3b82f6",
  labelKey: "docs",
  order: 3,
  component: () => import("./components/DocsApp"),
  views: {
    "/": () => import("./components/DocsApp"),
  },
};
