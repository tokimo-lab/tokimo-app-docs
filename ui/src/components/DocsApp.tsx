import { AppSetupGuide, Spin } from "@tokimo/ui";
import {
  useRuntimeCtx,
  useWindowActions,
  useWindowNav,
} from "@tokimo/sdk";
import { FileText, GitBranch, Plus, Presentation, Share2, Table } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api/generated";
import type { DocSpaceOutput } from "../api/generated";
import { useContainerWidth } from "../hooks/use-container-width";
import { useSidebarCollapsed } from "../hooks/use-sidebar-collapsed";
import { registerBridge } from "../modal-bridge";
import DocsAppPage from "../pages/DocsAppPage";
import DocsSpaceSidebar from "./DocsSpaceSidebar";

export default function DocsApp() {
  const { t } = useTranslation();
  const { data: spaces, isLoading } = api.docs.listSpaces.useQuery({});
  const { route, replace, navigate } = useWindowNav();

  // Parse route params (e.g. /space/:spaceId)
  const params = useMemo(() => {
    const segments = route.split("/").filter(Boolean);
    const spaceIdx = segments.indexOf("space");
    return { spaceId: spaceIdx >= 0 ? segments[spaceIdx + 1] : undefined };
  }, [route]);

  const updateTitle = useCallback(
    (title: string) => navigate(route, title),
    [navigate, route],
  );

  const activeSpaceId = params.spaceId ?? null;
  const [containerRef, containerWidth] = useContainerWidth();
  const { collapsed: sidebarCollapsed, onToggleCollapse } = useSidebarCollapsed(
    "docs",
    containerWidth > 0 && containerWidth < 720,
  );

  const { openModalWindow } = useWindowActions();
  const ctx = useRuntimeCtx();

  const openEditorModal = useCallback(
    (opts: { spaceId?: string } = {}) => {
      const isEdit = !!opts.spaceId;
      const bridgeId = registerBridge({
        kind: "space-editor",
        ctx,
        onSaved: (id: string) => {
          if (!isEdit) {
            replace(`/space/${id}`);
          }
        },
      });
      openModalWindow({
        component: () => import("./DocSpaceEditorWindow"),
        title: isEdit ? "TokimoDocs · 设置" : "TokimoDocs · 新建文档空间",
        width: 720,
        height: 640,
        metadata: {
          bridgeId,
          ...(isEdit ? { spaceId: opts.spaceId } : {}),
        } as Record<string, unknown>,
      });
    },
    [ctx, openModalWindow, replace],
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
          icon: [FileText, Table, Presentation, GitBranch][i],
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
