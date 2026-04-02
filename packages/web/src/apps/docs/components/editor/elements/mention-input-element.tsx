/**
 * MentionInputElement — combobox-triggered @mention input.
 *
 * When user types `@`, this inline element appears and shows a dropdown
 * of matching users. Selecting a user replaces the input with a MentionElement.
 */
import { getMentionOnSelectItem } from "@platejs/mention";
import type { PlateElementProps } from "platejs/react";
import { PlateElement, useEditorRef, useElement } from "platejs/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MOCK_USERS = [
  { text: "Admin", key: "admin" },
  { text: "User", key: "user" },
  { text: "Guest", key: "guest" },
];

function filterUsers(query: string) {
  if (!query) return MOCK_USERS;
  const lower = query.toLowerCase();
  return MOCK_USERS.filter((u) => u.text.toLowerCase().includes(lower));
}

export function MentionInputElement(props: PlateElementProps) {
  const editor = useEditorRef();
  const element = useElement();
  const inputRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = useMemo(() => filterUsers(query), [query]);

  const onSelectItem = useMemo(() => getMentionOnSelectItem(), []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const removeInput = useCallback(() => {
    const path = editor.api.findPath(element);
    if (path) editor.tf.removeNodes({ at: path });
  }, [editor, element]);

  const selectUser = useCallback(
    (user: (typeof MOCK_USERS)[number]) => {
      onSelectItem(editor, user, query);
    },
    [editor, onSelectItem, query],
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
        if (filtered[selectedIndex]) selectUser(filtered[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        removeInput();
      } else if (e.key === "Backspace" && query === "") {
        e.preventDefault();
        removeInput();
      }
    },
    [filtered, selectedIndex, selectUser, removeInput, query],
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll into view on selection change
  useEffect(() => {
    const selected = menuRef.current?.querySelector("[data-selected='true']");
    if (selected) selected.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <PlateElement {...props} as="span" className="inline">
      <span className="text-blue-600 dark:text-blue-400">@</span>
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
        className="inline text-blue-600 outline-none dark:text-blue-400"
        data-slate-editor={false}
      />
      {props.children}
      {menuPos &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] w-56 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
            style={{ top: menuPos.top, left: menuPos.left, maxHeight: 200 }}
          >
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-center text-sm text-fg-muted">
                没有匹配的用户
              </div>
            ) : (
              filtered.map((user, idx) => (
                <button
                  key={user.key}
                  type="button"
                  data-selected={idx === selectedIndex}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
                    idx === selectedIndex
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      : "text-fg-secondary hover:bg-zinc-50  dark:hover:bg-zinc-700/50"
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectUser(user);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <span className="flex size-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700 dark:bg-blue-800 dark:text-blue-300">
                    {user.text[0]}
                  </span>
                  {user.text}
                </button>
              ))
            )}
          </div>,
          document.body,
        )}
    </PlateElement>
  );
}
