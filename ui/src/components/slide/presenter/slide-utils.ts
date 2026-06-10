import type {
  ElementAnimation,
  Slide,
  SlideBackground,
  TransitionType,
} from "../types";

/** Get CSS transform/opacity for a transition entering state */
export function getTransitionEnterStyle(
  type: TransitionType,
  forward: boolean,
): React.CSSProperties {
  switch (type) {
    case "fade":
      return { opacity: 0 };
    case "slideLeft":
      return {
        transform: forward ? "translateX(100%)" : "translateX(-100%)",
      };
    case "slideRight":
      return {
        transform: forward ? "translateX(-100%)" : "translateX(100%)",
      };
    case "slideUp":
      return { transform: "translateY(100%)" };
    case "slideDown":
      return { transform: "translateY(-100%)" };
    case "scale":
      return { opacity: 0, transform: "scale(0.8)" };
    case "cover":
      return {
        transform: forward ? "translateX(100%)" : "translateX(-100%)",
      };
    case "push":
      return {
        transform: forward ? "translateX(100%)" : "translateX(-100%)",
      };
    case "reveal":
      return { opacity: 1 };
    default:
      return {};
  }
}

/** Build background CSS from a Slide */
export function getBackgroundStyle(
  bg: SlideBackground | undefined,
): React.CSSProperties {
  const style: React.CSSProperties = { backgroundColor: "#fff" };
  if (!bg) return style;
  if (bg.type === "solid" && bg.color) {
    style.backgroundColor = bg.color;
  } else if (bg.type === "gradient" && bg.gradient) {
    const stops = bg.gradient.colors
      .map((c) => `${c.color} ${c.offset * 100}%`)
      .join(", ");
    style.background =
      bg.gradient.type === "linear"
        ? `linear-gradient(${bg.gradient.angle ?? 0}deg, ${stops})`
        : `radial-gradient(circle, ${stops})`;
  }
  return style;
}

/** Compute click-grouped animations for a slide */
export function getClickGroups(s: Slide | undefined) {
  if (!s?.animations) return [];
  const sorted = [...s.animations].sort((a, b) => a.order - b.order);
  const groups: ElementAnimation[][] = [];
  for (const anim of sorted) {
    if (anim.trigger === "withPrevious" && groups.length > 0) {
      groups[groups.length - 1].push(anim);
    } else {
      groups.push([anim]);
    }
  }
  return groups;
}
