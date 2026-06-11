/**
 * DocTemplateChooser — Modal dialog for choosing a document template.
 *
 * Displays template cards in a responsive grid. On selection, the parent
 * creates a new doc and populates its content from the chosen template.
 */

import { cn, Modal } from "@tokimo/ui";
import {
  BookOpen,
  Calendar,
  ClipboardList,
  FileText,
  LayoutTemplate,
  Lightbulb,
  ListChecks,
  Pencil,
} from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { DOC_TEMPLATES, type DocTemplate } from "./doc-templates";

// ── Icon mapping ─────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, ReactNode> = {
  FileText: <FileText size={22} />,
  Calendar: <Calendar size={22} />,
  ClipboardList: <ClipboardList size={22} />,
  LayoutTemplate: <LayoutTemplate size={22} />,
  ListChecks: <ListChecks size={22} />,
  Lightbulb: <Lightbulb size={22} />,
  BookOpen: <BookOpen size={22} />,
  Pencil: <Pencil size={22} />,
};

// ── Props ────────────────────────────────────────────────────────────────────

interface DocTemplateChooserProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: DocTemplate) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function DocTemplateChooser({
  open,
  onClose,
  onSelect,
}: DocTemplateChooserProps) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t("templateChooser.title")}
      size="large"
      footer={null}
    >
      <div className="grid grid-cols-2 gap-3 p-2 sm:grid-cols-3 md:grid-cols-4">
        {DOC_TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => {
              onSelect(tpl);
              onClose();
            }}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border px-4 py-5 text-center transition-all",
              "border-border-base bg-surface-elevated hover:border-[var(--accent)] hover:shadow-md",
              "dark:hover:border-[var(--accent)] ",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
            )}
          >
            <span className="flex size-10 items-center justify-center rounded-lg bg-fill-tertiary text-fg-muted dark:bg-white/[0.10]">
              {ICON_MAP[tpl.icon] ?? <FileText size={22} />}
            </span>
            <span className="text-sm font-medium text-fg-primary">
              {tpl.name}
            </span>
            <span className="line-clamp-2 text-xs text-fg-muted">
              {tpl.description}
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
