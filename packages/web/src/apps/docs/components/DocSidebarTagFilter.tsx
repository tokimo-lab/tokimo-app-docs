import { cn } from "@tokiomo/components";
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
          <span className="ml-auto rounded-full bg-blue-100 px-1.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            {filterTags.length}
          </span>
        )}
      </button>

      {filterTags.length > 0 && !expanded && (
        <div className="mt-1 flex flex-wrap gap-1">
          {filterTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            >
              {tag}
              <button
                type="button"
                className="ml-0.5 rounded-full p-0.5 hover:bg-blue-100 dark:hover:bg-blue-800/50"
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
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
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
