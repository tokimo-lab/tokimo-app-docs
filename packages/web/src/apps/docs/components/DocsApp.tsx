import { Spin } from "@tokimo/ui";
import { FileText, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/generated/rust-api";
import type { DocSpaceOutput } from "@/generated/rust-types/DocSpaceOutput";
import { useContainerWidth } from "@/shared/hooks/use-container-width";
import { useSidebarCollapsed } from "@/shared/hooks/use-sidebar-collapsed";
import { useWindowActions, useWindowId, useWindowNav } from "@/system";
import DocsAppPage from "../pages/DocsAppPage";
import DocsSpaceSidebar from "./DocsSpaceSidebar";

const STORAGE_KEY = "docs-active-space";

export default function DocsApp() {
  const { data: spaces, isLoading } = api.docs.listSpaces.useQuery({});
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const initialized = useRef(false);
  const { updateTitle } = useWindowNav();
  const [containerRef, containerWidth] = useContainerWidth();
  const { collapsed: sidebarCollapsed, onToggleCollapse } = useSidebarCollapsed(
    "docs",
    containerWidth > 0 && containerWidth < 720,
  );

  const windowId = useWindowId();
  const { openModalWindow } = useWindowActions();

  const openSettings = useCallback(() => {
    openModalWindow({
      component: () => import("@/apps/settings/admin/DocsSettingsPage"),
      parentWindowId: windowId,
      title: "TokimoDocs 设置",
      width: 960,
      height: 640,
      noMinimize: true,
    });
  }, [openModalWindow, windowId]);

  useEffect(() => {
    if (!spaces?.length || initialized.current) return;
    initialized.current = true;
    const saved = localStorage.getItem(STORAGE_KEY);
    const id =
      saved && spaces.some((s) => s.id === saved) ? saved : spaces[0].id;
    setActiveSpaceId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, [spaces]);

  const activeSpace = spaces?.find((s) => s.id === activeSpaceId);

  useEffect(() => {
    if (activeSpace) {
      updateTitle(`TokimoDocs · ${activeSpace.name}`);
    }
  }, [activeSpace, updateTitle]);

  const handleSelectSpace = (id: string) => {
    setActiveSpaceId(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spin />
      </div>
    );
  }

  if (!spaces?.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-subtle)] text-[var(--accent)] dark:bg-[var(--accent-subtle)] dark:text-[var(--accent)]">
          <FileText className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-fg-primary">
            开始使用 TokimoDocs
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            创建一个文档空间来组织你的笔记和文档
          </p>
        </div>
        <button
          type="button"
          onClick={openSettings}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
        >
          <Plus className="h-4 w-4" />
          新建文档空间
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="grid h-full"
      style={{ gridTemplateColumns: `${sidebarCollapsed ? 48 : 188}px 1fr` }}
    >
      <DocsSpaceSidebar
        spaces={spaces as DocSpaceOutput[]}
        activeId={activeSpaceId}
        onSelect={handleSelectSpace}
        collapsed={sidebarCollapsed}
        onCreateClick={openSettings}
        onSettingsClick={openSettings}
        onToggleCollapse={onToggleCollapse}
      />
      <div className="min-w-0 overflow-hidden h-full">
        {activeSpaceId && <DocsAppPage spaceId={activeSpaceId} />}
      </div>
    </div>
  );
}
