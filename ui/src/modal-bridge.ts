import type { AppRuntimeCtx } from "@tokimo/sdk";

export interface SpaceEditorBridge {
  kind: "space-editor";
  ctx: AppRuntimeCtx;
  onSaved?: (savedId: string) => void;
  onDeleted?: () => void;
}

export type ModalBridge = SpaceEditorBridge;

const registry = new Map<string, ModalBridge>();
let counter = 0;

export function registerBridge(b: ModalBridge): string {
  counter += 1;
  const id = `docs-bridge-${Date.now()}-${counter}`;
  registry.set(id, b);
  return id;
}

export function getBridge(id: string): ModalBridge | undefined {
  return registry.get(id);
}
