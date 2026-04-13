import type {
  BaseContent,
  BaseRecord,
  BaseView,
  CellValue,
  Field,
  FieldType,
  FilterCondition,
  FilterGroup,
  GroupRule,
  SelectOption,
  SortRule,
  ViewType,
} from "./types";
import { SELECT_COLORS } from "./types";

// ── ID generation ───────────────────────────────────────────────────────────

let counter = 0;
export function generateId(prefix = "id"): string {
  counter++;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

// ── Factory functions ───────────────────────────────────────────────────────

export function createField(
  name: string,
  type: FieldType,
  options?: SelectOption[],
): Field {
  return {
    id: generateId("fld"),
    name,
    type,
    width: type === "checkbox" ? 80 : 180,
    options,
  };
}

export function createRecord(fields: Field[]): BaseRecord {
  const data: Record<string, CellValue> = {};
  for (const f of fields) {
    data[f.id] = getDefaultValue(f.type);
  }
  const now = new Date().toISOString();
  return {
    id: generateId("rec"),
    data,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function createView(name: string, fields: Field[]): BaseView {
  return {
    id: generateId("viw"),
    name,
    type: "grid",
    filters: { conjunction: "and", conditions: [] },
    sorts: [],
    groups: [],
    hiddenFieldIds: [],
    fieldOrder: fields.map((f) => f.id),
    rowHeight: "medium",
    frozenFieldCount: 0,
  };
}

export function createViewWithType(
  name: string,
  type: ViewType,
  fields: Field[],
): BaseView {
  return {
    ...createView(name, fields),
    type,
  };
}

export function createDefaultBaseFields(): Field[] {
  return [
    createField("标题", "text"),
    createField("备注", "text"),
    createField("状态", "select", [
      { id: generateId("opt"), label: "待处理", color: SELECT_COLORS[9] },
      { id: generateId("opt"), label: "进行中", color: SELECT_COLORS[0] },
      { id: generateId("opt"), label: "已完成", color: SELECT_COLORS[11] },
    ]),
  ];
}

export function createDefaultBaseContent(): BaseContent {
  const fields = createDefaultBaseFields();
  const view = createView("Grid View", fields);
  return {
    fields,
    views: [view],
    activeViewId: view.id,
  };
}

// ── Default values ──────────────────────────────────────────────────────────

function getDefaultValue(type: FieldType): CellValue {
  switch (type) {
    case "text":
    case "url":
    case "date":
      return "";
    case "number":
      return null;
    case "select":
      return "";
    case "multiSelect":
      return [];
    case "checkbox":
      return false;
  }
}

// ── Filter engine ───────────────────────────────────────────────────────────

function matchCondition(
  value: CellValue,
  cond: FilterCondition,
  field: Field | undefined,
): boolean {
  const { operator } = cond;

  if (operator === "isEmpty")
    return (
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    );
  if (operator === "isNotEmpty")
    return (
      value !== null &&
      value !== "" &&
      !(Array.isArray(value) && value.length === 0)
    );

  const cv = cond.value;
  const strVal = String(value ?? "");
  const strCv = String(cv ?? "");
  const numVal = Number(value);
  const numCv = Number(cv);

  switch (operator) {
    case "eq":
      if (field?.type === "number") return numVal === numCv;
      if (field?.type === "checkbox") return value === cv;
      return strVal === strCv;
    case "neq":
      return !matchCondition(value, { ...cond, operator: "eq" }, field);
    case "contains":
      if (Array.isArray(value)) return value.includes(strCv);
      return strVal.toLowerCase().includes(strCv.toLowerCase());
    case "notContains":
      return !matchCondition(value, { ...cond, operator: "contains" }, field);
    case "gt":
      return numVal > numCv;
    case "gte":
      return numVal >= numCv;
    case "lt":
      return numVal < numCv;
    case "lte":
      return numVal <= numCv;
    default:
      return true;
  }
}

export function applyFilters(
  records: BaseRecord[],
  filterGroup: FilterGroup,
  fields: Field[],
): BaseRecord[] {
  if (filterGroup.conditions.length === 0) return records;
  const fieldMap = new Map(fields.map((f) => [f.id, f]));

  return records.filter((rec) => {
    const results = filterGroup.conditions.map((cond) =>
      matchCondition(rec.data[cond.fieldId], cond, fieldMap.get(cond.fieldId)),
    );
    return filterGroup.conjunction === "and"
      ? results.every(Boolean)
      : results.some(Boolean);
  });
}

// ── Sort engine ─────────────────────────────────────────────────────────────

function compareValues(
  a: CellValue,
  b: CellValue,
  field: Field | undefined,
): number {
  if (a === b) return 0;
  if (a === null || a === "") return 1;
  if (b === null || b === "") return -1;

  if (field?.type === "number") return Number(a) - Number(b);
  if (field?.type === "checkbox")
    return (a === true ? 1 : 0) - (b === true ? 1 : 0);
  return String(a).localeCompare(String(b));
}

export function applySorts(
  records: BaseRecord[],
  sorts: SortRule[],
  fields: Field[],
): BaseRecord[] {
  if (sorts.length === 0) return records;
  const fieldMap = new Map(fields.map((f) => [f.id, f]));

  return [...records].sort((a, b) => {
    for (const sort of sorts) {
      const field = fieldMap.get(sort.fieldId);
      const cmp = compareValues(
        a.data[sort.fieldId],
        b.data[sort.fieldId],
        field,
      );
      if (cmp !== 0) return sort.direction === "asc" ? cmp : -cmp;
    }
    return 0;
  });
}

// ── Group engine ────────────────────────────────────────────────────────────

export interface RecordGroup {
  key: string;
  label: string;
  records: BaseRecord[];
}

export function applyGroups(
  records: BaseRecord[],
  groups: GroupRule[],
  fields: Field[],
): RecordGroup[] {
  if (groups.length === 0) return [{ key: "__all", label: "", records }];

  const group = groups[0];
  const field = fields.find((f) => f.id === group.fieldId);
  const map = new Map<string, BaseRecord[]>();
  const order: string[] = [];

  for (const rec of records) {
    const val = rec.data[group.fieldId];
    const key = Array.isArray(val) ? val.join(", ") : String(val ?? "");
    const label = key || "(空)";
    if (!map.has(label)) {
      map.set(label, []);
      order.push(label);
    }
    map.get(label)!.push(rec);
  }

  order.sort((a, b) => {
    const cmp = a.localeCompare(b);
    return group.direction === "asc" ? cmp : -cmp;
  });

  return order.map((label) => ({
    key: `${field?.id ?? ""}:${label}`,
    label,
    records: map.get(label) ?? [],
  }));
}

// ── View helpers ────────────────────────────────────────────────────────────

/** Get visible fields in the order defined by the view */
export function getVisibleFields(fields: Field[], view: BaseView): Field[] {
  const hidden = new Set(view.hiddenFieldIds);
  const fieldMap = new Map(fields.map((f) => [f.id, f]));

  // Use view.fieldOrder if available, fall back to original order
  const ordered =
    view.fieldOrder.length > 0
      ? view.fieldOrder
          .map((id) => fieldMap.get(id))
          .filter((f): f is Field => !!f && !hidden.has(f.id))
      : fields.filter((f) => !hidden.has(f.id));

  // Append any fields not in fieldOrder
  const seen = new Set(ordered.map((f) => f.id));
  for (const f of fields) {
    if (!seen.has(f.id) && !hidden.has(f.id)) {
      ordered.push(f);
    }
  }

  return ordered;
}

/** Get processed (filtered + sorted) records for a view */
export function getProcessedRecords(
  records: BaseRecord[],
  view: BaseView,
  fields: Field[],
): BaseRecord[] {
  let result = applyFilters(records, view.filters, fields);
  result = applySorts(result, view.sorts, fields);
  return result;
}

// ── Field type labels ───────────────────────────────────────────────────────

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "文本",
  number: "数字",
  select: "单选",
  multiSelect: "多选",
  checkbox: "复选框",
  date: "日期",
  url: "网址",
};

export function nextSelectColor(existing: SelectOption[]): string {
  const idx = existing.length % SELECT_COLORS.length;
  return SELECT_COLORS[idx];
}
