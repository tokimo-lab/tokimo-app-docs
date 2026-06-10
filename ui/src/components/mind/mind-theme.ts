/**
 * Feishu-inspired mind map themes for mind-elixir.
 *
 * Clean, minimal aesthetic with soft colors and rounded nodes.
 */

import type { Theme } from "mind-elixir";

/**
 * Feishu-inspired light theme.
 * - Root: Feishu blue pill with white text
 * - Main nodes: white with subtle gray border, rounded
 * - Sub nodes: light gray background, muted text
 * - Lines: soft coordinated branch colors
 */
export const FEISHU_LIGHT_THEME: Theme = {
  name: "Feishu Light",
  type: "light",
  palette: [
    "#3370FF",
    "#7B67EE",
    "#2DBEAB",
    "#FF8800",
    "#F54A45",
    "#3681FC",
    "#B46BD6",
    "#35B569",
    "#D97706",
    "#E05A98",
  ],
  cssVar: {
    "--node-gap-x": "28px",
    "--node-gap-y": "8px",
    "--main-gap-x": "56px",
    "--main-gap-y": "36px",
    "--root-radius": "22px",
    "--main-radius": "10px",
    "--root-color": "#ffffff",
    "--root-bgcolor": "#3370FF",
    "--root-border-color": "transparent",
    "--main-color": "#1f2329",
    "--main-bgcolor": "#ffffff",
    "--main-bgcolor-transparent": "rgba(255, 255, 255, 0.92)",
    "--topic-padding": "4px",
    "--color": "#646a73",
    "--bgcolor": "#ffffff",
    "--selected": "#3370FF",
    "--accent-color": "#3370FF",
    "--panel-color": "#1f2329",
    "--panel-bgcolor": "#ffffff",
    "--panel-border-color": "#dee0e3",
    "--map-padding": "50px 80px",
  },
};

/**
 * Feishu-inspired dark theme.
 * - Root: slightly brighter blue
 * - Main nodes: dark surface with muted border
 * - Sub nodes: transparent, light text
 * - Lines: desaturated branch colors
 */
export const FEISHU_DARK_THEME: Theme = {
  name: "Feishu Dark",
  type: "dark",
  palette: [
    "#4C7CFF",
    "#9181F4",
    "#3DD4BF",
    "#FFA940",
    "#FF6B6B",
    "#5B9BFF",
    "#C98AE8",
    "#4FCB80",
    "#E8A230",
    "#F07DAD",
  ],
  cssVar: {
    "--node-gap-x": "28px",
    "--node-gap-y": "8px",
    "--main-gap-x": "56px",
    "--main-gap-y": "36px",
    "--root-radius": "22px",
    "--main-radius": "10px",
    "--root-color": "#ffffff",
    "--root-bgcolor": "#4C6EF5",
    "--root-border-color": "transparent",
    "--main-color": "#d0d5dd",
    "--main-bgcolor": "#2b2f36",
    "--main-bgcolor-transparent": "rgba(43, 47, 54, 0.92)",
    "--topic-padding": "4px",
    "--color": "#8f959e",
    "--bgcolor": "#1a1c1e",
    "--selected": "#4C7CFF",
    "--accent-color": "#4C7CFF",
    "--panel-color": "#d0d5dd",
    "--panel-bgcolor": "#2b2f36",
    "--panel-border-color": "#3d4149",
    "--map-padding": "50px 80px",
  },
};
