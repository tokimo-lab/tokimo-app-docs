import { Download, Paperclip, Settings2 } from "lucide-react";
import type { PlateElementProps } from "platejs/react";
import { PlateElement, useElement } from "platejs/react";
import { useEffect, useState } from "react";
import { rustUrl } from "@/lib/rust-api-runtime";
import { MaterialFileIcon } from "@/shared/components/icons";

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return "";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / 1024 ** i;
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

const HEIGHT_OPTIONS = [
  { label: "自动", value: null },
  { label: "200px", value: 200 },
  { label: "300px", value: 300 },
  { label: "400px", value: 400 },
  { label: "600px", value: 600 },
] as const;

interface AttachmentData {
  attachmentId?: string;
  storageKey?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  height?: number | null;
  /** Upload progress 0-100, present only while uploading */
  uploadProgress?: number;
}

function getStorageUrl(storageKey: string): string {
  return rustUrl(`/storage/${storageKey}`);
}

function isImageType(mime: string): boolean {
  return mime.startsWith("image/");
}

function isPdfType(mime: string): boolean {
  return mime === "application/pdf";
}

function isVideoType(mime: string): boolean {
  return mime.startsWith("video/");
}

function isAudioType(mime: string): boolean {
  return mime.startsWith("audio/");
}

function isTextType(mime: string): boolean {
  return (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/xml" ||
    mime === "application/javascript"
  );
}

function PreviewContent({
  storageKey,
  fileType,
  fileName,
  height,
}: {
  storageKey: string;
  fileType: string;
  fileName: string;
  height: number | null | undefined;
}) {
  const url = getStorageUrl(storageKey);
  const style = height ? { height: `${height}px` } : undefined;

  if (isImageType(fileType)) {
    return (
      <div className="flex justify-center overflow-hidden" style={style}>
        <img
          src={url}
          alt={fileName}
          className="max-w-full object-contain"
          loading="lazy"
        />
      </div>
    );
  }

  if (isPdfType(fileType)) {
    return (
      <iframe
        src={url}
        title={fileName}
        className="w-full border-0"
        style={{ height: height ? `${height}px` : "400px" }}
      />
    );
  }

  if (isVideoType(fileType)) {
    return (
      <div style={style}>
        <video src={url} controls className="w-full">
          <track kind="captions" />
        </video>
      </div>
    );
  }

  if (isAudioType(fileType)) {
    return (
      <div className="px-4 py-3">
        <audio src={url} controls className="w-full">
          <track kind="captions" />
        </audio>
      </div>
    );
  }

  if (isTextType(fileType)) {
    return <TextPreview url={url} height={height} />;
  }

  // Fallback: large icon centered
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 py-8"
      style={style}
    >
      <MaterialFileIcon name={fileName} size={48} />
      <span className="text-xs text-fg-muted">Preview not available</span>
    </div>
  );
}

function TextPreview({
  url,
  height,
}: {
  url: string;
  height: number | null | undefined;
}) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.text();
      })
      .then((t) => {
        if (!cancelled) setText(t.slice(0, 10000));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div
      className="overflow-auto bg-fill-quaternary p-4 font-mono text-xs text-fg-secondary"
      style={{ height: height ? `${height}px` : "300px" }}
    >
      {error ? (
        <span className="text-fg-muted">Failed to load preview</span>
      ) : text !== null ? (
        <pre className="whitespace-pre-wrap">{text}</pre>
      ) : (
        <span className="text-fg-muted">Loading...</span>
      )}
    </div>
  );
}

function HeightPopover({
  current,
  onSelect,
  onClose,
}: {
  current: number | null | undefined;
  onSelect: (h: number | null) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 bottom-full z-50 mb-1 rounded-lg border border-border-base bg-surface-overlay p-1 shadow-lg">
      {HEIGHT_OPTIONS.map((opt) => (
        <button
          key={opt.label}
          type="button"
          className={`block w-full cursor-pointer rounded px-3 py-1.5 text-left text-xs ${
            current === opt.value
              ? "bg-fill-brand-secondary text-fg-on-emphasis"
              : "text-fg-secondary hover:bg-fill-tertiary"
          }`}
          onClick={() => {
            onSelect(opt.value);
            onClose();
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function AttachmentElement(props: PlateElementProps) {
  const element = useElement();
  const el = element as unknown as AttachmentData;
  const [showHeightMenu, setShowHeightMenu] = useState(false);

  const storageKey = el.storageKey || "";
  const fileName = el.fileName || "Unnamed file";
  const fileType = el.fileType || "application/octet-stream";
  const fileSize = el.fileSize;
  const height = el.height;
  const uploadProgress = el.uploadProgress;

  const sizeLabel = formatFileSize(fileSize);
  const downloadUrl = storageKey ? getStorageUrl(storageKey) : null;

  // Uploading state
  if (uploadProgress != null && uploadProgress < 100) {
    return (
      <PlateElement className="my-3" {...props}>
        <div
          contentEditable={false}
          className="rounded-lg border border-border-base bg-surface-base"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <Paperclip size={16} className="shrink-0 text-fg-muted" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-fg-secondary">{fileName}</p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-fill-tertiary">
                <div
                  className="h-full rounded-full bg-fill-brand transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
            <span className="shrink-0 text-xs text-fg-muted tabular-nums">
              {uploadProgress}%
            </span>
          </div>
        </div>
        {props.children}
      </PlateElement>
    );
  }

  return (
    <PlateElement className="my-3" {...props}>
      <div
        contentEditable={false}
        className="group overflow-hidden rounded-lg border border-border-base bg-surface-base transition-colors hover:border-border-hover"
      >
        {/* Preview area */}
        {storageKey && (
          <div className="overflow-hidden">
            <PreviewContent
              storageKey={storageKey}
              fileType={fileType}
              fileName={fileName}
              height={height}
            />
          </div>
        )}

        {/* Info bar */}
        <div className="flex items-center gap-3 border-t border-border-base px-4 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-fill-tertiary dark:bg-white/[0.10]">
            <MaterialFileIcon name={fileName} size={18} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg-primary">
              {fileName}
            </p>
            {sizeLabel && <p className="text-xs text-fg-muted">{sizeLabel}</p>}
          </div>

          <div className="relative flex items-center gap-1">
            {/* Download */}
            {downloadUrl && (
              <a
                href={downloadUrl}
                download={fileName}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded opacity-0 transition-opacity hover:bg-fill-tertiary group-hover:opacity-100"
                title="下载"
              >
                <Download size={14} className="text-fg-muted" />
              </a>
            )}

            {/* Height settings */}
            <button
              type="button"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded opacity-0 transition-opacity hover:bg-fill-tertiary group-hover:opacity-100"
              title="预览高度"
              onClick={() => setShowHeightMenu((v) => !v)}
            >
              <Settings2 size={14} className="text-fg-muted" />
            </button>

            {showHeightMenu && (
              <HeightPopover
                current={height}
                onSelect={(_h) => {
                  // Height change will be wired up via Slate transforms in upload-integration phase
                }}
                onClose={() => setShowHeightMenu(false)}
              />
            )}
          </div>
        </div>
      </div>
      {props.children}
    </PlateElement>
  );
}
