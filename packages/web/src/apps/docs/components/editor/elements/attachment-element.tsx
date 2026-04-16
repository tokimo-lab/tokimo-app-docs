import {
  Download,
  FileWarning,
  GripVertical,
  Loader2,
  Paperclip,
  Settings2,
} from "lucide-react";
import type { PlateElementProps } from "platejs/react";
import { PlateElement, useEditorRef, useElement } from "platejs/react";
import {
  Component,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ScrollGuardShield } from "@/apps/docs/hooks/use-scroll-guard";
import { AudioPlayer } from "@/apps/viewers/audio/AudioPlayer";
import { ImagePreview } from "@/apps/viewers/image/ImagePreview";
import { PdfEmbed, type PdfViewMode } from "@/apps/viewers/pdf/PdfEmbed";
import { MonacoTextEditor } from "@/apps/viewers/text/MonacoTextEditor";
import { VideoPreview } from "@/apps/viewers/video/VideoPreview";
import { docAttachmentApi } from "@/generated/rust-api/docs/attachment";
import { rustUrl } from "@/lib/rust-api-runtime";
import { MaterialFileIcon } from "@/shared/components/icons";
import { useBlockDrag } from "../hooks/use-block-drag";

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return "";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / 1024 ** i;
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

/** Error boundary that auto-retries once (handles Monaco disposal on Slate moveNodes). */
class PreviewErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; retryCount: number }
> {
  state = { hasError: false, retryCount: 0 };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    // Auto-retry once after a micro-task to let services reinitialize
    if (this.state.retryCount < 1) {
      requestAnimationFrame(() => {
        this.setState((s) => ({
          hasError: false,
          retryCount: s.retryCount + 1,
        }));
      });
    }
  }
  render() {
    if (this.state.hasError && this.state.retryCount >= 1) {
      return (
        <div className="flex items-center justify-center py-8 text-xs text-fg-muted">
          预览加载失败
        </div>
      );
    }
    return this.props.children;
  }
}

const HEIGHT_OPTIONS = [
  { label: "自动", value: null },
  { label: "200px", value: 200 },
  { label: "300px", value: 300 },
  { label: "400px", value: 400 },
  { label: "600px", value: 600 },
  { label: "800px", value: 800 },
  { label: "1000px", value: 1000 },
] as const;

const MAX_WIDTH_OPTIONS = [
  { label: "100%", value: null },
  { label: "400px", value: 400 },
  { label: "500px", value: 500 },
  { label: "600px", value: 600 },
  { label: "800px", value: 800 },
] as const;

interface AttachmentData {
  attachmentId?: string;
  storageKey?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  height?: number | null;
  maxWidth?: number | null;
  pdfMode?: string | null;
  pdfZoom?: number | null;
  /** Upload progress 0-100, present only while uploading */
  uploadProgress?: number;
  /** Detection fields from backend */
  fileCategory?: string;
  detectedMime?: string;
  detectedLanguage?: string;
  isBinary?: boolean;
  textEncoding?: string;
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

function isTextType(mime: string, fileName?: string): boolean {
  if (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/xml" ||
    mime === "application/javascript"
  ) {
    return true;
  }
  // Extension-based fallback for files with generic MIME
  if (fileName && mime === "application/octet-stream") {
    const ext = fileName.split(".").pop()?.toLowerCase();
    const textExts = new Set([
      "log",
      "lua",
      "sh",
      "bash",
      "zsh",
      "fish",
      "ps1",
      "bat",
      "cmd",
      "ini",
      "cfg",
      "conf",
      "env",
      "properties",
      "toml",
      "yaml",
      "yml",
      "csv",
      "tsv",
      "sql",
      "graphql",
      "gql",
      "proto",
      "tf",
      "hcl",
      "r",
      "rmd",
      "dart",
      "scala",
      "zig",
      "nim",
      "ex",
      "exs",
      "erl",
      "hs",
      "ml",
      "clj",
      "cljs",
      "pl",
      "pm",
      "vue",
      "svelte",
      "dockerfile",
      "makefile",
      "cmake",
      "gitignore",
      "editorconfig",
    ]);
    if (ext && textExts.has(ext)) return true;
  }
  return false;
}

/** Check if a file is an office document that can be previewed via Gotenberg */
function isOfficeType(category?: string, mime?: string): boolean {
  if (
    category === "document" ||
    category === "spreadsheet" ||
    category === "presentation"
  ) {
    // Exclude PDF since we handle it natively
    if (mime === "application/pdf") return false;
    return true;
  }
  // Fallback: check MIME for legacy Office types (e.g. when category is "binary")
  if (mime) {
    const officeMimes = [
      "application/msword",
      "application/vnd.ms-excel",
      "application/vnd.ms-powerpoint",
      "application/rtf",
      "application/vnd.openxmlformats-officedocument.",
      "application/vnd.oasis.opendocument.",
    ];
    if (officeMimes.some((prefix) => mime.startsWith(prefix))) return true;
  }
  return false;
}

type PreviewKind =
  | "image"
  | "pdf"
  | "video"
  | "audio"
  | "text"
  | "office"
  | "fallback";

/** Determine preview kind from detection fields, falling back to MIME heuristics */
function resolvePreviewKind(
  fileType: string,
  fileCategory?: string,
  isBinary?: boolean,
  fileName?: string,
): PreviewKind {
  // Use fileCategory from detector when available
  if (fileCategory) {
    if (isOfficeType(fileCategory, fileType)) return "office";
    switch (fileCategory) {
      case "image":
        return "image";
      case "video":
        return "video";
      case "audio":
        return "audio";
      case "text":
        return "text";
    }
  }

  // Fallback to MIME-based heuristics for older attachments without detection fields
  if (isImageType(fileType)) return "image";
  if (isPdfType(fileType)) return "pdf";
  if (isVideoType(fileType)) return "video";
  if (isAudioType(fileType)) return "audio";
  if (isTextType(fileType, fileName)) return "text";
  if (isOfficeType(undefined, fileType)) return "office";
  if (isBinary === false) return "text";

  // PDF check (category=document but caught above via MIME)
  if (fileType === "application/pdf") return "pdf";

  return "fallback";
}

const DEFAULT_HEIGHTS: Record<string, number> = {
  image: 300,
  pdf: 400,
  text: 300,
  office: 400,
  fallback: 120,
};

function getPlaceholderHeight(
  fileType: string,
  explicitHeight: number | null | undefined,
  fileCategory?: string,
  isBinary?: boolean,
): number {
  if (explicitHeight) return explicitHeight;
  const kind = resolvePreviewKind(fileType, fileCategory, isBinary);
  return DEFAULT_HEIGHTS[kind] ?? DEFAULT_HEIGHTS.fallback;
}

/** Renders children only when the element is near the viewport. */
function LazyViewport({
  height,
  children,
}: {
  height: number;
  children: React.ReactNode;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!visible) {
    return (
      <div
        ref={sentinelRef}
        className="flex items-center justify-center bg-fill-tertiary/30"
        style={{ height: `${height}px` }}
      >
        <Paperclip size={20} className="animate-pulse text-fg-muted" />
      </div>
    );
  }

  return <>{children}</>;
}

/** Office document preview — fetches PDF preview URL from backend, renders via PdfEmbed */
function OfficePreview({
  attachmentId,
  fileName,
  height,
  maxWidth,
  pdfMode,
  onPdfModeChange,
  pdfZoom,
  onPdfZoomChange,
}: {
  attachmentId: string;
  fileName: string;
  height: number | null | undefined;
  maxWidth?: number | null;
  pdfMode?: PdfViewMode;
  onPdfModeChange?: (mode: PdfViewMode) => void;
  pdfZoom?: number;
  onPdfZoomChange?: (zoom: number) => void;
}) {
  const [state, setState] = useState<{
    status: "loading" | "ready" | "error";
    url?: string;
    error?: string;
  }>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    docAttachmentApi.preview
      .fetch({ id: attachmentId })
      .then((result) => {
        if (!cancelled) {
          setState({ status: "ready", url: rustUrl(result.url) });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            error: err instanceof Error ? err.message : "Preview failed",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attachmentId]);

  if (state.status === "loading") {
    return (
      <div
        className="flex items-center justify-center gap-2 text-fg-muted"
        style={{ height: height ? `${height}px` : "400px" }}
      >
        <Loader2 size={18} className="animate-spin" />
        <span className="text-xs">Generating preview…</span>
      </div>
    );
  }

  if (state.status === "error" || !state.url) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 text-fg-muted"
        style={{ height: height ? `${height}px` : "120px" }}
      >
        <FileWarning size={24} />
        <span className="text-xs">{state.error ?? "Preview unavailable"}</span>
      </div>
    );
  }

  return (
    <div style={{ height: height ? `${height}px` : "400px" }}>
      <PdfEmbed
        src={state.url}
        title={fileName}
        maxWidth={maxWidth ?? undefined}
        mode={pdfMode}
        onModeChange={onPdfModeChange}
        zoom={pdfZoom}
        onZoomChange={onPdfZoomChange}
      />
    </div>
  );
}

function PreviewContent({
  storageKey,
  fileType,
  fileName,
  height,
  maxWidth,
  pdfMode,
  pdfZoom,
  onPdfModeChange,
  onPdfZoomChange,
  attachmentId,
  fileCategory,
  detectedLanguage,
  isBinary,
}: {
  storageKey: string;
  fileType: string;
  fileName: string;
  height: number | null | undefined;
  maxWidth?: number | null;
  pdfMode?: PdfViewMode;
  pdfZoom?: number;
  onPdfModeChange?: (mode: PdfViewMode) => void;
  onPdfZoomChange?: (zoom: number) => void;
  attachmentId?: string;
  fileCategory?: string;
  detectedLanguage?: string;
  isBinary?: boolean;
}) {
  const url = getStorageUrl(storageKey);
  const style = height ? { height: `${height}px` } : undefined;
  const kind = resolvePreviewKind(fileType, fileCategory, isBinary, fileName);

  if (kind === "image") {
    return (
      <div className="overflow-hidden" style={style ?? { height: "300px" }}>
        <ImagePreview
          src={url}
          alt={fileName}
          showToolbar={false}
          className="h-full"
        />
      </div>
    );
  }

  if (kind === "pdf") {
    return (
      <ScrollGuardShield>
        <div style={{ height: height ? `${height}px` : "400px" }}>
          <PdfEmbed
            src={url}
            title={fileName}
            maxWidth={maxWidth ?? undefined}
            mode={pdfMode}
            onModeChange={onPdfModeChange}
            zoom={pdfZoom}
            onZoomChange={onPdfZoomChange}
          />
        </div>
      </ScrollGuardShield>
    );
  }

  if (kind === "video") {
    return (
      <div style={style}>
        <VideoPreview src={url} className="w-full" />
      </div>
    );
  }

  if (kind === "audio") {
    return (
      <div className="px-4 py-3">
        <AudioPlayer src={url} fileName={fileName} />
      </div>
    );
  }

  if (kind === "text") {
    return (
      <div style={{ height: height ? `${height}px` : "300px" }}>
        <ScrollGuardShield>
          <MonacoTextEditor
            readOnlyUrl={url}
            fileName={fileName}
            language={detectedLanguage}
          />
        </ScrollGuardShield>
      </div>
    );
  }

  if (kind === "office" && attachmentId) {
    return (
      <ScrollGuardShield>
        <OfficePreview
          attachmentId={attachmentId}
          fileName={fileName}
          height={height}
          maxWidth={maxWidth}
          pdfMode={pdfMode}
          onPdfModeChange={onPdfModeChange}
          pdfZoom={pdfZoom}
          onPdfZoomChange={onPdfZoomChange}
        />
      </ScrollGuardShield>
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

function SettingsPopover({
  currentHeight,
  currentMaxWidth,
  showMaxWidth,
  onHeightChange,
  onMaxWidthChange,
  onClose,
}: {
  currentHeight: number | null | undefined;
  currentMaxWidth: number | null | undefined;
  showMaxWidth: boolean;
  onHeightChange: (h: number | null) => void;
  onMaxWidthChange: (w: number | null) => void;
  onClose: () => void;
}) {
  const [customHeight, setCustomHeight] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const applyCustomHeight = () => {
    const v = Number.parseInt(customHeight, 10);
    if (v >= 100 && v <= 2000) {
      onHeightChange(v);
      setCustomHeight("");
    }
  };

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 bottom-full z-50 mb-1 min-w-[140px] rounded-lg border border-black/[0.06] bg-white/90 p-1.5 shadow-lg backdrop-blur-xl dark:border-white/[0.08] dark:bg-[rgba(15,15,25,0.9)]"
    >
      <div className="mb-1 px-2 text-[10px] font-medium text-fg-muted">
        高度
      </div>
      {HEIGHT_OPTIONS.map((opt) => (
        <button
          key={opt.label}
          type="button"
          className={`block w-full cursor-pointer rounded px-3 py-1 text-left text-xs ${
            currentHeight === opt.value
              ? "bg-fill-brand-secondary text-fg-on-emphasis"
              : "text-fg-secondary hover:bg-fill-tertiary"
          }`}
          onClick={() => onHeightChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}

      {/* Custom height input */}
      <div className="mt-1 flex items-center gap-1 px-1">
        <input
          type="number"
          min={100}
          max={2000}
          placeholder="自定义"
          value={customHeight}
          onChange={(e) => setCustomHeight(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyCustomHeight();
          }}
          className="h-6 w-full min-w-0 rounded border border-border-base bg-transparent px-2 text-xs text-fg-primary outline-none focus:border-border-brand"
        />
        <span className="shrink-0 text-[10px] text-fg-muted">px</span>
      </div>

      {showMaxWidth && (
        <>
          <div className="mx-1 my-1.5 border-t border-border-base" />
          <div className="mb-1 px-2 text-[10px] font-medium text-fg-muted">
            最大宽度
          </div>
          {MAX_WIDTH_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              className={`block w-full cursor-pointer rounded px-3 py-1 text-left text-xs ${
                currentMaxWidth === opt.value
                  ? "bg-fill-brand-secondary text-fg-on-emphasis"
                  : "text-fg-secondary hover:bg-fill-tertiary"
              }`}
              onClick={() => onMaxWidthChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </>
      )}
    </div>
  );
}

export function AttachmentElement(props: PlateElementProps) {
  const editor = useEditorRef();
  const element = useElement();
  const el = element as unknown as AttachmentData;
  const [showHeightMenu, setShowHeightMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isDragging, handleDragPointerDown } = useBlockDrag(containerRef);

  const storageKey = el.storageKey || "";
  const fileName = el.fileName || "Unnamed file";
  // Prefer backend-detected MIME over browser-provided MIME
  const fileType = el.detectedMime || el.fileType || "application/octet-stream";
  const fileSize = el.fileSize;
  const height = el.height;
  const maxWidth = el.maxWidth;
  const pdfMode = (el.pdfMode as PdfViewMode) || "scroll";
  const pdfZoom = (el.pdfZoom as number) || 1;
  const uploadProgress = el.uploadProgress;
  const fileCategory = el.fileCategory;
  const detectedLanguage = el.detectedLanguage;
  const isBinary = el.isBinary;
  const attachmentId = el.attachmentId;

  const sizeLabel = formatFileSize(fileSize);
  const downloadUrl = storageKey ? getStorageUrl(storageKey) : null;

  const previewKind = resolvePreviewKind(
    fileType,
    fileCategory,
    isBinary,
    fileName,
  );
  const showMaxWidthSetting = previewKind === "pdf" || previewKind === "office";

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

  const handleMaxWidthChange = useCallback(
    (w: number | null) => {
      const path = editor.api.findPath(element);
      if (path) {
        editor.tf.setNodes({ maxWidth: w } as Record<string, unknown>, {
          at: path,
        });
      }
    },
    [editor, element],
  );

  const handlePdfModeChange = useCallback(
    (m: PdfViewMode) => {
      const path = editor.api.findPath(element);
      if (path) {
        editor.tf.setNodes({ pdfMode: m } as Record<string, unknown>, {
          at: path,
        });
      }
    },
    [editor, element],
  );

  const handlePdfZoomChange = useCallback(
    (z: number) => {
      const path = editor.api.findPath(element);
      if (path) {
        editor.tf.setNodes({ pdfZoom: z } as Record<string, unknown>, {
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
        ref={containerRef}
        contentEditable={false}
        className={`group relative overflow-hidden rounded-lg border bg-surface-base transition-[border-color,opacity] ${
          isDragging
            ? "border-border-brand opacity-30"
            : "border-border-base hover:border-border-hover"
        }`}
      >
        {/* Title bar — drag handle */}
        <div
          onPointerDown={handleDragPointerDown}
          className="flex cursor-grab items-center gap-2 border-b border-border-base px-3 py-1.5 select-none active:cursor-grabbing"
        >
          <GripVertical
            size={14}
            className="shrink-0 text-fg-muted opacity-0 transition-opacity group-hover:opacity-100"
          />
          <div className="flex h-5 w-5 shrink-0 items-center justify-center">
            <MaterialFileIcon name={fileName} size={14} />
          </div>
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-fg-secondary">
            {fileName}
          </span>
          {sizeLabel && (
            <span className="shrink-0 text-[10px] text-fg-muted">
              {sizeLabel}
            </span>
          )}

          <div className="relative flex shrink-0 items-center gap-0.5">
            {/* Download */}
            {downloadUrl && (
              <a
                href={downloadUrl}
                download={fileName}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded opacity-0 transition-opacity hover:bg-fill-tertiary group-hover:opacity-100"
                title="下载"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <Download size={12} className="text-fg-muted" />
              </a>
            )}

            {/* Preview settings */}
            <div className="relative">
              <button
                type="button"
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded opacity-0 transition-opacity hover:bg-fill-tertiary group-hover:opacity-100"
                title="预览设置"
                onClick={() => setShowHeightMenu((v) => !v)}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <Settings2 size={12} className="text-fg-muted" />
              </button>

              {showHeightMenu && (
                <SettingsPopover
                  currentHeight={height}
                  currentMaxWidth={maxWidth}
                  showMaxWidth={showMaxWidthSetting}
                  onHeightChange={handleHeightChange}
                  onMaxWidthChange={handleMaxWidthChange}
                  onClose={() => setShowHeightMenu(false)}
                />
              )}
            </div>
          </div>
        </div>

        {/* Preview area */}
        {storageKey && (
          <div className="overflow-hidden">
            <PreviewErrorBoundary>
              <LazyViewport
                height={getPlaceholderHeight(
                  fileType,
                  height,
                  fileCategory,
                  isBinary,
                )}
              >
                <PreviewContent
                  storageKey={storageKey}
                  fileType={fileType}
                  fileName={fileName}
                  height={height}
                  maxWidth={maxWidth}
                  pdfMode={pdfMode}
                  pdfZoom={pdfZoom}
                  onPdfModeChange={handlePdfModeChange}
                  onPdfZoomChange={handlePdfZoomChange}
                  attachmentId={attachmentId}
                  fileCategory={fileCategory}
                  detectedLanguage={detectedLanguage}
                  isBinary={isBinary}
                />
              </LazyViewport>
            </PreviewErrorBoundary>
          </div>
        )}
      </div>
      {props.children}
    </PlateElement>
  );
}
