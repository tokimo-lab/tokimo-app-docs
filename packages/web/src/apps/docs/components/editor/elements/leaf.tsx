import type { TText } from "platejs";

interface LeafProps {
  leaf: TText;
  children: React.ReactNode;
  attributes: Record<string, unknown>;
}

export function Leaf({ leaf, children, attributes }: LeafProps) {
  const l = leaf as Record<string, unknown>;

  if (l.bold) {
    children = <strong>{children}</strong>;
  }
  if (l.italic) {
    children = <em>{children}</em>;
  }
  if (l.underline) {
    children = <u>{children}</u>;
  }
  if (l.strikethrough) {
    children = <s>{children}</s>;
  }
  if (l.code) {
    children = (
      <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-sm text-rose-600 dark:bg-zinc-800 dark:text-rose-400">
        {children}
      </code>
    );
  }

  return <span {...attributes}>{children}</span>;
}
