import type { PlateElementProps } from "platejs/react";
import { PlateElement, useElement } from "platejs/react";

const VARIANT_STYLES: Record<
  string,
  { bg: string; border: string; icon: string }
> = {
  info: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    icon: "ℹ️",
  },
  warning: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    icon: "⚠️",
  },
  tip: {
    bg: "bg-green-50 dark:bg-green-950/30",
    border: "border-green-200 dark:border-green-800",
    icon: "💡",
  },
  danger: {
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
    icon: "🚨",
  },
};

export function CalloutElement(props: PlateElementProps) {
  const element = useElement();
  const variant =
    ((element as Record<string, unknown>).variant as string) || "info";
  const style = VARIANT_STYLES[variant] || VARIANT_STYLES.info;

  return (
    <PlateElement
      className={`my-3 flex gap-2 rounded-lg border p-4 ${style.bg} ${style.border}`}
      {...props}
    >
      <span className="shrink-0 select-none text-lg" contentEditable={false}>
        {((element as Record<string, unknown>).icon as string) || style.icon}
      </span>
      <div className="min-w-0 flex-1">{props.children}</div>
    </PlateElement>
  );
}
