import { useVirtualizer } from "@tanstack/react-virtual";
import { Button, Modal, Spin } from "@tokiomo/components";
import {
  ChevronRight,
  CornerLeftUp,
  FolderOpen,
  HardDrive,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FileSystemDto } from "@/generated/rust-api";
import { api } from "@/generated/rust-api";
import { MaterialFileIcon } from "@/shared/components/icons";

export interface VfsFileSelection {
  fileSystemId: string;
  fileSystemName: string;
  filePath: string;
  fileName: string;
  fileSize: number | null;
  modifiedAt: string | null;
}

interface VfsFilePickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (file: VfsFileSelection) => void;
}

const ROW_HEIGHT = 36;

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / 1024 ** i;
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

/**
 * VfsFilePickerModal — Two-phase picker:
 *   1. Select a file system (from api.fileSystem.list)
 *   2. Browse directories and select a file
 */
export default function VfsFilePickerModal({
  open,
  onClose,
  onSelect,
}: VfsFilePickerModalProps) {
  const [selectedFs, setSelectedFs] = useState<FileSystemDto | null>(null);
  const [currentPath, setCurrentPath] = useState("/");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setSelectedFs(null);
      setCurrentPath("/");
      setSelectedFile(null);
    }
  }, [open]);

  const fsListQuery = api.fileSystem.list.useQuery({
    enabled: open,
  });

  const fileSystems = fsListQuery.data ?? [];

  const handleSelectFs = useCallback((fs: FileSystemDto) => {
    setSelectedFs(fs);
    const config = (fs.config ?? {}) as Record<string, string>;
    setCurrentPath(fs.type === "local" ? config.root_folder_path || "/" : "/");
    setSelectedFile(null);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedFs(null);
    setCurrentPath("/");
    setSelectedFile(null);
  }, []);

  return (
    <Modal
      title="引用文件"
      open={open}
      onCancel={onClose}
      footer={null}
      size="default"
      centered
    >
      <div className="flex flex-col" style={{ height: 420 }}>
        {!selectedFs ? (
          <FileSystemList
            fileSystems={fileSystems}
            isLoading={fsListQuery.isLoading}
            onSelect={handleSelectFs}
          />
        ) : (
          <FileBrowser
            fileSystem={selectedFs}
            currentPath={currentPath}
            selectedFile={selectedFile}
            onNavigate={setCurrentPath}
            onSelectFile={setSelectedFile}
            onBack={handleBack}
            onConfirm={(file) => {
              onSelect(file);
              onClose();
            }}
          />
        )}
      </div>
    </Modal>
  );
}

// ── Phase 1: File System Selection ──

function FileSystemList({
  fileSystems,
  isLoading,
  onSelect,
}: {
  fileSystems: FileSystemDto[];
  isLoading: boolean;
  onSelect: (fs: FileSystemDto) => void;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spin size="small" />
      </div>
    );
  }

  if (fileSystems.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-fg-muted">
        <HardDrive size={32} />
        <p className="text-sm">No file systems configured</p>
        <p className="text-xs">Add a file system in Settings → File Systems</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <p className="px-4 py-2 text-xs font-medium text-fg-muted">选择存储源</p>
      {fileSystems.map((fs) => (
        <button
          key={fs.id}
          type="button"
          className="flex w-full items-center gap-3 border-0 bg-transparent px-4 py-2.5 text-left text-inherit transition-colors hover:bg-fill-tertiary"
          onClick={() => onSelect(fs)}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400">
            <HardDrive size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg-secondary">
              {fs.name}
            </p>
            <p className="truncate text-xs text-fg-muted">{fs.type}</p>
          </div>
          <ChevronRight size={16} className="shrink-0 text-fg-muted" />
        </button>
      ))}
    </div>
  );
}

// ── Phase 2: File Browser ──

function FileBrowser({
  fileSystem,
  currentPath,
  selectedFile,
  onNavigate,
  onSelectFile,
  onBack,
  onConfirm,
}: {
  fileSystem: FileSystemDto;
  currentPath: string;
  selectedFile: string | null;
  onNavigate: (path: string) => void;
  onSelectFile: (path: string | null) => void;
  onBack: () => void;
  onConfirm: (file: VfsFileSelection) => void;
}) {
  const browseQuery = api.fileSystem.browse.useQuery(
    { path: currentPath, fileSystemId: fileSystem.id },
    { enabled: true, retry: false, staleTime: 0 },
  );

  const entries = browseQuery.data?.entries ?? [];
  const parentPath = browseQuery.data?.parentPath ?? null;

  const dirs = entries.filter((e) => e.isDirectory);
  const files = entries.filter((e) => !e.isDirectory);
  const rows = [
    ...(parentPath ? [{ kind: "up" as const, path: parentPath }] : []),
    ...dirs.map((e) => ({ kind: "dir" as const, entry: e })),
    ...files.map((e) => ({ kind: "file" as const, entry: e })),
  ];

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const selectedEntry = selectedFile
    ? entries.find((e) => e.path === selectedFile)
    : null;

  const handleConfirm = useCallback(() => {
    if (!selectedEntry) return;
    onConfirm({
      fileSystemId: fileSystem.id,
      fileSystemName: fileSystem.name,
      filePath: selectedEntry.path,
      fileName: selectedEntry.name,
      fileSize: selectedEntry.size ?? null,
      modifiedAt: selectedEntry.modifiedAt ?? null,
    });
  }, [selectedEntry, fileSystem, onConfirm]);

  // Path segments for breadcrumb
  const pathSegments = currentPath
    .split("/")
    .filter(Boolean)
    .reduce<Array<{ name: string; path: string }>>((acc, seg) => {
      const prev = acc.length > 0 ? acc[acc.length - 1].path : "";
      acc.push({ name: seg, path: `${prev}/${seg}` });
      return acc;
    }, []);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header: back + breadcrumb */}
      <div className="flex items-center gap-1 border-b border-border-base px-3 py-1.5">
        <button
          type="button"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-transparent border-0 text-fg-muted hover:bg-fill-tertiary hover:text-fg-secondary"
          onClick={onBack}
          title="Back to file systems"
        >
          <CornerLeftUp size={14} />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto text-xs">
          <button
            type="button"
            className="shrink-0 rounded bg-transparent border-0 px-1 py-0.5 text-fg-muted hover:text-fg-secondary"
            onClick={() => onNavigate("/")}
          >
            {fileSystem.name}
          </button>
          {pathSegments.map((seg) => (
            <span key={seg.path} className="flex items-center gap-0.5">
              <ChevronRight size={10} className="shrink-0 text-fg-muted" />
              <button
                type="button"
                className="shrink-0 truncate rounded bg-transparent border-0 px-1 py-0.5 text-fg-muted hover:text-fg-secondary"
                onClick={() => onNavigate(seg.path)}
              >
                {seg.name}
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* File list */}
      <div ref={parentRef} className="flex-1 overflow-y-auto">
        {browseQuery.isFetching && entries.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Spin size="small" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-fg-muted">
            Empty directory
          </div>
        ) : (
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((vItem) => {
              const row = rows[vItem.index];
              return (
                <div
                  key={vItem.key}
                  style={{
                    position: "absolute",
                    top: vItem.start,
                    left: 0,
                    right: 0,
                    height: ROW_HEIGHT,
                  }}
                >
                  {row.kind === "up" ? (
                    <button
                      type="button"
                      className="flex h-full w-full items-center gap-2 border-0 bg-transparent px-3 text-left text-inherit text-sm opacity-60 hover:bg-fill-tertiary"
                      onClick={() => onNavigate(row.path)}
                    >
                      <MaterialFileIcon name=".." isDirectory size={16} />
                      <span>..</span>
                    </button>
                  ) : row.kind === "dir" ? (
                    <button
                      type="button"
                      className="flex h-full w-full items-center gap-2 border-0 bg-transparent px-3 text-left text-inherit text-sm hover:bg-fill-tertiary"
                      onClick={() => onNavigate(row.entry.path)}
                    >
                      <MaterialFileIcon
                        name={row.entry.name}
                        isDirectory
                        size={16}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {row.entry.name}
                      </span>
                      <FolderOpen
                        size={12}
                        className="shrink-0 text-fg-muted"
                      />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={`flex h-full w-full items-center gap-2 border-0 px-3 text-left text-sm transition-colors ${
                        selectedFile === row.entry.path
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          : "bg-transparent text-inherit hover:bg-fill-tertiary"
                      }`}
                      onClick={() => onSelectFile(row.entry.path)}
                      onDoubleClick={() => {
                        onSelectFile(row.entry.path);
                        const entry = row.entry;
                        onConfirm({
                          fileSystemId: fileSystem.id,
                          fileSystemName: fileSystem.name,
                          filePath: entry.path,
                          fileName: entry.name,
                          fileSize: entry.size ?? null,
                          modifiedAt: entry.modifiedAt ?? null,
                        });
                      }}
                    >
                      <MaterialFileIcon name={row.entry.name} size={16} />
                      <span className="min-w-0 flex-1 truncate">
                        {row.entry.name}
                      </span>
                      <span className="shrink-0 text-xs text-fg-muted">
                        {formatFileSize(row.entry.size)}
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border-base px-3 py-2">
        <span className="truncate text-xs text-fg-muted">
          {selectedEntry ? selectedEntry.name : "Select a file"}
        </span>
        <Button
          size="small"
          variant="primary"
          disabled={!selectedFile}
          onClick={handleConfirm}
        >
          确认
        </Button>
      </div>
    </div>
  );
}
