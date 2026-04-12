import { cn } from "@tokiomo/components";
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
import { downloadSlideAsImage } from "../lib/export-image";
import { createDefaultPresentation, isSlidePresentation } from "../types";
import { useSlideStore } from "../use-slide-store";

const SHORTCUTS: Array<[string, string]> = [
  ["Ctrl+Z", "撤销"],
  ["Ctrl+Shift+Z", "重做"],
  ["Ctrl+C", "复制"],
  ["Ctrl+V", "粘贴"],
  ["Ctrl+X", "剪切"],
  ["Ctrl+D", "复制元素"],
  ["Ctrl+A", "全选"],
  ["Ctrl+G", "组合"],
  ["Ctrl+Shift+G", "取消组合"],
  ["Delete", "删除"],
  ["Ctrl+F", "搜索"],
  ["Ctrl+H", "搜索替换"],
  ["Space+拖拽", "平移画布"],
  ["Ctrl+↑/↓", "调整层级"],
];

const menuItemClass =
  "flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-black/5 dark:hover:bg-white/5";

export function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<"import" | "export" | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const presentation = useSlideStore((s) => s.presentation);
  const setPresentation = useSlideStore((s) => s.setPresentation);

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
    alert("PPTX 导出功能即将推出");
  }, [closeMenu]);

  const handleExportMarkdown = useCallback(() => {
    closeMenu();
    alert("Markdown 导出功能即将推出");
  }, [closeMenu]);

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
            alert("无效的幻灯片文件");
          }
        } catch {
          alert("文件解析失败");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [setPresentation],
  );

  const handleImportPptx = useCallback(() => {
    closeMenu();
    alert("PPTX 导入功能即将推出");
  }, [closeMenu]);

  const handleReset = useCallback(() => {
    closeMenu();
    if (window.confirm("确定要重置幻灯片吗？当前内容将丢失。")) {
      setPresentation(createDefaultPresentation());
    }
  }, [closeMenu, setPresentation]);

  return (
    <>
      <div className="relative">
        <button
          type="button"
          className={cn(
            "flex cursor-pointer items-center justify-center rounded-md p-1.5",
            "hover:bg-black/5 dark:hover:bg-white/5",
            open && "bg-blue-50 text-blue-500 dark:bg-blue-500/10",
          )}
          onClick={() => setOpen(!open)}
          title="菜单"
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
                  导入文件
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
                  导出文件
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
                重置幻灯片
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
                快捷键说明
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
              <h3 className="text-sm font-semibold">快捷键说明</h3>
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
                    快捷键
                  </th>
                  <th className="py-1.5 text-left font-medium text-fg-muted">
                    功能
                  </th>
                </tr>
              </thead>
              <tbody>
                {SHORTCUTS.map(([key, desc]) => (
                  <tr
                    key={key}
                    className="border-b border-border-subtle last:border-0"
                  >
                    <td className="py-1.5">
                      <kbd className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] dark:bg-neutral-700">
                        {key}
                      </kbd>
                    </td>
                    <td className="py-1.5">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
