import { serializeMd } from "@platejs/markdown";
import type { DocEditorHandle } from "@/apps/docs/components/editor";
import { openAiAssistant } from "@/lib/ai-assistant-events";

/** Serialize editor content to Markdown and trigger download. */
export function exportAsMarkdown(
  editor: DocEditorHandle | null,
  title?: string,
): void {
  if (!editor) return;
  const md = serializeMd(editor, { value: editor.children });
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title || "document"}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Open a file picker for .md/.txt and pass content to callback. */
export function pickAndReadMarkdownFile(
  callback: (mdText: string) => void,
): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".md,.markdown,.txt";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => callback(reader.result as string);
    reader.readAsText(file);
  };
  input.click();
}

/** Export editor content as .docx via dynamic import. */
export async function exportAsDocx(
  editor: DocEditorHandle | null,
  title?: string,
): Promise<void> {
  if (!editor) return;
  const { exportDocx } = await import(
    "@/apps/docs/components/export/serialize-docx"
  );
  await exportDocx(editor.children, title || "document");
}

/** Extract all plain text from the Plate editor tree. */
export function getEditorPlainText(editor: DocEditorHandle | null): string {
  if (!editor?.children) return "";
  const extractText = (nodes: unknown[]): string =>
    nodes
      .map((node: unknown) => {
        const n = node as Record<string, unknown>;
        if (typeof n.text === "string") return n.text;
        if (Array.isArray(n.children)) return extractText(n.children);
        return "";
      })
      .join("\n");
  return extractText(editor.children as unknown[]);
}

/** Get currently selected text from the browser. */
export function getSelectedText(): string {
  try {
    return window.getSelection()?.toString() ?? "";
  } catch {
    return "";
  }
}

/** Dispatch an AI action from the editor toolbar. */
export function dispatchAiAction(
  actionId: string,
  selectedText: string,
  fullText: string,
): void {
  const prompts: Record<string, (sel: string, doc: string) => string> = {
    improve: (s) => `请帮我润色优化以下文本：\n\n${s}`,
    continue: (_, d) => `请从以下文本继续写作：\n\n${d.slice(-2000)}`,
    summarize: (_, d) => `请总结以下文档：\n\n${d}`,
    "translate-en": (s) => `请将以下文本翻译为英文：\n\n${s}`,
  };
  const fn = prompts[actionId];
  if (fn) {
    openAiAssistant({ message: fn(selectedText, fullText), autoSend: true });
  } else {
    openAiAssistant();
  }
}
