import type { Editor } from "@tiptap/react";
import { cn } from "@tokiomo/components";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Indent,
  Italic,
  List,
  ListOrdered,
  Minus,
  Outdent,
  Plus,
  Quote,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
} from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";
import {
  getActiveTextEditor,
  subscribeTextEditor,
} from "../lib/slide-text-editor-bridge";
import type { ElementOutline, SlideTextElement } from "../types";
import { useSlideStore } from "../use-slide-store";

const sectionClass = "border-b border-border-subtle px-4 py-3";
const labelClass = "mb-2 text-xs font-medium text-fg-muted";
const iconBtnClass =
  "flex cursor-pointer items-center justify-center rounded p-1.5 hover:bg-black/5 dark:hover:bg-white/5";
const activeBtnClass =
  "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400";
const selectClass =
  "h-7 flex-1 cursor-pointer rounded border border-border-subtle bg-transparent px-2 text-xs text-fg-default outline-none dark:bg-neutral-800";
const numberInputClass =
  "h-7 w-full rounded border border-border-subtle bg-transparent px-2 text-xs text-fg-default outline-none focus:border-blue-500 dark:bg-neutral-800";

function useActiveTextEditor(): Editor | null {
  return useSyncExternalStore(subscribeTextEditor, getActiveTextEditor);
}

// ── Presets ──────────────────────────────────────────────────

interface TextPreset {
  label: string;
  fontSize: string;
  fontWeight?: string;
}

const TEXT_PRESETS: TextPreset[] = [
  { label: "大标题", fontSize: "36px", fontWeight: "bold" },
  { label: "小标题", fontSize: "24px", fontWeight: "bold" },
  { label: "正文", fontSize: "18px" },
  { label: "正文小", fontSize: "14px" },
  { label: "注释1", fontSize: "12px" },
  { label: "注释2", fontSize: "10px" },
];

const FONT_FAMILIES = [
  "Microsoft YaHei",
  "SimSun",
  "SimHei",
  "KaiTi",
  "FangSong",
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Georgia",
  "Courier New",
  "Verdana",
];

const LINE_HEIGHT_OPTIONS = [1, 1.2, 1.4, 1.5, 1.6, 1.8, 2, 2.5, 3];
const LETTER_SPACING_OPTIONS = [0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8];

// ── ColorInput ──────────────────────────────────────────────

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs text-fg-muted">{label}</span>
      <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded border border-border-subtle">
        <input
          type="color"
          className="absolute -inset-1 h-10 w-10 cursor-pointer"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <span className="text-xs text-fg-muted">{value}</span>
    </div>
  );
}

// ── SliderRow ───────────────────────────────────────────────

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs text-fg-muted">{label}</span>
      <input
        type="range"
        className="h-1 flex-1 cursor-pointer accent-blue-500"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="w-10 text-right text-xs text-fg-muted">
        {value}
        {unit}
      </span>
    </div>
  );
}

// ── Main Panel ──────────────────────────────────────────────

export function TextStylePanel({ element }: { element: SlideTextElement }) {
  const editor = useActiveTextEditor();
  const updateElement = useSlideStore((s) => s.updateElement);
  const pushHistory = useSlideStore((s) => s.pushHistory);

  const update = useCallback(
    (changes: Partial<SlideTextElement>) => {
      pushHistory();
      updateElement(element.id, changes);
    },
    [element.id, pushHistory, updateElement],
  );

  // ── Helpers ─────────────────────────────────────────────

  const parseFontSize = (): number => {
    if (editor) {
      const attrs = editor.getAttributes("textStyle");
      if (attrs.fontSize) return Number.parseInt(attrs.fontSize, 10);
    }
    // Fallback: parse from content
    const match = element.content.match(/font-size:\s*(\d+)px/);
    return match ? Number(match[1]) : 16;
  };

  const getFontFamily = (): string => {
    if (editor) {
      const attrs = editor.getAttributes("textStyle");
      if (attrs.fontFamily) return attrs.fontFamily;
    }
    return element.defaultFontName;
  };

  const getFontColor = (): string => {
    if (editor) {
      const attrs = editor.getAttributes("textStyle");
      if (attrs.color) return attrs.color;
    }
    return element.defaultColor;
  };

  const getTextAlign = (): string => {
    if (editor) {
      if (editor.isActive({ textAlign: "center" })) return "center";
      if (editor.isActive({ textAlign: "right" })) return "right";
      if (editor.isActive({ textAlign: "justify" })) return "justify";
    }
    return "left";
  };

  const currentFontSize = parseFontSize();
  const currentFontFamily = getFontFamily();
  const currentFontColor = getFontColor();
  const currentAlign = getTextAlign();

  // ── Actions ─────────────────────────────────────────────

  const applyPreset = (preset: TextPreset) => {
    if (editor) {
      let chain = editor.chain().focus().selectAll();
      chain = chain.setMark("textStyle", { fontSize: preset.fontSize });
      if (preset.fontWeight === "bold") {
        chain = chain.setBold();
      } else {
        chain = chain.unsetBold();
      }
      chain.run();
    }
  };

  const setFontSize = (size: number) => {
    if (editor) {
      editor
        .chain()
        .focus()
        .setMark("textStyle", { fontSize: `${size}px` })
        .run();
    }
  };

  const setFontFamily = (family: string) => {
    if (editor) {
      editor.chain().focus().setFontFamily(family).run();
    }
    update({ defaultFontName: family });
  };

  const setFontColor = (color: string) => {
    if (editor) {
      editor.chain().focus().setColor(color).run();
    }
    update({ defaultColor: color });
  };

  const setTextAlign = (align: "left" | "center" | "right" | "justify") => {
    if (editor) {
      editor.chain().focus().setTextAlign(align).run();
    }
  };

  const toggleFormat = (format: string) => {
    if (!editor) return;
    switch (format) {
      case "bold":
        editor.chain().focus().toggleBold().run();
        break;
      case "italic":
        editor.chain().focus().toggleItalic().run();
        break;
      case "underline":
        editor.chain().focus().toggleUnderline().run();
        break;
      case "strike":
        editor.chain().focus().toggleStrike().run();
        break;
      case "superscript":
        editor.chain().focus().toggleSuperscript().run();
        break;
      case "subscript":
        editor.chain().focus().toggleSubscript().run();
        break;
      case "code":
        editor.chain().focus().toggleCode().run();
        break;
      case "blockquote":
        editor.chain().focus().toggleBlockquote().run();
        break;
      case "bulletList":
        editor.chain().focus().toggleBulletList().run();
        break;
      case "orderedList":
        editor.chain().focus().toggleOrderedList().run();
        break;
    }
  };

  const outline = element.outline;
  const hasOutline = !!outline;

  return (
    <div className="flex flex-col gap-0 pb-4">
      {/* 文字预设 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>文字预设</h3>
        <div className="grid grid-cols-3 gap-1">
          {TEXT_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="cursor-pointer rounded border border-border-subtle px-2 py-1 text-xs text-fg-default hover:bg-black/5 dark:hover:bg-white/5"
              onClick={() => applyPreset(preset)}
              disabled={!editor}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* 字体与大小 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>字体</h3>
        <div className="flex flex-col gap-2">
          <select
            className={selectClass}
            value={currentFontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1">
            <span className="w-16 shrink-0 text-xs text-fg-muted">大小</span>
            <button
              type="button"
              className={cn(iconBtnClass, "h-7 w-7")}
              onClick={() => setFontSize(Math.max(8, currentFontSize - 2))}
              disabled={!editor}
            >
              <Minus size={14} />
            </button>
            <input
              type="number"
              className={cn(numberInputClass, "w-16 text-center")}
              min={8}
              max={200}
              value={currentFontSize}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v >= 8 && v <= 200) setFontSize(v);
              }}
              disabled={!editor}
            />
            <button
              type="button"
              className={cn(iconBtnClass, "h-7 w-7")}
              onClick={() => setFontSize(Math.min(200, currentFontSize + 2))}
              disabled={!editor}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 字体颜色 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>字体颜色</h3>
        <ColorInput
          label="颜色"
          value={currentFontColor}
          onChange={setFontColor}
        />
      </div>

      {/* 文字格式 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>格式</h3>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <FormatBtn
              icon={<Bold size={16} />}
              active={editor?.isActive("bold")}
              onClick={() => toggleFormat("bold")}
              title="粗体"
              disabled={!editor}
            />
            <FormatBtn
              icon={<Italic size={16} />}
              active={editor?.isActive("italic")}
              onClick={() => toggleFormat("italic")}
              title="斜体"
              disabled={!editor}
            />
            <FormatBtn
              icon={<Underline size={16} />}
              active={editor?.isActive("underline")}
              onClick={() => toggleFormat("underline")}
              title="下划线"
              disabled={!editor}
            />
            <FormatBtn
              icon={<Strikethrough size={16} />}
              active={editor?.isActive("strike")}
              onClick={() => toggleFormat("strike")}
              title="删除线"
              disabled={!editor}
            />
          </div>
          <div className="flex items-center gap-1">
            <FormatBtn
              icon={<Superscript size={16} />}
              active={editor?.isActive("superscript")}
              onClick={() => toggleFormat("superscript")}
              title="上标"
              disabled={!editor}
            />
            <FormatBtn
              icon={<Subscript size={16} />}
              active={editor?.isActive("subscript")}
              onClick={() => toggleFormat("subscript")}
              title="下标"
              disabled={!editor}
            />
            <FormatBtn
              icon={<Code size={16} />}
              active={editor?.isActive("code")}
              onClick={() => toggleFormat("code")}
              title="代码"
              disabled={!editor}
            />
            <FormatBtn
              icon={<Quote size={16} />}
              active={editor?.isActive("blockquote")}
              onClick={() => toggleFormat("blockquote")}
              title="引用"
              disabled={!editor}
            />
          </div>
        </div>
      </div>

      {/* 对齐 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>对齐</h3>
        <div className="flex items-center gap-1">
          <FormatBtn
            icon={<AlignLeft size={16} />}
            active={currentAlign === "left"}
            onClick={() => setTextAlign("left")}
            title="左对齐"
            disabled={!editor}
          />
          <FormatBtn
            icon={<AlignCenter size={16} />}
            active={currentAlign === "center"}
            onClick={() => setTextAlign("center")}
            title="居中"
            disabled={!editor}
          />
          <FormatBtn
            icon={<AlignRight size={16} />}
            active={currentAlign === "right"}
            onClick={() => setTextAlign("right")}
            title="右对齐"
            disabled={!editor}
          />
          <FormatBtn
            icon={<AlignJustify size={16} />}
            active={currentAlign === "justify"}
            onClick={() => setTextAlign("justify")}
            title="两端对齐"
            disabled={!editor}
          />
        </div>
      </div>

      {/* 列表 & 缩进 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>列表</h3>
        <div className="flex items-center gap-1">
          <FormatBtn
            icon={<List size={16} />}
            active={editor?.isActive("bulletList")}
            onClick={() => toggleFormat("bulletList")}
            title="无序列表"
            disabled={!editor}
          />
          <FormatBtn
            icon={<ListOrdered size={16} />}
            active={editor?.isActive("orderedList")}
            onClick={() => toggleFormat("orderedList")}
            title="有序列表"
            disabled={!editor}
          />
          <div className="mx-1 h-4 w-px bg-border-subtle" />
          <FormatBtn
            icon={<Outdent size={16} />}
            active={false}
            onClick={() => {
              if (editor) editor.chain().focus().liftListItem("listItem").run();
            }}
            title="减少缩进"
            disabled={!editor}
          />
          <FormatBtn
            icon={<Indent size={16} />}
            active={false}
            onClick={() => {
              if (editor) editor.chain().focus().sinkListItem("listItem").run();
            }}
            title="增加缩进"
            disabled={!editor}
          />
        </div>
      </div>

      {/* 间距 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>间距</h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs text-fg-muted">行高</span>
            <select
              className={selectClass}
              value={element.lineHeight ?? 1.5}
              onChange={(e) => update({ lineHeight: Number(e.target.value) })}
            >
              {LINE_HEIGHT_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs text-fg-muted">字距</span>
            <select
              className={selectClass}
              value={element.wordSpace ?? 0}
              onChange={(e) => update({ wordSpace: Number(e.target.value) })}
            >
              {LETTER_SPACING_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v}px
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 元素填充 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>元素填充</h3>
        <ColorInput
          label="背景"
          value={element.fill || "#ffffff"}
          onChange={(c) => update({ fill: c })}
        />
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-fg-default">
          <input
            type="checkbox"
            className="cursor-pointer accent-blue-500"
            checked={!element.fill || element.fill === "transparent"}
            onChange={(e) => {
              update({ fill: e.target.checked ? undefined : "#ffffff" });
            }}
          />
          透明背景
        </label>
      </div>

      {/* 描边 */}
      <div className={sectionClass}>
        <h3 className={labelClass}>描边</h3>
        <label className="mb-2 flex cursor-pointer items-center gap-2 text-xs text-fg-default">
          <input
            type="checkbox"
            className="cursor-pointer accent-blue-500"
            checked={hasOutline}
            onChange={(e) => {
              if (e.target.checked) {
                update({
                  outline: { color: "#000000", width: 2, style: "solid" },
                });
              } else {
                update({ outline: undefined });
              }
            }}
          />
          启用描边
        </label>
        {hasOutline && outline && (
          <div className="flex flex-col gap-2">
            <ColorInput
              label="颜色"
              value={outline.color}
              onChange={(c) => update({ outline: { ...outline, color: c } })}
            />
            <SliderRow
              label="宽度"
              value={outline.width}
              min={1}
              max={10}
              step={1}
              onChange={(v) => update({ outline: { ...outline, width: v } })}
              unit="px"
            />
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-xs text-fg-muted">样式</span>
              <select
                className={selectClass}
                value={outline.style}
                onChange={(e) =>
                  update({
                    outline: {
                      ...outline,
                      style: e.target.value as ElementOutline["style"],
                    },
                  })
                }
              >
                <option value="solid">实线</option>
                <option value="dashed">虚线</option>
                <option value="dotted">点线</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 透明度 */}
      <div className="px-4 py-3">
        <h3 className={labelClass}>透明度</h3>
        <SliderRow
          label="不透明度"
          value={Math.round((element.opacity ?? 1) * 100)}
          min={0}
          max={100}
          step={1}
          onChange={(v) => update({ opacity: v / 100 })}
          unit="%"
        />
      </div>
    </div>
  );
}

// ── FormatBtn ───────────────────────────────────────────────

function FormatBtn({
  icon,
  active,
  onClick,
  title,
  disabled,
}: {
  icon: React.ReactNode;
  active: boolean | undefined;
  onClick: () => void;
  title: string;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(iconBtnClass, active && activeBtnClass)}
      title={title}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
    </button>
  );
}
