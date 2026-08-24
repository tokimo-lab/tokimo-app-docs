import type { PlateElementProps } from "platejs/react";
import { PlateElement, useEditorRef, useElement } from "platejs/react";
import { useCallback, useRef, useState } from "react";

export function DateElement(props: PlateElementProps) {
  const editor = useEditorRef();
  const element = useElement();
  const date = (element as Record<string, unknown>).date as string;
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatted = date
    ? new Date(date).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "选择日期";

  const handleDateChange = useCallback(
    (newDate: string) => {
      const path = editor.api.findPath(element);
      if (path) {
        editor.tf.setNodes({ date: newDate } as Record<string, unknown>, {
          at: path,
        });
      }
      setPickerOpen(false);
    },
    [editor, element],
  );

  return (
    <PlateElement
      as="span"
      className="relative inline-flex cursor-pointer items-center rounded bg-fill-tertiary px-1.5 py-0.5 text-sm text-fg-muted hover:bg-fill-tertiary "
      {...props}
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: date element click */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: date element click */}
      <span
        contentEditable={false}
        className="select-none"
        onClick={() => {
          setPickerOpen(true);
          setTimeout(() => inputRef.current?.showPicker(), 0);
        }}
      >
        📅 {formatted}
        {pickerOpen && (
          <input
            ref={inputRef}
            type="date"
            value={date || ""}
            onChange={(e) => handleDateChange(e.target.value)}
            onBlur={() => setPickerOpen(false)}
            className="absolute top-full left-0 z-50 mt-1 rounded border border-base bg-surface-overlay px-2 py-1 text-sm text-fg-on-overlay shadow-md backdrop-blur-glass"
          />
        )}
      </span>
      {props.children}
    </PlateElement>
  );
}
