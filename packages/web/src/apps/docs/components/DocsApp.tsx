import { Empty, Spin } from "@tokiomo/components";
import { useEffect, useRef, useState } from "react";
import { api } from "@/generated/rust-api";
import { useContainerWidth } from "@/shared/hooks/use-container-width";
import DocsAppPage from "../pages/DocsAppPage";
import DocsSpaceSidebar from "./DocsSpaceSidebar";

const STORAGE_KEY = "docs-active-space";

export default function DocsApp() {
  const { data: spaces, isLoading } = api.docs.listSpaces.useQuery({});
  const [containerRef, containerWidth] = useContainerWidth();
  const sidebarCollapsed = containerWidth > 0 && containerWidth < 720;
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
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
      <div className="flex h-full items-center justify-center">
        <Empty description="还没有文档空间，请在系统设置中添加" />
      </div>
    );
  }

  return (
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
      />
      <div className="min-w-0 flex-1 overflow-hidden">
        {activeSpaceId && <DocsAppPage spaceId={activeSpaceId} />}
      </div>
    </div>
  );
}
