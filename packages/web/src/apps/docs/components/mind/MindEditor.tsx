/**
 * MindEditor — Mind map editor powered by mind-elixir.
 *
 * Wraps mind-elixir in a React component. The mind map data
 * is loaded from / saved to the doc node's `content` field (JSONB).
 * Supports Yjs-based real-time collaboration via useMindCollab.
 */

import MindElixir from "mind-elixir";
import "mind-elixir/style.css";
import "./mind-overrides.css";

import type { MindElixirData, MindElixirInstance } from "mind-elixir";
import type { LangPack } from "mind-elixir/i18n";
import { en, ja, zh_CN } from "mind-elixir/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useThemeCore } from "@/system";
import { MindOutlineView } from "./MindOutlineView";
import { MindViewSwitcher } from "./MindViewSwitcher";
import { FEISHU_DARK_THEME, FEISHU_LIGHT_THEME } from "./mind-theme";
import { useMindCollab } from "./use-mind-collab";

type ViewMode = "mindmap" | "outline";

// ── Locale mapping ─────────────────────────────────────────────────────────

const LOCALE_MAP: Record<string, LangPack> = {
  "zh-CN": zh_CN,
  "en-US": en,
  "ja-JP": ja,
};

// ── Props ───────────────────────────────────────────────────────────────────

interface MindEditorProps {
  /** Doc node content (MindElixirData JSON or null for new). */
  content: unknown;
  /** Called when the mind map data changes (will be debounced internally). */
  onChange: (data: MindElixirData) => void;
  /** Doc node ID for collaboration room. */
  nodeId: string;
  /** User display name for collab presence. */
  userName?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isMindElixirData(v: unknown): v is MindElixirData {
  return (
    typeof v === "object" &&
    v !== null &&
    "nodeData" in v &&
    typeof (v as MindElixirData).nodeData === "object"
  );
}

// ── Component ───────────────────────────────────────────────────────────────

export function MindEditor({
  content,
  onChange,
  nodeId,
  userName,
}: MindEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mindRef = useRef<MindElixirInstance | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const contentRef = useRef(content);
  contentRef.current = content;
  const isReplayingRef = useRef(false);

  const [mindInstance, setMindInstance] = useState<MindElixirInstance | null>(
    null,
  );
  const [viewMode, setViewMode] = useState<ViewMode>("mindmap");
  const [outlineData, setOutlineData] = useState<MindElixirData | null>(null);

  const { theme } = useThemeCore();
  const isDark = theme === "dark";
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;

  const { i18n } = useTranslation();
  const langRef = useRef(i18n.language);
  langRef.current = i18n.language;

  const debouncedSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (!mindRef.current || isReplayingRef.current) return;
      const { theme: _t, ...data } = mindRef.current.getData();
      onChangeRef.current(data as MindElixirData);
    }, 800);
  }, []);

  // ── Init mind-elixir on mount ──────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const initialContent = contentRef.current;
    const data: MindElixirData = isMindElixirData(initialContent)
      ? initialContent
      : MindElixir.new("思维导图");

    // Strip embedded theme from data — we always apply our own Feishu theme
    const { theme: _savedTheme, ...cleanData } = data;

    const locale = LOCALE_MAP[langRef.current] ?? zh_CN;
    const customTheme = isDarkRef.current
      ? FEISHU_DARK_THEME
      : FEISHU_LIGHT_THEME;
    const mind = new MindElixir({
      el,
      direction: cleanData.direction ?? 2,
      editable: true,
      contextMenu: { locale },
      toolBar: true,
      keypress: true,
      allowUndo: true,
      theme: customTheme,
    });

    mind.init(cleanData as MindElixirData);
    // Re-apply after init (init can override from data.theme)
    mind.changeTheme(customTheme);

    // Listen for any operation and debounce-save
    mind.bus.addListener("operation", () => debouncedSave());

    mindRef.current = mind;
    setMindInstance(mind);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      mind.destroy();
      mindRef.current = null;
      setMindInstance(null);
    };
  }, [debouncedSave]);

  // ── Theme sync ─────────────────────────────────────────────────────────
  const customTheme = isDark ? FEISHU_DARK_THEME : FEISHU_LIGHT_THEME;

  useEffect(() => {
    if (!mindRef.current) return;
    mindRef.current.changeTheme(customTheme);
  }, [customTheme]);

  // ── Collab ─────────────────────────────────────────────────────────────
  useMindCollab({
    nodeId,
    userName: userName ?? "Anonymous",
    mind: mindInstance,
    isReplayingRef,
    customTheme,
  });

  // ── View mode switching ───────────────────────────────────────────────
  const handleModeChange = useCallback(
    (mode: ViewMode) => {
      if (mode === viewMode) return;
      if (mode === "outline" && mindRef.current) {
        // Capture current mind map data for outline view
        const { theme: _t, ...data } = mindRef.current.getData();
        setOutlineData(data as MindElixirData);
      } else if (mode === "mindmap" && outlineData && mindRef.current) {
        // Apply outline edits back to mind-elixir
        mindRef.current.refresh(outlineData);
        mindRef.current.changeTheme(
          isDarkRef.current ? FEISHU_DARK_THEME : FEISHU_LIGHT_THEME,
          false,
        );
      }
      setViewMode(mode);
    },
    [viewMode, outlineData],
  );

  const handleOutlineChange = useCallback((data: MindElixirData) => {
    setOutlineData(data);
    const { theme: _t, ...clean } = data;
    onChangeRef.current(clean as MindElixirData);
  }, []);

  return (
    <div className="mind-feishu relative flex-1 overflow-hidden">
      <MindViewSwitcher mode={viewMode} onModeChange={handleModeChange} />
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ display: viewMode === "mindmap" ? undefined : "none" }}
      />
      {viewMode === "outline" && outlineData && (
        <MindOutlineView
          data={outlineData}
          onChange={handleOutlineChange}
          isDark={isDark}
        />
      )}
    </div>
  );
}
