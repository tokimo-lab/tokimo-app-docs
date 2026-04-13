import { useCallback, useMemo, useRef, useState } from "react";
import type {
  BaseContent,
  BaseTable,
  BaseView,
  CellValue,
  Field,
  FieldType,
  FilterCondition,
  GroupRule,
  SelectOption,
  SortRule,
} from "./types";
import {
  applyGroups,
  createDefaultBaseContent,
  createField,
  createRecord,
  createTable,
  createView,
  generateId,
  getProcessedRecords,
  getVisibleFields,
  nextSelectColor,
} from "./utils";

interface UseBaseEditorOptions {
  content: unknown;
  onChange: (content: BaseContent) => void;
}

export function useBaseEditor({ content, onChange }: UseBaseEditorOptions) {
  const initial = useMemo(() => {
    if (
      content &&
      typeof content === "object" &&
      "tables" in (content as BaseContent)
    ) {
      return content as BaseContent;
    }
    return createDefaultBaseContent();
  }, [content]);

  const [base, setBase] = useState<BaseContent>(initial);
  const baseRef = useRef(base);
  baseRef.current = base;

  const commit = useCallback(
    (next: BaseContent) => {
      setBase(next);
      onChange(next);
    },
    [onChange],
  );

  // ── Active table/view ─────────────────────────────────────────────────
  const activeTable = useMemo(
    () =>
      base.tables.find((t) => t.id === base.activeTableId) ?? base.tables[0],
    [base],
  );

  const activeView = useMemo(
    () =>
      activeTable?.views.find((v) => v.id === activeTable.activeViewId) ??
      activeTable?.views[0],
    [activeTable],
  );

  const visibleFields = useMemo(
    () =>
      activeTable && activeView
        ? getVisibleFields(activeTable.fields, activeView)
        : [],
    [activeTable, activeView],
  );

  const processedRecords = useMemo(
    () =>
      activeTable && activeView
        ? getProcessedRecords(
            activeTable.records,
            activeView,
            activeTable.fields,
          )
        : [],
    [activeTable, activeView],
  );

  const groupedRecords = useMemo(
    () =>
      activeTable && activeView
        ? applyGroups(processedRecords, activeView.groups, activeTable.fields)
        : [{ key: "__all", label: "", records: processedRecords }],
    [processedRecords, activeTable, activeView],
  );

  // ── Table helpers ─────────────────────────────────────────────────────
  const updateTable = useCallback(
    (tableId: string, updater: (t: BaseTable) => BaseTable) => {
      const b = baseRef.current;
      commit({
        ...b,
        tables: b.tables.map((t) => (t.id === tableId ? updater(t) : t)),
      });
    },
    [commit],
  );

  const setActiveTable = useCallback(
    (tableId: string) => commit({ ...baseRef.current, activeTableId: tableId }),
    [commit],
  );

  const addTable = useCallback(() => {
    const b = baseRef.current;
    const name = `Table ${b.tables.length + 1}`;
    const table = createTable(name);
    commit({
      ...b,
      tables: [...b.tables, table],
      activeTableId: table.id,
    });
  }, [commit]);

  const deleteTable = useCallback(
    (tableId: string) => {
      const b = baseRef.current;
      if (b.tables.length <= 1) return;
      const next = b.tables.filter((t) => t.id !== tableId);
      commit({
        ...b,
        tables: next,
        activeTableId:
          b.activeTableId === tableId ? next[0].id : b.activeTableId,
      });
    },
    [commit],
  );

  const renameTable = useCallback(
    (tableId: string, name: string) => {
      updateTable(tableId, (t) => ({ ...t, name }));
    },
    [updateTable],
  );

  // ── View helpers ──────────────────────────────────────────────────────
  const setActiveView = useCallback(
    (viewId: string) => {
      if (!activeTable) return;
      updateTable(activeTable.id, (t) => ({ ...t, activeViewId: viewId }));
    },
    [activeTable, updateTable],
  );

  const addView = useCallback(() => {
    if (!activeTable) return;
    const name = `View ${activeTable.views.length + 1}`;
    const view = createView(name, activeTable.fields);
    updateTable(activeTable.id, (t) => ({
      ...t,
      views: [...t.views, view],
      activeViewId: view.id,
    }));
  }, [activeTable, updateTable]);

  const deleteView = useCallback(
    (viewId: string) => {
      if (!activeTable || activeTable.views.length <= 1) return;
      updateTable(activeTable.id, (t) => {
        const next = t.views.filter((v) => v.id !== viewId);
        return {
          ...t,
          views: next,
          activeViewId: t.activeViewId === viewId ? next[0].id : t.activeViewId,
        };
      });
    },
    [activeTable, updateTable],
  );

  const updateView = useCallback(
    (viewId: string, partial: Partial<BaseView>) => {
      if (!activeTable) return;
      updateTable(activeTable.id, (t) => ({
        ...t,
        views: t.views.map((v) => (v.id === viewId ? { ...v, ...partial } : v)),
      }));
    },
    [activeTable, updateTable],
  );

  // ── Field helpers ─────────────────────────────────────────────────────
  const addField = useCallback(
    (name: string, type: FieldType) => {
      if (!activeTable) return;
      const field = createField(name, type);
      updateTable(activeTable.id, (t) => ({
        ...t,
        fields: [...t.fields, field],
        records: t.records.map((r) => ({
          ...r,
          data: {
            ...r.data,
            [field.id]:
              type === "checkbox" ? false : type === "multiSelect" ? [] : null,
          },
        })),
        views: t.views.map((v) => ({
          ...v,
          fieldOrder: [...v.fieldOrder, field.id],
        })),
      }));
    },
    [activeTable, updateTable],
  );

  const updateField = useCallback(
    (fieldId: string, partial: Partial<Field>) => {
      if (!activeTable) return;
      updateTable(activeTable.id, (t) => ({
        ...t,
        fields: t.fields.map((f) =>
          f.id === fieldId ? { ...f, ...partial } : f,
        ),
      }));
    },
    [activeTable, updateTable],
  );

  const deleteField = useCallback(
    (fieldId: string) => {
      if (!activeTable) return;
      updateTable(activeTable.id, (t) => ({
        ...t,
        fields: t.fields.filter((f) => f.id !== fieldId),
        records: t.records.map((r) => {
          const { [fieldId]: _, ...rest } = r.data;
          return { ...r, data: rest };
        }),
        views: t.views.map((v) => ({
          ...v,
          fieldOrder: v.fieldOrder.filter((id) => id !== fieldId),
          hiddenFieldIds: v.hiddenFieldIds.filter((id) => id !== fieldId),
        })),
      }));
    },
    [activeTable, updateTable],
  );

  const resizeField = useCallback(
    (fieldId: string, width: number) => {
      if (!activeTable) return;
      updateTable(activeTable.id, (t) => ({
        ...t,
        fields: t.fields.map((f) =>
          f.id === fieldId ? { ...f, width: Math.max(60, width) } : f,
        ),
      }));
    },
    [activeTable, updateTable],
  );

  // ── Record helpers ────────────────────────────────────────────────────
  const addRecord = useCallback(() => {
    if (!activeTable) return;
    const rec = createRecord(activeTable.fields);
    updateTable(activeTable.id, (t) => ({
      ...t,
      records: [...t.records, rec],
    }));
  }, [activeTable, updateTable]);

  const deleteRecord = useCallback(
    (recordId: string) => {
      if (!activeTable) return;
      updateTable(activeTable.id, (t) => ({
        ...t,
        records: t.records.filter((r) => r.id !== recordId),
      }));
    },
    [activeTable, updateTable],
  );

  const updateCell = useCallback(
    (recordId: string, fieldId: string, value: CellValue) => {
      if (!activeTable) return;
      updateTable(activeTable.id, (t) => ({
        ...t,
        records: t.records.map((r) =>
          r.id === recordId
            ? { ...r, data: { ...r.data, [fieldId]: value } }
            : r,
        ),
      }));
    },
    [activeTable, updateTable],
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
      if (!activeTable) return;
      const field = activeTable.fields.find((f) => f.id === fieldId);
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
    [activeTable, updateField],
  );

  return {
    base,
    activeTable,
    activeView,
    visibleFields,
    processedRecords,
    groupedRecords,

    // Table
    setActiveTable,
    addTable,
    deleteTable,
    renameTable,

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
