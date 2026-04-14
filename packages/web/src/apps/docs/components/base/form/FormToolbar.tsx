import type { BaseEditorState } from "../useBaseEditor";

interface FormToolbarProps {
  state: BaseEditorState;
}

export function FormToolbar({ state: _state }: FormToolbarProps) {
  return (
    <div className="flex h-10 items-center border-b border-border-subtle px-4">
      <span className="text-sm text-fg-muted">
        表单视图 — 使用下方切换按钮在编辑和填写模式间切换
      </span>
    </div>
  );
}
