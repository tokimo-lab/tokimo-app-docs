import { AutoformatPlugin } from "@platejs/autoformat";
import {
  BlockquotePlugin,
  BoldPlugin,
  CodePlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  HorizontalRulePlugin,
  ItalicPlugin,
  StrikethroughPlugin,
  UnderlinePlugin,
} from "@platejs/basic-nodes/react";
import { CodeBlockPlugin, CodeLinePlugin } from "@platejs/code-block/react";
import { BaseIndentPlugin } from "@platejs/indent";
import { LinkPlugin } from "@platejs/link/react";
import { ListPlugin } from "@platejs/list/react";
import { SlashInputPlugin, SlashPlugin } from "@platejs/slash-command/react";
import { ParagraphPlugin } from "platejs/react";
import { BlockquoteElement } from "./elements/blockquote-element";
import { CodeBlockElement } from "./elements/code-block-element";
import { CodeLineElement } from "./elements/code-line-element";
import { HeadingElement } from "./elements/heading-element";
import { HrElement } from "./elements/hr-element";
import { LinkElement } from "./elements/link-element";
import { ParagraphElement } from "./elements/paragraph-element";
import { SlashInputElement } from "./slash-menu";

const autoformatRules = [
  // Block rules
  { mode: "block" as const, match: "# ", type: "h1" },
  { mode: "block" as const, match: "## ", type: "h2" },
  { mode: "block" as const, match: "### ", type: "h3" },
  { mode: "block" as const, match: "> ", type: "blockquote" },
  { mode: "block" as const, match: "--- ", type: "hr" },
  { mode: "block" as const, match: "```", type: "code_block" },
  // Mark rules
  { mode: "mark" as const, match: { start: "**", end: "**" }, type: "bold" },
  { mode: "mark" as const, match: { start: "__", end: "__" }, type: "bold" },
  { mode: "mark" as const, match: { start: "*", end: "*" }, type: "italic" },
  { mode: "mark" as const, match: { start: "_", end: "_" }, type: "italic" },
  {
    mode: "mark" as const,
    match: { start: "~~", end: "~~" },
    type: "strikethrough",
  },
  { mode: "mark" as const, match: { start: "`", end: "`" }, type: "code" },
];

export const editorPlugins = [
  // Block elements
  ParagraphPlugin.withComponent(ParagraphElement),
  H1Plugin.withComponent(HeadingElement),
  H2Plugin.withComponent(HeadingElement),
  H3Plugin.withComponent(HeadingElement),
  BlockquotePlugin.withComponent(BlockquoteElement),
  HorizontalRulePlugin.withComponent(HrElement),
  CodeBlockPlugin.withComponent(CodeBlockElement),
  CodeLinePlugin.withComponent(CodeLineElement),
  LinkPlugin.withComponent(LinkElement),

  // Inline marks
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  StrikethroughPlugin,
  CodePlugin,

  // Lists (indent-based)
  ListPlugin,
  BaseIndentPlugin.configure({
    options: {
      offset: 24,
      unit: "px",
    },
  }),

  // Slash command
  SlashPlugin,
  SlashInputPlugin.withComponent(SlashInputElement),

  // Markdown shortcuts
  AutoformatPlugin.configure({
    options: {
      rules: autoformatRules,
    },
  }),
];
