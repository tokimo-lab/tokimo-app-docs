/**
 * Event helpers to programmatically open the system AI assistant panel.
 *
 * Any component (docs, photos, etc.) can call `openAiAssistant()` to
 * trigger the menubar AI panel without importing it directly.
 */

export interface OpenAiAssistantOptions {
  /** Pre-fill the input with this message. */
  message?: string;
  /** Auto-send the message immediately after panel opens. */
  autoSend?: boolean;
  /** Contextual content (e.g. current document text) attached to the session. */
  context?: string;
  /** Short label for the context source (e.g. document title). */
  contextLabel?: string;
}

const EVENT_NAME = "open-ai-assistant";

/** Programmatically open the system AI assistant panel. */
export function openAiAssistant(options?: OpenAiAssistantOptions) {
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: options }));
}

/** Subscribe to open-ai-assistant events. Returns cleanup function. */
export function onOpenAiAssistant(
  handler: (options?: OpenAiAssistantOptions) => void,
) {
  const listener = (e: Event) => {
    handler((e as CustomEvent<OpenAiAssistantOptions>).detail);
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}

// ── AI document edit events ─────────────────────────

export interface AiDocumentEditDetail {
  /** New document content in Markdown format. */
  content: string;
  /** Brief summary of the changes. */
  summary: string;
}

const DOC_EDIT_EVENT = "ai-edit-document";

/** Dispatch when AI's edit_document tool call is received (called by useClientTools). */
export function dispatchAiDocumentEdit(detail: AiDocumentEditDetail) {
  window.dispatchEvent(new CustomEvent(DOC_EDIT_EVENT, { detail }));
}

/** Subscribe to AI document edit events. Returns cleanup function. */
export function onAiDocumentEdit(
  handler: (detail: AiDocumentEditDetail) => void,
) {
  const listener = (e: Event) => {
    handler((e as CustomEvent<AiDocumentEditDetail>).detail);
  };
  window.addEventListener(DOC_EDIT_EVENT, listener);
  return () => window.removeEventListener(DOC_EDIT_EVENT, listener);
}
