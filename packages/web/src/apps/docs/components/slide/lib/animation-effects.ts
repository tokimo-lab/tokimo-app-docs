import type { AnimationEffect, AnimationType } from "../types";

export const ANIMATION_KEYFRAMES: Record<AnimationEffect, Keyframe[]> = {
  // Entrance
  fadeIn: [{ opacity: 0 }, { opacity: 1 }],
  fadeInUp: [
    { opacity: 0, transform: "translateY(50px)" },
    { opacity: 1, transform: "translateY(0)" },
  ],
  fadeInDown: [
    { opacity: 0, transform: "translateY(-50px)" },
    { opacity: 1, transform: "translateY(0)" },
  ],
  fadeInLeft: [
    { opacity: 0, transform: "translateX(-50px)" },
    { opacity: 1, transform: "translateX(0)" },
  ],
  fadeInRight: [
    { opacity: 0, transform: "translateX(50px)" },
    { opacity: 1, transform: "translateX(0)" },
  ],
  zoomIn: [
    { opacity: 0, transform: "scale(0.3)" },
    { opacity: 1, transform: "scale(1)" },
  ],
  bounceIn: [
    { opacity: 0, transform: "scale(0.3)" },
    { opacity: 1, transform: "scale(1.05)" },
    { opacity: 1, transform: "scale(0.95)" },
    { opacity: 1, transform: "scale(1)" },
  ],
  slideInUp: [
    { transform: "translateY(100%)" },
    { transform: "translateY(0)" },
  ],
  slideInDown: [
    { transform: "translateY(-100%)" },
    { transform: "translateY(0)" },
  ],
  slideInLeft: [
    { transform: "translateX(-100%)" },
    { transform: "translateX(0)" },
  ],
  slideInRight: [
    { transform: "translateX(100%)" },
    { transform: "translateX(0)" },
  ],

  // Exit
  fadeOut: [{ opacity: 1 }, { opacity: 0 }],
  fadeOutUp: [
    { opacity: 1, transform: "translateY(0)" },
    { opacity: 0, transform: "translateY(-50px)" },
  ],
  fadeOutDown: [
    { opacity: 1, transform: "translateY(0)" },
    { opacity: 0, transform: "translateY(50px)" },
  ],
  fadeOutLeft: [
    { opacity: 1, transform: "translateX(0)" },
    { opacity: 0, transform: "translateX(-50px)" },
  ],
  fadeOutRight: [
    { opacity: 1, transform: "translateX(0)" },
    { opacity: 0, transform: "translateX(50px)" },
  ],
  zoomOut: [
    { opacity: 1, transform: "scale(1)" },
    { opacity: 0, transform: "scale(0.3)" },
  ],
  bounceOut: [
    { opacity: 1, transform: "scale(1)" },
    { opacity: 1, transform: "scale(1.05)" },
    { opacity: 0, transform: "scale(0.3)" },
  ],
  slideOutUp: [
    { transform: "translateY(0)" },
    { transform: "translateY(-100%)" },
  ],
  slideOutDown: [
    { transform: "translateY(0)" },
    { transform: "translateY(100%)" },
  ],
  slideOutLeft: [
    { transform: "translateX(0)" },
    { transform: "translateX(-100%)" },
  ],
  slideOutRight: [
    { transform: "translateX(0)" },
    { transform: "translateX(100%)" },
  ],

  // Emphasis
  pulse: [
    { transform: "scale(1)" },
    { transform: "scale(1.1)" },
    { transform: "scale(1)" },
  ],
  bounce: [
    { transform: "translateY(0)" },
    { transform: "translateY(-30px)" },
    { transform: "translateY(0)" },
    { transform: "translateY(-15px)" },
    { transform: "translateY(0)" },
  ],
  shake: [
    { transform: "translateX(0)" },
    { transform: "translateX(-10px)" },
    { transform: "translateX(10px)" },
    { transform: "translateX(-10px)" },
    { transform: "translateX(10px)" },
    { transform: "translateX(0)" },
  ],
  swing: [
    { transform: "rotate(0deg)" },
    { transform: "rotate(15deg)" },
    { transform: "rotate(-10deg)" },
    { transform: "rotate(5deg)" },
    { transform: "rotate(-5deg)" },
    { transform: "rotate(0deg)" },
  ],
  tada: [
    { transform: "scale(1) rotate(0deg)" },
    { transform: "scale(0.9) rotate(-3deg)" },
    { transform: "scale(1.1) rotate(3deg)" },
    { transform: "scale(1.1) rotate(-3deg)" },
    { transform: "scale(1.1) rotate(3deg)" },
    { transform: "scale(1) rotate(0deg)" },
  ],
  flash: [
    { opacity: 1 },
    { opacity: 0 },
    { opacity: 1 },
    { opacity: 0 },
    { opacity: 1 },
  ],
  rubberBand: [
    { transform: "scaleX(1) scaleY(1)" },
    { transform: "scaleX(1.25) scaleY(0.75)" },
    { transform: "scaleX(0.75) scaleY(1.25)" },
    { transform: "scaleX(1.15) scaleY(0.85)" },
    { transform: "scaleX(0.95) scaleY(1.05)" },
    { transform: "scaleX(1) scaleY(1)" },
  ],
};

export interface AnimationEffectMeta {
  effect: AnimationEffect;
  label: string;
  type: AnimationType;
}

export const ENTRANCE_EFFECTS: AnimationEffectMeta[] = [
  { effect: "fadeIn", label: "淡入", type: "entrance" },
  { effect: "fadeInUp", label: "向上淡入", type: "entrance" },
  { effect: "fadeInDown", label: "向下淡入", type: "entrance" },
  { effect: "fadeInLeft", label: "向左淡入", type: "entrance" },
  { effect: "fadeInRight", label: "向右淡入", type: "entrance" },
  { effect: "zoomIn", label: "缩放进入", type: "entrance" },
  { effect: "bounceIn", label: "弹跳进入", type: "entrance" },
  { effect: "slideInUp", label: "向上滑入", type: "entrance" },
  { effect: "slideInDown", label: "向下滑入", type: "entrance" },
  { effect: "slideInLeft", label: "向左滑入", type: "entrance" },
  { effect: "slideInRight", label: "向右滑入", type: "entrance" },
];

export const EXIT_EFFECTS: AnimationEffectMeta[] = [
  { effect: "fadeOut", label: "淡出", type: "exit" },
  { effect: "fadeOutUp", label: "向上淡出", type: "exit" },
  { effect: "fadeOutDown", label: "向下淡出", type: "exit" },
  { effect: "fadeOutLeft", label: "向左淡出", type: "exit" },
  { effect: "fadeOutRight", label: "向右淡出", type: "exit" },
  { effect: "zoomOut", label: "缩放退出", type: "exit" },
  { effect: "bounceOut", label: "弹跳退出", type: "exit" },
  { effect: "slideOutUp", label: "向上滑出", type: "exit" },
  { effect: "slideOutDown", label: "向下滑出", type: "exit" },
  { effect: "slideOutLeft", label: "向左滑出", type: "exit" },
  { effect: "slideOutRight", label: "向右滑出", type: "exit" },
];

export const EMPHASIS_EFFECTS: AnimationEffectMeta[] = [
  { effect: "pulse", label: "脉冲", type: "emphasis" },
  { effect: "bounce", label: "弹跳", type: "emphasis" },
  { effect: "shake", label: "抖动", type: "emphasis" },
  { effect: "swing", label: "摇摆", type: "emphasis" },
  { effect: "tada", label: "惊叹", type: "emphasis" },
  { effect: "flash", label: "闪烁", type: "emphasis" },
  { effect: "rubberBand", label: "橡皮筋", type: "emphasis" },
];

export const ALL_EFFECTS: AnimationEffectMeta[] = [
  ...ENTRANCE_EFFECTS,
  ...EXIT_EFFECTS,
  ...EMPHASIS_EFFECTS,
];

export function getEffectLabel(effect: AnimationEffect): string {
  return ALL_EFFECTS.find((e) => e.effect === effect)?.label ?? effect;
}

export function getEffectType(effect: AnimationEffect): AnimationType {
  return ALL_EFFECTS.find((e) => e.effect === effect)?.type ?? "entrance";
}

export function getTypeLabel(type: AnimationType): string {
  switch (type) {
    case "entrance":
      return "入场";
    case "exit":
      return "退场";
    case "emphasis":
      return "强调";
  }
}

export function getTriggerLabel(
  trigger: "onClick" | "withPrevious" | "afterPrevious",
): string {
  switch (trigger) {
    case "onClick":
      return "单击时";
    case "withPrevious":
      return "与上一动画同时";
    case "afterPrevious":
      return "上一动画之后";
  }
}
