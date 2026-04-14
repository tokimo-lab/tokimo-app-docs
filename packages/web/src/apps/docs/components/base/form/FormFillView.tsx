import { useCallback, useMemo, useState } from "react";
import type { CellValue, Field, RecordData } from "../types";
import type { BaseEditorState } from "../useBaseEditor";

interface FormFillViewProps {
  state: BaseEditorState;
}

export function FormFillView({ state }: FormFillViewProps) {
  const { activeView, fields } = state;
  const rawConfig = activeView?.formConfig;
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
  const [formData, setFormData] = useState<RecordData>({});
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Set<string>>(new Set());

  const visibleFields = useMemo(() => {
    if (!config) return [];
    return config.visibleFieldIds
      .map((id) => fields.find((f) => f.id === id))
      .filter(Boolean) as Field[];
  }, [config, fields]);

  const requiredSet = useMemo(
    () => new Set(config?.requiredFieldIds ?? []),
    [config?.requiredFieldIds],
  );

  const updateField = useCallback((fieldId: string, value: CellValue) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => {
      const next = new Set(prev);
      next.delete(fieldId);
      return next;
    });
  }, []);

  const handleSubmit = useCallback(() => {
    // Validate required fields
    const newErrors = new Set<string>();
    for (const fieldId of config?.requiredFieldIds ?? []) {
      const val = formData[fieldId];
      if (val === undefined || val === null || val === "") {
        newErrors.add(fieldId);
      }
    }
    if (newErrors.size > 0) {
      setErrors(newErrors);
      return;
    }
    state.submitForm(formData);
    setFormData({});
    setSubmitted(true);
  }, [config, formData, state]);

  const handleReset = useCallback(() => {
    setSubmitted(false);
    setFormData({});
    setErrors(new Set());
  }, []);

  if (submitted) {
    return (
      <div className="flex h-full items-center justify-center bg-fill-tertiary">
        <div className="rounded-lg bg-surface-base p-8 text-center shadow-lg">
          <div className="mb-4 text-5xl">✓</div>
          <h2 className="mb-2 text-xl font-bold">提交成功</h2>
          <p className="mb-6 text-sm text-fg-muted">你的回答已成功记录</p>
          <button
            type="button"
            className="cursor-pointer rounded-lg bg-blue-500 px-6 py-2 text-sm text-white hover:bg-blue-600"
            onClick={handleReset}
          >
            再次填写
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-fill-tertiary">
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
          </svg>
        </div>
      </div>

      {/* Form card */}
      <div className="relative z-10 mx-auto -mt-12 mb-8 max-w-xl rounded-lg bg-surface-base p-6 shadow-lg">
        <h1 className="mb-1 text-2xl font-bold">{config.title || "表单"}</h1>
        {config.description && (
          <p className="mb-6 text-sm text-fg-muted">{config.description}</p>
        )}

        <div className="space-y-5">
          {visibleFields.map((field) => (
            <FormInput
              key={field.id}
              field={field}
              value={formData[field.id]}
              isRequired={requiredSet.has(field.id)}
              hasError={errors.has(field.id)}
              onChange={(val) => updateField(field.id, val)}
            />
          ))}
        </div>

        <button
          type="button"
          className="mt-8 w-full cursor-pointer rounded-lg bg-blue-500 py-2.5 text-sm font-medium text-white hover:bg-blue-600"
          onClick={handleSubmit}
        >
          提交
        </button>
      </div>
    </div>
  );
}

function FormInput({
  field,
  value,
  isRequired,
  hasError,
  onChange,
}: {
  field: Field;
  value: CellValue | undefined;
  isRequired: boolean;
  hasError: boolean;
  onChange: (val: CellValue) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1 text-sm font-medium">
        {field.name}
        {isRequired && <span className="text-red-500">*</span>}
      </div>
      {renderInput(field, value, hasError, onChange)}
      {hasError && <p className="mt-1 text-xs text-red-500">此字段为必填项</p>}
    </div>
  );
}

function renderInput(
  field: Field,
  value: CellValue | undefined,
  hasError: boolean,
  onChange: (val: CellValue) => void,
) {
  const borderClass = hasError
    ? "border-red-400 focus:ring-red-200"
    : "border-border-subtle focus:ring-blue-200";

  switch (field.type) {
    case "text":
    case "url":
    case "email":
    case "phone":
      return (
        <input
          type={
            field.type === "url"
              ? "url"
              : field.type === "email"
                ? "email"
                : "text"
          }
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${borderClass}`}
          placeholder={`请输入${field.name}`}
        />
      );

    case "number":
      return (
        <input
          type="number"
          value={(value as number) ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${borderClass}`}
          placeholder={`请输入${field.name}`}
        />
      );

    case "date":
    case "createdTime":
    case "modifiedTime":
      return (
        <input
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${borderClass}`}
        />
      );

    case "checkbox":
      return (
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border-border-subtle"
          />
          <span className="text-sm text-fg-secondary">{field.name}</span>
        </label>
      );

    case "select":
    case "workflow":
      return (
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className={`w-full cursor-pointer rounded-lg border bg-surface-base px-3 py-2 text-sm outline-none focus:ring-2 ${borderClass}`}
        >
          <option value="">请选择</option>
          {field.options?.map((opt) => (
            <option key={opt.id} value={opt.label}>
              {opt.label}
            </option>
          ))}
        </select>
      );

    case "multiSelect":
      return (
        <MultiSelectInput
          field={field}
          value={value as string[] | undefined}
          hasError={hasError}
          onChange={onChange}
        />
      );

    case "rating": {
      const rating = (value as number) ?? 0;
      return (
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className="cursor-pointer text-xl"
              onClick={() => onChange(star === rating ? 0 : star)}
            >
              {star <= rating ? "★" : "☆"}
            </button>
          ))}
        </div>
      );
    }

    default:
      return (
        <input
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 ${borderClass}`}
          placeholder={`请输入${field.name}`}
        />
      );
  }
}

function MultiSelectInput({
  field,
  value,
  hasError,
  onChange,
}: {
  field: Field;
  value: string[] | undefined;
  hasError: boolean;
  onChange: (val: CellValue) => void;
}) {
  const selected = new Set(value ?? []);
  const borderClass = hasError ? "border-red-400" : "border-border-subtle";

  return (
    <div className={`rounded-lg border p-2 ${borderClass}`}>
      <div className="flex flex-wrap gap-1.5">
        {field.options?.map((opt) => {
          const isSelected = selected.has(opt.label);
          return (
            <button
              key={opt.id}
              type="button"
              className={`cursor-pointer rounded-full px-3 py-1 text-xs transition-colors ${
                isSelected
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                  : "bg-fill-tertiary text-fg-secondary hover:bg-fill-secondary"
              }`}
              onClick={() => {
                const next = new Set(selected);
                if (isSelected) {
                  next.delete(opt.label);
                } else {
                  next.add(opt.label);
                }
                onChange(Array.from(next));
              }}
            >
              {opt.label}
            </button>
          );
        }) ?? <span className="text-xs text-fg-muted">暂无选项</span>}
      </div>
    </div>
  );
}
