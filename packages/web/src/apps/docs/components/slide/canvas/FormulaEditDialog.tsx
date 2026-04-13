import katex from "katex";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

interface FormulaEditDialogProps {
  formula: string;
  onChange: (formula: string) => void;
  onClose: () => void;
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
    try {
      return katex.renderToString(draft, {
        throwOnError: false,
        displayMode: true,
      });
    } catch {
      return `<span style="color:#e53e3e">${t("docs.invalidFormula")}</span>`;
    }
  }, [draft, t]);

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
        className="flex w-[480px] flex-col gap-3 rounded-lg bg-white p-5 shadow-2xl dark:bg-neutral-800"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
          {t("docs.editFormula")}
        </div>
        <div
          className="flex min-h-[60px] items-center justify-center rounded border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-600 dark:bg-neutral-900"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX preview
          dangerouslySetInnerHTML={{ __html: preview }}
        />
        <textarea
          ref={textareaRef}
          className="h-24 resize-none rounded border border-neutral-300 bg-white px-3 py-2 font-mono text-sm dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-100"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            onChange(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder="E = mc^2"
        />
        <div className="flex items-center justify-between">
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
              className="cursor-pointer rounded bg-blue-500 px-4 py-1.5 text-sm text-white hover:bg-blue-600"
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
