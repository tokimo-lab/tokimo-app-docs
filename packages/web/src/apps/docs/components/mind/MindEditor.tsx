/**
 * MindEditor — Mind map editor powered by mind-elixir.
 *
 * Wraps mind-elixir in a React component. The mind map data
 * is loaded from / saved to the doc node's `content` field (JSONB).
 */

import MindElixir from "mind-elixir";
import "mind-elixir/style.css";

import type { MindElixirData, MindElixirInstance } from "mind-elixir";
import type { LangPack } from "mind-elixir/i18n";
import { en, ja, zh_CN } from "mind-elixir/i18n";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useThemeCore } from "@/system";

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

export function MindEditor({ content, onChange }: MindEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mindRef = useRef<MindElixirInstance | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const contentRef = useRef(content);
  contentRef.current = content;

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
      if (!mindRef.current) return;
      const data = mindRef.current.getData();
      onChangeRef.current(data);
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

    const locale = LOCALE_MAP[langRef.current] ?? zh_CN;
    const mind = new MindElixir({
      el,
      direction: data.direction ?? 2,
      editable: true,
      contextMenu: { locale },
      toolBar: true,
      keypress: true,
      allowUndo: true,
      theme: isDarkRef.current ? MindElixir.DARK_THEME : MindElixir.THEME,
    });

    mind.init(data);

    // Listen for any operation and debounce-save
    mind.bus.addListener("operation", () => debouncedSave());

    mindRef.current = mind;

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      mind.destroy();
      mindRef.current = null;
    };
  }, [debouncedSave]);

  // ── Theme sync ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mindRef.current) return;
    const newTheme = isDark ? MindElixir.DARK_THEME : MindElixir.THEME;
    mindRef.current.changeTheme(newTheme);
  }, [isDark]);

  return (
    <div className="relative flex-1 overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
