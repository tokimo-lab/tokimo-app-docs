/**
 * SheetEditor — Canvas-based spreadsheet editor powered by Univer.
 *
 * Wraps Univer's preset-sheets-core in a React component. The workbook snapshot
 * is loaded from / saved to the doc node's `content` field (JSONB).
 */

import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import UniverPresetSheetsCoreEnUS from "@univerjs/preset-sheets-core/locales/en-US";
import UniverPresetSheetsCoreJaJP from "@univerjs/preset-sheets-core/locales/ja-JP";
import UniverPresetSheetsCoreZhCN from "@univerjs/preset-sheets-core/locales/zh-CN";
import { createUniver, LocaleType, mergeLocales } from "@univerjs/presets";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useThemeCore } from "../../hooks/use-theme";

import "@univerjs/preset-sheets-core/lib/index.css";
import "./sheet-overrides.css";
import { useDocViewport } from "../../hooks/use-doc-viewport";
import { SheetCursorOverlay } from "./SheetCursorOverlay";
import { useSheetCollab } from "./use-sheet-collab";

// ── Locale mapping ─────────────────────────────────────────────────────────

const LOCALE_MAP: Record<string, LocaleType> = {
  "zh-CN": LocaleType.ZH_CN,
  "en-US": LocaleType.EN_US,
  "ja-JP": LocaleType.JA_JP,
};

const LOCALE_PACKS: Record<string, Record<string, unknown>> = {
  "zh-CN": UniverPresetSheetsCoreZhCN as Record<string, unknown>,
  "en-US": UniverPresetSheetsCoreEnUS as Record<string, unknown>,
  "ja-JP": UniverPresetSheetsCoreJaJP as Record<string, unknown>,
};

function resolveLocale(lang: string) {
  return LOCALE_MAP[lang] ?? LocaleType.EN_US;
}

function resolveLocalePack(lang: string) {
  return LOCALE_PACKS[lang] ?? UniverPresetSheetsCoreEnUS;
}

// ── Props ───────────────────────────────────────────────────────────────────

interface SheetEditorProps {
  /** Doc node content (Univer IWorkbookData snapshot or null for new). */
  content: unknown;
  /** Called when the workbook data changes (debounced by parent). */
  onChange: (snapshot: unknown) => void;
  /** Doc node ID — when provided, enables real-time collaborative editing. */
  spaceId?: string;
  relPath?: string;
  /** User display name for remote presence labels. */
  userName?: string;
}

// ── Component ───────────────────────────────────────────────────────────────

export function SheetEditor({
  content,
  onChange,
  spaceId,
  relPath,
  userName,
}: SheetEditorProps) {
  const { i18n } = useTranslation();
  const { theme } = useThemeCore();
  const containerRef = useRef<HTMLDivElement>(null);
  const univerRef = useRef<ReturnType<typeof createUniver> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isReplayingRef = useRef(false);
  const [univerInstance, setUniverInstance] = useState<{
    univer: ReturnType<typeof createUniver>["univer"];
    univerAPI: ReturnType<typeof createUniver>["univerAPI"];
  } | null>(null);

  // Viewport state persistence (active sheet tab)
  const {
    viewState: savedViewport,
    isLoading: viewportLoading,
    saveViewport,
  } = useDocViewport(spaceId, relPath);
  const viewportRestoredRef = useRef(false);

  // Stable reference to initial content — only used on mount
  const initialContentRef = useRef(content);

  const debouncedSave = useCallback(() => {
    // Skip saves triggered by remote collab replay
    if (isReplayingRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (isReplayingRef.current) return;
      const api = univerRef.current?.univerAPI;
      if (!api) return;
      const workbook = api.getActiveWorkbook();
      if (!workbook) return;
      const snapshot = workbook.save();
      onChangeRef.current(snapshot);
    }, 800);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const lang = i18n.language;
    const locale = resolveLocale(lang);
    const localePack = resolveLocalePack(lang);

    const result = createUniver({
      locale,
      locales: {
        [locale]: mergeLocales(localePack as Record<string, unknown>),
      },
      presets: [
        UniverSheetsCorePreset({
          container: el,
        }),
      ],
    });

    univerRef.current = result;
    setUniverInstance({ univer: result.univer, univerAPI: result.univerAPI });

    // Load existing snapshot or create empty workbook
    const data = initialContentRef.current;
    if (
      data &&
      typeof data === "object" &&
      "id" in (data as Record<string, unknown>)
    ) {
      result.univerAPI.createWorkbook(data as Record<string, unknown>);
    } else {
      result.univerAPI.createWorkbook({});
    }

    // Listen for changes to trigger auto-save
    const disposable = result.univerAPI.onCommandExecuted(() => {
      debouncedSave();
    });

    return () => {
      disposable.dispose();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      result.univer.dispose();
      univerRef.current = null;
      setUniverInstance(null);
    };
    // Only re-create on mount / language change
  }, [i18n.language, debouncedSave]);

  // Real-time collaboration via Yjs
  useSheetCollab({
    spaceId: spaceId ?? null,
    relPath: relPath ?? null,
    userName: userName ?? "Anonymous",
    univer: univerInstance?.univer as never,
    univerAPI: univerInstance?.univerAPI as never,
    isReplayingRef,
    initialContent: initialContentRef.current,
  });

  // Toggle dark mode reactively without re-creating the Univer instance
  useEffect(() => {
    univerRef.current?.univerAPI.toggleDarkMode(theme === "dark");
  }, [theme]);

  // ── Restore active sheet tab ──────────────────────────────────────────
  useEffect(() => {
    if (viewportLoading || viewportRestoredRef.current || !univerInstance)
      return;
    viewportRestoredRef.current = true;

    const sv = savedViewport as { activeSheetId?: string } | null;
    if (!sv?.activeSheetId) return;

    const workbook = univerInstance.univerAPI.getActiveWorkbook();
    if (!workbook) return;
    const sheet = workbook.getSheetBySheetId(sv.activeSheetId);
    if (sheet) {
      workbook.setActiveSheet(sheet);
    }
  }, [viewportLoading, savedViewport, univerInstance]);

  // ── Track active sheet changes ────────────────────────────────────────
  useEffect(() => {
    if (!univerInstance) return;
    const disposable = univerInstance.univerAPI.onCommandExecuted((cmd) => {
      // SetWorksheetActivateCommand fires when user switches tabs
      if (
        typeof cmd === "object" &&
        cmd !== null &&
        "id" in cmd &&
        typeof (cmd as { id: string }).id === "string" &&
        (cmd as { id: string }).id.includes("SetWorksheetActivate")
      ) {
        const wb = univerInstance.univerAPI.getActiveWorkbook();
        const sheetId = wb?.getActiveSheet()?.getSheetId();
        if (sheetId) {
          saveViewport({ activeSheetId: sheetId });
        }
      }
    });
    return () => disposable.dispose();
  }, [univerInstance, saveViewport]);

  return (
    <div className="relative h-full w-full">
      <div
        ref={containerRef}
        className="h-full w-full sheet-editor-overrides"
      />
      {relPath && (
        <SheetCursorOverlay
          nodeId={relPath ?? null}
          univerAPI={univerInstance?.univerAPI as never}
          containerRef={containerRef}
        />
      )}
    </div>
  );
}
