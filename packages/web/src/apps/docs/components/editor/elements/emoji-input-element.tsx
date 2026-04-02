/**
 * EmojiInputElement — combobox-triggered emoji picker.
 *
 * When user types `:`, this inline element appears and shows a dropdown
 * of matching emojis. Selecting one inserts the emoji character.
 */
import emojiData from "@emoji-mart/data";
import type { PlateElementProps } from "platejs/react";
import { PlateElement, useEditorRef, useElement } from "platejs/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface EmojiItem {
  id: string;
  name: string;
  skins: Array<{ native: string }>;
  keywords?: string[];
}

const ALL_EMOJIS: EmojiItem[] = Object.values(
  (emojiData as Record<string, unknown>).emojis as Record<string, EmojiItem>,
);

function filterEmojis(query: string): EmojiItem[] {
  if (!query) return ALL_EMOJIS.slice(0, 30);
  const lower = query.toLowerCase();
  return ALL_EMOJIS.filter(
    (e) =>
      e.id.includes(lower) ||
      e.name.toLowerCase().includes(lower) ||
      e.keywords?.some((k) => k.includes(lower)),
  ).slice(0, 30);
}

export function EmojiInputElement(props: PlateElementProps) {
  const editor = useEditorRef();
  const element = useElement();
  const inputRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = useMemo(() => filterEmojis(query), [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on query
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const removeInput = useCallback(() => {
    const path = editor.api.findPath(element);
    if (path) editor.tf.removeNodes({ at: path });
  }, [editor, element]);

  const insertEmoji = useCallback(
    (emoji: EmojiItem) => {
      const native = emoji.skins?.[0]?.native;
      if (!native) return;
      const path = editor.api.findPath(element);
      if (path) {
        editor.tf.removeNodes({ at: path });
        editor.tf.insertText(native);
      }
    },
    [editor, element],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % Math.max(1, filtered.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (i) => (i - 1 + filtered.length) % Math.max(1, filtered.length),
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) insertEmoji(filtered[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        removeInput();
      } else if (e.key === "Backspace" && query === "") {
        e.preventDefault();
        removeInput();
      }
    },
    [filtered, selectedIndex, insertEmoji, removeInput, query],
  );

  const handleInput = useCallback(() => {
    setQuery(inputRef.current?.textContent ?? "");
  }, []);

  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.left });
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on selection change
  useEffect(() => {
    const selected = menuRef.current?.querySelector("[data-selected='true']");
    if (selected) selected.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <PlateElement {...props} as="span" className="inline">
      <span className="text-fg-muted">:</span>
      <span
        ref={inputRef}
        role="combobox"
        aria-expanded
        aria-haspopup="listbox"
        tabIndex={0}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        className="inline text-fg-muted outline-none dark:text-zinc-400"
        data-slate-editor={false}
      />
      {props.children}
      {menuPos &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] w-72 overflow-y-auto rounded-lg border border-border-base bg-surface-elevated py-1 shadow-xl "
            style={{ top: menuPos.top, left: menuPos.left, maxHeight: 280 }}
          >
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-center text-sm text-fg-muted">
                没有匹配的表情
              </div>
            ) : (
              <div className="grid grid-cols-8 gap-0.5 p-2">
                {filtered.map((emoji, idx) => (
                  <button
                    key={emoji.id}
                    type="button"
                    data-selected={idx === selectedIndex}
                    title={emoji.name}
                    className={`flex size-8 items-center justify-center rounded text-xl transition-colors ${
                      idx === selectedIndex
                        ? "bg-blue-100 dark:bg-blue-900/40"
                        : "hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertEmoji(emoji);
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    {emoji.skins?.[0]?.native}
                  </button>
                ))}
              </div>
            )}
            {query && filtered.length > 0 && (
              <div className="border-t border-border-base px-3 py-1.5 text-xs text-fg-muted">
                {filtered[selectedIndex]?.name}
              </div>
            )}
          </div>,
          document.body,
        )}
    </PlateElement>
  );
}
