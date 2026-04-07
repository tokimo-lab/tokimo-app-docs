/**
 * Unified DocNode abstraction — a single type for all node kinds
 * (folder, document, slide, sheet, form, …).
 *
 * The backend now stores everything in one `doc_nodes` table with a
 * `type` discriminator.  This module maps the API list item into local tree
 * structures.
 */

import type { DocNodeListItem } from "@/generated/rust-api";

// ── Node type enum ─────────────────────────────────────────────────────────

export type DocNodeType = "folder" | "notion" | "slide" | "sheet" | "form";

// ── DocNode (local alias with convenience fields) ───────────────────

export interface DocNode {
  id: string;
  type: DocNodeType;
  parentId: string | null;
  title: string;
  icon: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
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

// ── Converter ──────────────────────────────────────────────────────────────

/** Map an API list item to the local DocNode shape. */
export function apiNodeToLocal(n: DocNodeListItem): DocNode {
  return {
    id: n.id,
    type: n.type as DocNodeType,
    parentId: n.parentId,
    title: n.title,
    icon: n.icon,
    sortOrder: n.sortOrder,
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
    wordCount: n.wordCount,
    tags: n.tags ?? undefined,
    isFavorite: n.isFavorite,
    isPinned: n.isPinned,
    isArchived: n.isArchived,
  };
}

// ── Tree builder ───────────────────────────────────────────────────────────

/** Sort comparator: by sortOrder, then by title. */
function nodeCompare(a: DocNode, b: DocNode): number {
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

/** Returns the i18n key for a node's untitled placeholder based on its type. */
export function untitledI18nKey(type: DocNodeType | string): string {
  switch (type) {
    case "sheet":
      return "docs.untitledSheet";
    case "slide":
      return "docs.untitledSlide";
    case "form":
      return "docs.untitledForm";
    default:
      return "docs.untitledDocument";
  }
}
