import { cn } from "@tokimo/ui";

interface PanelTabsProps {
  tabs: Array<{ key: string; label: string }>;
  activeTab: string;
  onTabChange: (key: string) => void;
}

export function PanelTabs({ tabs, activeTab, onTabChange }: PanelTabsProps) {
  return (
    <div className="flex border-b border-border-subtle">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={cn(
            "flex flex-1 cursor-pointer items-center justify-center py-2.5 text-sm transition-colors",
            activeTab === tab.key
              ? "border-b-2 border-[var(--accent)] font-medium text-[var(--accent)]"
              : "text-fg-muted hover:text-fg-default",
          )}
          onClick={() => onTabChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
