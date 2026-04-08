import { Spin } from "@tokiomo/components";
import { FileText, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/generated/rust-api";
import { useContainerWidth } from "@/shared/hooks/use-container-width";
import DocsAppPage from "../pages/DocsAppPage";
import DocsSettingsModal from "./DocsSettingsModal";
import DocsSpaceSidebar from "./DocsSpaceSidebar";

const STORAGE_KEY = "docs-active-space";

export default function DocsApp() {
  const { data: spaces, isLoading } = api.docs.listSpaces.useQuery({});
  const [containerRef, containerWidth] = useContainerWidth();
  const sidebarCollapsed = containerWidth > 0 && containerWidth < 720;
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (!spaces?.length || initialized.current) return;
    initialized.current = true;
    const saved = localStorage.getItem(STORAGE_KEY);
    const id =
      saved && spaces.some((s) => s.id === saved) ? saved : spaces[0].id;
    setActiveSpaceId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, [spaces]);

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
      <>
        <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
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
            onClick={() => setSettingsOpen(true)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            新建文档空间
          </button>
        </div>
        <DocsSettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className="grid h-full"
        style={{ gridTemplateColumns: `${sidebarCollapsed ? 48 : 200}px 1fr` }}
      >
        <DocsSpaceSidebar
          spaces={spaces}
          activeId={activeSpaceId}
          onSelect={handleSelectSpace}
          collapsed={sidebarCollapsed}
          onCreateClick={() => setSettingsOpen(true)}
          onSettingsClick={() => setSettingsOpen(true)}
        />
        <div className="min-w-0 flex-1 overflow-hidden">
          {activeSpaceId && <DocsAppPage spaceId={activeSpaceId} />}
        </div>
      </div>
      <DocsSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
