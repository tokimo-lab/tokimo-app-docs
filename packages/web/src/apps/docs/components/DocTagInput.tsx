/**
 * DocTagInput — Tag input with autocomplete for the doc editor header.
 *
 * Shows existing tags as removable pills, with an input field that
 * autocompletes from all tags in the app (via api.docs.listTags).
 */

import { cn } from "@tokimo/ui";
import { Plus, Tag, X } from "lucide-react";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "@/generated/rust-api";

const MAX_TAG_LENGTH = 30;

interface DocTagInputProps {
  nodeId: string;
  spaceId: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}

export function DocTagInput({
  nodeId: _nodeId,
  spaceId,
  tags,
  onChange,
}: DocTagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const tagsQuery = api.docs.listTags.useQuery(
    { spaceId },
    { enabled: !!spaceId },
  );
  const allTags = tagsQuery.data ?? [];

  // Suggestions: existing tags not yet applied, filtered by input
  const suggestions = useMemo(() => {
    const lower = inputValue.trim().toLowerCase();
    if (!lower) return [];
    const current = new Set(tags.map((t) => t.toLowerCase()));
    return allTags
      .filter(
        (t) => !current.has(t.toLowerCase()) && t.toLowerCase().includes(lower),
      )
      .slice(0, 8);
  }, [inputValue, tags, allTags]);

  // Reset highlight when suggestions change
  useEffect(() => {
    setHighlightedIdx(-1);
  }, []);

  const addTag = useCallback(
    (raw: string) => {
      const tag = raw.trim().slice(0, MAX_TAG_LENGTH);
      if (!tag) return;
      if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
      onChange([...tags, tag]);
      setInputValue("");
    },
    [tags, onChange],
  );

  const removeTag = useCallback(
    (tag: string) => {
      onChange(tags.filter((t) => t !== tag));
    },
    [tags, onChange],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if ((e.key === "Enter" && !e.nativeEvent.isComposing) || e.key === ",") {
        e.preventDefault();
        if (highlightedIdx >= 0 && highlightedIdx < suggestions.length) {
          addTag(suggestions[highlightedIdx]);
        } else {
          addTag(inputValue);
        }
      } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
        removeTag(tags[tags.length - 1]);
      } else if (e.key === "Escape") {
        setIsEditing(false);
        setInputValue("");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIdx((i) => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIdx((i) => Math.max(i - 1, 0));
      }
    },
    [inputValue, tags, suggestions, highlightedIdx, addTag, removeTag],
  );

  // Close dropdown on outside click
  useEffect(() => {
    if (!isEditing) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsEditing(false);
        setInputValue("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isEditing]);

  if (!isEditing && tags.length === 0) {
    return (
      <button
        type="button"
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-fg-muted hover:bg-fill-tertiary hover:text-fg-secondary"
        onClick={() => {
          setIsEditing(true);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
      >
        <Tag size={12} />
        <span>添加标签</span>
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex flex-wrap items-center gap-1"
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-0.5 rounded-full bg-fill-tertiary px-2 py-0.5 text-xs text-fg-secondary "
        >
          {tag}
          <button
            type="button"
            className="ml-0.5 rounded-full p-0.5 text-fg-muted hover:bg-fill-tertiary hover:text-fg-secondary"
            onClick={() => removeTag(tag)}
          >
            <X size={10} />
          </button>
        </span>
      ))}

      {isEditing ? (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={MAX_TAG_LENGTH}
            placeholder="输入标签…"
            className="min-w-[80px] border-none bg-transparent py-0.5 text-xs text-fg-secondary outline-none placeholder:text-fg-muted  "
          />
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 z-50 mt-1 w-48 rounded-md border border-border-base bg-surface-elevated py-1 shadow-lg ">
              {suggestions.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-xs",
                    i === highlightedIdx
                      ? "bg-fill-tertiary text-fg-primary "
                      : "text-fg-muted hover:bg-fill-tertiary",
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addTag(s);
                  }}
                  onMouseEnter={() => setHighlightedIdx(i)}
                >
                  <Tag size={11} className="shrink-0 opacity-40" />
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="rounded p-0.5 text-fg-muted hover:bg-fill-tertiary hover:text-fg-secondary"
          onClick={() => {
            setIsEditing(true);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          title="添加标签"
        >
          <Plus size={12} />
        </button>
      )}
    </div>
  );
}
