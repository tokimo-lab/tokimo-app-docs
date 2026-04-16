import { AtSign } from "lucide-react";
import type { PlateElementProps } from "platejs/react";
import { PlateElement, useElement } from "platejs/react";

export function MentionElement(props: PlateElementProps) {
  const element = useElement();
  const value = (element as Record<string, unknown>).value as string;

  return (
    <PlateElement
      as="span"
      className="inline-flex items-center gap-0.5 rounded bg-[var(--accent-subtle)] px-1.5 py-0.5 text-sm font-medium text-[var(--accent)] dark:bg-[var(--accent-subtle)] dark:text-[var(--accent-text)]"
      {...props}
    >
      <span contentEditable={false} className="select-none">
        <AtSign className="inline size-3.5" />
        {value || "mention"}
      </span>
      {props.children}
    </PlateElement>
  );
}
