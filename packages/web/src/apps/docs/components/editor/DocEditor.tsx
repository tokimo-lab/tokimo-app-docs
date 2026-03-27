import type { Value } from "platejs";
import { Plate, PlateContent, usePlateEditor } from "platejs/react";
import { useMemo } from "react";
import { Leaf } from "./elements/leaf";
import { FloatingToolbar } from "./floating-toolbar";
import { editorPlugins } from "./plugins";

export interface DocEditorProps {
  value: Value | null;
  onChange: (value: Value) => void;
  readOnly?: boolean;
  placeholder?: string;
}

const EMPTY_VALUE: Value = [{ type: "p", children: [{ text: "" }] }];

export function DocEditor({
  value,
  onChange,
  readOnly = false,
  placeholder = "Type '/' for commands…",
}: DocEditorProps) {
  const initialValue = useMemo(() => value ?? EMPTY_VALUE, [value]);

  const editor = usePlateEditor(
    {
      plugins: editorPlugins,
      value: initialValue,
    },
    [initialValue],
  );

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
          renderLeaf={({ children, leaf, attributes }) => (
            <Leaf leaf={leaf} attributes={attributes}>
              {children}
            </Leaf>
          )}
        />
      </div>
      {!readOnly && <FloatingToolbar />}
    </Plate>
  );
}
