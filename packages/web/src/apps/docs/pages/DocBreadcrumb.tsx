import { Folder } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { untitledI18nKey } from "@/apps/docs/lib/doc-node";
import type { DocNodeListItem, DocNodeOutput } from "@/generated/rust-api";

export function DocBreadcrumb({
  doc,
  allNodes,
  onNavigateFolder,
}: {
  doc: DocNodeOutput;
  allNodes: DocNodeListItem[];
  onNavigateFolder?: (folderId: string | null) => void;
}) {
  const { t } = useTranslation();
  const path = useMemo(() => {
    if (!doc.parentId) return [];
    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
    const result: DocNodeListItem[] = [];
    let current = nodeMap.get(doc.parentId);
    while (current) {
      result.unshift(current);
      current = current.parentId ? nodeMap.get(current.parentId) : undefined;
    }
    return result;
  }, [doc.parentId, allNodes]);

  return (
    <div className="flex items-center gap-1 text-xs text-fg-muted">
      <Folder size={12} />
      <button
        type="button"
        className="hover:text-fg-secondary cursor-pointer"
        onClick={() => onNavigateFolder?.(null)}
      >
        文档
      </button>
      {path.map((node) => (
        <span key={node.id} className="flex items-center gap-1">
          <span className="text-fg-muted">/</span>
          <button
            type="button"
            className="hover:text-fg-secondary cursor-pointer"
            onClick={() => onNavigateFolder?.(node.id)}
          >
            {node.icon ? `${node.icon} ` : ""}
            {node.title}
          </button>
        </span>
      ))}
      <span className="text-fg-muted">/</span>
      <span className="text-fg-secondary">
        {doc.icon ? `${doc.icon} ` : ""}
        {doc.title || t(untitledI18nKey(doc.type))}
      </span>
    </div>
  );
}
