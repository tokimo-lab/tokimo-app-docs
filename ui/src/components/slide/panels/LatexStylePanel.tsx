import { useTranslation } from "react-i18next";
import type { SlideLatexElement } from "../types";
import { useSlideStore } from "../use-slide-store";

const sectionClass = "border-b border-border-subtle px-4 py-3";
const labelClass = "mb-3 text-xs font-medium text-fg-muted";
const numberInputClass =
  "h-7 w-full rounded border border-border-subtle bg-transparent px-2 text-xs text-fg-default outline-none focus:border-[var(--accent)] dark:bg-neutral-800";

export function LatexStylePanel({ element }: { element: SlideLatexElement }) {
  const { t } = useTranslation();
  const updateElement = useSlideStore((s) => s.updateElement);
  const pushHistory = useSlideStore((s) => s.pushHistory);

  const update = (changes: Partial<SlideLatexElement>) => {
    pushHistory();
    updateElement(element.id, changes);
  };

  const handleEditFormula = () => {
    window.dispatchEvent(
      new CustomEvent("slide:edit-latex", {
        detail: { elementId: element.id },
      }),
    );
  };

  return (
    <div className="flex flex-col gap-0 pb-4">
      {/* 操作 */}
      <div className={sectionClass}>
        <button
          type="button"
          className="h-8 w-full cursor-pointer rounded bg-accent text-xs font-medium text-fg-on-accent hover:bg-accent-hover"
          onClick={handleEditFormula}
        >
          {t("docs.editFormula")}
        </button>
      </div>

      {/* 样式 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>{t("docs.formulaStyle")}</h3>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-xs text-fg-muted">
              {t("docs.formulaFontSize")}
            </span>
            <input
              type="number"
              className={numberInputClass}
              min={8}
              max={96}
              value={element.fontSize ?? 24}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v >= 8 && v <= 96) update({ fontSize: v });
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-xs text-fg-muted">
              {t("docs.formulaColor")}
            </span>
            <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded border border-border-subtle">
              <input
                type="color"
                className="absolute -inset-1 h-10 w-10 cursor-pointer"
                value={element.color ?? "#333333"}
                onChange={(e) => update({ color: e.target.value })}
              />
            </div>
            <span className="text-xs text-fg-muted">
              {element.color ?? "#333333"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
