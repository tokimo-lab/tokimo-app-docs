import { cn } from "@tokimo/ui";
import { ChevronDown, ChevronRight, Tag, X } from "lucide-react";
import { useState } from "react";

interface DocSidebarTagFilterProps {
  availableTags: string[];
  filterTags: string[];
  onToggleTag: (tag: string) => void;
  onClearTags: () => void;
}

export function DocSidebarTagFilter({
  availableTags,
  filterTags,
  onToggleTag,
  onClearTags,
}: DocSidebarTagFilterProps) {
  const [expanded, setExpanded] = useState(false);

  if (availableTags.length === 0) return null;

  return (
    <div className="px-3 pb-1">
      <button
        type="button"
        className="flex w-full items-center gap-1 rounded px-1 py-1 text-xs font-medium text-fg-muted hover:text-fg-secondary"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Tag size={12} />
        <span>标签</span>
        {filterTags.length > 0 && (
          <span className="ml-auto rounded-full bg-[var(--accent-subtle)] px-1.5 text-[10px] font-semibold text-[var(--accent)] dark:bg-[var(--accent-subtle)] dark:text-[var(--accent-text)]">
            {filterTags.length}
          </span>
        )}
      </button>

      {filterTags.length > 0 && !expanded && (
        <div className="mt-1 flex flex-wrap gap-1">
          {filterTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-0.5 rounded-full bg-[var(--accent-subtle)] px-2 py-0.5 text-[11px] text-[var(--accent)] dark:bg-[var(--accent-subtle)] dark:text-[var(--accent-text)]"
            >
              {tag}
              <button
                type="button"
                className="ml-0.5 rounded-full p-0.5 hover:bg-[var(--accent-subtle)] dark:hover:bg-[var(--accent-subtle-hover)]"
                onClick={() => onToggleTag(tag)}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {expanded && (
        <div className="mt-1 flex flex-wrap gap-1">
          {availableTags.map((tag) => {
            const isActive = filterTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] transition-colors",
                  isActive
                    ? "bg-[var(--accent-subtle)] text-[var(--accent)] dark:bg-[var(--accent-subtle)] dark:text-[var(--accent-text)]"
                    : "bg-fill-tertiary text-fg-muted hover:bg-fill-secondary",
                )}
                onClick={() => onToggleTag(tag)}
              >
                {tag}
              </button>
            );
          })}
          {filterTags.length > 0 && (
            <button
              type="button"
              className="rounded-full px-2 py-0.5 text-[11px] text-fg-muted hover:text-fg-secondary"
              onClick={onClearTags}
            >
              清除
            </button>
          )}
        </div>
      )}
    </div>
  );
}
