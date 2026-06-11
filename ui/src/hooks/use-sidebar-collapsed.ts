import { useCallback } from "react";
import { useRuntimeCtx, useShellPreference } from "@tokimo/sdk";

/**
 * Manages sidebar collapsed state with DB-backed preference persistence.
 *
 * Uses SDK's useShellPreference for standalone-safe storage.
 * Combines auto-collapse (e.g. < 720px) with manual user override.
 */
export function useSidebarCollapsed(
  _componentId: string,
  autoCollapsed: boolean,
) {
  const ctx = useRuntimeCtx();
  const { data, patch } = useShellPreference<{
    sidebar?: { sidebarCollapsed?: boolean };
  }>(ctx);
  const manuallyCollapsed = data.sidebar?.sidebarCollapsed === true;
  const collapsed = autoCollapsed || manuallyCollapsed;

  const onToggleCollapse = useCallback(() => {
    patch({ sidebar: { sidebarCollapsed: !collapsed } });
  }, [collapsed, patch]);

  return { collapsed, onToggleCollapse };
}
