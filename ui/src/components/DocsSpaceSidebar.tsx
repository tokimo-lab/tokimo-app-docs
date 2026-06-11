import { AppSidebar, Tooltip } from "@tokimo/ui";
import { PanelLeft, PanelLeftClose, Plus, Settings } from "lucide-react";
import { getAvatarColor, getAvatarIcon } from "@tokimo/sdk";
import { useTranslation } from "react-i18next";
import type { DocSpaceOutput } from "../api/generated";
import { AppIcon } from "./icons/AppIcon";

export default function DocsSpaceSidebar({
  spaces,
  activeId,
  onSelect,
  collapsed,
  onCreateClick,
  onSettingsClick,
  onToggleCollapse,
  settingsActive = false,
}: {
  spaces: DocSpaceOutput[];
  activeId: string | null;
  onSelect: (id: string) => void;
  collapsed?: boolean;
  onCreateClick: () => void;
  onSettingsClick: () => void;
  onToggleCollapse?: () => void;
  /** When true, the settings (⚙) button shows a highlighted state. */
  settingsActive?: boolean;
}) {
  const { t } = useTranslation();
  const sections = [
    {
      items: spaces.map((s) => ({
        key: s.id,
        icon: (
          <AppIcon
            icon={getAvatarIcon(s.avatar) || s.name}
            color={getAvatarColor(s.avatar)}
            size={24}
          />
        ),
        label: s.name,
      })),
    },
  ];

  const collapsedFooter = (
    <div className="flex flex-col items-center gap-1">
      <Tooltip title={t("spaceSidebar.newSpace")} placement="right">
        <button
          type="button"
          onClick={onCreateClick}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-fg-muted transition-all hover:bg-black/[0.08] hover:text-fg-secondary dark:hover:bg-white/[0.08]"
        >
          <Plus className="h-4 w-4" />
        </button>
      </Tooltip>
      <Tooltip title={t("spaceSidebar.settings")} placement="right">
        <button
          type="button"
          onClick={onSettingsClick}
          className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-all ${
            settingsActive
              ? "bg-black/[0.08] text-fg-primary dark:bg-white/[0.08]"
              : "text-fg-muted hover:bg-black/[0.08] hover:text-fg-secondary dark:hover:bg-white/[0.08]"
          }`}
        >
          <Settings className="h-4 w-4" />
        </button>
      </Tooltip>
      <Tooltip title={t("spaceSidebar.expand")} placement="right">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-fg-muted transition-all hover:bg-black/[0.08] hover:text-fg-secondary dark:hover:bg-white/[0.08]"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      </Tooltip>
    </div>
  );

  const fullFooter = (
    <div className="flex items-center gap-1">
      <Tooltip title={t("spaceSidebar.newSpace")}>
        <button
          type="button"
          onClick={onCreateClick}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-fg-muted transition-all hover:bg-black/[0.08] hover:text-fg-secondary dark:hover:bg-white/[0.08]"
        >
          <Plus className="h-4 w-4" />
        </button>
      </Tooltip>
      <Tooltip title={t("spaceSidebar.settings")}>
        <button
          type="button"
          onClick={onSettingsClick}
          className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-all ${
            settingsActive
              ? "bg-black/[0.08] text-fg-primary dark:bg-white/[0.08]"
              : "text-fg-muted hover:bg-black/[0.08] hover:text-fg-secondary dark:hover:bg-white/[0.08]"
          }`}
        >
          <Settings className="h-4 w-4" />
        </button>
      </Tooltip>
      <Tooltip title={t("spaceSidebar.collapse")}>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="ml-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-fg-muted transition-all hover:bg-black/[0.08] hover:text-fg-secondary dark:hover:bg-white/[0.08]"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </Tooltip>
    </div>
  );

  return (
    <AppSidebar
      sections={sections}
      activeKey={activeId ?? undefined}
      onSelect={onSelect}
      collapsed={collapsed}
      footer={collapsed ? collapsedFooter : fullFooter}
    />
  );
}
