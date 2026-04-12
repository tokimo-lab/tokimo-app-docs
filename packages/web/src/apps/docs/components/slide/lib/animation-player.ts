import type { AnimationEffect, ElementAnimation } from "../types";
import { ANIMATION_KEYFRAMES } from "./animation-effects";

export interface AnimationController {
  play: () => Promise<void>;
  stop: () => void;
}

function getKeyframes(effect: AnimationEffect): Keyframe[] {
  return ANIMATION_KEYFRAMES[effect] ?? [{ opacity: 1 }, { opacity: 1 }];
}

/** Play a single animation on an element using the Web Animations API. */
export function playElementAnimation(
  element: HTMLElement,
  anim: ElementAnimation,
): Animation {
  const keyframes = getKeyframes(anim.effect);
  const animation = element.animate(keyframes, {
    duration: anim.duration,
    delay: anim.delay,
    easing: "ease-in-out",
    fill: "forwards",
  });
  return animation;
}

/**
 * Build a controller that plays a list of animations in sequence,
 * respecting trigger types (onClick waits, withPrevious runs simultaneously,
 * afterPrevious chains after the previous group finishes).
 */
export function createAnimationPlayer(
  animations: ElementAnimation[],
  getElement: (elementId: string) => HTMLElement | null,
): AnimationController {
  const sorted = [...animations].sort((a, b) => a.order - b.order);
  let running: Animation[] = [];
  let stopped = false;

  // Group animations by trigger into sequential steps.
  // Each step is a group of animations that play simultaneously.
  type AnimGroup = ElementAnimation[];
  const steps: AnimGroup[] = [];

  for (const anim of sorted) {
    if (anim.trigger === "withPrevious" && steps.length > 0) {
      // Add to the current (last) group
      steps[steps.length - 1].push(anim);
    } else {
      // onClick or afterPrevious — new sequential step
      steps.push([anim]);
    }
  }

  async function playGroup(group: AnimGroup): Promise<void> {
    const groupAnimations: Animation[] = [];
    for (const anim of group) {
      const el = getElement(anim.elementId);
      if (!el) continue;
      const webAnim = playElementAnimation(el, anim);
      running.push(webAnim);
      groupAnimations.push(webAnim);
    }
    await Promise.all(
      groupAnimations.map(
        (a) =>
          new Promise<void>((resolve) => {
            a.addEventListener("finish", () => resolve(), { once: true });
            a.addEventListener("cancel", () => resolve(), { once: true });
          }),
      ),
    );
  }

  async function play(): Promise<void> {
    stopped = false;
    for (const group of steps) {
      if (stopped) break;
      await playGroup(group);
    }
  }

  function stop(): void {
    stopped = true;
    for (const a of running) {
      a.cancel();
    }
    running = [];
  }

  return { play, stop };
}

/**
 * Preview a single animation on an element — plays once then cleans up.
 */
export async function previewAnimation(
  element: HTMLElement,
  anim: ElementAnimation,
): Promise<void> {
  const webAnim = playElementAnimation(element, anim);
  await webAnim.finished;
  webAnim.cancel();
}
