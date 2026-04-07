import { Download, FileIcon } from "lucide-react";
import type { PlateElementProps } from "platejs/react";
import { PlateElement, useElement } from "platejs/react";

export function VideoElement(props: PlateElementProps) {
  const element = useElement();
  const url = (element as Record<string, unknown>).url as string;

  return (
    <PlateElement className="my-4" {...props}>
      <div contentEditable={false} className="flex justify-center">
        {url ? (
          <video src={url} controls className="max-w-full rounded">
            <track kind="captions" />
          </video>
        ) : (
          <div className="flex h-40 w-full items-center justify-center rounded border-2 border-dashed border-border-base text-fg-muted">
            Paste or enter a video URL
          </div>
        )}
      </div>
      {props.children}
    </PlateElement>
  );
}

export function AudioElement(props: PlateElementProps) {
  const element = useElement();
  const url = (element as Record<string, unknown>).url as string;

  return (
    <PlateElement className="my-4" {...props}>
      <div contentEditable={false}>
        {url ? (
          <audio src={url} controls className="w-full">
            <track kind="captions" />
          </audio>
        ) : (
          <div className="flex h-16 w-full items-center justify-center rounded border-2 border-dashed border-border-base text-fg-muted">
            Paste or enter an audio URL
          </div>
        )}
      </div>
      {props.children}
    </PlateElement>
  );
}

export function FileElement(props: PlateElementProps) {
  const element = useElement();
  const url = (element as Record<string, unknown>).url as string;
  const name = ((element as Record<string, unknown>).name as string) || "File";
  const size = (element as Record<string, unknown>).size as number | undefined;

  const sizeLabel = size
    ? size < 1024
      ? `${size} B`
      : size < 1048576
        ? `${(size / 1024).toFixed(1)} KB`
        : `${(size / 1048576).toFixed(1)} MB`
    : null;

  return (
    <PlateElement className="my-3" {...props}>
      <div
        contentEditable={false}
        className="flex items-center gap-3 rounded-lg border border-border-base bg-surface-base px-4 py-3"
      >
        <FileIcon size={20} className="shrink-0 text-fg-muted" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg-secondary">
            {name}
          </p>
          {sizeLabel && <p className="text-xs text-fg-muted">{sizeLabel}</p>}
        </div>
        {url && (
          <a
            href={url}
            download={name}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-fill-tertiary "
          >
            <Download size={14} className="text-fg-muted" />
          </a>
        )}
      </div>
      {props.children}
    </PlateElement>
  );
}

export function MediaEmbedElement(props: PlateElementProps) {
  const element = useElement();
  const url = (element as Record<string, unknown>).url as string;

  return (
    <PlateElement className="my-4" {...props}>
      <div contentEditable={false} className="flex justify-center">
        {url ? (
          <div className="w-full overflow-hidden rounded border border-border-base">
            <iframe
              src={url}
              title="Embedded content"
              className="h-80 w-full border-0"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-popups"
            />
          </div>
        ) : (
          <div className="flex h-40 w-full items-center justify-center rounded border-2 border-dashed border-border-base text-fg-muted">
            Paste a URL to embed
          </div>
        )}
      </div>
      {props.children}
    </PlateElement>
  );
}
