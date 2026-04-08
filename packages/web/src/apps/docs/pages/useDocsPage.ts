import { deserializeMd } from "@platejs/markdown";
import { useQueryClient } from "@tanstack/react-query";
import type { TElement, Value } from "platejs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  SidebarTab,
  SortDir,
  SortField,
} from "@/apps/docs/components/DocSidebar";
import type { DocTemplate } from "@/apps/docs/components/doc-templates";
import type { DocEditorHandle } from "@/apps/docs/components/editor";
import type { VfsFileSelection } from "@/apps/docs/components/VfsFilePickerModal";
import type { DocNode, DocNodeType } from "@/apps/docs/lib/doc-node";
import {
  buildNodePath,
  nextUniqueName,
  resolveNodeByPath,
  untitledI18nKey,
} from "@/apps/docs/lib/doc-node";
import type { DocNodeOutput } from "@/generated/rust-api";
import { api } from "@/generated/rust-api";
import { onAiDocumentEdit, openAiAssistant } from "@/lib/ai-assistant-events";
import { useMessage, useWindowNav } from "@/system";
import { useAuth } from "@/system/auth/useAuth";
import {
  dispatchAiAction,
  exportAsDocx,
  exportAsMarkdown,
  getEditorPlainText,
  getSelectedText,
  pickAndReadMarkdownFile,
} from "./doc-page-utils";

export function useDocsPage() {
  const { metadata, route, navigate, replace } = useWindowNav();
  const appId = metadata.appId as string | undefined;
  const message = useMessage();
  const { t } = useTranslation();
  const { user } = useAuth();

  // ── UI state ─────────────────────────────────────────────────────────
  const [tab, setTab] = useState<SidebarTab>("all");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [commentSidebarOpen, setCommentSidebarOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [previewingVersionId, setPreviewingVersionId] = useState<string | null>(
    null,
  );
  const [templateChooserOpen, setTemplateChooserOpen] = useState(false);
  const [pendingParentId, setPendingParentId] = useState<string | undefined>();
  const [vfsPickerOpen, setVfsPickerOpen] = useState(false);
  const editorRef = useRef<DocEditorHandle | null>(null);

  const effectiveSortField = tab === "recent" ? "updatedAt" : sortField;
  const effectiveSortDir = tab === "recent" ? "desc" : sortDir;

  // ── Unfiltered tree index (for path ↔ node resolution) ──────────────
  const treeQuery = api.docs.list.useQuery(
    { appId: appId ?? "", pageSize: 9999 },
    { enabled: !!appId },
  );
  const treeNodes = useMemo(
    () => treeQuery.data?.items ?? [],
    [treeQuery.data],
  );

  // ── Route-derived selection ──────────────────────────────────────────
  const selectedNodeId = useMemo(
    () => resolveNodeByPath(route, treeNodes),
    [route, treeNodes],
  );
  const selectedNode = useMemo(
    () => treeNodes.find((n) => n.id === selectedNodeId) ?? null,
    [treeNodes, selectedNodeId],
  );
  const selectedNodeType = (selectedNode?.type as DocNodeType) ?? null;

  // Auto-repair route when node path changes
  const prevRouteRef = useRef(route);
  useEffect(() => {
    if (!selectedNodeId || !selectedNode) return;
    const correctPath = buildNodePath(selectedNodeId, treeNodes);
    if (correctPath !== route && route !== "/") {
      replace(correctPath, selectedNode.title);
    }
    prevRouteRef.current = route;
  }, [selectedNodeId, selectedNode, treeNodes, route, replace]);

  // Navigation helpers
  const selectNode = useCallback(
    (node: { id: string; title: string }) => {
      navigate(buildNodePath(node.id, treeNodes), node.title);
      setPreviewingVersionId(null);
    },
    [treeNodes, navigate],
  );
  const deselectNode = useCallback(() => navigate("/"), [navigate]);

  const navigateToNode = useCallback(
    (nodeId: string | null) => {
      if (!nodeId) {
        deselectNode();
        return;
      }
      const node = treeNodes.find((n) => n.id === nodeId);
      node ? selectNode(node) : deselectNode();
    },
    [treeNodes, selectNode, deselectNode],
  );

  const selectedDocId = selectedNodeType === "notion" ? selectedNodeId : null;
  const selectedSheetId = selectedNodeType === "sheet" ? selectedNodeId : null;
  const selectedContentNodeId = selectedDocId ?? selectedSheetId;
  const currentFolderId = selectedNodeType === "folder" ? selectedNodeId : null;

  const handleSelectNode = useCallback(
    (node: DocNode) => selectNode(node),
    [selectNode],
  );

  // ── Filtered node list query (sidebar display) ──────────────────────
  const listQuery = api.docs.list.useQuery(
    {
      appId: appId ?? "",
      pageSize: 500,
      sortBy: effectiveSortField,
      sortDir: effectiveSortDir,
      search: search || undefined,
      favoritesOnly: tab === "favorites" ? true : undefined,
      tags: filterTags.length > 0 ? filterTags.join(",") : undefined,
      archived: tab === "trash" ? true : undefined,
    },
    { enabled: !!appId },
  );
  const allNodes = useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);

  // ── Selected node detail ────────────────────────────────────────────
  const detailQuery = api.docs.getById.useQuery(
    { id: selectedContentNodeId ?? "" },
    { enabled: !!selectedContentNodeId },
  );
  const selectedDoc = selectedDocId ? (detailQuery.data ?? null) : null;
  const selectedSheet = selectedSheetId ? (detailQuery.data ?? null) : null;
  const queryClient = useQueryClient();

  // ── Version preview ─────────────────────────────────────────────────
  const versionQuery = api.docs.getVersion.useQuery(
    { versionId: previewingVersionId ?? "" },
    { enabled: !!previewingVersionId },
  );
  const restoreVersionMutation = api.docs.restoreVersion.useMutation({
    onSuccess: () => {
      message.success("版本已恢复");
      setPreviewingVersionId(null);
      detailQuery.refetch();
      listQuery.refetch();
      api.docs.listVersions.invalidate(queryClient, {
        nodeId: selectedDocId ?? "",
      });
    },
    onError: () => message.error("恢复失败"),
  });

  // ── Mutations ───────────────────────────────────────────────────────
  const selectNodeRef = useRef(selectNode);
  selectNodeRef.current = selectNode;
  const deselectNodeRef = useRef(deselectNode);
  deselectNodeRef.current = deselectNode;

  const createMutation = api.docs.create.useMutation({
    onSuccess: (node: DocNodeOutput) => {
      if (node.type !== "folder") selectNodeRef.current(node);
      listQuery.refetch();
      treeQuery.refetch();
    },
    onError: () => message.error("创建失败"),
  });

  const updateMutation = api.docs.update.useMutation({
    onSuccess: () => {
      listQuery.refetch();
      treeQuery.refetch();
    },
  });

  const archiveMutation = api.docs.archive.useMutation({
    onSuccess: () => {
      deselectNodeRef.current();
      listQuery.refetch();
      treeQuery.refetch();
      message.success("已归档");
    },
    onError: () => message.error("归档失败"),
  });

  const restoreMutation = api.docs.restore.useMutation({
    onSuccess: () => {
      deselectNodeRef.current();
      listQuery.refetch();
      treeQuery.refetch();
      message.success("已恢复");
    },
    onError: () => message.error("恢复失败"),
  });

  const permanentDeleteMutation = api.docs.permanentDelete.useMutation({
    onSuccess: () => {
      deselectNodeRef.current();
      listQuery.refetch();
      treeQuery.refetch();
      message.success("已永久删除");
    },
    onError: () => message.error("删除失败"),
  });

  const favoriteMutation = api.docs.toggleFavorite.useMutation({
    onSuccess: () => listQuery.refetch(),
  });

  const moveMut = api.docs.move.useMutation({
    onSuccess: () => {
      listQuery.refetch();
      treeQuery.refetch();
      message.success("已移动");
    },
    onError: () => message.error("移动失败"),
  });

  // ── Refs for stable callbacks ───────────────────────────────────────
  const stateRef = useRef({
    appId,
    treeNodes,
    selectedDocId,
    selectedDocTitle: selectedDoc?.title,
  });
  stateRef.current = {
    appId,
    treeNodes,
    selectedDocId,
    selectedDocTitle: selectedDoc?.title,
  };
  const createMutRef = useRef(createMutation);
  createMutRef.current = createMutation;
  const updateMutRef = useRef(updateMutation);
  updateMutRef.current = updateMutation;
  const detailQueryRef = useRef(detailQuery);
  detailQueryRef.current = detailQuery;

  // ── Handlers ────────────────────────────────────────────────────────
  const handleCreate = useCallback(
    (type: DocNodeType, parentId?: string) => {
      if (type === "notion") {
        setPendingParentId(parentId);
        setTemplateChooserOpen(true);
      } else {
        const { appId: id, treeNodes: nodes } = stateRef.current;
        if (!id) return;
        const title = nextUniqueName(
          t(untitledI18nKey(type)),
          nodes,
          parentId ?? null,
        );
        createMutRef.current.mutate({ appId: id, type, title, parentId });
      }
    },
    [t],
  );

  const handleTemplateSelect = useCallback(
    (template: DocTemplate) => {
      const { appId: id, treeNodes: nodes } = stateRef.current;
      if (!id) return;
      const baseName = template.title || t("docs.untitledDocument");
      const title = nextUniqueName(baseName, nodes, pendingParentId ?? null);
      createMutRef.current.mutate(
        { appId: id, parentId: pendingParentId, title },
        {
          onSuccess: (doc: DocNodeOutput) => {
            if (template.id !== "blank") {
              updateMutRef.current.mutate({
                id: doc.id,
                content: template.content,
              });
            }
          },
        },
      );
      setTemplateChooserOpen(false);
    },
    [pendingParentId, t],
  );

  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleContentChange = useCallback(
    (value: Value) => {
      if (!selectedDocId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateMutRef.current.mutate({ id: selectedDocId, content: value });
      }, 800);
    },
    [selectedDocId],
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      if (!selectedDocId) return;
      updateMutRef.current.mutate({ id: selectedDocId, title });
    },
    [selectedDocId],
  );

  const handleSheetContentChange = useCallback(
    (snapshot: unknown) => {
      if (!selectedSheetId) return;
      updateMutRef.current.mutate({ id: selectedSheetId, content: snapshot });
    },
    [selectedSheetId],
  );

  const handleExportMarkdown = useCallback(() => {
    const editor = editorRef.current;
    if (editor) exportAsMarkdown(editor, stateRef.current.selectedDocTitle);
  }, []);

  const handleImportMarkdown = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    pickAndReadMarkdownFile(async (mdText) => {
      const value = deserializeMd(editor, mdText);
      const docId = stateRef.current.selectedDocId;
      if (docId) {
        await updateMutRef.current.mutateAsync({ id: docId, content: value });
        await detailQueryRef.current.refetch();
      }
    });
  }, []);

  const handleExportDocx = useCallback(async () => {
    const editor = editorRef.current;
    if (editor) await exportAsDocx(editor, stateRef.current.selectedDocTitle);
  }, []);

  const toggleSidebar = useCallback(() => setSidebarCollapsed((v) => !v), []);

  const handleAddComment = useCallback(
    (_: string) => setCommentSidebarOpen(true),
    [],
  );

  const handleOpenAi = useCallback(() => {
    const editor = editorRef.current;
    const text = editor ? getEditorPlainText(editor) : "";
    openAiAssistant({
      context: text || undefined,
      contextLabel: selectedDoc?.title || "文档",
    });
  }, [selectedDoc?.title]);

  const handleAiAction = useCallback((actionId: string) => {
    const editor = editorRef.current;
    const selected = editor?.selection ? getSelectedText() : "";
    const full = editor ? getEditorPlainText(editor) : "";
    dispatchAiAction(actionId, selected, full);
  }, []);

  const handleInsertVfsFile = useCallback(() => setVfsPickerOpen(true), []);

  const handleVfsFileSelected = useCallback((file: VfsFileSelection) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.tf.insertNodes({
      type: "vfs_file",
      fileSystemId: file.fileSystemId,
      fileSystemName: file.fileSystemName,
      filePath: file.filePath,
      fileName: file.fileName,
      fileSize: file.fileSize,
      modifiedAt: file.modifiedAt,
      children: [{ text: "" }],
    } as unknown as TElement);
  }, []);

  // ── AI document edit: apply & undo ──────────────────────────────────
  const [aiUndoContent, setAiUndoContent] = useState<Value | null>(null);
  const [aiUndoSummary, setAiUndoSummary] = useState<string | null>(null);

  useEffect(() => {
    return onAiDocumentEdit(async ({ content, summary }) => {
      const editor = editorRef.current;
      if (!editor) return;
      const docId = stateRef.current.selectedDocId;
      if (!docId) return;
      setAiUndoContent([...editor.children] as Value);
      setAiUndoSummary(summary);
      const newValue = deserializeMd(editor, content);
      await updateMutRef.current.mutateAsync({ id: docId, content: newValue });
      await detailQueryRef.current.refetch();
    });
  }, []);

  const handleAiUndo = useCallback(async () => {
    if (!aiUndoContent) return;
    const docId = stateRef.current.selectedDocId;
    if (docId) {
      await updateMutRef.current.mutateAsync({
        id: docId,
        content: aiUndoContent,
      });
      await detailQueryRef.current.refetch();
    }
    setAiUndoContent(null);
    setAiUndoSummary(null);
  }, [aiUndoContent]);

  const dismissAiUndo = useCallback(() => {
    setAiUndoContent(null);
    setAiUndoSummary(null);
  }, []);

  return {
    appId,
    t,
    user,
    tab,
    setTab,
    search,
    setSearch,
    sortField,
    setSortField,
    sortDir,
    setSortDir,
    sidebarCollapsed,
    filterTags,
    setFilterTags,
    commentSidebarOpen,
    setCommentSidebarOpen,
    versionHistoryOpen,
    setVersionHistoryOpen,
    previewingVersionId,
    setPreviewingVersionId,
    templateChooserOpen,
    setTemplateChooserOpen,
    vfsPickerOpen,
    setVfsPickerOpen,
    editorRef,
    effectiveSortField,
    effectiveSortDir,
    treeNodes,
    allNodes,
    selectedNodeId,
    selectedDocId,
    selectedSheetId,
    currentFolderId,
    selectedDoc,
    selectedSheet,
    listQuery,
    detailQuery,
    versionQuery,
    createMutation,
    updateMutation,
    archiveMutation,
    restoreMutation,
    permanentDeleteMutation,
    favoriteMutation,
    moveMut,
    restoreVersionMutation,
    selectNode,
    deselectNode,
    navigateToNode,
    handleSelectNode,
    handleCreate,
    handleTemplateSelect,
    handleContentChange,
    handleTitleChange,
    handleSheetContentChange,
    handleExportMarkdown,
    handleImportMarkdown,
    handleExportDocx,
    toggleSidebar,
    handleAddComment,
    handleOpenAi,
    handleAiAction,
    handleInsertVfsFile,
    handleVfsFileSelected,
    aiUndoContent,
    aiUndoSummary,
    handleAiUndo,
    dismissAiUndo,
  };
}
