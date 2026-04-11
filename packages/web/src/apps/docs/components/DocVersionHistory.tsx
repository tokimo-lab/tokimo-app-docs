import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@tokiomo/components";
import { Clock, RotateCcw, X } from "lucide-react";
import { useCallback, useState } from "react";
import { api } from "@/generated/rust-api";
import type { DocNodeVersionOutput } from "@/generated/rust-types/index";
import { useDateFormat, useMessage } from "@/system";

interface DocVersionHistoryProps {
  nodeId: string;
  open: boolean;
  onClose: () => void;
  onPreviewVersion: (versionId: string) => void;
  onClearPreview: () => void;
  previewingVersionId: string | null;
}

export function DocVersionHistory({
  nodeId,
  open,
  onClose,
  onPreviewVersion,
  onClearPreview,
  previewingVersionId,
}: DocVersionHistoryProps) {
  const queryClient = useQueryClient();
  const message = useMessage();

  const versionsQuery = api.docs.listVersions.useQuery(
    { nodeId },
    { enabled: open && !!nodeId },
  );

  const versions = versionsQuery.data ?? [];

  const restoreMutation = api.docs.restoreVersion.useMutation({
    onSuccess: () => {
      message.success("版本已恢复");
      onClearPreview();
      api.docs.getById.invalidate(queryClient, { id: nodeId });
      api.docs.listVersions.invalidate(queryClient, { nodeId });
    },
    onError: () => message.error("恢复失败"),
  });

  const handleRestore = useCallback(
    (versionId: string) => {
      restoreMutation.mutate({ nodeId, versionId });
    },
    [restoreMutation, nodeId],
  );

  if (!open) return null;

  return (
    <div className="flex w-72 shrink-0 flex-col border-l border-border-base bg-surface-elevated ">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-base px-3 py-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-fg-secondary">
          <Clock className="size-4" />
          <span>版本历史</span>
          {versions.length > 0 && (
            <span className="rounded-full bg-blue-100 px-1.5 text-xs text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
              {versions.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            onClearPreview();
            onClose();
          }}
          className="flex size-6 items-center justify-center rounded text-fg-muted transition-colors hover:bg-fill-tertiary hover:text-fg-secondary"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {versionsQuery.isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-fg-muted">
            加载中…
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-fg-muted">
            <Clock className="size-8" strokeWidth={1} />
            <p className="text-sm">暂无版本历史</p>
            <p className="px-4 text-center text-xs text-fg-muted">
              编辑文档时会自动保存版本快照
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {versions.map((version) => (
              <VersionItem
                key={version.id}
                version={version}
                isActive={previewingVersionId === version.id}
                onPreview={() => onPreviewVersion(version.id)}
                onRestore={() => handleRestore(version.id)}
                isRestoring={restoreMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Version item ───────────────────────────────────────────────────────────

function VersionItem({
  version,
  isActive,
  onPreview,
  onRestore,
  isRestoring,
}: {
  version: DocNodeVersionOutput;
  isActive: boolean;
  onPreview: () => void;
  onRestore: () => void;
  isRestoring: boolean;
}) {
  const [showRestore, setShowRestore] = useState(false);
  const { formatLong } = useDateFormat();

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: version item
    // biome-ignore lint/a11y/noStaticElementInteractions: version item
    <div
      className={cn(
        "group cursor-pointer border-b border-border-subtle px-3 py-2.5 transition-colors hover:bg-fill-tertiary",
        isActive && "bg-blue-50 dark:bg-blue-900/20",
      )}
      onClick={onPreview}
      onMouseEnter={() => setShowRestore(true)}
      onMouseLeave={() => setShowRestore(false)}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "text-xs font-medium",
                isActive
                  ? "text-blue-700 dark:text-blue-400"
                  : "text-fg-secondary",
              )}
            >
              版本 {version.version}
            </span>
            <span className="text-[10px] text-fg-muted">
              {formatLong(version.createdAt)}
            </span>
          </div>
          <span className="text-[11px] text-fg-muted">
            {version.wordCount} 字
          </span>
        </div>
        {showRestore && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRestore();
            }}
            disabled={isRestoring}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-blue-600 transition-colors hover:bg-blue-100 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
            title="恢复此版本"
          >
            <RotateCcw className="size-3" />
            恢复
          </button>
        )}
      </div>
    </div>
  );
}

// ── Version preview bar ────────────────────────────────────────────────────

interface VersionPreviewBarProps {
  version: number;
  createdAt: string;
  onRestore: () => void;
  onBack: () => void;
  isRestoring: boolean;
}

export function VersionPreviewBar({
  version,
  createdAt,
  onRestore,
  onBack,
  isRestoring,
}: VersionPreviewBarProps) {
  const { formatLong } = useDateFormat();
  return (
    <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-1.5 dark:border-amber-800 dark:bg-amber-900/20">
      <span className="text-xs text-amber-800 dark:text-amber-300">
        正在查看版本 {version} · {formatLong(createdAt)}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRestore}
          disabled={isRestoring}
          className="rounded bg-amber-600 px-2.5 py-1 text-xs text-white transition-colors hover:bg-amber-700 disabled:opacity-50 dark:bg-amber-700 dark:hover:bg-amber-600"
        >
          恢复此版本
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded px-2.5 py-1 text-xs text-amber-700 transition-colors hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/30"
        >
          返回当前版本
        </button>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
