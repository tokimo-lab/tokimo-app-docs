/**
 * Branch line generators for mind-elixir.
 *
 * Two styles:
 * - **curved** — the default Bezier curves (matches mind-elixir built-in)
 * - **angular** — straight right-angle lines (Feishu-style)
 */

import type { MindElixirInstance } from "mind-elixir";

const LHS = "lhs";

// ── Types ───────────────────────────────────────────────────────────────────

interface MainLineParams {
  pT: number;
  pL: number;
  pW: number;
  pH: number;
  cT: number;
  cL: number;
  cW: number;
  cH: number;
  direction: string;
  containerHeight: number;
}

interface SubLineParams {
  pT: number;
  pL: number;
  pW: number;
  pH: number;
  cT: number;
  cL: number;
  cW: number;
  cH: number;
  direction: string;
  isFirst: boolean | undefined;
}

// ── Curved (default) ────────────────────────────────────────────────────────

export function curvedMain({
  pT,
  pL,
  pW,
  pH,
  cT,
  cL,
  cW,
  cH,
  direction,
}: MainLineParams): string {
  // All lines emanate from a single fixed point on the parent edge (Feishu-style)
  const y1 = pT + pH / 2;
  const x2 = direction === LHS ? cL + cW : cL;
  const y2 = cT + cH / 2;
  // Fixed junction point: right edge center (or left edge for LHS)
  const x1 = direction === LHS ? pL : pL + pW;
  // Control point at ~40% horizontal distance for a smooth S-curve
  const cx = x1 + (x2 - x1) * 0.4;
  return `M ${x1} ${y1} C ${cx} ${y1} ${cx} ${y2} ${x2} ${y2}`;
}

export function curvedSub(
  this: MindElixirInstance,
  { pT, pL, pW, pH, cT, cL, cW, cH, direction, isFirst }: SubLineParams,
): string {
  const GAP = Number.parseInt(
    this.container.style.getPropertyValue("--node-gap-x"),
    10,
  );
  let y1: number;
  if (isFirst) {
    y1 = pT + pH / 2;
  } else {
    y1 = pT + pH;
  }
  const y2 = cT + cH;
  const m = (Math.abs(y1 - y2) / 300) * GAP;

  if (direction === LHS) {
    const mid = pL;
    const x1 = mid + GAP;
    const x2 = mid - GAP;
    const endX = cL + GAP;
    return `M ${x1} ${y1} C ${mid} ${y1} ${mid + m} ${y2} ${x2} ${y2} H ${endX}`;
  }
  const mid = pL + pW;
  const x1 = mid - GAP;
  const x2 = mid + GAP;
  const endX = cL + cW - GAP;
  return `M ${x1} ${y1} C ${mid} ${y1} ${mid - m} ${y2} ${x2} ${y2} H ${endX}`;
}

// ── Angular (right-angle with rounded corners) ─────────────────────────────

const CORNER_RADIUS = 5;

/** Build an angular path: x1,y1 → horizontal to midX → vertical to y2 → horizontal to x2, with rounded corners at the two 90° turns. */
function roundedAngularPath(
  x1: number,
  y1: number,
  midX: number,
  y2: number,
  x2: number,
): string {
  const dy = y2 - y1;
  if (Math.abs(dy) < 1) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }
  const r = Math.min(
    CORNER_RADIUS,
    Math.abs(dy) / 2,
    Math.abs(midX - x1) / 2,
    Math.abs(x2 - midX) / 2,
  );
  if (r < 0.5) {
    return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
  }
  const dx1 = Math.sign(midX - x1);
  const dyS = Math.sign(dy);
  const dx2 = Math.sign(x2 - midX);
  const s1 = dx1 * dyS > 0 ? 1 : 0;
  const s2 = dyS * dx2 > 0 ? 0 : 1;
  return [
    `M ${x1} ${y1}`,
    `L ${midX - dx1 * r} ${y1}`,
    `A ${r} ${r} 0 0 ${s1} ${midX} ${y1 + dyS * r}`,
    `L ${midX} ${y2 - dyS * r}`,
    `A ${r} ${r} 0 0 ${s2} ${midX + dx2 * r} ${y2}`,
    `L ${x2} ${y2}`,
  ].join(" ");
}

export function angularMain({
  pT,
  pL,
  pW,
  pH,
  cT,
  cL,
  cW,
  cH,
  direction,
}: MainLineParams): string {
  const y1 = pT + pH / 2;
  const y2 = cT + cH / 2;

  if (direction === LHS) {
    const x1 = pL;
    const x2 = cL + cW;
    const midX = (x1 + x2) / 2;
    return roundedAngularPath(x1, y1, midX, y2, x2);
  }
  const x1 = pL + pW;
  const x2 = cL;
  const midX = (x1 + x2) / 2;
  return roundedAngularPath(x1, y1, midX, y2, x2);
}

export function angularSub(
  this: MindElixirInstance,
  { pT, pL, pW, pH, cT, cL, cW, cH, direction, isFirst }: SubLineParams,
): string {
  const GAP = Number.parseInt(
    this.container.style.getPropertyValue("--node-gap-x"),
    10,
  );
  const y1 = isFirst ? pT + pH / 2 : pT + pH;
  const y2 = cT + cH;

  if (direction === LHS) {
    const x1 = pL;
    const midX = x1 - GAP;
    const endX = cL + cW;
    return roundedAngularPath(x1, y1, midX, y2, endX);
  }
  const x1 = pL + pW;
  const midX = x1 + GAP;
  const endX = cL;
  return roundedAngularPath(x1, y1, midX, y2, endX);
}
