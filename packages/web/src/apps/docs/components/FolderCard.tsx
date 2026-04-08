import { Dropdown, type DropdownMenuItem } from "@tokiomo/components";
import { Folder, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { DocNode } from "../lib/doc-node";

interface FolderCardProps {
  node: DocNode;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onCreateDoc: () => void;
}

export function FolderCard({
  node,
  onOpen,
  onRename,
  onDelete,
  onCreateDoc,
}: FolderCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [localName, setLocalName] = useState(node.title);

  const menuItems: DropdownMenuItem[] = useMemo(
    () => [
      {
        key: "new-doc",
        label: "新建文档",
        icon: <Plus size={14} />,
        onClick: () => onCreateDoc(),
      },
      { key: "d1", type: "divider" as const },
      {
        key: "rename",
        label: "重命名",
        icon: <Pencil size={14} />,
        onClick: () => {
          setLocalName(node.title);
          setIsRenaming(true);
        },
      },
      { key: "d2", type: "divider" as const },
      {
        key: "delete",
        label: "删除文件夹",
        icon: <Trash2 size={14} />,
        danger: true,
        onClick: () => {
          if (
            window.confirm(
              `确定删除文件夹「${node.title}」？其中的文档将移至根目录。`,
            )
          ) {
            onDelete();
          }
        },
      },
    ],
    [node.title, onCreateDoc, onDelete],
  );

  return (
    <Dropdown
      trigger={["contextMenu"]}
      menu={{ items: menuItems }}
      placement="bottomLeft"
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: folder card */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: click container */}
      <div
        className="group flex cursor-pointer items-center gap-2 rounded-lg border border-border-subtle bg-fill-secondary px-3 py-2.5 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:hover:border-blue-700 dark:hover:bg-blue-950/30"
        onClick={isRenaming ? undefined : onOpen}
      >
        <Folder size={20} className="shrink-0 text-yellow-500" />
        {isRenaming ? (
          <input
            type="text"
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onBlur={() => {
              if (localName.trim() && localName !== node.title) {
                onRename(localName.trim());
              }
              setIsRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setIsRenaming(false);
            }}
            className="min-w-0 flex-1 rounded border border-blue-400 bg-transparent px-1 text-sm outline-none"
            // biome-ignore lint/a11y/noAutofocus: rename input
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-sm text-fg-primary">
            {node.icon ? `${node.icon} ` : ""}
            {node.title}
          </span>
        )}
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
              className="shrink-0 rounded p-0.5 opacity-0 transition-opacity hover:bg-fill-tertiary group-hover:opacity-100"
            >
              <MoreHorizontal size={14} className="text-fg-muted" />
            </button>
          </Dropdown>
        </div>
      </div>
    </Dropdown>
  );
}
