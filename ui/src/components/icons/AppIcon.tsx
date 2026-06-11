/**
 * AppIcon — unified app icon renderer for standalone docs app.
 *
 * Simplified version of the monolith's AppIcon. Supports:
 * - Emoji/text icons with colored background
 * - Lucide icon resolution (via icon string starting with "lucide:")
 */

import { cn } from "@tokimo/ui";
import type { ComponentType } from "react";

const HASH_PALETTE = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
];

function hashColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = str.charCodeAt(i) + ((h << 5) - h);
  }
  return HASH_PALETTE[Math.abs(h) % HASH_PALETTE.length];
}

export function AppIcon({
  icon,
  iconComponent: IconComponent,
  image,
  color,
  size = 40,
  className,
  onClick,
}: {
  icon?: string | null;
  iconComponent?: ComponentType<{
    className?: string;
    style?: React.CSSProperties;
  }>;
  image?: string | null;
  color?: string | null;
  size?: number;
  className?: string;
  onClick?: () => void;
}) {
  const hasEmoji = !image && !IconComponent && !!icon;

  const bgColor = image
    ? undefined
    : color === "transparent"
      ? undefined
      : color || (hasEmoji ? hashColor(icon!) : undefined);

  const lucideScale = size <= 24 ? 0.6 : 0.45;

  const content = image ? (
    <img
      src={image}
      alt=""
      width={size}
      height={size}
      className="object-cover"
      style={{ width: size, height: size }}
      draggable={false}
    />
  ) : IconComponent ? (
    <IconComponent
      className="text-white/90"
      style={{
        width: size * lucideScale,
        height: size * lucideScale,
      }}
    />
  ) : hasEmoji ? (
    <span
      className={cn("text-center leading-none", bgColor && "text-white")}
      style={{ fontSize: size * 0.45, whiteSpace: "nowrap" as const }}
    >
      {icon}
    </span>
  ) : null;

  const baseClass =
    "rounded-[20%] flex items-center justify-center select-none shrink-0 overflow-hidden";

  if (onClick) {
    return (
      <button
        type="button"
        data-app-icon
        className={cn(
          baseClass,
          "cursor-pointer hover:ring-4 hover:ring-black/10 dark:hover:ring-white/10 transition-all",
          className,
        )}
        style={{
          width: size,
          height: size,
          backgroundColor: bgColor,
        }}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      data-app-icon
      className={cn(baseClass, className)}
      style={{
        width: size,
        height: size,
        backgroundColor: bgColor,
      }}
    >
      {content}
    </div>
  );
}
