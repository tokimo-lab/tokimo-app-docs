/**
 * Unified DocNode abstraction — a single type for folders and documents.
 *
 * Design goal: folder and document are treated as sibling node types in
 * the same tree.  This module converts the API types (DocFolderOutput,
 * DocListItem) into a flat `DocNode[]` list plus tree utilities.
 *
 * Extensible for future node types (slide, sheet, form, …).
 */

import type { DocFolderOutput, DocListItem } from "@/generated/rust-api";

// ── Node type enum ─────────────────────────────────────────────────────────

export type DocNodeType = "folder" | "document" | "slide" | "sheet" | "form";

// ── DocNode ────────────────────────────────────────────────────────────────

export interface DocNode {
  id: string;
  type: DocNodeType;
  parentId: string | null;
  title: string;
  icon: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  // Document-specific fields (undefined for folders)
  wordCount?: number;
  tags?: string[];
  isFavorite?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
}

// ── Tree node (node + resolved children) ──────────────────────────────────

export interface DocTreeNode {
  node: DocNode;
  children: DocTreeNode[];
}

// ── Converters ─────────────────────────────────────────────────────────────

export function folderToNode(f: DocFolderOutput): DocNode {
  return {
    id: f.id,
    type: "folder",
    parentId: f.parentId,
    title: f.name,
    icon: f.icon,
    sortOrder: f.sortOrder,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  };
}

export function docToNode(d: DocListItem): DocNode {
  return {
    id: d.id,
    type: "document",
    parentId: d.folderId,
    title: d.title,
    icon: d.icon,
    sortOrder: 0,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    wordCount: d.wordCount,
    tags: d.tags ?? undefined,
    isFavorite: d.isFavorite,
    isPinned: d.isPinned,
    isArchived: d.isArchived,
  };
}

export function mergeFoldersAndDocs(
  folders: DocFolderOutput[],
  docs: DocListItem[],
): DocNode[] {
  return [...folders.map(folderToNode), ...docs.map(docToNode)];
}

// ── Tree builder ───────────────────────────────────────────────────────────

/** Sort comparator: folders first, then by sortOrder, then by title. */
function nodeCompare(a: DocNode, b: DocNode): number {
  if (a.type === "folder" && b.type !== "folder") return -1;
  if (a.type !== "folder" && b.type === "folder") return 1;
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.title.localeCompare(b.title);
}

/** Build a tree from a flat DocNode list. */
export function buildNodeTree(nodes: DocNode[]): DocTreeNode[] {
  const childMap = new Map<string | null, DocNode[]>();
  for (const n of nodes) {
    const list = childMap.get(n.parentId) ?? [];
    list.push(n);
    childMap.set(n.parentId, list);
  }

  function build(parentId: string | null): DocTreeNode[] {
    const children = childMap.get(parentId) ?? [];
    children.sort(nodeCompare);
    return children.map((node) => ({
      node,
      children: build(node.id),
    }));
  }

  return build(null);
}

/** Get children of a specific node (flat, sorted). */
export function getChildNodes(
  nodes: DocNode[],
  parentId: string | null,
): DocNode[] {
  return nodes.filter((n) => n.parentId === parentId).sort(nodeCompare);
}

/** Build ancestor chain for breadcrumb (root → … → current). */
export function getAncestorChain(
  nodes: DocNode[],
  nodeId: string | null,
): DocNode[] {
  if (!nodeId) return [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const chain: DocNode[] = [];
  let cur = byId.get(nodeId);
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain;
}

// ── Formatting helpers ─────────────────────────────────────────────────────

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = diff / 1000;
  if (sec < 60) return "刚刚";
  const min = sec / 60;
  if (min < 60) return `${Math.floor(min)} 分钟前`;
  const hr = min / 60;
  if (hr < 24) return `${Math.floor(hr)} 小时前`;
  const day = hr / 24;
  if (day < 30) return `${Math.floor(day)} 天前`;
  return new Date(iso).toLocaleDateString("zh-CN");
}

export function formatWordCount(count: number | undefined): string {
  if (!count) return "";
  if (count >= 10_000) return `${(count / 10_000).toFixed(1)} 万字`;
  return `${count} 字`;
}
