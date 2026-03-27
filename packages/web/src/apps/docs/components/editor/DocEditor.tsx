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
import { IndentPlugin } from "@platejs/indent/react";
import { LinkPlugin } from "@platejs/link/react";
import { ListPlugin } from "@platejs/list/react";
import { SlashInputPlugin, SlashPlugin } from "@platejs/slash-command/react";
import type { Value } from "platejs";
import {
  ParagraphPlugin,
  Plate,
  PlateContent,
  usePlateEditor,
} from "platejs/react";
import { useMemo } from "react";
import { BlockquoteElement } from "./elements/blockquote-element";
import { CodeBlockElement } from "./elements/code-block-element";
import { CodeLineElement } from "./elements/code-line-element";
import { HeadingElement } from "./elements/heading-element";
import { HrElement } from "./elements/hr-element";
import { LinkElement } from "./elements/link-element";
import { ParagraphElement } from "./elements/paragraph-element";
import { FloatingToolbar } from "./floating-toolbar";
import { SlashInputElement } from "./slash-menu";

export interface DocEditorProps {
  value: Value | null;
  onChange: (value: Value) => void;
  readOnly?: boolean;
  placeholder?: string;
}

const EMPTY_VALUE: Value = [{ type: "p", children: [{ text: "" }] }];

const autoformatRules = [
  { mode: "block" as const, match: "# ", type: "h1" },
  { mode: "block" as const, match: "## ", type: "h2" },
  { mode: "block" as const, match: "### ", type: "h3" },
  { mode: "block" as const, match: "> ", type: "blockquote" },
  { mode: "block" as const, match: "--- ", type: "hr" },
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

const plugins = [
  ParagraphPlugin.withComponent(ParagraphElement),
  H1Plugin.withComponent(HeadingElement),
  H2Plugin.withComponent(HeadingElement),
  H3Plugin.withComponent(HeadingElement),
  BlockquotePlugin.withComponent(BlockquoteElement),
  HorizontalRulePlugin.withComponent(HrElement),
  CodeBlockPlugin.withComponent(CodeBlockElement),
  CodeLinePlugin.withComponent(CodeLineElement),
  LinkPlugin.withComponent(LinkElement),

  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  StrikethroughPlugin,
  CodePlugin,

  ListPlugin,
  IndentPlugin.configure({ options: { offset: 24, unit: "px" } }),

  SlashPlugin,
  SlashInputPlugin.withComponent(SlashInputElement),

  AutoformatPlugin.configure({ options: { rules: autoformatRules } }),
];

export function DocEditor({
  value,
  onChange,
  readOnly = false,
  placeholder = "输入 '/' 插入内容…",
}: DocEditorProps) {
  const initialValue = useMemo(() => value ?? EMPTY_VALUE, [value]);

  const editor = usePlateEditor({ plugins, value: initialValue }, [
    initialValue,
  ]);

  if (!editor) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-zinc-400">
        Loading editor…
      </div>
    );
  }

  return (
    <Plate
      editor={editor}
      onValueChange={({ value: newValue }) => onChange(newValue)}
      readOnly={readOnly}
    >
      <div className="relative mx-auto w-full max-w-3xl px-6 py-8">
        <PlateContent
          className="min-h-[200px] outline-none [&_[data-slate-placeholder]]:!text-zinc-400 [&_[data-slate-placeholder]]:!opacity-100 dark:[&_[data-slate-placeholder]]:!text-zinc-500"
          placeholder={placeholder}
        />
      </div>
      {!readOnly && <FloatingToolbar />}
    </Plate>
  );
}
