import { AppSetupGuide, Spin } from "@tokimo/ui";
import { GitBranch, Plus, Share2, Table } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/generated/rust-api";
import type { DocSpaceOutput } from "@/generated/rust-types/DocSpaceOutput";
import { useContainerWidth } from "@/shared/hooks/use-container-width";
import { useSidebarCollapsed } from "@/shared/hooks/use-sidebar-collapsed";
import { useWindowActions, useWindowId, useWindowNav } from "@/system";
import { PickCancelled, pickWithBridge } from "@/system/window-bridge";
import DocsAppPage from "../pages/DocsAppPage";
import DocsSpaceSidebar from "./DocsSpaceSidebar";

export default function DocsApp() {
  const { t } = useTranslation();
  const { data: spaces, isLoading } = api.docs.listSpaces.useQuery({});
  const { params, replace, updateTitle } = useWindowNav();
  const activeSpaceId = params.spaceId ?? null;
  const [containerRef, containerWidth] = useContainerWidth();
  const { collapsed: sidebarCollapsed, onToggleCollapse } = useSidebarCollapsed(
    "docs",
    containerWidth > 0 && containerWidth < 720,
  );

  const windowId = useWindowId();
  const { openModalWindow } = useWindowActions();

  const openEditorModal = useCallback(
    async (opts: { spaceId?: string } = {}) => {
      const isEdit = !!opts.spaceId;
      try {
        const created = await pickWithBridge<{ id: string }>(openModalWindow, {
          component: () => import("@/apps/settings/admin/DocSpaceEditorWindow"),
          parentWindowId: windowId,
          title: isEdit ? "TokimoDocs · 设置" : "TokimoDocs · 新建文档空间",
          width: 720,
          height: 640,
          noResize: true,
          noMinimize: true,
          metadata: isEdit
            ? ({ spaceId: opts.spaceId } as Record<string, unknown>)
            : undefined,
        });
        if (!isEdit) {
          replace(`/space/${created.id}`);
        }
      } catch (err) {
        if (err instanceof PickCancelled) return;
        throw err;
      }
    },
    [openModalWindow, windowId, replace],
  );

  // Default to first space when no spaceId in route, or stale spaceId
  useEffect(() => {
    if (!spaces?.length) return;
    if (!activeSpaceId || !spaces.some((s) => s.id === activeSpaceId)) {
      replace(`/space/${spaces[0].id}`);
    }
  }, [spaces, activeSpaceId, replace]);

  const activeSpace = spaces?.find((s) => s.id === activeSpaceId);

  useEffect(() => {
    if (activeSpace) {
      updateTitle(`TokimoDocs · ${activeSpace.name}`);
    }
  }, [activeSpace, updateTitle]);

  const handleSelectSpace = (id: string) => {
    replace(`/space/${id}`);
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
      <AppSetupGuide
        imageSrc="/page-icons/docs.png"
        accentColor="purple"
        title={t("common.setupGuide.getStarted", { name: "TokimoDocs" })}
        description={t("common.setupGuide.docsTagline")}
        features={(
          t("common.setupGuide.docsFeatures", {
            returnObjects: true,
          }) as string[]
        ).map((label, i) => ({
          icon: [Table, Share2, GitBranch][i],
          label,
        }))}
        actionLabel={t("common.setupGuide.docsAction")}
        actionIcon={Plus}
        onAction={() => {
          void openEditorModal();
        }}
        buttonClassName="bg-[var(--accent)] hover:bg-[var(--accent-hover)]"
      />
    );
  }

  return (
    <div ref={containerRef} className="relative flex h-full">
      <DocsSpaceSidebar
        spaces={spaces as DocSpaceOutput[]}
        activeId={activeSpaceId}
        onSelect={handleSelectSpace}
        collapsed={sidebarCollapsed}
        onCreateClick={() => {
          void openEditorModal();
        }}
        onSettingsClick={() => {
          if (activeSpaceId) {
            void openEditorModal({ spaceId: activeSpaceId });
          }
        }}
        onToggleCollapse={onToggleCollapse}
      />
      <div className="relative flex-1 min-w-0 overflow-hidden h-full">
        {activeSpaceId && <DocsAppPage spaceId={activeSpaceId} />}
      </div>
    </div>
  );
}
