import { cn, useConfirm, useToast } from "@tokimo/ui";
import {
  ChevronRight,
  FileDown,
  FileUp,
  Keyboard,
  Menu,
  RotateCcw,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { downloadSlideAsImage } from "../lib/export-image";
import { createDefaultPresentation, isSlidePresentation } from "../types";
import { useSlideStore } from "../use-slide-store";

const SHORTCUTS = [
  ["Ctrl+Z", "docs.slideShortcutUndo"],
  ["Ctrl+Shift+Z", "docs.slideShortcutRedo"],
  ["Ctrl+C", "docs.slideShortcutCopy"],
  ["Ctrl+V", "docs.slideShortcutPaste"],
  ["Ctrl+X", "docs.slideShortcutCut"],
  ["Ctrl+D", "docs.slideShortcutDuplicate"],
  ["Ctrl+A", "docs.slideShortcutSelectAll"],
  ["Ctrl+G", "docs.slideShortcutGroup"],
  ["Ctrl+Shift+G", "docs.slideShortcutUngroup"],
  ["Delete", "docs.slideShortcutDelete"],
  ["Ctrl+F", "docs.slideShortcutSearch"],
  ["Ctrl+H", "docs.slideShortcutReplace"],
  ["Space + Drag", "docs.slideShortcutPan"],
  ["Ctrl + ↑/↓", "docs.slideShortcutLayer"],
] as const;

const menuItemClass =
  "flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-black/5 dark:hover:bg-white/5";

export function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<"import" | "export" | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const presentation = useSlideStore((s) => s.presentation);
  const setPresentation = useSlideStore((s) => s.setPresentation);
  const { t } = useTranslation();
  const message = useToast();
  const [confirmHolder, confirm] = useConfirm();

  const closeMenu = useCallback(() => {
    setOpen(false);
    setSubmenu(null);
  }, []);

  const handleExportPng = useCallback(async () => {
    closeMenu();
    const viewport = document.querySelector<HTMLElement>(
      '[data-viewport="true"]',
    );
    if (!viewport) return;
    await downloadSlideAsImage(viewport, "slide");
  }, [closeMenu]);

  const handleExportJson = useCallback(() => {
    closeMenu();
    const json = JSON.stringify(presentation, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "presentation.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [closeMenu, presentation]);

  const handleExportPptx = useCallback(() => {
    closeMenu();
    message.info(t("docs.slidePptxExportComingSoon"));
  }, [closeMenu, message, t]);

  const handleExportMarkdown = useCallback(() => {
    closeMenu();
    message.info(t("docs.slideMarkdownExportComingSoon"));
  }, [closeMenu, message, t]);

  const handleImportJson = useCallback(() => {
    closeMenu();
    fileInputRef.current?.click();
  }, [closeMenu]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed: unknown = JSON.parse(reader.result as string);
          if (isSlidePresentation(parsed)) {
            setPresentation(parsed);
          } else {
            message.error(t("docs.slideInvalidFile"));
          }
        } catch {
          message.error(t("docs.slideFileParseFailed"));
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [message, setPresentation, t],
  );

  const handleImportPptx = useCallback(() => {
    closeMenu();
    message.info(t("docs.slidePptxImportComingSoon"));
  }, [closeMenu, message, t]);

  const handleReset = useCallback(() => {
    closeMenu();
    confirm({
      title: t("docs.slideReset"),
      content: t("docs.slideResetConfirm"),
      okText: t("docs.slideReset"),
      cancelText: t("common.cancel"),
      variant: "danger",
      onOk: () => setPresentation(createDefaultPresentation()),
    });
  }, [closeMenu, confirm, setPresentation, t]);

  return (
    <>
      <div className="relative">
        <button
          type="button"
          className={cn(
            "flex cursor-pointer items-center justify-center rounded-md p-1.5",
            "hover:bg-black/5 dark:hover:bg-white/5",
            open &&
              "bg-accent-subtle text-accent-text",
          )}
          onClick={() => setOpen(!open)}
          title={t("docs.slideMenu")}
        >
          <Menu size={18} />
        </button>

        {open && (
          <>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop overlay */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: no keyboard interaction needed */}
            <div className="fixed inset-0 z-40" onClick={closeMenu} />
            <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-md border border-border-subtle bg-white py-1 shadow-lg dark:bg-neutral-800">
              {/* Import submenu */}
              {/* biome-ignore lint/a11y/noStaticElementInteractions: submenu hover trigger */}
              <div
                className="relative"
                onMouseEnter={() => setSubmenu("import")}
                onMouseLeave={() =>
                  setSubmenu((s) => (s === "import" ? null : s))
                }
              >
                <button type="button" className={menuItemClass}>
                  <FileUp size={14} />
                  {t("docs.slideImportFile")}
                  <ChevronRight size={12} className="ml-auto" />
                </button>
                {submenu === "import" && (
                  <div className="absolute left-full top-0 min-w-[120px] rounded-md border border-border-subtle bg-white py-1 shadow-lg dark:bg-neutral-800">
                    <button
                      type="button"
                      className={menuItemClass}
                      onClick={handleImportPptx}
                    >
                      PPTX
                    </button>
                    <button
                      type="button"
                      className={menuItemClass}
                      onClick={handleImportJson}
                    >
                      JSON
                    </button>
                  </div>
                )}
              </div>

              {/* Export submenu */}
              {/* biome-ignore lint/a11y/noStaticElementInteractions: submenu hover trigger */}
              <div
                className="relative"
                onMouseEnter={() => setSubmenu("export")}
                onMouseLeave={() =>
                  setSubmenu((s) => (s === "export" ? null : s))
                }
              >
                <button type="button" className={menuItemClass}>
                  <FileDown size={14} />
                  {t("docs.slideExportFile")}
                  <ChevronRight size={12} className="ml-auto" />
                </button>
                {submenu === "export" && (
                  <div className="absolute left-full top-0 min-w-[120px] rounded-md border border-border-subtle bg-white py-1 shadow-lg dark:bg-neutral-800">
                    <button
                      type="button"
                      className={menuItemClass}
                      onClick={handleExportPptx}
                    >
                      PPTX
                    </button>
                    <button
                      type="button"
                      className={menuItemClass}
                      onClick={handleExportJson}
                    >
                      JSON
                    </button>
                    <button
                      type="button"
                      className={menuItemClass}
                      onClick={handleExportPng}
                    >
                      PNG
                    </button>
                    <button
                      type="button"
                      className={menuItemClass}
                      onClick={handleExportMarkdown}
                    >
                      Markdown
                    </button>
                  </div>
                )}
              </div>

              <div className="my-1 h-px bg-border-subtle" />

              <button
                type="button"
                className={menuItemClass}
                onClick={handleReset}
              >
                <RotateCcw size={14} />
                {t("docs.slideReset")}
              </button>

              <div className="my-1 h-px bg-border-subtle" />

              <button
                type="button"
                className={menuItemClass}
                onClick={() => {
                  closeMenu();
                  setShortcutsOpen(true);
                }}
              >
                <Keyboard size={14} />
                {t("docs.slideShortcuts")}
              </button>
            </div>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Shortcuts modal */}
      {shortcutsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop overlay */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: no keyboard interaction needed */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShortcutsOpen(false)}
          />
          <div className="relative z-10 w-[420px] rounded-lg bg-white p-5 shadow-2xl dark:bg-neutral-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {t("docs.slideShortcuts")}
              </h3>
              <button
                type="button"
                className="cursor-pointer rounded p-1 hover:bg-black/5 dark:hover:bg-white/5"
                onClick={() => setShortcutsOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="py-1.5 text-left font-medium text-fg-muted">
                    {t("docs.slideShortcutKey")}
                  </th>
                  <th className="py-1.5 text-left font-medium text-fg-muted">
                    {t("docs.slideShortcutAction")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {SHORTCUTS.map(([key, descriptionKey]) => (
                  <tr
                    key={key}
                    className="border-b border-border-subtle last:border-0"
                  >
                    <td className="py-1.5">
                      <kbd className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] dark:bg-neutral-700">
                        {key}
                      </kbd>
                    </td>
                    <td className="py-1.5">{t(descriptionKey)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {confirmHolder}
    </>
  );
}
