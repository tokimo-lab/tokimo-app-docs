import { FileText } from "lucide-react";
import type { AppManifest } from "@tokimo/sdk";

export const manifest: AppManifest = {
  id: "docs",
  category: "app",
  fullBleed: true,
  defaultSize: { width: 1200, height: 800 },
  icon: FileText,
  image: "/page-icons/docs.png",
  color: "#3b82f6",
  appName: "Docs",
  order: 3,
  component: () => import("./components/DocsApp"),
  views: {
    "/": () => import("./components/DocsApp"),
    "/space/:spaceId": () => import("./components/DocsApp"),
    "/space/:spaceId/node/:encodedRelPath": () =>
      import("./components/DocsApp"),
  },
};
