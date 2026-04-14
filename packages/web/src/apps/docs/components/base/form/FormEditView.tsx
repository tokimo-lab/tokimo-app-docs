import { cn } from "@tokiomo/components";
import { GripVertical, Minus, Plus } from "lucide-react";
import { useMemo } from "react";
import type { Field } from "../types";
import type { BaseEditorState } from "../useBaseEditor";
import { FIELD_TYPE_LABELS } from "../utils";

interface FormEditViewProps {
  state: BaseEditorState;
}

export function FormEditView({ state }: FormEditViewProps) {
  const { activeView, fields } = state;
  const rawConfig = activeView?.formConfig;

  // Compute effective config (fallback for views created before form support)
  const config = useMemo(
    () =>
      rawConfig ?? {
        title: "表单",
        description: "",
        visibleFieldIds: fields.map((f) => f.id),
        requiredFieldIds: [],
      },
    [rawConfig, fields],
  );

  const visibleFields = useMemo(() => {
    if (!config) return [];
    return config.visibleFieldIds
      .map((id) => fields.find((f) => f.id === id))
      .filter(Boolean) as Field[];
  }, [config, fields]);

  const availableFields = useMemo(() => {
    if (!config) return [];
    const visibleSet = new Set(config.visibleFieldIds);
    return fields.filter((f) => !visibleSet.has(f.id));
  }, [config, fields]);

  const requiredSet = useMemo(
    () => new Set(config?.requiredFieldIds ?? []),
    [config?.requiredFieldIds],
  );

  if (!config) return null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar: available fields */}
      <div className="w-64 shrink-0 overflow-y-auto border-r border-border-subtle bg-surface-base p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-fg-secondary">
            可选题目
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="cursor-pointer text-xs text-blue-600 hover:underline"
              onClick={() =>
                state.setFormConfig({
                  visibleFieldIds: fields.map((f) => f.id),
                })
              }
            >
              全部添加
            </button>
            <button
              type="button"
              className="cursor-pointer text-xs text-blue-600 hover:underline"
              onClick={() =>
                state.setFormConfig({
                  visibleFieldIds: [],
                  requiredFieldIds: [],
                })
              }
            >
              全部移除
            </button>
          </div>
        </div>

        {availableFields.length > 0 ? (
          <div className="space-y-1">
            {availableFields.map((field) => (
              <div
                key={field.id}
                className="flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-fill-tertiary"
              >
                <span className="flex items-center gap-1.5 truncate">
                  <FieldTypeIcon type={field.type} />
                  {field.name}
                </span>
                <button
                  type="button"
                  className="cursor-pointer text-fg-muted hover:text-fg-default"
                  onClick={() => state.toggleFormField(field.id)}
                >
                  <Plus size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-4 text-center text-xs text-fg-muted">
            所有字段已添加
          </div>
        )}
      </div>

      {/* Right: Form preview */}
      <div className="flex-1 overflow-y-auto bg-fill-tertiary">
        {/* Blue decorative header */}
        <div className="relative h-40 overflow-hidden bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600">
          <div className="absolute inset-0">
            <svg
              className="h-full w-full opacity-20"
              viewBox="0 0 800 200"
              preserveAspectRatio="none"
            >
              <circle cx="100" cy="100" r="80" fill="white" />
              <circle cx="700" cy="50" r="60" fill="white" />
              <rect
                x="300"
                y="30"
                width="120"
                height="120"
                rx="20"
                fill="white"
                transform="rotate(20 360 90)"
              />
              <rect
                x="500"
                y="80"
                width="80"
                height="80"
                rx="15"
                fill="white"
                transform="rotate(-15 540 120)"
              />
            </svg>
          </div>
        </div>

        {/* Form card */}
        <div className="mx-auto -mt-12 mb-8 max-w-xl rounded-lg bg-surface-base p-6 shadow-lg">
          {/* Editable title */}
          <input
            type="text"
            value={config.title}
            onChange={(e) => state.setFormConfig({ title: e.target.value })}
            className="mb-1 w-full border-none bg-transparent text-2xl font-bold outline-none placeholder:text-fg-muted"
            placeholder="表单标题"
          />
          <input
            type="text"
            value={config.description}
            onChange={(e) =>
              state.setFormConfig({ description: e.target.value })
            }
            className="mb-6 w-full border-none bg-transparent text-sm text-fg-muted outline-none placeholder:text-fg-muted/50"
            placeholder="请输入表单描述"
          />

          {/* Form fields */}
          {visibleFields.length > 0 ? (
            <div className="space-y-4">
              {visibleFields.map((field) => (
                <FormFieldRow
                  key={field.id}
                  field={field}
                  isRequired={requiredSet.has(field.id)}
                  onToggleRequired={() => state.toggleFormRequired(field.id)}
                  onRemove={() => state.toggleFormField(field.id)}
                />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-fg-muted">
              从左侧添加字段到表单
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FormFieldRow({
  field,
  isRequired,
  onToggleRequired,
  onRemove,
}: {
  field: Field;
  isRequired: boolean;
  onToggleRequired: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="group rounded-lg border border-transparent p-3 transition-colors hover:border-border-subtle hover:bg-fill-tertiary/50">
      <div className="mb-2 flex items-center gap-2">
        <GripVertical
          size={14}
          className="shrink-0 cursor-grab text-fg-muted opacity-0 transition-opacity group-hover:opacity-100"
        />
        <span className="text-sm font-medium">{field.name}</span>
        <div className="flex-1" />
        {/* Required toggle */}
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 text-xs text-fg-muted"
          onClick={onToggleRequired}
        >
          <div
            className={cn(
              "h-4 w-7 rounded-full transition-colors",
              isRequired ? "bg-blue-500" : "bg-fill-secondary",
            )}
          >
            <div
              className={cn(
                "h-4 w-4 rounded-full bg-white shadow transition-transform",
                isRequired ? "translate-x-3" : "translate-x-0",
              )}
            />
          </div>
          必填
        </button>
        {/* Remove */}
        <button
          type="button"
          className="cursor-pointer text-fg-muted opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
          onClick={onRemove}
        >
          <Minus size={16} />
        </button>
      </div>
      {/* Input preview (disabled) */}
      <div className="rounded border border-border-subtle bg-surface-base px-3 py-2 text-sm text-fg-muted">
        {getPlaceholder(field)}
      </div>
    </div>
  );
}

function getPlaceholder(field: Field): string {
  switch (field.type) {
    case "text":
      return "填写者回答区";
    case "number":
      return "请输入数字";
    case "select":
    case "workflow":
      return "请选择选项";
    case "multiSelect":
      return "请选择选项";
    case "date":
    case "createdTime":
    case "modifiedTime":
      return "请选择日期";
    case "checkbox":
      return "勾选";
    case "url":
      return "请输入链接";
    case "email":
      return "请输入邮箱";
    case "phone":
      return "请输入电话号码";
    case "rating":
      return "请评分";
    case "member":
    case "createdBy":
    case "modifiedBy":
      return "请选择人员";
    case "attachment":
      return "请上传附件";
    default:
      return "请输入内容";
  }
}

function FieldTypeIcon({ type }: { type: string }) {
  const label = FIELD_TYPE_LABELS[type as keyof typeof FIELD_TYPE_LABELS];
  return <span className="text-[10px] text-fg-muted">{label ?? type}</span>;
}
