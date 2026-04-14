import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef } from "react";
import { api } from "@/generated/rust-api";
import type {
  BaseRecord,
  BaseView,
  CalendarViewMode,
  CellValue,
  Field,
  FieldType,
  FilterCondition,
  FormConfig,
  GalleryConfig,
  GanttConfig,
  GroupRule,
  RecordData,
  RowHeight,
  SelectOption,
  SortRule,
  ViewType,
} from "./types";
import type { KanbanGroup } from "./utils";
import {
  applyGroups,
  createDefaultBaseContent,
  createField,
  createView,
  createViewWithType,
  generateId,
  getProcessedRecords,
  getVisibleFields,
  groupRecordsForKanban,
  nextSelectColor,
  VIEW_TYPE_DEFAULT_NAMES,
} from "./utils";

interface UseBaseEditorOptions {
  nodeId: string;
}

// ── Helpers to parse API response into typed local objects ──────────────────

function parseFields(raw: unknown): Field[] {
  if (Array.isArray(raw)) return raw as Field[];
  return [];
}

function parseViews(raw: unknown): BaseView[] {
  if (Array.isArray(raw)) return raw as BaseView[];
  return [];
}

function parseRecordData(raw: unknown): RecordData {
  if (raw && typeof raw === "object" && !Array.isArray(raw))
    return raw as RecordData;
  return {};
}

export function useBaseEditor({ nodeId }: UseBaseEditorOptions) {
  const queryClient = useQueryClient();
  const defaults = useRef(createDefaultBaseContent());

  // ── Queries ─────────────────────────────────────────────────────────────
  const metaQuery = api.bitable.getMeta.useQuery(
    { nodeId },
    { enabled: !!nodeId },
  );

  const recordsQuery = api.bitable.listRecords.useQuery(
    { nodeId, pageSize: 1000 },
    { enabled: !!nodeId },
  );

  // ── Mutations ───────────────────────────────────────────────────────────
  const updateMetaMut = api.bitable.updateMeta.useMutation({
    onSuccess: () => {
      api.bitable.getMeta.invalidate(queryClient, { nodeId });
    },
  });

  const createRecordMut = api.bitable.createRecord.useMutation({
    onSuccess: () => {
      api.bitable.listRecords.invalidate(queryClient, {
        nodeId,
        pageSize: 1000,
      });
    },
  });

  const updateRecordMut = api.bitable.updateRecord.useMutation({
    onSuccess: () => {
      api.bitable.listRecords.invalidate(queryClient, {
        nodeId,
        pageSize: 1000,
      });
    },
  });

  const deleteRecordMut = api.bitable.deleteRecord.useMutation({
    onSuccess: () => {
      api.bitable.listRecords.invalidate(queryClient, {
        nodeId,
        pageSize: 1000,
      });
    },
  });

  // ── Derived state ───────────────────────────────────────────────────────
  const fields = useMemo(
    () =>
      metaQuery.data
        ? parseFields(metaQuery.data.fields)
        : defaults.current.fields,
    [metaQuery.data],
  );

  const views = useMemo(
    () =>
      metaQuery.data
        ? parseViews(metaQuery.data.views)
        : defaults.current.views,
    [metaQuery.data],
  );

  const activeViewId = useMemo(
    () => metaQuery.data?.activeViewId ?? defaults.current.activeViewId,
    [metaQuery.data],
  );

  const activeView = useMemo(
    () => views.find((v) => v.id === activeViewId) ?? views[0],
    [views, activeViewId],
  );

  const records: BaseRecord[] = useMemo(() => {
    if (!recordsQuery.data?.items) return [];
    return recordsQuery.data.items.map((r) => ({
      id: r.id,
      data: parseRecordData(r.data),
      sortOrder: r.sortOrder,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }, [recordsQuery.data]);

  const visibleFields = useMemo(
    () => (activeView ? getVisibleFields(fields, activeView) : []),
    [fields, activeView],
  );

  const processedRecords = useMemo(
    () =>
      activeView ? getProcessedRecords(records, activeView, fields) : records,
    [records, activeView, fields],
  );

  const groupedRecords = useMemo(
    () =>
      activeView
        ? applyGroups(processedRecords, activeView.groups, fields)
        : [{ key: "__all", label: "", records: processedRecords }],
    [processedRecords, activeView, fields],
  );

  const kanbanGroups: KanbanGroup[] = useMemo(() => {
    if (!activeView?.kanbanConfig?.groupFieldId) return [];
    const groupField = fields.find(
      (f) => f.id === activeView.kanbanConfig!.groupFieldId,
    );
    if (!groupField) return [];
    return groupRecordsForKanban(processedRecords, groupField);
  }, [activeView, fields, processedRecords]);

  const isLoading = metaQuery.isLoading || recordsQuery.isLoading;

  // ── Meta update helper ────────────────────────────────────────────────
  const commitMeta = useCallback(
    (partial: {
      fields?: Field[];
      views?: BaseView[];
      activeViewId?: string;
    }) => {
      updateMetaMut.mutate({
        nodeId,
        fields: partial.fields,
        views: partial.views,
        activeViewId: partial.activeViewId,
      });
    },
    [nodeId, updateMetaMut],
  );

  // Snapshot refs for current fields/views to avoid stale closures
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const viewsRef = useRef(views);
  viewsRef.current = views;
  const activeViewIdRef = useRef(activeViewId);
  activeViewIdRef.current = activeViewId;

  // ── View helpers ──────────────────────────────────────────────────────
  const setActiveView = useCallback(
    (viewId: string) => {
      commitMeta({ activeViewId: viewId });
    },
    [commitMeta],
  );

  const addView = useCallback(() => {
    const name = VIEW_TYPE_DEFAULT_NAMES.grid;
    const view = createView(name, fieldsRef.current);
    commitMeta({
      views: [...viewsRef.current, view],
      activeViewId: view.id,
    });
  }, [commitMeta]);

  const deleteView = useCallback(
    (viewId: string) => {
      const cur = viewsRef.current;
      if (cur.length <= 1) return;
      const next = cur.filter((v) => v.id !== viewId);
      commitMeta({
        views: next,
        activeViewId:
          activeViewIdRef.current === viewId
            ? next[0].id
            : activeViewIdRef.current,
      });
    },
    [commitMeta],
  );

  const updateView = useCallback(
    (viewId: string, partial: Partial<BaseView>) => {
      commitMeta({
        views: viewsRef.current.map((v) =>
          v.id === viewId ? { ...v, ...partial } : v,
        ),
      });
    },
    [commitMeta],
  );

  // ── Field helpers ─────────────────────────────────────────────────────
  const addField = useCallback(
    (name: string, type: FieldType) => {
      const field = createField(name, type);
      commitMeta({
        fields: [...fieldsRef.current, field],
        views: viewsRef.current.map((v) => ({
          ...v,
          fieldOrder: [...v.fieldOrder, field.id],
        })),
      });
    },
    [commitMeta],
  );

  const updateField = useCallback(
    (fieldId: string, partial: Partial<Field>) => {
      commitMeta({
        fields: fieldsRef.current.map((f) =>
          f.id === fieldId ? { ...f, ...partial } : f,
        ),
      });
    },
    [commitMeta],
  );

  const deleteField = useCallback(
    (fieldId: string) => {
      commitMeta({
        fields: fieldsRef.current.filter((f) => f.id !== fieldId),
        views: viewsRef.current.map((v) => ({
          ...v,
          fieldOrder: v.fieldOrder.filter((id) => id !== fieldId),
          hiddenFieldIds: v.hiddenFieldIds.filter((id) => id !== fieldId),
        })),
      });
    },
    [commitMeta],
  );

  const resizeField = useCallback(
    (fieldId: string, width: number) => {
      commitMeta({
        fields: fieldsRef.current.map((f) =>
          f.id === fieldId ? { ...f, width: Math.max(60, width) } : f,
        ),
      });
    },
    [commitMeta],
  );

  // ── Record helpers ────────────────────────────────────────────────────
  const addRecord = useCallback(() => {
    createRecordMut.mutate({ nodeId, data: {} });
  }, [nodeId, createRecordMut]);

  const deleteRecord = useCallback(
    (recordId: string) => {
      deleteRecordMut.mutate(recordId);
    },
    [deleteRecordMut],
  );

  const updateCell = useCallback(
    (recordId: string, fieldId: string, value: CellValue) => {
      // Find the current record to merge data
      const rec = records.find((r) => r.id === recordId);
      const newData = { ...(rec?.data ?? {}), [fieldId]: value };
      updateRecordMut.mutate({ recordId, data: newData });
    },
    [records, updateRecordMut],
  );

  // ── Filter/Sort/Group shortcuts ───────────────────────────────────────
  const setFilters = useCallback(
    (conditions: FilterCondition[], conjunction?: "and" | "or") => {
      if (!activeView) return;
      updateView(activeView.id, {
        filters: {
          conjunction: conjunction ?? activeView.filters.conjunction,
          conditions,
        },
      });
    },
    [activeView, updateView],
  );

  const setSorts = useCallback(
    (sorts: SortRule[]) => {
      if (!activeView) return;
      updateView(activeView.id, { sorts });
    },
    [activeView, updateView],
  );

  const setGroups = useCallback(
    (groups: GroupRule[]) => {
      if (!activeView) return;
      updateView(activeView.id, { groups });
    },
    [activeView, updateView],
  );

  const addSelectOption = useCallback(
    (fieldId: string, label: string) => {
      const field = fieldsRef.current.find((f) => f.id === fieldId);
      if (!field) return;
      const existing = field.options ?? [];
      const option: SelectOption = {
        id: generateId("opt"),
        label,
        color: nextSelectColor(existing),
      };
      updateField(fieldId, { options: [...existing, option] });
      return option;
    },
    [updateField],
  );

  // ── New operations (Feishu parity) ──────────────────────────────────

  const duplicateField = useCallback(
    (fieldId: string) => {
      const src = fieldsRef.current.find((f) => f.id === fieldId);
      if (!src) return;
      const dup = createField(`${src.name} 副本`, src.type, src.options);
      dup.width = src.width;
      const idx = fieldsRef.current.findIndex((f) => f.id === fieldId);
      const newFields = [...fieldsRef.current];
      newFields.splice(idx + 1, 0, dup);
      commitMeta({
        fields: newFields,
        views: viewsRef.current.map((v) => {
          const orderIdx = v.fieldOrder.indexOf(fieldId);
          const newOrder = [...v.fieldOrder];
          newOrder.splice(orderIdx + 1, 0, dup.id);
          return { ...v, fieldOrder: newOrder };
        }),
      });
    },
    [commitMeta],
  );

  const insertFieldAfter = useCallback(
    (afterFieldId: string, name: string, type: FieldType) => {
      const field = createField(name, type);
      const idx = fieldsRef.current.findIndex((f) => f.id === afterFieldId);
      const newFields = [...fieldsRef.current];
      newFields.splice(idx + 1, 0, field);
      commitMeta({
        fields: newFields,
        views: viewsRef.current.map((v) => {
          const orderIdx = v.fieldOrder.indexOf(afterFieldId);
          const newOrder = [...v.fieldOrder];
          newOrder.splice(orderIdx + 1, 0, field.id);
          return { ...v, fieldOrder: newOrder };
        }),
      });
    },
    [commitMeta],
  );

  const addSortForField = useCallback(
    (fieldId: string, direction: "asc" | "desc") => {
      const view = viewsRef.current.find(
        (v) => v.id === activeViewIdRef.current,
      );
      if (!view) return;
      const rule: SortRule = { id: generateId("srt"), fieldId, direction };
      updateView(view.id, { sorts: [...view.sorts, rule] });
    },
    [updateView],
  );

  const addFilterForField = useCallback(
    (fieldId: string) => {
      const view = viewsRef.current.find(
        (v) => v.id === activeViewIdRef.current,
      );
      if (!view) return;
      const cond: FilterCondition = {
        id: generateId("flt"),
        fieldId,
        operator: "contains",
        value: "",
      };
      updateView(view.id, {
        filters: {
          conjunction: view.filters.conjunction,
          conditions: [...view.filters.conditions, cond],
        },
      });
    },
    [updateView],
  );

  const addGroupForField = useCallback(
    (fieldId: string) => {
      const view = viewsRef.current.find(
        (v) => v.id === activeViewIdRef.current,
      );
      if (!view) return;
      const rule: GroupRule = {
        id: generateId("grp"),
        fieldId,
        direction: "asc",
      };
      updateView(view.id, { groups: [...view.groups, rule] });
    },
    [updateView],
  );

  // ── Kanban operations ──────────────────────────────────────────────────

  const setKanbanGroupField = useCallback(
    (fieldId: string) => {
      const viewId = activeViewIdRef.current;
      const view = viewsRef.current.find((v) => v.id === viewId);
      if (!view) return;
      updateView(viewId, {
        kanbanConfig: {
          ...(view.kanbanConfig ?? {
            groupFieldId: "",
            cardDisplayMode: "normal" as const,
            showFieldNames: false,
            cardVisibleFieldIds: fieldsRef.current.map((f) => f.id),
          }),
          groupFieldId: fieldId,
        },
      });
    },
    [updateView],
  );

  const setKanbanDisplayMode = useCallback(
    (mode: "normal" | "compact") => {
      const viewId = activeViewIdRef.current;
      const view = viewsRef.current.find((v) => v.id === viewId);
      if (!view?.kanbanConfig) return;
      updateView(viewId, {
        kanbanConfig: { ...view.kanbanConfig, cardDisplayMode: mode },
      });
    },
    [updateView],
  );

  const toggleKanbanCardField = useCallback(
    (fieldId: string) => {
      const viewId = activeViewIdRef.current;
      const view = viewsRef.current.find((v) => v.id === viewId);
      if (!view?.kanbanConfig) return;
      const visible = view.kanbanConfig.cardVisibleFieldIds;
      const next = visible.includes(fieldId)
        ? visible.filter((id) => id !== fieldId)
        : [...visible, fieldId];
      updateView(viewId, {
        kanbanConfig: { ...view.kanbanConfig, cardVisibleFieldIds: next },
      });
    },
    [updateView],
  );

  const setKanbanShowFieldNames = useCallback(
    (show: boolean) => {
      const viewId = activeViewIdRef.current;
      const view = viewsRef.current.find((v) => v.id === viewId);
      if (!view?.kanbanConfig) return;
      updateView(viewId, {
        kanbanConfig: { ...view.kanbanConfig, showFieldNames: show },
      });
    },
    [updateView],
  );

  const addRecordToGroup = useCallback(
    (groupValue: string | null) => {
      const view = viewsRef.current.find(
        (v) => v.id === activeViewIdRef.current,
      );
      if (!view?.kanbanConfig) {
        createRecordMut.mutate({ nodeId, data: {} });
        return;
      }
      const fieldId = view.kanbanConfig.groupFieldId;
      const field = fieldsRef.current.find((f) => f.id === fieldId);
      if (!field) {
        createRecordMut.mutate({ nodeId, data: {} });
        return;
      }

      let data: Record<string, CellValue> = {};
      if (groupValue !== null) {
        if (field.type === "multiSelect" || field.type === "member") {
          data = { [fieldId]: [groupValue] };
        } else if (field.type === "checkbox") {
          data = { [fieldId]: groupValue === "__true" };
        } else if (field.type === "rating") {
          data = { [fieldId]: Number(groupValue) };
        } else {
          data = { [fieldId]: groupValue };
        }
      }
      createRecordMut.mutate({ nodeId, data });
    },
    [nodeId, createRecordMut],
  );

  const addKanbanGroup = useCallback(
    (label: string, color: string) => {
      const view = viewsRef.current.find(
        (v) => v.id === activeViewIdRef.current,
      );
      if (!view?.kanbanConfig) return;
      const fieldId = view.kanbanConfig.groupFieldId;
      const field = fieldsRef.current.find((f) => f.id === fieldId);
      if (!field) return;
      const existing = field.options ?? [];
      const option: SelectOption = {
        id: generateId("opt"),
        label,
        color,
      };
      updateField(fieldId, { options: [...existing, option] });
    },
    [updateField],
  );

  const deleteKanbanGroup = useCallback(
    (optionId: string) => {
      const view = viewsRef.current.find(
        (v) => v.id === activeViewIdRef.current,
      );
      if (!view?.kanbanConfig) return;
      const fieldId = view.kanbanConfig.groupFieldId;
      const field = fieldsRef.current.find((f) => f.id === fieldId);
      if (!field) return;
      updateField(fieldId, {
        options: (field.options ?? []).filter((o) => o.id !== optionId),
      });
    },
    [updateField],
  );

  const renameKanbanGroup = useCallback(
    (optionId: string, newLabel: string) => {
      const view = viewsRef.current.find(
        (v) => v.id === activeViewIdRef.current,
      );
      if (!view?.kanbanConfig) return;
      const fieldId = view.kanbanConfig.groupFieldId;
      const field = fieldsRef.current.find((f) => f.id === fieldId);
      if (!field) return;
      updateField(fieldId, {
        options: (field.options ?? []).map((o) =>
          o.id === optionId ? { ...o, label: newLabel } : o,
        ),
      });
    },
    [updateField],
  );

  const setRowHeight = useCallback(
    (height: RowHeight) => {
      const viewId = activeViewIdRef.current;
      updateView(viewId, { rowHeight: height });
    },
    [updateView],
  );

  const setFrozenFieldCount = useCallback(
    (count: number) => {
      const viewId = activeViewIdRef.current;
      updateView(viewId, { frozenFieldCount: count });
    },
    [updateView],
  );

  const addViewWithType = useCallback(
    (type: ViewType) => {
      const name = VIEW_TYPE_DEFAULT_NAMES[type];
      const view = createViewWithType(name, type, fieldsRef.current);
      commitMeta({
        views: [...viewsRef.current, view],
        activeViewId: view.id,
      });
    },
    [commitMeta],
  );

  // ── Calendar operations ────────────────────────────────────────────────

  const setCalendarDateField = useCallback(
    (fieldId: string) => {
      const viewId = activeViewIdRef.current;
      const view = viewsRef.current.find((v) => v.id === viewId);
      if (!view) return;
      updateView(viewId, {
        calendarConfig: {
          ...(view.calendarConfig ?? {
            dateFieldId: "",
            viewMode: "month" as const,
          }),
          dateFieldId: fieldId,
        },
      });
    },
    [updateView],
  );

  const setCalendarViewMode = useCallback(
    (mode: CalendarViewMode) => {
      const viewId = activeViewIdRef.current;
      const view = viewsRef.current.find((v) => v.id === viewId);
      if (!view?.calendarConfig) return;
      updateView(viewId, {
        calendarConfig: { ...view.calendarConfig, viewMode: mode },
      });
    },
    [updateView],
  );

  const addRecordOnDate = useCallback(
    (dateStr: string) => {
      const view = viewsRef.current.find(
        (v) => v.id === activeViewIdRef.current,
      );
      const dateFieldId = view?.calendarConfig?.dateFieldId;
      if (!dateFieldId) {
        createRecordMut.mutate({ nodeId, data: {} });
        return;
      }
      createRecordMut.mutate({ nodeId, data: { [dateFieldId]: dateStr } });
    },
    [nodeId, createRecordMut],
  );

  // ── Gantt operations ─────────────────────────────────────────────────

  const setGanttConfig = useCallback(
    (partial: Partial<GanttConfig>) => {
      const viewId = activeViewIdRef.current;
      const view = viewsRef.current.find((v) => v.id === viewId);
      if (!view) return;
      const current = view.ganttConfig ?? {
        startDateFieldId: "",
        endDateFieldId: "",
        titleFieldId: "",
        colorMode: "custom" as const,
        customColor: "#3b82f6",
        workdaysOnly: false,
        timeScale: "month" as const,
      };
      updateView(viewId, {
        ganttConfig: { ...current, ...partial },
      });
    },
    [updateView],
  );

  const updateRecordDates = useCallback(
    (recordId: string, startDate: string, endDate: string) => {
      const view = viewsRef.current.find(
        (v) => v.id === activeViewIdRef.current,
      );
      const cfg = view?.ganttConfig;
      if (!cfg) return;
      const rec = records.find((r) => r.id === recordId);
      const newData = {
        ...(rec?.data ?? {}),
        [cfg.startDateFieldId]: startDate,
        [cfg.endDateFieldId]: endDate,
      };
      updateRecordMut.mutate({ recordId, data: newData });
    },
    [records, updateRecordMut],
  );

  // ── Gallery operations ──────────────────────────────────────────────

  const setGalleryConfig = useCallback(
    (partial: Partial<GalleryConfig>) => {
      const viewId = activeViewIdRef.current;
      const view = viewsRef.current.find((v) => v.id === viewId);
      if (!view) return;
      const current = view.galleryConfig ?? {
        coverFieldId: "",
        titleFieldId: "",
        cardVisibleFieldIds: fieldsRef.current.map((f) => f.id),
        cardSize: "medium" as const,
      };
      updateView(viewId, {
        galleryConfig: { ...current, ...partial },
      });
    },
    [updateView],
  );

  const toggleGalleryCardField = useCallback(
    (fieldId: string) => {
      const viewId = activeViewIdRef.current;
      const view = viewsRef.current.find((v) => v.id === viewId);
      if (!view?.galleryConfig) return;
      const visible = view.galleryConfig.cardVisibleFieldIds;
      const next = visible.includes(fieldId)
        ? visible.filter((id) => id !== fieldId)
        : [...visible, fieldId];
      updateView(viewId, {
        galleryConfig: { ...view.galleryConfig, cardVisibleFieldIds: next },
      });
    },
    [updateView],
  );

  // ── Form operations ─────────────────────────────────────────────────

  const setFormConfig = useCallback(
    (partial: Partial<FormConfig>) => {
      const viewId = activeViewIdRef.current;
      const view = viewsRef.current.find((v) => v.id === viewId);
      if (!view) return;
      const current = view.formConfig ?? {
        title: "表单",
        description: "",
        visibleFieldIds: fieldsRef.current.map((f) => f.id),
        requiredFieldIds: [],
      };
      updateView(viewId, {
        formConfig: { ...current, ...partial },
      });
    },
    [updateView],
  );

  const toggleFormField = useCallback(
    (fieldId: string) => {
      const viewId = activeViewIdRef.current;
      const view = viewsRef.current.find((v) => v.id === viewId);
      if (!view?.formConfig) return;
      const visible = view.formConfig.visibleFieldIds;
      const next = visible.includes(fieldId)
        ? visible.filter((id) => id !== fieldId)
        : [...visible, fieldId];
      const required = view.formConfig.requiredFieldIds.filter((id) =>
        next.includes(id),
      );
      updateView(viewId, {
        formConfig: {
          ...view.formConfig,
          visibleFieldIds: next,
          requiredFieldIds: required,
        },
      });
    },
    [updateView],
  );

  const toggleFormRequired = useCallback(
    (fieldId: string) => {
      const viewId = activeViewIdRef.current;
      const view = viewsRef.current.find((v) => v.id === viewId);
      if (!view?.formConfig) return;
      const required = view.formConfig.requiredFieldIds;
      const next = required.includes(fieldId)
        ? required.filter((id) => id !== fieldId)
        : [...required, fieldId];
      updateView(viewId, {
        formConfig: { ...view.formConfig, requiredFieldIds: next },
      });
    },
    [updateView],
  );

  const reorderFormFields = useCallback(
    (fieldIds: string[]) => {
      const viewId = activeViewIdRef.current;
      const view = viewsRef.current.find((v) => v.id === viewId);
      if (!view?.formConfig) return;
      updateView(viewId, {
        formConfig: { ...view.formConfig, visibleFieldIds: fieldIds },
      });
    },
    [updateView],
  );

  const submitForm = useCallback(
    (data: RecordData) => {
      createRecordMut.mutate({ nodeId, data });
    },
    [nodeId, createRecordMut],
  );

  return {
    // Compatibility: GridView checks `activeTable` for null guard
    activeTable: metaQuery.data ? { fields, views } : undefined,
    fields,
    views,
    activeView,
    visibleFields,
    processedRecords,
    records,
    groupedRecords,
    isLoading,

    // View
    setActiveView,
    addView,
    deleteView,
    updateView,
    addViewWithType,

    // Field
    addField,
    updateField,
    deleteField,
    resizeField,
    duplicateField,
    insertFieldAfter,

    // Record
    addRecord,
    deleteRecord,
    updateCell,

    // Filter/Sort/Group
    setFilters,
    setSorts,
    setGroups,
    addSortForField,
    addFilterForField,
    addGroupForField,

    // View settings
    setRowHeight,
    setFrozenFieldCount,

    // Select options
    addSelectOption,

    // Kanban
    kanbanGroups,
    setKanbanGroupField,
    setKanbanDisplayMode,
    toggleKanbanCardField,
    setKanbanShowFieldNames,
    addRecordToGroup,
    addKanbanGroup,
    deleteKanbanGroup,
    renameKanbanGroup,
    // Calendar
    setCalendarDateField,
    setCalendarViewMode,
    addRecordOnDate,
    // Gantt
    setGanttConfig,
    updateRecordDates,
    // Gallery
    setGalleryConfig,
    toggleGalleryCardField,
    // Form
    setFormConfig,
    toggleFormField,
    toggleFormRequired,
    reorderFormFields,
    submitForm,
  };
}

export type BaseEditorState = ReturnType<typeof useBaseEditor>;
