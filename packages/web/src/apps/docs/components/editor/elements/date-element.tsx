import type { PlateElementProps } from "platejs/react";
import { PlateElement, useElement } from "platejs/react";

export function DateElement(props: PlateElementProps) {
  const element = useElement();
  const date = (element as Record<string, unknown>).date as string;

  const formatted = date
    ? new Date(date).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "选择日期";

  return (
    <PlateElement
      as="span"
      className="inline-flex cursor-pointer items-center rounded bg-zinc-100 px-1.5 py-0.5 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
      {...props}
    >
      <span contentEditable={false} className="select-none">
        📅 {formatted}
      </span>
      {props.children}
    </PlateElement>
  );
}
