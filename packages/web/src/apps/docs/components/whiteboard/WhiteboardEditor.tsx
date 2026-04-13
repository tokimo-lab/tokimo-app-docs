/**
 * WhiteboardEditor — Excalidraw-based whiteboard editor for Docs.
 *
 * Wraps @excalidraw/excalidraw with:
 * - Theme sync (useThemeCore → dark/light)
 * - Language sync (i18next → excalidraw langCode)
 * - Debounced auto-save to doc_nodes.content
 */

import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useThemeCore } from "@/system";

// Excalidraw langCode mapping from our i18next locale
const LANG_MAP: Record<string, string> = {
  "zh-CN": "zh-CN",
  "zh-TW": "zh-TW",
  "en-US": "en",
  en: "en",
  "ja-JP": "ja-JP",
  ja: "ja-JP",
};

interface WhiteboardData {
  elements?: readonly ExcalidrawElement[];
  appState?: Partial<AppState>;
  files?: BinaryFiles;
}

interface WhiteboardEditorProps {
  content: unknown;
  onChange: (data: unknown) => void;
  nodeId: string;
  userName?: string;
}

const SAVE_DEBOUNCE_MS = 800;

export function WhiteboardEditor({
  content,
  onChange,
  nodeId,
}: WhiteboardEditorProps) {
  const { theme } = useThemeCore();
  const { i18n } = useTranslation();
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether this is the initial mount to avoid saving the initial load
  const initializedRef = useRef(false);

  const langCode = useMemo(
    () => LANG_MAP[i18n.language] ?? "en",
    [i18n.language],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: nodeId triggers re-parse of content for different whiteboards
  const initialData = useMemo<WhiteboardData>(() => {
    // Reset the initialized flag so we skip the first onChange after loading
    initializedRef.current = false;
    if (!content || typeof content !== "object") return {};
    const c = content as WhiteboardData;
    return {
      elements: c.elements ?? [],
      appState: {
        ...(c.appState ?? {}),
        // Let excalidraw manage these based on our theme prop
        theme: undefined,
      },
      files: c.files ?? undefined,
    };
  }, [nodeId]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleChange = useCallback(
    (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => {
      // Skip the initial onChange that fires when excalidraw loads data
      if (!initializedRef.current) {
        initializedRef.current = true;
        return;
      }

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        // Only save non-deleted elements
        const activeElements = elements.filter((el) => !el.isDeleted);
        // Strip volatile appState fields
        const {
          collaborators: _c,
          selectedElementIds: _s,
          ...persistAppState
        } = appState;
        onChangeRef.current({
          elements: activeElements,
          appState: {
            viewBackgroundColor: persistAppState.viewBackgroundColor,
            gridSize: persistAppState.gridSize,
          },
          files,
        });
      }, SAVE_DEBOUNCE_MS);
    },
    [],
  );

  return (
    <div className="relative h-full w-full">
      <Excalidraw
        excalidrawAPI={(api: ExcalidrawImperativeAPI) => {
          if (!excalidrawAPI) setExcalidrawAPI(api);
        }}
        initialData={initialData}
        onChange={handleChange}
        theme={theme === "dark" ? "dark" : "light"}
        langCode={langCode}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            export: false,
          },
        }}
      />
    </div>
  );
}
