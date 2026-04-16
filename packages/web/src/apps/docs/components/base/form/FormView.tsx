import { cn } from "@tokiomo/components";
import { useState } from "react";
import type { BaseEditorState } from "../useBaseEditor";
import { FormEditView } from "./FormEditView";
import { FormFillView } from "./FormFillView";

type FormMode = "edit" | "fill";

interface FormViewProps {
  state: BaseEditorState;
}

export function FormView({ state }: FormViewProps) {
  const [mode, setMode] = useState<FormMode>("edit");

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Mode toggle bar */}
      <div className="flex items-center gap-1 border-b border-border-subtle bg-surface-base px-4 py-2">
        <button
          type="button"
          className={cn(
            "cursor-pointer rounded-md px-3 py-1 text-sm transition-colors",
            mode === "edit"
              ? "bg-[var(--accent-subtle)] font-medium text-[var(--accent)] dark:bg-[var(--accent-subtle)] dark:text-[var(--accent)]"
              : "text-fg-secondary hover:bg-fill-tertiary",
          )}
          onClick={() => setMode("edit")}
        >
          编辑表单
        </button>
        <button
          type="button"
          className={cn(
            "cursor-pointer rounded-md px-3 py-1 text-sm transition-colors",
            mode === "fill"
              ? "bg-[var(--accent-subtle)] font-medium text-[var(--accent)] dark:bg-[var(--accent-subtle)] dark:text-[var(--accent)]"
              : "text-fg-secondary hover:bg-fill-tertiary",
          )}
          onClick={() => setMode("fill")}
        >
          填写表单
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        {mode === "edit" ? (
          <FormEditView state={state} />
        ) : (
          <FormFillView state={state} />
        )}
      </div>
    </div>
  );
}
