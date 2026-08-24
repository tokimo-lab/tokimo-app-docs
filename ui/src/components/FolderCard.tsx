import { Dropdown, type DropdownMenuItem, useConfirm } from "@tokimo/ui";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DocNode } from "../lib/doc-node";
import { DocNodeIcon } from "./DocNodeIcon";

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
  const [confirmHolder, confirm] = useConfirm();
  const { t } = useTranslation();

  const menuItems: DropdownMenuItem[] = useMemo(
    () => [
      {
        key: "new-doc",
        label: t("folder.newDocument"),
        icon: <Plus size={14} />,
        onClick: () => onCreateDoc(),
      },
      { key: "d1", type: "divider" as const },
      {
        key: "rename",
        label: t("folder.rename"),
        icon: <Pencil size={14} />,
        onClick: () => {
          setLocalName(node.title);
          setIsRenaming(true);
        },
      },
      { key: "d2", type: "divider" as const },
      {
        key: "delete",
        label: t("folder.delete"),
        icon: <Trash2 size={14} />,
        danger: true,
        onClick: () => {
          confirm({
            title: t("confirm.archiveTitle"),
            content: t("confirm.archiveFolderContent"),
            okText: t("nodes.archive"),
            cancelText: t("common.cancel"),
            variant: "warning",
            onOk: onDelete,
          });
        },
      },
    ],
    [confirm, node.title, onCreateDoc, onDelete, t],
  );

  return (
    <>
      {confirmHolder}
      <Dropdown
        trigger={["contextMenu"]}
        menu={{ items: menuItems }}
        placement="bottomLeft"
      >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: folder card */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: click container */}
      <div
        className="group flex cursor-pointer items-center gap-2 rounded-lg border border-border-subtle bg-fill-secondary px-3 py-2.5 transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-subtle)] dark:hover:bg-[var(--accent-subtle)]"
        onClick={isRenaming ? undefined : onOpen}
      >
        <DocNodeIcon node={node} size={20} />
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
              if (e.key === "Enter" && !e.nativeEvent.isComposing)
                (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setIsRenaming(false);
            }}
            className="min-w-0 flex-1 rounded border border-[var(--accent)] bg-transparent px-1 text-sm outline-none"
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
    </>
  );
}
