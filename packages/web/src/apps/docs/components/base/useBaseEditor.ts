import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef } from "react";
import { api } from "@/generated/rust-api";
import type {
  BaseRecord,
  BaseView,
  CellValue,
  Field,
  FieldType,
  FilterCondition,
  GroupRule,
  RecordData,
  SelectOption,
  SortRule,
} from "./types";
import {
  applyGroups,
  createDefaultBaseContent,
  createField,
  createView,
  generateId,
  getProcessedRecords,
  getVisibleFields,
  nextSelectColor,
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
    const name = `View ${viewsRef.current.length + 1}`;
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

    // Field
    addField,
    updateField,
    deleteField,
    resizeField,

    // Record
    addRecord,
    deleteRecord,
    updateCell,

    // Filter/Sort/Group
    setFilters,
    setSorts,
    setGroups,

    // Select options
    addSelectOption,
  };
}

export type BaseEditorState = ReturnType<typeof useBaseEditor>;
