import { AppSidebar } from "@tokiomo/components";
import { Settings } from "lucide-react";
import type { DocSpaceOutput } from "@/generated/rust-types/DocSpaceOutput";
import { AppIcon } from "@/shared/components/icons";
import { useWindowActions } from "@/system";

export default function DocsSpaceSidebar({
  spaces,
  activeId,
  onSelect,
  collapsed,
}: {
  spaces: DocSpaceOutput[];
  activeId: string | null;
  onSelect: (id: string) => void;
  collapsed?: boolean;
}) {
  const { openWindow } = useWindowActions();

  const openSettings = () =>
    openWindow({
      type: "system",
      title: "系统设置",
      route: "/docs-settings",
      metadata: { pageId: "system-settings" },
    });

  const sections = [
    {
      items: spaces.map((s) => ({
        key: s.id,
        icon: <AppIcon icon={s.icon} color={s.color} size={20} />,
        label: s.name,
      })),
    },
  ];

  return (
    <AppSidebar
      sections={sections}
      activeKey={activeId ?? undefined}
      onSelect={onSelect}
      collapsed={collapsed}
      footer={
        <button
          type="button"
          onClick={openSettings}
          className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-fg-muted transition-colors hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
        >
          <Settings size={14} className="shrink-0 opacity-60" />
          <span>TokimoDocs 设置</span>
        </button>
      }
    />
  );
}
