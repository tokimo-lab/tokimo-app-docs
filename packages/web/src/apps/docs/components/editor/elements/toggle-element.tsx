import { useToggleButton, useToggleButtonState } from "@platejs/toggle/react";
import { ChevronRight } from "lucide-react";
import type { PlateElementProps } from "platejs/react";
import { PlateElement, useElement } from "platejs/react";

export function ToggleElement(props: PlateElementProps) {
  const element = useElement();
  const state = useToggleButtonState(element.id as string);
  const { buttonProps, open } = useToggleButton(state);

  return (
    <PlateElement className="my-2" {...props}>
      <div className="flex items-start gap-1">
        <button
          type="button"
          className="mt-1 flex size-5 shrink-0 items-center justify-center rounded text-fg-muted hover:bg-fill-tertiary"
          {...buttonProps}
          contentEditable={false}
        >
          <ChevronRight
            size={14}
            className={`transition-transform ${open ? "rotate-90" : ""}`}
          />
        </button>
        <div className="min-w-0 flex-1">{props.children}</div>
      </div>
    </PlateElement>
  );
}
