import { useQueryClient } from "@tanstack/react-query";
import { cn, Modal, useToast as useMessage } from "@tokimo/ui";
import { Clock, RotateCcw, X } from "lucide-react";
import { useCallback, useState } from "react";
import { useDateFormat } from "@tokimo/ui";
import { useTranslation } from "react-i18next";
import { api, type DocNodeVersionOutput } from "../api/generated";

interface DocVersionHistoryProps {
  spaceId: string;
  relPath: string;
  open: boolean;
  onClose: () => void;
  onPreviewVersion: (versionId: string) => void;
  onClearPreview: () => void;
  previewingVersionId: string | null;
  /** Called after a successful restore so the parent can force-reload the editor. */
  onRestored?: () => void;
}

export function DocVersionHistory({
  spaceId,
  relPath,
  open,
  onClose,
  onPreviewVersion,
  onClearPreview,
  previewingVersionId,
  onRestored,
}: DocVersionHistoryProps) {
  const queryClient = useQueryClient();
  const message = useMessage();
  const { t } = useTranslation();

  const versionsQuery = api.docs.listVersions.useQuery(
    { spaceId, relPath },
    { enabled: open && !!spaceId && !!relPath },
  );

  const versions = versionsQuery.data ?? [];

  const restoreMutation = api.docs.restoreVersion.useMutation({
    onSuccess: () => {
      message.success(t("versions.restored"));
      onClearPreview();
      api.docs.getNode.invalidate(queryClient, { spaceId, relPath });
      api.docs.listVersions.invalidate(queryClient, { spaceId, relPath });
      onRestored?.();
    },
    onError: () => message.error(t("versions.restoreFailed")),
  });

  const handleRestore = useCallback(
    (versionId: string) => {
      Modal.confirm({
        title: t("confirm.restoreVersion"),
        content: t("confirm.restoreVersionContent"),
        okText: t("confirm.restore"),
        cancelText: t("common.cancel"),
        variant: "warning",
        onOk: () => {
          restoreMutation.mutate({ spaceId, relPath, versionId });
        },
      });
    },
    [restoreMutation, spaceId, relPath, t],
  );

  if (!open) return null;

  return (
    <div className="flex w-72 shrink-0 flex-col border-l border-border-base bg-surface-raised text-fg-on-raised">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-base px-3 py-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-fg-secondary">
          <Clock className="size-4" />
          <span>{t("editor.versionHistory")}</span>
          {versions.length > 0 && (
            <span className="rounded-full bg-[var(--accent-subtle)] px-1.5 text-xs text-[var(--accent)] dark:bg-[var(--accent-subtle)] dark:text-[var(--accent)]">
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
            {t("common.loading")}
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-fg-muted">
            <Clock className="size-8" strokeWidth={1} />
            <p className="text-sm">{t("versions.empty")}</p>
            <p className="px-4 text-center text-xs text-fg-muted">
              {t("versions.empty")}
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
  const { t } = useTranslation();

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: version item
    // biome-ignore lint/a11y/noStaticElementInteractions: version item
    <div
      className={cn(
        "group cursor-pointer border-b border-border-subtle px-3 py-2.5 transition-colors hover:bg-fill-tertiary",
        isActive && "bg-[var(--accent-subtle)]",
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
                isActive ? "text-[var(--accent)]" : "text-fg-secondary",
              )}
            >
              {t("versions.version", { version: version.version })}
            </span>
            <span className="text-[10px] text-fg-muted">
              {formatLong(version.createdAt)}
            </span>
          </div>
          <span className="text-[11px] text-fg-muted">
            {t("versions.wordCount", { count: version.wordCount })}
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
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-[var(--accent)] transition-colors hover:bg-[var(--accent-subtle)] disabled:opacity-50 dark:text-[var(--accent)] dark:hover:bg-[var(--accent-subtle)]"
            title={t("versions.restoreThis")}
          >
            <RotateCcw className="size-3" />
            {t("versions.restoreThis")}
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
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-1.5 dark:border-amber-800 dark:bg-amber-900/20">
      <span className="text-xs text-amber-800 dark:text-amber-300">
        {t("versions.previewing", { version, date: formatLong(createdAt) })}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRestore}
          disabled={isRestoring}
          className="rounded bg-amber-600 px-2.5 py-1 text-xs text-white transition-colors hover:bg-amber-700 disabled:opacity-50 dark:bg-amber-700 dark:hover:bg-amber-600"
        >
          {t("versions.restoreThis")}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="rounded px-2.5 py-1 text-xs text-amber-700 transition-colors hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/30"
        >
          {t("versions.backToCurrent")}
        </button>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
