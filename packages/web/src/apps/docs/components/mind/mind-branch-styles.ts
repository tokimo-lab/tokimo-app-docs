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
  containerHeight,
}: MainLineParams): string {
  let x1 = pL + pW / 2;
  const y1 = pT + pH / 2;
  const x2 = direction === LHS ? cL + cW : cL;
  const y2 = cT + cH / 2;
  const pct = Math.abs(y2 - y1) / containerHeight;
  const offset = (1 - pct) * 0.25 * (pW / 2);
  x1 = direction === LHS ? x1 - pW / 10 - offset : x1 + pW / 10 + offset;
  return `M ${x1} ${y1} Q ${x1} ${y2} ${x2} ${y2}`;
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

// ── Angular (straight right-angle) ─────────────────────────────────────────

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
    return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
  }
  const x1 = pL + pW;
  const x2 = cL;
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
}

export function angularSub(
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

  if (direction === LHS) {
    const x1 = pL;
    const midX = x1 - GAP;
    const endX = cL + cW;
    return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${endX} ${y2}`;
  }
  const x1 = pL + pW;
  const midX = x1 + GAP;
  const endX = cL;
  return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${endX} ${y2}`;
}
