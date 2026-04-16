/**
 * DocNodeIcon — Finder-style material icons for doc nodes.
 *
 * Uses material-icon-theme (via MaterialFileIcon) for folders so that
 * well-known folder names (.github, node_modules, src, …) light up with
 * dedicated icons. For typed docs we pick a matching material SVG by type.
 */

import { memo } from "react";
import { MaterialFileIcon } from "@/shared/components/icons/MaterialFileIcon";
import type { DocNode } from "../lib/doc-node";

const DOC_TYPE_ICON: Record<string, string> = {
  markdown: "markdown",
  sheet: "table",
  base: "database",
  slide: "powerpoint",
  mind: "roadmap",
  whiteboard: "excalidraw",
  notion: "document",
};

interface DocNodeIconProps {
  node: Pick<DocNode, "type" | "title">;
  isExpanded?: boolean;
  size?: number;
}

export const DocNodeIcon = memo(function DocNodeIcon({
  node,
  size = 16,
}: DocNodeIconProps) {
  if (node.type === "folder") {
    return (
      <MaterialFileIcon name={node.title || "folder"} isDirectory size={size} />
    );
  }

  const iconName = DOC_TYPE_ICON[node.type] ?? "document";
  return (
    <img
      src={`/material-icons/${iconName}.svg`}
      alt=""
      width={size}
      height={size}
      className="shrink-0"
    />
  );
});
