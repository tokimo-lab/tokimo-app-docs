import { cn, Dropdown, type DropdownMenuItem } from "@tokimo/ui";
import {
  Copy,
  Folder,
  Heart,
  MoreHorizontal,
  MoveRight,
  Star,
  Trash2,
} from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDateFormat } from "@tokimo/ui";
import type { DocNode } from "../lib/doc-node";
import { untitledI18nKey } from "../lib/doc-node";
import { DocNodeIcon } from "./DocNodeIcon";

function formatWordCount(count: number): string {
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万字`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k字`;
  return `${count} 字`;
}

interface DocRowProps {
  node: DocNode;
  allFolders: DocNode[];
  onClick: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  onMove: (folderId: string | null) => void;
  onCopyId: () => void;
  isTrash: boolean;
}

export function DocRow({
  node,
  allFolders,
  onClick,
  onFavorite,
  onDelete,
  onMove,
  onCopyId,
  isTrash,
}: DocRowProps) {
  const { t } = useTranslation();
  const { formatLong } = useDateFormat();
  const moveChildren: DropdownMenuItem[] = useMemo(() => {
    const items: DropdownMenuItem[] = [
      {
        key: "root",
        label: "根目录",
        icon: <Folder size={14} />,
        onClick: () => onMove(null),
      },
    ];
    for (const f of allFolders) {
      if (f.id !== node.parentId) {
        items.push({
          key: f.id,
          label: f.icon ? `${f.icon} ${f.title}` : f.title,
          icon: <Folder size={14} className="text-yellow-500" />,
          onClick: () => onMove(f.id),
        });
      }
    }
    return items;
  }, [allFolders, node.parentId, onMove]);

  const menuItems: DropdownMenuItem[] = useMemo(
    () =>
      isTrash
        ? [
            {
              key: "delete",
              label: "永久删除",
              icon: <Trash2 size={14} />,
              danger: true,
              onClick: onDelete,
            },
          ]
        : [
            {
              key: "fav",
              label: node.isFavorite ? "取消收藏" : "收藏",
              icon: <Heart size={14} />,
              onClick: onFavorite,
            },
            {
              key: "move",
              label: "移动到…",
              icon: <MoveRight size={14} />,
              children: moveChildren,
            },
            { key: "d1", type: "divider" as const },
            {
              key: "copy-id",
              label: "复制文档 ID",
              icon: <Copy size={14} />,
              onClick: onCopyId,
            },
            { key: "d2", type: "divider" as const },
            {
              key: "delete",
              label: "删除",
              icon: <Trash2 size={14} />,
              danger: true,
              onClick: onDelete,
            },
          ],
    [node.isFavorite, isTrash, moveChildren, onFavorite, onDelete, onCopyId],
  );

  const displayTitle = node.title || t(untitledI18nKey(node.type));

  return (
    <Dropdown
      trigger={["contextMenu"]}
      menu={{ items: menuItems }}
      placement="bottomLeft"
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: doc row */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: click container */}
      <div
        className="group flex cursor-pointer items-center border-b border-border-subtle py-2 transition-colors hover:bg-fill-tertiary"
        onClick={onClick}
      >
        {/* Icon + Title */}
        <div className="flex flex-1 items-center gap-2 overflow-hidden">
          <span className={cn("shrink-0", isTrash && "opacity-50 grayscale")}>
            <DocNodeIcon node={node} size={16} />
          </span>
          <span
            className={cn(
              "truncate text-sm",
              isTrash ? "text-fg-muted line-through" : "text-fg-primary",
            )}
          >
            {node.icon ? `${node.icon} ` : ""}
            {displayTitle}
          </span>
          {node.isFavorite && !isTrash && (
            <Star
              size={12}
              className="shrink-0 fill-yellow-400 text-yellow-400"
            />
          )}
        </div>
        {/* Modified */}
        <div className="w-36 text-xs text-fg-muted">
          {formatLong(node.updatedAt)}
        </div>
        {/* Word count */}
        <div className="w-24 text-xs text-fg-muted">
          {formatWordCount(node.wordCount ?? 0)}
        </div>
        {/* Actions */}
        <div className="w-10 text-right">
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: stop propagation wrapper */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: stop propagation wrapper */}
          <div onClick={(e) => e.stopPropagation()}>
            <Dropdown
              menu={{ items: menuItems }}
              trigger={["click"]}
              placement="bottomRight"
            >
              <button
                type="button"
                className="rounded p-0.5 opacity-0 transition-opacity hover:bg-fill-quaternary group-hover:opacity-100"
              >
                <MoreHorizontal size={14} className="text-fg-muted" />
              </button>
            </Dropdown>
          </div>
        </div>
      </div>
    </Dropdown>
  );
}
