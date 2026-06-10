/**
 * Docs app — document editor and management for Tokimo.
 *
 * Uses @tokimo/sdk for app lifecycle, @tokimo/ui for components.
 */
import {
  type AppRuntimeCtx,
  type Dispose,
  defineApp,
  makeTranslator,
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
import DocsApp from "./components/DocsApp";
import { enUS, zhCN } from "./i18n";
import "./index.css";

function DocsWindow({ ctx }: { ctx: AppRuntimeCtx }) {
  const t = makeTranslator({ "zh-CN": zhCN, "en-US": enUS }, ctx.locale);

  return (
    <div className="flex h-full w-full text-[var(--color-fg-primary)]">
      <DocsApp t={t} ctx={ctx} />
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
  translations: { "zh-CN": zhCN, "en-US": enUS },
  mount(container, ctx): Dispose {
    const root: Root = createRoot(container);
    const locale = ctx.locale.startsWith("zh") ? uiZhCN : uiEnUS;
    root.render(
      <StrictMode>
        <ConfigProvider locale={locale}>
          <ToastProvider>
            <RuntimeProvider value={ctx}>
              <DocsWindow ctx={ctx} />
            </RuntimeProvider>
          </ToastProvider>
        </ConfigProvider>
      </StrictMode>,
    );
    return () => root.unmount();
  },
});
