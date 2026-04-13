/**
 * WhiteboardEditor — Excalidraw-based whiteboard editor for Docs.
 *
 * Wraps @excalidraw/excalidraw with:
 * - Theme sync (useThemeCore → dark/light)
 * - Language sync (i18next → excalidraw langCode)
 * - Debounced auto-save to doc_nodes.content
 */

import { Excalidraw, MainMenu } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import { Library } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useThemeCore } from "@/system";
import { useWhiteboardLibraryAdapter } from "./useWhiteboardLibraryAdapter";
import { WhiteboardLibraryPanel } from "./WhiteboardLibraryPanel";

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
  const { i18n, t } = useTranslation();
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const [showLibraryPanel, setShowLibraryPanel] = useState(false);

  // Persist user library to backend
  useWhiteboardLibraryAdapter(excalidrawAPI);

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

  // Intercept native "Browse libraries" link to open our custom panel
  useEffect(() => {
    const container = document.querySelector(".whiteboard-editor");
    if (!container) return;
    const handler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest(".library-menu-browse-button")) {
        e.preventDefault();
        e.stopPropagation();
        setShowLibraryPanel(true);
      }
    };
    container.addEventListener("click", handler, true);
    return () => container.removeEventListener("click", handler, true);
  }, []);

  // Patch Excalidraw built-in locale strings and hide unwanted menu items
  useEffect(() => {
    const TEXT_PATCHES: Record<string, string> = {
      "尚未添加任何项目……": "尚未添加任何项目",
      "Excalidraw 素材库": "公共素材库",
      浏览素材库: "浏览公共素材库",
    };
    // Library menu items to hide (keep only "删除" / "Remove")
    const HIDDEN_MENU_ITEMS = new Set([
      "保存到...",
      "发布",
      "打开",
      "重置素材库",
      "Save as…",
      "Publish",
      "Open",
      "Reset library",
    ]);
    const patchTextNodes = (root: Node) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (;;) {
        const node = walker.nextNode() as Text | null;
        if (!node) break;
        const v = node.nodeValue;
        if (v && v in TEXT_PATCHES) {
          node.nodeValue = TEXT_PATCHES[v];
        }
      }
    };
    const hideLibraryMenuItems = (root: Node) => {
      if (!(root instanceof HTMLElement)) return;
      const menu =
        root.closest?.(".dropdown-menu.library-menu") ??
        root.querySelector?.(".dropdown-menu.library-menu");
      if (!menu) return;
      for (const item of menu.querySelectorAll(".dropdown-menu-item")) {
        const text = item.textContent?.trim() ?? "";
        if (HIDDEN_MENU_ITEMS.has(text)) {
          (item as HTMLElement).style.display = "none";
        }
      }
    };
    // Mark library dragger elements as data-draggable so they bypass
    // the global dragstart preventDefault in Desktop.tsx
    const markDraggable = (root: Node) => {
      if (!(root instanceof HTMLElement)) return;
      for (const dragger of root.querySelectorAll(".library-unit__dragger")) {
        if (!dragger.hasAttribute("data-draggable")) {
          dragger.setAttribute("data-draggable", "true");
        }
      }
      if (
        root.classList?.contains("library-unit__dragger") &&
        !root.hasAttribute("data-draggable")
      ) {
        root.setAttribute("data-draggable", "true");
      }
    };
    // Disable the library ⋮ menu button when no items are checked
    const updateMenuButton = (root: Node) => {
      if (!(root instanceof HTMLElement)) return;
      const sidebar =
        root.closest?.(".layer-ui__library") ??
        root.querySelector?.(".layer-ui__library");
      if (!sidebar) return;
      const btn = sidebar.querySelector(
        ".dropdown-menu-button.zen-mode-transition",
      ) as HTMLButtonElement | null;
      if (!btn) return;
      const hasChecked = sidebar.querySelector(
        ".library-unit__checkbox.is-checked",
      );
      btn.disabled = !hasChecked;
      btn.style.opacity = hasChecked ? "" : "0.35";
      btn.style.pointerEvents = hasChecked ? "" : "none";
    };
    const container = document.querySelector(".whiteboard-editor");
    if (!container) return;
    patchTextNodes(container);
    markDraggable(container);
    updateMenuButton(container);
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "characterData") {
          const v = m.target.nodeValue;
          if (v && v in TEXT_PATCHES) {
            m.target.nodeValue = TEXT_PATCHES[v];
          }
        }
        for (const added of m.addedNodes) {
          patchTextNodes(added);
          hideLibraryMenuItems(added);
          markDraggable(added);
        }
        // Re-check ⋮ button state when checkboxes change
        if (m.type === "attributes" || m.type === "childList") {
          updateMenuButton(container);
        }
      }
    });
    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["checked", "class"],
    });
    return () => observer.disconnect();
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
    <div className="relative h-full w-full whiteboard-editor">
      {/* Hide unwanted Excalidraw UI elements */}
      <style>{`
        .whiteboard-editor .App-toolbar__extra-tools-dropdown .dropdown-menu-container > div:not([class]),
        .whiteboard-editor .App-toolbar__extra-tools-dropdown .dropdown-menu-container > button:last-child {
          display: none !important;
        }
        .whiteboard-editor .library-menu-browse-button {
          cursor: pointer;
        }
      `}</style>
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
      >
        <MainMenu>
          <MainMenu.DefaultItems.Export />
          <MainMenu.DefaultItems.SearchMenu />
          <MainMenu.DefaultItems.Help />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
          <MainMenu.Separator />
          <MainMenu.Item
            onSelect={() => setShowLibraryPanel((v) => !v)}
            icon={<Library className="w-4 h-4" />}
          >
            {t("docs.whiteboardLibrary")}
          </MainMenu.Item>
        </MainMenu>
      </Excalidraw>

      {/* Library browsing panel */}
      {showLibraryPanel && (
        <div className="absolute top-0 right-0 h-full z-10">
          <WhiteboardLibraryPanel
            excalidrawAPI={excalidrawAPI}
            onClose={() => {
              setShowLibraryPanel(false);
              // Re-open native library sidebar so user sees the items they added
              excalidrawAPI?.updateScene({
                appState: {
                  openSidebar: { name: "default", tab: "library" },
                },
              });
            }}
          />
        </div>
      )}
    </div>
  );
}
