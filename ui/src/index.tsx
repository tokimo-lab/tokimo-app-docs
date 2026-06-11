/**
 * Docs app — document editor and management for Tokimo.
 *
 * Uses @tokimo/sdk for app lifecycle, @tokimo/ui for components.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  type AppRuntimeCtx,
  type Dispose,
  defineApp,
  RuntimeProvider,
} from "@tokimo/sdk";
import {
  ConfigProvider,
  ToastProvider,
  enUS as uiEnUS,
  zhCN as uiZhCN,
} from "@tokimo/ui";
import { FileText } from "lucide-react";
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import DocsApp from "./components/DocsApp";
import i18n from "./i18n";
import "./index.css";

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function DocsWindow({ ctx }: { ctx: AppRuntimeCtx }) {
  // Sync i18next language with shell locale
  const lang = ctx.locale.startsWith("zh") ? "zh-CN" : "en-US";
  if (i18n.language !== lang) {
    void i18n.changeLanguage(lang);
  }

  return (
    <div className="flex h-full w-full text-[var(--color-fg-primary)]">
      <DocsApp />
    </div>
  );
}

export default defineApp({
  id: "docs",
  manifest: {
    id: "docs",
    appName: "Docs",
    icon: "FileText",
    image: "icon.png",
    color: "#3b82f6",
    windowType: "docs",
    defaultSize: { width: 1200, height: 800 },
    category: "app",
  },
  mount(container, ctx): Dispose {
    const root: Root = createRoot(container);
    const locale = ctx.locale.startsWith("zh") ? uiZhCN : uiEnUS;

    // Sync i18next language with shell locale
    const lang = ctx.locale.startsWith("zh") ? "zh-CN" : "en-US";
    if (i18n.language !== lang) {
      void i18n.changeLanguage(lang);
    }

    root.render(
      <StrictMode>
        <I18nextProvider i18n={i18n}>
          <QueryClientProvider client={queryClient}>
            <ConfigProvider locale={locale}>
              <ToastProvider>
                <RuntimeProvider value={ctx}>
                  <DocsWindow ctx={ctx} />
                </RuntimeProvider>
              </ToastProvider>
            </ConfigProvider>
          </QueryClientProvider>
        </I18nextProvider>
      </StrictMode>,
    );
    return () => root.unmount();
  },
});
