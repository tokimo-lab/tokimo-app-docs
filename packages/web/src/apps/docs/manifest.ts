import { FileText } from "lucide-react";
import type { AppManifest } from "../_framework/types";

export const manifest: AppManifest = {
  id: "docs",
  category: "system",
  fullBleed: true,
  defaultSize: { width: 1200, height: 800 },
  icon: FileText,
  image: "/page-icons/docs.png",
  color: "#3b82f6",
  appName: "dashboard.menu.docs",
  order: 3,
  component: () => import("./components/DocsApp"),
  views: {
    "/": () => import("./components/DocsApp"),
    "/space/:spaceId": () => import("./components/DocsApp"),
    "/space/:spaceId/node/:encodedRelPath": () =>
      import("./components/DocsApp"),
  },

  userSettings: {
    order: 14,
    sections: [
      {
        key: "sidebar",
        label: "settings.sidebar.title",
        fields: [
          {
            key: "sidebarCollapsed",
            type: "boolean",
            label: "settings.sidebar.defaultCollapsed",
            defaultValue: false,
          },
        ],
      },
    ],
  },
};
