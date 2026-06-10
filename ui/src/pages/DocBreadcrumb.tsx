import { Folder } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { untitledI18nKey } from "@/apps/docs/lib/doc-node";
import type { DocNodeListItem } from "@/generated/rust-api";
import type { DocNodeDetail } from "./useDocsPage";

export function DocBreadcrumb({
  doc,
  allNodes,
  onNavigateFolder,
}: {
  doc: DocNodeDetail;
  allNodes: DocNodeListItem[];
  onNavigateFolder?: (folderId: string | null) => void;
}) {
  const { t } = useTranslation();

  const crumbs = useMemo(() => {
    const segments = doc.relPath.split("/").filter(Boolean);
    if (segments.length <= 1) return [];

    const ancestorPaths = segments.slice(0, -1).map((_, i) => {
      const relPath = segments.slice(0, i + 1).join("/");
      return relPath;
    });

    const nodeByPath = new Map(allNodes.map((n) => [n.relPath, n]));
    return ancestorPaths.map((relPath) => {
      const node = nodeByPath.get(relPath);
      const segment = relPath.split("/").pop() ?? relPath;
      return {
        relPath,
        title: node?.title ?? segment,
        icon: node?.icon ?? null,
      };
    });
  }, [doc.relPath, allNodes]);

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
      {crumbs.map((crumb) => (
        <span key={crumb.relPath} className="flex items-center gap-1">
          <span className="text-fg-muted">/</span>
          <button
            type="button"
            className="hover:text-fg-secondary cursor-pointer"
            onClick={() => onNavigateFolder?.(crumb.relPath)}
          >
            {crumb.icon ? `${crumb.icon} ` : ""}
            {crumb.title}
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
