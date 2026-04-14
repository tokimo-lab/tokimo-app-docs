// ── Base (Multi-dimensional Table) type system ─────────────────────────────

export type FieldType =
  | "text"
  | "number"
  | "select"
  | "multiSelect"
  | "checkbox"
  | "date"
  | "url"
  | "phone"
  | "email"
  | "currency"
  | "progress"
  | "rating"
  | "workflow"
  | "attachment"
  | "member"
  | "autoNumber"
  | "createdBy"
  | "modifiedBy"
  | "createdTime"
  | "modifiedTime";

export interface SelectOption {
  id: string;
  label: string;
  color: string;
}

export interface Field {
  id: string;
  name: string;
  type: FieldType;
  width: number;
  /** For select / multiSelect fields */
  options?: SelectOption[];
}

/** A single row of data — keyed by field id */
export type CellValue = string | number | boolean | string[] | null;
export type RecordData = Record<string, CellValue>;

export interface BaseRecord {
  id: string;
  data: RecordData;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ── View types ──────────────────────────────────────────────────────────────

export type ViewType =
  | "grid"
  | "kanban"
  | "gallery"
  | "form"
  | "calendar"
  | "gantt";

export type RowHeight = "short" | "medium" | "tall" | "extraTall";

export type FilterOperator =
  | "eq"
  | "neq"
  | "contains"
  | "notContains"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "isEmpty"
  | "isNotEmpty";

export interface FilterCondition {
  id: string;
  fieldId: string;
  operator: FilterOperator;
  value: CellValue;
}

export interface FilterGroup {
  conjunction: "and" | "or";
  conditions: FilterCondition[];
}

export interface SortRule {
  id: string;
  fieldId: string;
  direction: "asc" | "desc";
}

export interface GroupRule {
  id: string;
  fieldId: string;
  direction: "asc" | "desc";
}

export interface KanbanConfig {
  groupFieldId: string;
  cardDisplayMode: "normal" | "compact";
  showFieldNames: boolean;
  cardVisibleFieldIds: string[];
}

export type CalendarViewMode = "day" | "week" | "month";

export interface CalendarConfig {
  dateFieldId: string;
  viewMode: CalendarViewMode;
}

export type GanttTimeScale = "week" | "month" | "quarter" | "year";
export type GanttColorMode = "custom" | "field";

export interface GanttConfig {
  startDateFieldId: string;
  endDateFieldId: string;
  titleFieldId: string;
  colorMode: GanttColorMode;
  customColor: string;
  workdaysOnly: boolean;
  timeScale: GanttTimeScale;
}

export type GalleryCardSize = "small" | "medium" | "large";

export interface GalleryConfig {
  coverFieldId: string;
  titleFieldId: string;
  cardVisibleFieldIds: string[];
  cardSize: GalleryCardSize;
}

export interface FormConfig {
  title: string;
  description: string;
  visibleFieldIds: string[];
  requiredFieldIds: string[];
}

export const ROW_COLORS = [
  { id: "blue", label: "蓝色", bg: "#dbeafe", dark: "#1e3a5f" },
  { id: "green", label: "绿色", bg: "#dcfce7", dark: "#14532d" },
  { id: "yellow", label: "黄色", bg: "#fef9c3", dark: "#713f12" },
  { id: "orange", label: "橙色", bg: "#ffedd5", dark: "#7c2d12" },
  { id: "red", label: "红色", bg: "#fee2e2", dark: "#7f1d1d" },
  { id: "purple", label: "紫色", bg: "#ede9fe", dark: "#4c1d95" },
  { id: "pink", label: "粉色", bg: "#fce7f3", dark: "#831843" },
  { id: "gray", label: "灰色", bg: "#f3f4f6", dark: "#374151" },
] as const;

export interface ColorRule {
  id: string;
  fieldId: string;
  operator: FilterOperator;
  value: CellValue;
  color: string;
}

export interface BaseView {
  id: string;
  name: string;
  type: ViewType;
  filters: FilterGroup;
  sorts: SortRule[];
  groups: GroupRule[];
  hiddenFieldIds: string[];
  fieldOrder: string[];
  rowHeight: RowHeight;
  colorRules: ColorRule[];
  frozenFieldCount: number;
  kanbanConfig?: KanbanConfig;
  calendarConfig?: CalendarConfig;
  ganttConfig?: GanttConfig;
  galleryConfig?: GalleryConfig;
  formConfig?: FormConfig;
}

// ── Content (single-table metadata) ─────────────────────────────────────────

/** Content structure stored in doc_nodes.content for type="base" */
export interface BaseContent {
  fields: Field[];
  views: BaseView[];
  activeViewId: string;
}

// ── Default colors for select options ───────────────────────────────────────

export const SELECT_COLORS = [
  "#e0f2fe", // sky-100
  "#dbeafe", // blue-100
  "#e0e7ff", // indigo-100
  "#ede9fe", // violet-100
  "#fae8ff", // fuchsia-100
  "#fce7f3", // pink-100
  "#ffe4e6", // rose-100
  "#fee2e2", // red-100
  "#ffedd5", // orange-100
  "#fef9c3", // yellow-100
  "#dcfce7", // green-100
  "#d1fae5", // emerald-100
  "#ccfbf1", // teal-100
] as const;

export const SELECT_COLORS_DARK = [
  "#0c4a6e", // sky-900
  "#1e3a5f", // blue-900
  "#312e81", // indigo-900
  "#4c1d95", // violet-900
  "#701a75", // fuchsia-900
  "#831843", // pink-900
  "#881337", // rose-900
  "#7f1d1d", // red-900
  "#7c2d12", // orange-900
  "#713f12", // yellow-900
  "#14532d", // green-900
  "#064e3b", // emerald-900
  "#134e4a", // teal-900
] as const;
