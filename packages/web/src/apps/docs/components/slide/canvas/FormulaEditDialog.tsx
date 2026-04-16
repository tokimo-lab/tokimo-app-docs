import { cn } from "@tokiomo/components";
import katex from "katex";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  FORMULA_LIST,
  SYMBOL_LIST,
  type SymbolCategory,
} from "../lib/latex-symbols";

interface FormulaEditDialogProps {
  formula: string;
  onChange: (formula: string) => void;
  onClose: () => void;
}

type RightTab = "symbols" | "presets";

function renderKatex(latex: string, displayMode = false): string {
  try {
    return katex.renderToString(latex, { throwOnError: false, displayMode });
  } catch {
    return "";
  }
}

export function FormulaEditDialog({
  formula,
  onChange,
  onClose,
}: FormulaEditDialogProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(formula);
  const originalRef = useRef(formula);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [rightTab, setRightTab] = useState<RightTab>("symbols");
  const [symbolTab, setSymbolTab] = useState<string>(SYMBOL_LIST[0].type);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleCancel = useCallback(() => {
    onChange(originalRef.current);
    onClose();
  }, [onChange, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancel();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        onClose();
      }
    },
    [handleCancel, onClose],
  );

  const preview = useMemo(() => {
    if (!draft.trim()) return "";
    return renderKatex(draft, true);
  }, [draft]);

  const insertAtCursor = useCallback(
    (latex: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = draft.slice(0, start) + latex + draft.slice(end);
      setDraft(newValue);
      onChange(newValue);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start + latex.length, start + latex.length);
      });
    },
    [draft, onChange],
  );

  const applyPreset = useCallback(
    (latex: string) => {
      setDraft(latex);
      onChange(latex);
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    },
    [onChange],
  );

  const activeCategory = useMemo(
    () => SYMBOL_LIST.find((c) => c.type === symbolTab) ?? SYMBOL_LIST[0],
    [symbolTab],
  );

  return createPortal(
    // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: dialog container */}
      <div
        className="flex max-h-[85vh] w-[760px] flex-col rounded-lg bg-white shadow-2xl dark:bg-neutral-800"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-neutral-200 px-5 py-3 text-sm font-medium text-neutral-700 dark:border-neutral-600 dark:text-neutral-200">
          {t("docs.editFormula")}
        </div>

        {/* Body: left editor + right panel */}
        <div className="flex min-h-0 flex-1">
          {/* Left column */}
          <div className="flex w-[55%] flex-col gap-3 border-r border-neutral-200 p-4 dark:border-neutral-600">
            <textarea
              ref={textareaRef}
              className="min-h-[120px] flex-1 resize-none rounded border border-neutral-300 bg-white px-3 py-2 font-mono text-sm dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                onChange(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              placeholder="E = mc^2"
            />
            <div
              className="flex min-h-[80px] items-center justify-center overflow-auto rounded border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-600 dark:bg-neutral-900"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX preview
              dangerouslySetInnerHTML={{
                __html:
                  preview ||
                  `<span class="text-neutral-400 text-sm">${t("docs.editFormula")}</span>`,
              }}
            />
          </div>

          {/* Right column */}
          <div className="flex w-[45%] flex-col">
            {/* Top tabs: Symbols | Presets */}
            <div className="flex border-b border-neutral-200 dark:border-neutral-600">
              <button
                type="button"
                className={cn(
                  "cursor-pointer px-4 py-2 text-sm transition-colors",
                  rightTab === "symbols"
                    ? "border-b-2 border-[var(--accent)] font-medium text-[var(--accent)]"
                    : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200",
                )}
                onClick={() => setRightTab("symbols")}
              >
                {t("docs.commonSymbols")}
              </button>
              <button
                type="button"
                className={cn(
                  "cursor-pointer px-4 py-2 text-sm transition-colors",
                  rightTab === "presets"
                    ? "border-b-2 border-[var(--accent)] font-medium text-[var(--accent)]"
                    : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200",
                )}
                onClick={() => setRightTab("presets")}
              >
                {t("docs.presetFormulas")}
              </button>
            </div>

            {rightTab === "symbols" ? (
              <SymbolPanel
                categories={SYMBOL_LIST}
                activeType={symbolTab}
                onTabChange={setSymbolTab}
                activeCategory={activeCategory}
                onInsert={insertAtCursor}
                t={t}
              />
            ) : (
              <PresetPanel onSelect={applyPreset} t={t} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-neutral-200 px-5 py-3 dark:border-neutral-600">
          <span className="text-xs text-neutral-400">
            {t("docs.ctrlEnterSave")}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="cursor-pointer rounded px-4 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700"
              onClick={handleCancel}
            >
              {t("docs.cancel")}
            </button>
            <button
              type="button"
              className="cursor-pointer rounded bg-[var(--accent-subtle)]0 px-4 py-1.5 text-sm text-white hover:bg-[var(--accent-hover)]"
              onClick={() => onClose()}
            >
              {t("docs.confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── Symbol sub-tabs + grid ── */

interface SymbolPanelProps {
  categories: SymbolCategory[];
  activeType: string;
  onTabChange: (type: string) => void;
  activeCategory: SymbolCategory;
  onInsert: (latex: string) => void;
  t: (key: string) => string;
}

function SymbolPanel({
  categories,
  activeType,
  onTabChange,
  activeCategory,
  onInsert,
  t,
}: SymbolPanelProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-neutral-100 px-3 pt-2 dark:border-neutral-700">
        {categories.map((cat) => (
          <button
            key={cat.type}
            type="button"
            className={cn(
              "cursor-pointer rounded-t px-2.5 py-1 text-xs transition-colors",
              activeType === cat.type
                ? "bg-[var(--accent-subtle)] font-medium text-[var(--accent)] dark:bg-[var(--accent-subtle)] dark:text-[var(--accent)]"
                : "text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700",
            )}
            onClick={() => onTabChange(cat.type)}
          >
            {t(cat.label)}
          </button>
        ))}
      </div>

      {/* Symbol grid */}
      <div className="flex flex-1 flex-wrap content-start gap-1 overflow-y-auto p-3">
        {activeCategory.children.map((sym) => (
          <button
            key={`${activeCategory.type}-${sym.latex}`}
            type="button"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-neutral-200 bg-white text-sm hover:border-[var(--accent)] hover:bg-[var(--accent-subtle)] dark:border-neutral-600 dark:bg-neutral-700 dark:hover:border-[var(--accent)] dark:hover:bg-[var(--accent-subtle)]"
            title={sym.latex}
            onClick={() => onInsert(sym.latex)}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX symbol
            dangerouslySetInnerHTML={{
              __html: renderKatex(sym.latex),
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Preset formula list ── */

interface PresetPanelProps {
  onSelect: (latex: string) => void;
  t: (key: string) => string;
}

function PresetPanel({ onSelect, t }: PresetPanelProps) {
  return (
    <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
      {FORMULA_LIST.map((f) => (
        <button
          key={f.label}
          type="button"
          className="cursor-pointer rounded border border-neutral-200 bg-white p-2 text-left transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-subtle)] dark:border-neutral-600 dark:bg-neutral-700 dark:hover:border-[var(--accent)] dark:hover:bg-[var(--accent-subtle)]"
          onClick={() => onSelect(f.latex)}
        >
          <div
            className="overflow-x-auto pb-1"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX formula
            dangerouslySetInnerHTML={{
              __html: renderKatex(f.latex, true),
            }}
          />
          <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {t(f.label)}
          </div>
        </button>
      ))}
    </div>
  );
}
