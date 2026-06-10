import type { Editor } from "@tiptap/react";

let currentEditor: Editor | null = null;
const listeners = new Set<() => void>();

export function setActiveTextEditor(editor: Editor | null) {
  currentEditor = editor;
  for (const l of listeners) l();
}

export function getActiveTextEditor(): Editor | null {
  return currentEditor;
}

export function subscribeTextEditor(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
