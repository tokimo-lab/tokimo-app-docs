import type { TElement } from "platejs";
import type { PlateElementProps } from "platejs/react";
import { PlateElement, useEditorRef } from "platejs/react";

const INDENT_WIDTH = 24;

export function TodoElement({
  element,
  children,
  ...props
}: PlateElementProps) {
  const editor = useEditorRef();
  const el = element as TElement & {
    checked?: boolean;
    indent?: number;
  };
  const checked = el.checked ?? false;
  const indent = el.indent ?? 0;

  const handleChange = () => {
    const path = editor.api.findPath(element);
    if (path) {
      editor.tf.setNodes({ checked: !checked } as Partial<TElement>, {
        at: path,
      });
    }
  };

  return (
    <PlateElement
      element={element}
      {...props}
      className="flex items-start gap-2 py-0.5 text-zinc-900 dark:text-zinc-100"
      style={{ paddingLeft: indent * INDENT_WIDTH }}
    >
      <span contentEditable={false} className="mt-1 flex shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          className="size-4 cursor-pointer rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600"
        />
      </span>
      <span
        className={
          checked ? "line-through text-zinc-400 dark:text-zinc-500" : ""
        }
      >
        {children}
      </span>
    </PlateElement>
  );
}
