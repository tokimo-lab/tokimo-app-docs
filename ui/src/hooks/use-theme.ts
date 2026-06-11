/**
 * useThemeCore — theme hook for standalone docs app.
 *
 * Uses the SDK's useAppearance() to get the current theme ("light" | "dark").
 * Provides a compatible interface with the monolith's useThemeCore().
 */

import { useAppearance } from "@tokimo/sdk";

export function useThemeCore() {
  const { theme } = useAppearance();
  return { theme };
}
