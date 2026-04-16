import { ExternalLink, FileIcon, HardDrive } from "lucide-react";
import type { PlateElementProps } from "platejs/react";
import { PlateElement, useElement } from "platejs/react";
import { useRef } from "react";
import { rustUrl } from "@/lib/rust-api-runtime";
import { MaterialFileIcon } from "@/shared/components/icons";
import { BlockToolbar } from "../components/BlockToolbar";
import { useBlockDrag } from "../hooks/use-block-drag";

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return "";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / 1024 ** i;
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

/**
 * VfsFileElement — Displays a reference to a file in the VFS (Virtual File System).
 *
 * Stored data: {
 *   type: "vfs_file",
 *   fileSystemId: string,
 *   filePath: string,
 *   fileName: string,
 *   fileSize?: number | null,
 *   fileSystemName?: string,
 *   modifiedAt?: string | null,
 *   children: [{ text: "" }]
 * }
 */
export function VfsFileElement(props: PlateElementProps) {
  const element = useElement();
  const el = element as Record<string, unknown>;
  const fileSystemId = (el.fileSystemId as string) || "";
  const filePath = (el.filePath as string) || "";
  const fileName = (el.fileName as string) || "Unknown file";
  const fileSize = el.fileSize as number | null | undefined;
  const fileSystemName = (el.fileSystemName as string) || "";
  const modifiedAt = el.modifiedAt as string | null | undefined;

  const fileUrl =
    fileSystemId && filePath
      ? rustUrl(
          `/api/vfs/${encodeURIComponent(fileSystemId)}/read-file?path=${encodeURIComponent(filePath)}`,
        )
      : null;

  const sizeLabel = formatFileSize(fileSize);
  const dateLabel = modifiedAt ? new Date(modifiedAt).toLocaleDateString() : "";
  const containerRef = useRef<HTMLDivElement>(null);
  const { isDragging, handleDragPointerDown } = useBlockDrag(containerRef);

  return (
    <PlateElement className="my-3" {...props}>
      <div
        contentEditable={false}
        className={`group/block relative transition-opacity ${isDragging ? "opacity-50" : ""}`}
      >
        <div ref={containerRef}>
          <BlockToolbar
            isDragging={isDragging}
            onPointerDown={handleDragPointerDown}
          />
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border-base bg-surface-base px-4 py-3 transition-colors hover:border-border-hover hover:bg-fill-tertiary  ">
          {/* File icon */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fill-tertiary dark:bg-white/[0.10]">
            <MaterialFileIcon name={fileName} size={22} />
          </div>

          {/* File info */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg-primary">
              {fileName}
            </p>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-fg-muted">
              {fileSystemName && (
                <span className="flex items-center gap-1">
                  <HardDrive size={10} />
                  {fileSystemName}
                </span>
              )}
              {sizeLabel && <span>{sizeLabel}</span>}
              {dateLabel && <span>{dateLabel}</span>}
            </div>
          </div>

          {/* Open link */}
          {fileUrl && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md opacity-0 transition-opacity hover:bg-fill-tertiary group-hover/block:opacity-100 "
              title="Open file"
            >
              <ExternalLink size={14} className="text-fg-muted" />
            </a>
          )}

          {/* Fallback icon when no file selected */}
          {!fileSystemId && (
            <div className="flex items-center gap-1.5 text-xs text-fg-muted">
              <FileIcon size={14} />
              <span>Select a file from VFS</span>
            </div>
          )}
        </div>
      </div>
      {props.children}
    </PlateElement>
  );
}
