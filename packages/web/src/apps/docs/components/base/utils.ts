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

// ── View type default names ──────────────────────────────────────────────────

export const VIEW_TYPE_DEFAULT_NAMES: Record<ViewType, string> = {
  grid: "表格",
  kanban: "看板",
  calendar: "日历",
  gantt: "甘特",
  gallery: "画册",
  form: "表单",
};

// ── Factory functions ───────────────────────────────────────────────────────

export function createField(
  name: string,
  type: FieldType,
  options?: SelectOption[],
): Field {
  const defaultOptions =
    type === "workflow" && !options
      ? [
          { id: generateId("opt"), label: "未开始", color: "#e0e7ff" },
          { id: generateId("opt"), label: "进行中", color: "#dbeafe" },
          { id: generateId("opt"), label: "已结束", color: "#dcfce7" },
        ]
      : options;
  return {
    id: generateId("fld"),
    name,
    type,
    width: type === "checkbox" ? 80 : 180,
    options: defaultOptions,
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
  const base = createView(name, fields);
  if (type === "kanban") {
    const groupableTypes: FieldType[] = [
      "select",
      "multiSelect",
      "member",
      "checkbox",
      "rating",
      "workflow",
    ];
    const groupField = fields.find((f) => groupableTypes.includes(f.type));
    return {
      ...base,
      type,
      kanbanConfig: {
        groupFieldId: groupField?.id ?? "",
        cardDisplayMode: "normal",
        showFieldNames: false,
        cardVisibleFieldIds: fields.map((f) => f.id),
      },
    };
  }
  if (type === "calendar") {
    const dateField = fields.find((f) => f.type === "date");
    return {
      ...base,
      type,
      calendarConfig: {
        dateFieldId: dateField?.id ?? "",
        viewMode: "month",
      },
    };
  }
  return { ...base, type };
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
    case "phone":
    case "email":
    case "select":
    case "workflow":
    case "createdBy":
    case "modifiedBy":
    case "createdTime":
    case "modifiedTime":
      return "";
    case "number":
    case "currency":
    case "progress":
    case "rating":
    case "autoNumber":
      return null;
    case "multiSelect":
    case "attachment":
    case "member":
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
  url: "超链接",
  phone: "电话号码",
  email: "Email",
  currency: "货币",
  progress: "进度",
  rating: "评分",
  workflow: "流程",
  attachment: "附件",
  member: "人员",
  autoNumber: "自动编号",
  createdBy: "创建人",
  modifiedBy: "修改人",
  createdTime: "创建时间",
  modifiedTime: "最后更新时间",
};

export function nextSelectColor(existing: SelectOption[]): string {
  const idx = existing.length % SELECT_COLORS.length;
  return SELECT_COLORS[idx];
}

// ── Kanban grouping utilities ───────────────────────────────────────────────

export interface KanbanGroup {
  id: string;
  label: string;
  color?: string;
  records: BaseRecord[];
}

export const KANBAN_GROUPABLE_TYPES: FieldType[] = [
  "select",
  "multiSelect",
  "member",
  "checkbox",
  "rating",
  "workflow",
];

export const KANBAN_CAN_ADD_GROUP_TYPES: FieldType[] = [
  "select",
  "multiSelect",
  "member",
];

export function groupRecordsForKanban(
  records: BaseRecord[],
  groupField: Field,
): KanbanGroup[] {
  const groups: KanbanGroup[] = [];
  const fieldId = groupField.id;

  switch (groupField.type) {
    case "select":
    case "workflow": {
      const options = groupField.options ?? [];
      const uncategorized: BaseRecord[] = [];
      const optionMap = new Map<string, BaseRecord[]>();
      for (const opt of options) optionMap.set(opt.id, []);

      for (const rec of records) {
        const val = rec.data[fieldId];
        if (typeof val === "string" && optionMap.has(val)) {
          optionMap.get(val)!.push(rec);
        } else {
          uncategorized.push(rec);
        }
      }

      groups.push({
        id: "__uncategorized",
        label: "未分类",
        records: uncategorized,
      });
      for (const opt of options) {
        groups.push({
          id: opt.id,
          label: opt.label,
          color: opt.color,
          records: optionMap.get(opt.id) ?? [],
        });
      }
      break;
    }
    case "multiSelect": {
      const options = groupField.options ?? [];
      const uncategorized: BaseRecord[] = [];
      const optionMap = new Map<string, BaseRecord[]>();
      for (const opt of options) optionMap.set(opt.id, []);

      for (const rec of records) {
        const val = rec.data[fieldId];
        if (Array.isArray(val) && val.length > 0) {
          let matched = false;
          for (const v of val) {
            if (optionMap.has(v)) {
              optionMap.get(v)!.push(rec);
              matched = true;
            }
          }
          if (!matched) uncategorized.push(rec);
        } else {
          uncategorized.push(rec);
        }
      }

      groups.push({
        id: "__uncategorized",
        label: "未分类",
        records: uncategorized,
      });
      for (const opt of options) {
        groups.push({
          id: opt.id,
          label: opt.label,
          color: opt.color,
          records: optionMap.get(opt.id) ?? [],
        });
      }
      break;
    }
    case "checkbox": {
      const checked: BaseRecord[] = [];
      const unchecked: BaseRecord[] = [];
      for (const rec of records) {
        if (rec.data[fieldId] === true) checked.push(rec);
        else unchecked.push(rec);
      }
      groups.push({ id: "__false", label: "未勾选", records: unchecked });
      groups.push({ id: "__true", label: "已勾选", records: checked });
      break;
    }
    case "rating": {
      const unrated: BaseRecord[] = [];
      const ratingMap = new Map<number, BaseRecord[]>();
      for (let i = 1; i <= 5; i++) ratingMap.set(i, []);

      for (const rec of records) {
        const val = rec.data[fieldId];
        const num = typeof val === "number" ? val : 0;
        if (num >= 1 && num <= 5) {
          ratingMap.get(num)!.push(rec);
        } else {
          unrated.push(rec);
        }
      }

      groups.push({
        id: "__uncategorized",
        label: "未评分",
        records: unrated,
      });
      for (let i = 1; i <= 5; i++) {
        groups.push({
          id: String(i),
          label: "★".repeat(i),
          records: ratingMap.get(i) ?? [],
        });
      }
      break;
    }
    case "member": {
      const unassigned: BaseRecord[] = [];
      const memberMap = new Map<string, BaseRecord[]>();

      for (const rec of records) {
        const val = rec.data[fieldId];
        if (Array.isArray(val) && val.length > 0) {
          for (const v of val) {
            if (!memberMap.has(v)) memberMap.set(v, []);
            memberMap.get(v)!.push(rec);
          }
        } else if (typeof val === "string" && val) {
          if (!memberMap.has(val)) memberMap.set(val, []);
          memberMap.get(val)!.push(rec);
        } else {
          unassigned.push(rec);
        }
      }

      groups.push({
        id: "__uncategorized",
        label: "未分配",
        records: unassigned,
      });
      for (const [name, recs] of memberMap) {
        groups.push({ id: name, label: name, records: recs });
      }
      break;
    }
    default: {
      groups.push({ id: "__all", label: "全部", records });
    }
  }

  return groups;
}

// ── Calendar utilities ──────────────────────────────────────────────────────

export interface CalendarDay {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  isCurrentMonth: boolean;
  isToday: boolean;
  records: BaseRecord[];
}

/** Get a 6×7 grid of days for a month view */
export function getMonthGrid(
  year: number,
  month: number, // 0-indexed
  records: BaseRecord[],
  dateFieldId: string,
): CalendarDay[][] {
  const today = new Date();
  const todayStr = formatDateStr(today);

  // First day of the month
  const firstDay = new Date(year, month, 1);
  // Monday=0 ... Sunday=6 (ISO weekday)
  let startWeekday = firstDay.getDay() - 1;
  if (startWeekday < 0) startWeekday = 6;

  // Start from the Monday before (or on) the 1st
  const gridStart = new Date(year, month, 1 - startWeekday);

  // Build record map by date string
  const recordsByDate = new Map<string, BaseRecord[]>();
  for (const rec of records) {
    const val = rec.data[dateFieldId];
    if (typeof val === "string" && val) {
      const ds = val.slice(0, 10); // YYYY-MM-DD
      if (!recordsByDate.has(ds)) recordsByDate.set(ds, []);
      recordsByDate.get(ds)!.push(rec);
    }
  }

  const weeks: CalendarDay[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + w * 7 + d);
      const dateStr = formatDateStr(date);
      week.push({
        date,
        dateStr,
        isCurrentMonth: date.getMonth() === month,
        isToday: dateStr === todayStr,
        records: recordsByDate.get(dateStr) ?? [],
      });
    }
    weeks.push(week);
  }
  return weeks;
}

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const WEEKDAY_LABELS = [
  "周一",
  "周二",
  "周三",
  "周四",
  "周五",
  "周六",
  "周日",
];
