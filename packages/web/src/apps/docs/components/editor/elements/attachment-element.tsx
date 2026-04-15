import { Download, Paperclip, Settings2 } from "lucide-react";
import type { PlateElementProps } from "platejs/react";
import { PlateElement, useEditorRef, useElement } from "platejs/react";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { rustUrl } from "@/lib/rust-api-runtime";
import { MaterialFileIcon } from "@/shared/components/icons";

// Monaco setup: workers, loader, transparent themes
import "@/lib/monaco-setup";

const MonacoEditor = lazy(() =>
  import("@monaco-editor/react").then((m) => ({ default: m.default })),
);

const EXT_TO_LANG: Record<string, string> = {
  css: "css",
  go: "go",
  html: "html",
  java: "java",
  js: "javascript",
  jsx: "javascript",
  json: "json",
  md: "markdown",
  nfo: "xml",
  py: "python",
  rs: "rust",
  sh: "shell",
  sql: "sql",
  ts: "typescript",
  tsx: "typescript",
  txt: "plaintext",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
  toml: "ini",
  ini: "ini",
  env: "shell",
  dockerfile: "dockerfile",
  makefile: "shell",
  svelte: "html",
  vue: "html",
  scss: "scss",
  less: "less",
  graphql: "graphql",
  prisma: "graphql",
  conf: "ini",
  cfg: "ini",
  log: "plaintext",
  csv: "plaintext",
  srt: "plaintext",
  ass: "plaintext",
  ssa: "plaintext",
  vtt: "plaintext",
};

const MIME_TO_LANG: Record<string, string> = {
  "application/json": "json",
  "application/javascript": "javascript",
  "application/xml": "xml",
  "text/html": "html",
  "text/css": "css",
  "text/xml": "xml",
  "text/markdown": "markdown",
};

function detectLanguage(fileName: string, fileType?: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const base = fileName.toLowerCase();
  if (base === "dockerfile") return "dockerfile";
  if (base === "makefile") return "shell";
  if (EXT_TO_LANG[ext]) return EXT_TO_LANG[ext];
  if (fileType && MIME_TO_LANG[fileType]) return MIME_TO_LANG[fileType];
  return "plaintext";
}

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
    return (
      <TextPreview
        url={url}
        height={height}
        fileName={fileName}
        fileType={fileType}
      />
    );
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
  fileName,
  fileType,
}: {
  url: string;
  height: number | null | undefined;
  fileName: string;
  fileType?: string;
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
        if (!cancelled) setText(t);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const resolvedHeight = height ? `${height}px` : "300px";
  const lang = detectLanguage(fileName, fileType);
  const isDark =
    typeof window !== "undefined" &&
    document.documentElement.classList.contains("dark");

  if (error) {
    return (
      <div
        className="flex items-center justify-center bg-fill-quaternary text-xs text-fg-muted"
        style={{ height: resolvedHeight }}
      >
        Failed to load preview
      </div>
    );
  }

  if (text === null) {
    return (
      <div
        className="flex items-center justify-center bg-fill-quaternary text-xs text-fg-muted"
        style={{ height: resolvedHeight }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div style={{ height: resolvedHeight }}>
      <Suspense
        fallback={
          <div
            className="flex items-center justify-center bg-fill-quaternary text-xs text-fg-muted"
            style={{ height: resolvedHeight }}
          >
            Loading editor...
          </div>
        }
      >
        <MonacoEditor
          height="100%"
          language={lang}
          theme={isDark ? "tokimo-dark" : "tokimo-light"}
          defaultValue={text}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            automaticLayout: true,
            padding: { top: 8 },
            renderWhitespace: "selection",
            bracketPairColorization: { enabled: true },
          }}
        />
      </Suspense>
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
  const editor = useEditorRef();
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

  const handleHeightChange = useCallback(
    (h: number | null) => {
      const path = editor.api.findPath(element);
      if (path) {
        editor.tf.setNodes({ height: h } as Record<string, unknown>, {
          at: path,
        });
      }
    },
    [editor, element],
  );

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
                onSelect={handleHeightChange}
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
