/**
 * useMessage — toast-based message hook for standalone docs app.
 *
 * Wraps `useToast` from @tokimo/ui, providing .success() and .error() methods
 * that match the monolith's useMessage() interface.
 */

import { useToast } from "@tokimo/ui";

export function useMessage() {
  const toast = useToast();
  return {
    success: (msg: string) => toast.success(msg),
    error: (msg: string) => toast.error(msg),
    info: (msg: string) => toast.info(msg),
    warning: (msg: string) => toast.warning(msg),
  };
}
