/**
 * WhiteboardEditor — Excalidraw-based whiteboard editor for Docs.
 *
 * Wraps @excalidraw/excalidraw with:
 * - Theme sync (useThemeCore → dark/light)
 * - Language sync (i18next → excalidraw langCode)
 * - Debounced auto-save to doc_nodes.content
 */

import {
  convertToExcalidrawElements,
  Excalidraw,
  MainMenu,
} from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type {
  ExcalidrawElement,
  FileId,
} from "@excalidraw/excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
  DataURL,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMessage } from "../../hooks/use-message";
import { useThemeCore } from "../../hooks/use-theme";
import { useDocViewport } from "../../hooks/use-doc-viewport";
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
  spaceId: string;
  relPath: string;
  userName?: string;
}

const SAVE_DEBOUNCE_MS = 800;
const MAX_IMAGE_WIDTH = 640;
const MAX_IMAGE_HEIGHT = 400;

function readFileAsDataUrl(file: File): Promise<DataURL> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
    reader.onload = () => resolve(reader.result as DataURL);
    reader.readAsDataURL(file);
  });
}

function loadImageSize(dataUrl: DataURL): Promise<{
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error("Image decode failed"));
    image.onload = () =>
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.src = dataUrl;
  });
}

function sceneSnapshotSignature(scene: WhiteboardData): string {
  return JSON.stringify({
    elements: (scene.elements ?? []).map((element) => [
      element.id,
      element.version,
      element.versionNonce,
    ]),
    appState: scene.appState,
    files: Object.values(scene.files ?? {}).map((file) => [
      file.id,
      file.created,
      file.dataURL.length,
    ]),
  });
}

export function WhiteboardEditor({
  content,
  onChange,
  spaceId,
  relPath,
}: WhiteboardEditorProps) {
  const { theme } = useThemeCore();
  const { i18n, t } = useTranslation();
  const message = useMessage();
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const [showLibraryPanel, setShowLibraryPanel] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Persist user library to backend
  useWhiteboardLibraryAdapter(excalidrawAPI);

  // Viewport state persistence
  const {
    viewState: savedViewport,
    isLoading: viewportLoading,
    saveViewport,
  } = useDocViewport(spaceId, relPath);
  const viewportRestoredRef = useRef(false);

  useEffect(() => {
    viewportRestoredRef.current = false;
  }, [relPath]);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSceneRef = useRef<WhiteboardData | null>(null);
  const lastQueuedSceneSignatureRef = useRef<string | null>(null);
  // Track whether this is the initial mount to avoid saving the initial load
  const initializedRef = useRef(false);

  const langCode = useMemo(
    () => LANG_MAP[i18n.language] ?? "en",
    [i18n.language],
  );

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
  }, [relPath]);

  const flushPendingSave = useCallback(() => {
    const pending = pendingSceneRef.current;
    if (!pending) return;
    pendingSceneRef.current = null;
    onChangeRef.current(pending);
  }, []);

  const queueSceneSave = useCallback(
    (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => {
      const snapshot: WhiteboardData = {
        elements: elements.filter((element) => !element.isDeleted),
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize,
        },
        files,
      };
      const signature = sceneSnapshotSignature(snapshot);
      if (signature === lastQueuedSceneSignatureRef.current) return;
      lastQueuedSceneSignatureRef.current = signature;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      pendingSceneRef.current = snapshot;
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        flushPendingSave();
      }, SAVE_DEBOUNCE_MS);
    },
    [flushPendingSave],
  );

  // Flush the last edit before switching documents or closing the window.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        flushPendingSave();
      }
    };
  }, [flushPendingSave]);

  // 3-tier viewport restore: saved state → fit content → default
  useEffect(() => {
    if (!excalidrawAPI || viewportLoading || viewportRestoredRef.current)
      return;
    viewportRestoredRef.current = true;

    const sv = savedViewport as {
      scrollX?: number;
      scrollY?: number;
      zoom?: number;
    } | null;

    if (sv?.scrollX != null && sv?.scrollY != null && sv?.zoom != null) {
      // Tier 1: Restore saved viewport
      excalidrawAPI.updateScene({
        appState: {
          scrollX: sv.scrollX,
          scrollY: sv.scrollY,
          zoom: { value: sv.zoom as AppState["zoom"]["value"] },
        },
      });
    } else {
      // Tier 2: Fit content to viewport (if there are elements)
      const elements = excalidrawAPI.getSceneElements();
      if (elements.length > 0) {
        excalidrawAPI.scrollToContent(undefined, {
          fitToViewport: true,
          viewportZoomFactor: 0.9,
          maxZoom: 1,
        });
      }
      // Tier 3: Default viewport (Excalidraw's built-in default) — no action needed
    }
  }, [excalidrawAPI, viewportLoading, savedViewport]);

  // Track scroll/zoom changes and save viewport state
  useEffect(() => {
    if (!excalidrawAPI) return;
    const unsubscribe = excalidrawAPI.onScrollChange(
      (scrollX: number, scrollY: number, zoom: { value: number }) => {
        saveViewport({ scrollX, scrollY, zoom: zoom.value });
      },
    );
    return unsubscribe;
  }, [excalidrawAPI, saveViewport]);

  // Intercept native integrations that do not work reliably in an embedded
  // browser, while preserving Excalidraw's own toolbar affordances.
  useEffect(() => {
    const container = document.querySelector(".whiteboard-editor");
    if (!container) return;
    const handler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest(".library-menu-browse-button")) {
        e.preventDefault();
        e.stopPropagation();
        setShowLibraryPanel(true);
        return;
      }

      const toolbarLabel = target.closest("label");
      if (
        target.closest('[data-testid="toolbar-image"]') ||
        toolbarLabel?.querySelector('[data-testid="toolbar-image"]')
      ) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        imageInputRef.current?.click();
      }
    };
    container.addEventListener("click", handler, true);
    return () => container.removeEventListener("click", handler, true);
  }, []);

  const handleImageFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      if (!file || !excalidrawAPI) return;

      try {
        const dataURL = await readFileAsDataUrl(file);
        const naturalSize = await loadImageSize(dataURL);
        if (naturalSize.width <= 0 || naturalSize.height <= 0) {
          throw new Error("Invalid image dimensions");
        }

        const fileId = crypto.randomUUID() as FileId;
        const scale = Math.min(
          1,
          MAX_IMAGE_WIDTH / naturalSize.width,
          MAX_IMAGE_HEIGHT / naturalSize.height,
        );
        const width = naturalSize.width * scale;
        const height = naturalSize.height * scale;
        const appState = excalidrawAPI.getAppState();
        const x =
          appState.width / (2 * appState.zoom.value) -
          appState.scrollX -
          width / 2;
        const y =
          appState.height / (2 * appState.zoom.value) -
          appState.scrollY -
          height / 2;

        const [imageElement] = convertToExcalidrawElements(
          [
            {
              type: "image",
              x,
              y,
              width,
              height,
              fileId,
              status: "saved",
              scale: [1, 1],
            },
          ],
          { regenerateIds: true },
        );
        const fileData: BinaryFileData = {
          id: fileId,
          dataURL,
          mimeType: file.type as BinaryFileData["mimeType"],
          created: Date.now(),
        };
        const nextElements = [
          ...excalidrawAPI.getSceneElements(),
          imageElement,
        ];
        const nextFiles = {
          ...excalidrawAPI.getFiles(),
          [fileId]: fileData,
        };

        excalidrawAPI.addFiles([fileData]);
        excalidrawAPI.updateScene({
          elements: nextElements,
        });
        // updateScene does not guarantee that the React onChange prop runs.
        // Persist the same complete scene snapshot explicitly.
        queueSceneSave(nextElements, appState, nextFiles);
      } catch (error) {
        console.error("Failed to insert whiteboard image", error);
        message.error(t("docs.whiteboardImageUploadFailed"));
      }
    },
    [excalidrawAPI, message, queueSceneSave, t],
  );

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

      queueSceneSave(elements, appState, files);
    },
    [queueSceneSave],
  );

  return (
    <div className="relative h-full w-full whiteboard-editor">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void handleImageFileChange(event)}
      />
      {/* Hide unwanted Excalidraw UI elements */}
      <style>{`
        .whiteboard-editor .App-toolbar__extra-tools-dropdown .dropdown-menu-container > div:not([class]),
        .whiteboard-editor .App-toolbar__extra-tools-dropdown .dropdown-menu-container > button:last-child {
          display: none !important;
        }
        .whiteboard-editor .library-menu-browse-button {
          cursor: pointer;
        }
        /* Hide external link buttons inside Help dialog */
        .HelpDialog__header {
          display: none !important;
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
          <MainMenu.DefaultItems.SearchMenu />
          <MainMenu.DefaultItems.Help />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
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
