import { Spin } from "@tokimo/ui";
import { FileText, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AnimatedSettingsPane } from "@/apps/_framework/AnimatedSettingsPane";
import DocSpaceEditor from "@/apps/settings/admin/DocSpaceEditor";
import { api } from "@/generated/rust-api";
import type { DocSpaceOutput } from "@/generated/rust-types/DocSpaceOutput";
import { useContainerWidth } from "@/shared/hooks/use-container-width";
import { useSidebarCollapsed } from "@/shared/hooks/use-sidebar-collapsed";
import { useWindowNav } from "@/system";
import DocsAppPage from "../pages/DocsAppPage";
import DocsSpaceSidebar from "./DocsSpaceSidebar";

type ViewMode = "docs" | "settings" | "settings-new";

export default function DocsApp() {
  const { data: spaces, isLoading } = api.docs.listSpaces.useQuery({});
  const { params, replace, updateTitle } = useWindowNav();
  const activeSpaceId = params.spaceId ?? null;
  const [mode, setMode] = useState<ViewMode>("docs");
  const [containerRef, containerWidth] = useContainerWidth();
  const { collapsed: sidebarCollapsed, onToggleCollapse } = useSidebarCollapsed(
    "docs",
    containerWidth > 0 && containerWidth < 720,
  );

  const openSettings = useCallback(() => {
    setMode("settings");
  }, []);

  const openCreate = useCallback(() => {
    setMode("settings-new");
  }, []);

  // Default to first space when no spaceId in route, or stale spaceId
  useEffect(() => {
    if (!spaces?.length) return;
    if (!activeSpaceId || !spaces.some((s) => s.id === activeSpaceId)) {
      replace(`/space/${spaces[0].id}`);
    }
  }, [spaces, activeSpaceId, replace]);

  const activeSpace = spaces?.find((s) => s.id === activeSpaceId);

  useEffect(() => {
    if (mode === "settings-new") {
      updateTitle("TokimoDocs · 新建空间");
    } else if (mode === "settings" && activeSpace) {
      updateTitle(`TokimoDocs · ${activeSpace.name} · 设置`);
    } else if (activeSpace) {
      updateTitle(`TokimoDocs · ${activeSpace.name}`);
    }
  }, [activeSpace, mode, updateTitle]);

  const handleSelectSpace = (id: string) => {
    replace(`/space/${id}`);
    setMode("docs");
  };

  const handleSaved = (savedId: string) => {
    replace(`/space/${savedId}`);
    setMode("docs");
  };

  const handleDeleted = () => {
    const remaining = (spaces ?? []).filter((s) => s.id !== activeSpaceId);
    const next = remaining[0]?.id;
    if (next) {
      replace(`/space/${next}`);
    } else {
      replace("/");
    }
    setMode("docs");
  };

  const handleCancel = () => {
    setMode("docs");
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spin />
      </div>
    );
  }

  if (!spaces?.length) {
    // Empty state: render sidebar (with + / settings buttons) + inline editor
    // when user clicks "新建文档空间", so the experience matches the populated state.
    if (mode === "settings-new") {
      return (
        <div ref={containerRef} className="relative flex h-full">
          <DocsSpaceSidebar
            spaces={[]}
            activeId={null}
            onSelect={handleSelectSpace}
            collapsed={sidebarCollapsed}
            onCreateClick={openCreate}
            onSettingsClick={openSettings}
            onToggleCollapse={onToggleCollapse}
            settingsActive
          />
          <div className="flex-1 min-w-0 overflow-hidden h-full">
            <DocSpaceEditor
              key="__new__"
              onSaved={handleSaved}
              onCancel={handleCancel}
            />
          </div>
        </div>
      );
    }
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
          onClick={openCreate}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
        >
          <Plus className="h-4 w-4" />
          新建文档空间
        </button>
      </div>
    );
  }

  const isSettingsView = mode !== "docs";

  return (
    <div ref={containerRef} className="relative flex h-full">
      <DocsSpaceSidebar
        spaces={spaces as DocSpaceOutput[]}
        activeId={activeSpaceId}
        onSelect={handleSelectSpace}
        collapsed={sidebarCollapsed}
        onCreateClick={openCreate}
        onSettingsClick={openSettings}
        onToggleCollapse={onToggleCollapse}
        settingsActive={isSettingsView}
      />
      <div className="relative flex-1 min-w-0 overflow-hidden h-full">
        {activeSpaceId && mode === "docs" && (
          <DocsAppPage spaceId={activeSpaceId} />
        )}
        <AnimatedSettingsPane open={mode === "settings-new"}>
          <DocSpaceEditor
            key="__new__"
            onSaved={handleSaved}
            onCancel={handleCancel}
          />
        </AnimatedSettingsPane>
        <AnimatedSettingsPane open={mode === "settings" && !!activeSpaceId}>
          <DocSpaceEditor
            key={activeSpaceId ?? "edit"}
            spaceId={activeSpaceId ?? undefined}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
            onCancel={handleCancel}
          />
        </AnimatedSettingsPane>
      </div>
    </div>
  );
}
