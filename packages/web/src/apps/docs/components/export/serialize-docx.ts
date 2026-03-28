/**
 * Serialize Plate/Slate JSON value → docx Document (using the `docx` npm package).
 *
 * Supported node types:
 *   Blocks — paragraph, h1-h3, blockquote, code_block, table, hr, callout,
 *            toggle, column_group, image, equation, list (indent-based)
 *   Marks — bold, italic, underline, strikethrough, code, highlight,
 *           superscript, subscript, kbd
 *   Inline — link, inline_equation, mention, date, emoji
 */

import {
  AlignmentType,
  BorderStyle,
  type Document,
  Math as DocxMath,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  type IRunOptions,
  type ISectionOptions,
  LevelFormat,
  MathRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { saveAs } from "file-saver";
import type { Value } from "platejs";

// ─── Mark helpers ──────────────────────────────────────────────────────
function markProps(node: Record<string, unknown>): IRunOptions {
  return {
    bold: !!node.bold || !!node.kbd || undefined,
    italics: !!node.italic || undefined,
    underline: node.underline ? { type: "single" as const } : undefined,
    strike: !!node.strikethrough || undefined,
    font: node.code || node.kbd ? { name: "Consolas" } : undefined,
    shading: node.code
      ? { type: ShadingType.CLEAR, color: "auto", fill: "E8E8E8" }
      : undefined,
    highlight: node.highlight ? ("yellow" as const) : undefined,
    superScript: !!node.superscript || undefined,
    subScript: !!node.subscript || undefined,
  };
}

// ─── Inline node → TextRun / ExternalHyperlink ─────────────────────────
type InlineResult = TextRun | ExternalHyperlink | DocxMath;

function serializeInline(node: Record<string, unknown>): InlineResult[] {
  // Text leaf
  if (typeof node.text === "string") {
    const text = node.text as string;
    if (!text) return [];
    return [new TextRun({ text, ...markProps(node) })];
  }

  const type = node.type as string | undefined;

  // Link
  if (type === "a") {
    const children = serializeInlines(
      (node.children as Record<string, unknown>[]) || [],
    );
    const url = (node.url as string) || "";
    return [new ExternalHyperlink({ link: url, children })];
  }

  // Inline equation (LaTeX)
  if (type === "inline_equation") {
    const tex = (node.texExpression as string) || "";
    return [new DocxMath({ children: [new MathRun(tex)] })];
  }

  // Mention
  if (type === "mention") {
    const value = (node.value as string) || "";
    return [new TextRun({ text: `@${value}`, bold: true })];
  }

  // Date
  if (type === "date") {
    const d = (node.date as string) || "";
    return [new TextRun({ text: d })];
  }

  // Fallback: try children
  if (Array.isArray(node.children)) {
    return serializeInlines(node.children as Record<string, unknown>[]);
  }

  return [];
}

function serializeInlines(nodes: Record<string, unknown>[]): InlineResult[] {
  return nodes.flatMap(serializeInline);
}

// ─── Heading level mapping ─────────────────────────────────────────────
function headingLevel(
  type: string,
): (typeof HeadingLevel)[keyof typeof HeadingLevel] | undefined {
  switch (type) {
    case "h1":
      return HeadingLevel.HEADING_1;
    case "h2":
      return HeadingLevel.HEADING_2;
    case "h3":
      return HeadingLevel.HEADING_3;
    default:
      return undefined;
  }
}

// ─── List helpers ──────────────────────────────────────────────────────
const BULLET_REF = "tokimo-bullet";
const NUMBERED_REF = "tokimo-numbered";

const numberingConfig = [
  {
    reference: BULLET_REF,
    levels: [
      {
        level: 0,
        format: LevelFormat.BULLET,
        text: "\u25CF",
        alignment: AlignmentType.LEFT,
      },
      {
        level: 1,
        format: LevelFormat.BULLET,
        text: "\u25CB",
        alignment: AlignmentType.LEFT,
      },
      {
        level: 2,
        format: LevelFormat.BULLET,
        text: "\u25A0",
        alignment: AlignmentType.LEFT,
      },
    ],
  },
  {
    reference: NUMBERED_REF,
    levels: [
      {
        level: 0,
        format: LevelFormat.DECIMAL,
        text: "%1.",
        alignment: AlignmentType.LEFT,
      },
      {
        level: 1,
        format: LevelFormat.LOWER_LETTER,
        text: "%2)",
        alignment: AlignmentType.LEFT,
      },
      {
        level: 2,
        format: LevelFormat.LOWER_ROMAN,
        text: "%3.",
        alignment: AlignmentType.LEFT,
      },
    ],
  },
] as const;

// ─── Block node → Paragraph[] ──────────────────────────────────────────
function serializeBlock(node: Record<string, unknown>): (Paragraph | Table)[] {
  const type = (node.type as string) || "p";
  const children = (node.children as Record<string, unknown>[]) || [];

  // Headings
  if (type === "h1" || type === "h2" || type === "h3") {
    return [
      new Paragraph({
        heading: headingLevel(type),
        children: serializeInlines(children),
      }),
    ];
  }

  // Paragraph (with optional list indent)
  if (type === "p") {
    const indent = node.indent as number | undefined;
    const listStyleType = node.listStyleType as string | undefined;

    if (listStyleType) {
      const isOrdered = listStyleType === "decimal";
      const level = indent ? Math.min(indent - 1, 2) : 0;
      return [
        new Paragraph({
          numbering: {
            reference: isOrdered ? NUMBERED_REF : BULLET_REF,
            level,
          },
          children: serializeInlines(children),
        }),
      ];
    }

    const opts: Record<string, unknown> = {
      children: serializeInlines(children),
    };
    if (indent) {
      opts.indent = { left: indent * 240 };
    }
    return [new Paragraph(opts as ConstructorParameters<typeof Paragraph>[0])];
  }

  // Blockquote
  if (type === "blockquote") {
    return [
      new Paragraph({
        indent: { left: 720 },
        border: {
          left: {
            color: "999999",
            space: 4,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
        children: serializeInlines(children),
      }),
    ];
  }

  // Horizontal rule
  if (type === "hr") {
    return [
      new Paragraph({
        border: {
          bottom: {
            color: "CCCCCC",
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
        children: [],
      }),
    ];
  }

  // Code block
  if (type === "code_block") {
    return children.flatMap((line) => {
      const lineChildren = (line.children as Record<string, unknown>[]) || [];
      const text = lineChildren.map((c) => (c.text as string) || "").join("");
      return [
        new Paragraph({
          children: [
            new TextRun({ text, font: { name: "Consolas" }, size: 20 }),
          ],
          shading: {
            type: ShadingType.CLEAR,
            color: "auto",
            fill: "F5F5F5",
          },
          spacing: { line: 276 },
        }),
      ];
    });
  }

  // Table
  if (type === "table") {
    const rows = children
      .filter((r) => (r.type as string) === "tr")
      .map((row) => {
        const cells = ((row.children as Record<string, unknown>[]) || [])
          .filter(
            (c) => (c.type as string) === "td" || (c.type as string) === "th",
          )
          .map((cell) => {
            const cellChildren =
              (cell.children as Record<string, unknown>[]) || [];
            const paragraphs = cellChildren.flatMap(serializeBlock);
            const paras = paragraphs.filter(
              (p): p is Paragraph => p instanceof Paragraph,
            );
            return new TableCell({
              children: paras.length > 0 ? paras : [new Paragraph({})],
              shading:
                (cell.type as string) === "th"
                  ? {
                      type: ShadingType.CLEAR,
                      color: "auto",
                      fill: "E8E8E8",
                    }
                  : undefined,
            });
          });
        return new TableRow({ children: cells });
      });

    if (rows.length === 0) return [];
    return [
      new Table({
        rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      }),
    ];
  }

  // Callout — render as indented paragraph with emoji prefix
  if (type === "callout") {
    const emoji = (node.emoji as string) || "💡";
    const runs = serializeInlines(children);
    return [
      new Paragraph({
        indent: { left: 360 },
        shading: {
          type: ShadingType.CLEAR,
          color: "auto",
          fill: "FFF8E1",
        },
        children: [new TextRun({ text: `${emoji} ` }), ...runs],
      }),
    ];
  }

  // Toggle (collapsible) — render as bold title + indented content
  if (type === "toggle") {
    const results: (Paragraph | Table)[] = [];
    if (children.length > 0) {
      // First child is toggle title
      const titleInlines = serializeInlines(
        (children[0].children as Record<string, unknown>[]) || [],
      );
      results.push(
        new Paragraph({
          children: [new TextRun({ text: "▶ ", bold: true }), ...titleInlines],
        }),
      );
      // Rest are toggle content
      for (let i = 1; i < children.length; i++) {
        results.push(...serializeBlock(children[i]));
      }
    }
    return results;
  }

  // Column group — render columns sequentially
  if (type === "column_group") {
    return children.flatMap((col) => {
      const colChildren = (col.children as Record<string, unknown>[]) || [];
      return colChildren.flatMap(serializeBlock);
    });
  }

  // Image — try to embed if it's a data URL, otherwise show URL text
  if (type === "img") {
    const url = (node.url as string) || "";
    const caption = (node.caption as string) || "";

    // For remote images, just show as a link paragraph
    const imgParagraphs: Paragraph[] = [];

    if (url.startsWith("data:")) {
      // data URL — embed the image
      try {
        const base64 = url.split(",")[1];
        imgParagraphs.push(
          new Paragraph({
            children: [
              new ImageRun({
                type: "png",
                data: Buffer.from(base64, "base64"),
                transformation: {
                  width: 400,
                  height: 300,
                },
              }),
            ],
          }),
        );
      } catch {
        imgParagraphs.push(
          new Paragraph({
            children: [new TextRun({ text: `[Image: ${url}]`, italics: true })],
          }),
        );
      }
    } else {
      imgParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `[Image: ${url}]`,
              italics: true,
              color: "666666",
            }),
          ],
        }),
      );
    }

    if (caption) {
      imgParagraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: caption, italics: true, size: 20 })],
        }),
      );
    }
    return imgParagraphs;
  }

  // Equation block (LaTeX)
  if (type === "equation") {
    const tex = (node.texExpression as string) || "";
    return [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new DocxMath({ children: [new MathRun(tex)] })],
      }),
    ];
  }

  // Mermaid — render as code block placeholder
  if (type === "mermaid") {
    const code = (node.code as string) || "";
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: "[Mermaid Diagram]",
            bold: true,
            italics: true,
          }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: code, font: { name: "Consolas" }, size: 18 }),
        ],
        shading: {
          type: ShadingType.CLEAR,
          color: "auto",
          fill: "F0F4F8",
        },
      }),
    ];
  }

  // TOC — placeholder
  if (type === "toc") {
    return [
      new Paragraph({
        children: [
          new TextRun({
            text: "[Table of Contents]",
            bold: true,
            italics: true,
          }),
        ],
      }),
    ];
  }

  // Fallback — render as paragraph
  return [
    new Paragraph({
      children: serializeInlines(children),
    }),
  ];
}

// ─── Main export function ──────────────────────────────────────────────

export async function exportDocx(value: Value, title: string): Promise<void> {
  const allBlocks = (value as Record<string, unknown>[]).flatMap(
    serializeBlock,
  );

  const sectionChildren = allBlocks as ISectionOptions["children"];

  // Dynamic import to avoid bundling issues
  const { Document: DocxDocument } = await import("docx");

  const doc: Document = new DocxDocument({
    numbering: { config: [...numberingConfig] },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: [
          // Title
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [new TextRun({ text: title, bold: true })],
            spacing: { after: 400 },
          }),
          ...sectionChildren,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${title || "document"}.docx`);
}
