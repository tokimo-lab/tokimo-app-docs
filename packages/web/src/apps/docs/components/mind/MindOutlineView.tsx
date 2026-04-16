/**
 * Outline view — renders MindElixirData as an editable hierarchical bullet list.
 *
 * Keyboard shortcuts:
 *  - Enter: create new sibling node
 *  - Tab: indent node (become child of previous sibling)
 *  - Shift+Tab: outdent node (become sibling of parent)
 *  - Backspace on empty: delete node
 *  - Click disclosure triangle: expand/collapse children
 */

import { ChevronRight } from "lucide-react";
import type { MindElixirData, NodeObj } from "mind-elixir";
import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

// ── Helpers ─────────────────────────────────────────────────────────────────

function generateNodeId(): string {
  return crypto.randomUUID().substring(0, 16);
}

/** Deep-clone a NodeObj tree (structuredClone works for plain data). */
function cloneNodeData(node: NodeObj): NodeObj {
  return structuredClone(node);
}

// ── Props ───────────────────────────────────────────────────────────────────

interface MindOutlineViewProps {
  data: MindElixirData;
  onChange: (data: MindElixirData) => void;
  isDark: boolean;
}

// ── Main component ──────────────────────────────────────────────────────────

export function MindOutlineView({
  data,
  onChange,
  isDark,
}: MindOutlineViewProps) {
  const [nodeData, setNodeData] = useState<NodeObj>(() =>
    cloneNodeData(data.nodeData),
  );
  const dataRef = useRef(data);
  dataRef.current = data;

  // Sync external data changes
  useEffect(() => {
    setNodeData(cloneNodeData(data.nodeData));
  }, [data]);

  const emitChange = useCallback(
    (updated: NodeObj) => {
      const { nodeData: _, theme: _t, ...rest } = dataRef.current;
      onChange({ ...rest, nodeData: updated });
    },
    [onChange],
  );

  const updateAndEmit = useCallback(
    (updater: (root: NodeObj) => NodeObj) => {
      setNodeData((prev) => {
        const next = updater(cloneNodeData(prev));
        emitChange(next);
        return next;
      });
    },
    [emitChange],
  );

  /** Update a single node's topic by id. */
  const handleTopicChange = useCallback(
    (id: string, topic: string) => {
      updateAndEmit((root) => {
        updateNodeTopic(root, id, topic);
        return root;
      });
    },
    [updateAndEmit],
  );

  /** Add a sibling after the node with given id. Returns new node id. */
  const handleAddSibling = useCallback(
    (id: string): string | null => {
      let newId: string | null = null;
      updateAndEmit((root) => {
        newId = addSibling(root, id);
        return root;
      });
      return newId;
    },
    [updateAndEmit],
  );

  /** Delete a node by id (not the root). */
  const handleDelete = useCallback(
    (id: string) => {
      updateAndEmit((root) => {
        deleteNode(root, id);
        return root;
      });
    },
    [updateAndEmit],
  );

  /** Indent: make node a child of its previous sibling. */
  const handleIndent = useCallback(
    (id: string) => {
      updateAndEmit((root) => {
        indentNode(root, id);
        return root;
      });
    },
    [updateAndEmit],
  );

  /** Outdent: make node a sibling of its parent. */
  const handleOutdent = useCallback(
    (id: string) => {
      updateAndEmit((root) => {
        outdentNode(root, id);
        return root;
      });
    },
    [updateAndEmit],
  );

  /** Toggle expanded state for a node. */
  const handleToggleExpand = useCallback(
    (id: string) => {
      updateAndEmit((root) => {
        toggleExpand(root, id);
        return root;
      });
    },
    [updateAndEmit],
  );

  return (
    <div
      className={`h-full overflow-auto py-8 pr-10 pl-14 ${
        isDark ? "bg-[#1a1c1e] text-gray-200" : "bg-white text-gray-800"
      }`}
    >
      {/* Root as heading */}
      <RootHeading
        node={nodeData}
        onTopicChange={handleTopicChange}
        isDark={isDark}
      />

      {/* Children as outline list */}
      {nodeData.children && nodeData.children.length > 0 && (
        <OutlineList
          nodes={nodeData.children}
          onTopicChange={handleTopicChange}
          onAddSibling={handleAddSibling}
          onDelete={handleDelete}
          onIndent={handleIndent}
          onOutdent={handleOutdent}
          onToggleExpand={handleToggleExpand}
          isDark={isDark}
          depth={0}
        />
      )}
    </div>
  );
}

// ── Root heading ────────────────────────────────────────────────────────────

function RootHeading({
  node,
  onTopicChange,
  isDark,
}: {
  node: NodeObj;
  onTopicChange: (id: string, topic: string) => void;
  isDark: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleBlur = () => {
    const text = ref.current?.textContent ?? "";
    if (text !== node.topic) {
      onTopicChange(node.id, text);
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: contentEditable div is inherently interactive
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={`mb-6 text-2xl font-bold outline-none ${
        isDark
          ? "text-white caret-[var(--accent)]"
          : "text-gray-900 caret-[var(--accent)]"
      }`}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleBlur();
        }
      }}
    >
      {node.topic}
    </div>
  );
}

// ── Outline list (recursive) ────────────────────────────────────────────────

function OutlineList({
  nodes,
  onTopicChange,
  onAddSibling,
  onDelete,
  onIndent,
  onOutdent,
  onToggleExpand,
  isDark,
  depth,
}: {
  nodes: NodeObj[];
  onTopicChange: (id: string, topic: string) => void;
  onAddSibling: (id: string) => string | null;
  onDelete: (id: string) => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
  onToggleExpand: (id: string) => void;
  isDark: boolean;
  depth: number;
}) {
  return (
    <ul className="list-none" style={{ paddingLeft: depth > 0 ? 24 : 0 }}>
      {nodes.map((node) => (
        <OutlineItem
          key={node.id}
          node={node}
          onTopicChange={onTopicChange}
          onAddSibling={onAddSibling}
          onDelete={onDelete}
          onIndent={onIndent}
          onOutdent={onOutdent}
          onToggleExpand={onToggleExpand}
          isDark={isDark}
          depth={depth}
        />
      ))}
    </ul>
  );
}

// ── Single outline item ─────────────────────────────────────────────────────

/** Ref map so we can focus newly-created nodes. */
const nodeRefMap = new Map<string, RefObject<HTMLDivElement | null>>();

function OutlineItem({
  node,
  onTopicChange,
  onAddSibling,
  onDelete,
  onIndent,
  onOutdent,
  onToggleExpand,
  isDark,
  depth,
}: {
  node: NodeObj;
  onTopicChange: (id: string, topic: string) => void;
  onAddSibling: (id: string) => string | null;
  onDelete: (id: string) => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
  onToggleExpand: (id: string) => void;
  isDark: boolean;
  depth: number;
}) {
  const editRef = useRef<HTMLDivElement>(null);
  nodeRefMap.set(node.id, editRef);

  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = node.expanded !== false; // default expanded

  // Focus newly created nodes
  useEffect(() => {
    return () => {
      nodeRefMap.delete(node.id);
    };
  }, [node.id]);

  const commitText = () => {
    const text = editRef.current?.textContent ?? "";
    if (text !== node.topic) {
      onTopicChange(node.id, text);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitText();
      const newId = onAddSibling(node.id);
      if (newId) {
        requestAnimationFrame(() => {
          const ref = nodeRefMap.get(newId);
          ref?.current?.focus();
        });
      }
    } else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      commitText();
      onIndent(node.id);
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      commitText();
      onOutdent(node.id);
    } else if (e.key === "Backspace") {
      const text = editRef.current?.textContent ?? "";
      if (text === "") {
        e.preventDefault();
        onDelete(node.id);
      }
    }
  };

  return (
    <li className="my-0.5">
      <div className="group flex items-start gap-1">
        {/* Disclosure triangle */}
        <button
          type="button"
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors ${
            hasChildren
              ? "cursor-pointer text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              : "cursor-default text-transparent"
          }`}
          onClick={() => hasChildren && onToggleExpand(node.id)}
          tabIndex={-1}
        >
          <ChevronRight
            size={14}
            className={`transition-transform ${isExpanded && hasChildren ? "rotate-90" : ""}`}
          />
        </button>

        {/* Bullet */}
        <span
          className={`mt-2 mr-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
            isDark ? "bg-gray-500" : "bg-gray-400"
          }`}
        />

        {/* biome-ignore lint/a11y/noStaticElementInteractions: contentEditable div is inherently interactive */}
        <div
          ref={editRef}
          contentEditable
          suppressContentEditableWarning
          className={`min-w-[40px] flex-1 rounded px-1 py-0.5 text-sm leading-6 outline-none transition-colors ${
            isDark
              ? "text-gray-200 caret-[var(--accent)] hover:bg-white/5 focus:bg-white/5"
              : "text-gray-800 caret-[var(--accent)] hover:bg-gray-50 focus:bg-[var(--accent-subtle)]/50"
          }`}
          onBlur={commitText}
          onKeyDown={handleKeyDown}
        >
          {node.topic}
        </div>
      </div>

      {/* Nested children */}
      {hasChildren && isExpanded && (
        <OutlineList
          nodes={node.children!}
          onTopicChange={onTopicChange}
          onAddSibling={onAddSibling}
          onDelete={onDelete}
          onIndent={onIndent}
          onOutdent={onOutdent}
          onToggleExpand={onToggleExpand}
          isDark={isDark}
          depth={depth + 1}
        />
      )}
    </li>
  );
}

// ── Tree mutation helpers ───────────────────────────────────────────────────

function updateNodeTopic(root: NodeObj, id: string, topic: string): boolean {
  if (root.id === id) {
    root.topic = topic;
    return true;
  }
  for (const child of root.children ?? []) {
    if (updateNodeTopic(child, id, topic)) return true;
  }
  return false;
}

function findParentAndIndex(
  root: NodeObj,
  id: string,
  _parent: NodeObj | null = null,
): { parent: NodeObj; index: number } | null {
  if (root.children) {
    for (let i = 0; i < root.children.length; i++) {
      if (root.children[i].id === id) {
        return { parent: root, index: i };
      }
      const result = findParentAndIndex(root.children[i], id, root.children[i]);
      if (result) return result;
    }
  }
  return null;
}

function addSibling(root: NodeObj, afterId: string): string | null {
  const loc = findParentAndIndex(root, afterId);
  if (!loc) return null;
  const newNode: NodeObj = { id: generateNodeId(), topic: "" };
  loc.parent.children!.splice(loc.index + 1, 0, newNode);
  return newNode.id;
}

function deleteNode(root: NodeObj, id: string): boolean {
  const loc = findParentAndIndex(root, id);
  if (!loc) return false;
  loc.parent.children!.splice(loc.index, 1);
  return true;
}

function indentNode(root: NodeObj, id: string): boolean {
  const loc = findParentAndIndex(root, id);
  if (!loc || loc.index === 0) return false;
  const node = loc.parent.children![loc.index];
  const prevSibling = loc.parent.children![loc.index - 1];
  loc.parent.children!.splice(loc.index, 1);
  if (!prevSibling.children) prevSibling.children = [];
  prevSibling.children.push(node);
  prevSibling.expanded = true;
  return true;
}

function outdentNode(root: NodeObj, id: string): boolean {
  const loc = findParentAndIndex(root, id);
  if (!loc) return false;
  const grandparentLoc = findParentAndIndex(root, loc.parent.id);
  if (!grandparentLoc) return false; // parent is root, can't outdent further
  const node = loc.parent.children![loc.index];
  loc.parent.children!.splice(loc.index, 1);
  grandparentLoc.parent.children!.splice(grandparentLoc.index + 1, 0, node);
  return true;
}

function toggleExpand(root: NodeObj, id: string): boolean {
  if (root.id === id) {
    root.expanded = root.expanded === false;
    return true;
  }
  for (const child of root.children ?? []) {
    if (toggleExpand(child, id)) return true;
  }
  return false;
}
