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
import type { VfsFileSelection } from "@/apps/docs/components/VfsFilePickerWindow";
import type { DocNode, DocNodeType } from "@/apps/docs/lib/doc-node";
import {
  buildNodePath,
  nextUniqueName,
  parentRelPathOf,
  resolveNodeByPath,
  untitledI18nKey,
} from "@/apps/docs/lib/doc-node";
import type { DocNodeListItem } from "@/generated/rust-api";
import { api } from "@/generated/rust-api";
import { docAttachmentApi } from "@/generated/rust-api/docs/attachment";
import type { DocsTab } from "@/generated/rust-api/docs/docs";
import { onAiDocumentEdit, openAiAssistant } from "@/lib/ai-assistant-events";
import { useMessage, useWindowNav } from "@/system";
import { useAuth } from "@/system/auth/useAuth";
import { useWindowActions } from "@/system/window/WindowManagerContext";
import { useWindowId } from "@/system/window/WindowNavContext";
import { PickCancelled, pickWithBridge } from "@/system/window-bridge";
import {
  dispatchAiAction,
  exportAsDocx,
  exportAsMarkdown,
  getEditorPlainText,
  getSelectedText,
  pickAndReadMarkdownFile,
} from "./doc-page-utils";

export type DocNodeDetail = DocNodeListItem & {
  id: string;
  content: unknown;
};

type DetailRecord = Record<string, unknown>;

function asDetailRecord(value: unknown): DetailRecord | null {
  return value != null && typeof value === "object"
    ? (value as DetailRecord)
    : null;
}

function stringField(record: DetailRecord | null, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

function numberField(record: DetailRecord | null, key: string): number | null {
  const value = record?.[key];
  return typeof value === "number" ? value : null;
}

function booleanField(
  record: DetailRecord | null,
  key: string,
): boolean | null {
  const value = record?.[key];
  return typeof value === "boolean" ? value : null;
}

function stringArrayField(
  record: DetailRecord | null,
  key: string,
): string[] | null {
  const value = record?.[key];
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : null;
}

function buildDocNodeDetail(
  node: DocNodeListItem | null,
  detail: unknown,
): DocNodeDetail | null {
  if (!node) return null;
  const record = asDetailRecord(detail);
  return {
    ...node,
    id: stringField(record, "id") ?? node.relPath,
    relPath: stringField(record, "relPath") ?? node.relPath,
    spaceId: stringField(record, "spaceId") ?? node.spaceId,
    parentId: stringField(record, "parentId") ?? node.parentId,
    type: stringField(record, "type") ?? node.type,
    title: stringField(record, "title") ?? node.title,
    icon: stringField(record, "icon") ?? node.icon,
    tags: stringArrayField(record, "tags") ?? node.tags,
    isFavorite: booleanField(record, "isFavorite") ?? node.isFavorite,
    isPinned: booleanField(record, "isPinned") ?? node.isPinned,
    isArchived: booleanField(record, "isArchived") ?? node.isArchived,
    wordCount: numberField(record, "wordCount") ?? node.wordCount,
    sortOrder: numberField(record, "sortOrder") ?? node.sortOrder,
    lastOpenedAt: stringField(record, "lastOpenedAt") ?? node.lastOpenedAt,
    createdAt: stringField(record, "createdAt") ?? node.createdAt,
    updatedAt: stringField(record, "updatedAt") ?? node.updatedAt,
    content: record?.content ?? null,
  };
}

function mergeNodesByRelPath(
  ...nodeGroups: readonly (readonly DocNodeListItem[] | undefined)[]
): DocNodeListItem[] {
  const nodesByRelPath = new Map<string, DocNodeListItem>();
  for (const group of nodeGroups) {
    for (const node of group ?? []) {
      if (!nodesByRelPath.has(node.relPath)) {
        nodesByRelPath.set(node.relPath, node);
      }
    }
  }
  return Array.from(nodesByRelPath.values());
}

export function useDocsPage(spaceId: string) {
  const { route, navigate, replace } = useWindowNav();
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
  const editorRef = useRef<DocEditorHandle | null>(null);
  const windowId = useWindowId();
  const { openModalWindow } = useWindowActions();

  const effectiveSortField = sortField;
  const effectiveSortDir = sortDir;
  const listTab: DocsTab = tab;

  // ── Filtered node list query (sidebar display) ──────────────────────
  const listQuery = api.docs.list.useQuery(
    {
      spaceId: spaceId ?? "",
      pageSize: 500,
      tab: listTab,
      search: search || undefined,
      tags: filterTags.length > 0 ? filterTags.join(",") : undefined,
    },
    { enabled: !!spaceId },
  );

  // ── Route-derived selection ──────────────────────────────────────────
  const selectedNodeId = useMemo(() => resolveNodeByPath(route), [route]);
  const selectedParentPath = useMemo(
    () => parentRelPathOf(selectedNodeId),
    [selectedNodeId],
  );
  const selectedFolderListQuery = api.docs.list.useQuery(
    {
      spaceId: spaceId ?? "",
      path: selectedParentPath ?? "",
      tab: "all",
      pageSize: 500,
    },
    { enabled: !!spaceId && !!selectedNodeId },
  );
  const selectedNode = useMemo(
    () =>
      selectedFolderListQuery.data?.items.find(
        (n) => n.relPath === selectedNodeId,
      ) ??
      listQuery.data?.items.find((n) => n.relPath === selectedNodeId) ??
      null,
    [selectedFolderListQuery.data, listQuery.data, selectedNodeId],
  );
  const selectedNodeType = (selectedNode?.type as DocNodeType) ?? null;

  // Auto-repair route when node path changes
  const prevRouteRef = useRef(route);
  useEffect(() => {
    if (!selectedNodeId || !selectedNode) return;
    const correctPath = buildNodePath(spaceId, selectedNodeId);
    if (correctPath !== route && route !== "/") {
      replace(correctPath, selectedNode.title);
    }
    prevRouteRef.current = route;
  }, [selectedNodeId, selectedNode, spaceId, route, replace]);

  // Navigation helpers
  const selectNode = useCallback(
    (node: { relPath: string; title: string }) => {
      navigate(
        buildNodePath(spaceId, node.relPath),
        `TokimoDocs · ${node.title}`,
      );
      setPreviewingVersionId(null);
    },
    [navigate, spaceId],
  );
  const deselectNode = useCallback(
    () => navigate(`/space/${encodeURIComponent(spaceId)}`),
    [navigate, spaceId],
  );

  const selectedDocId = selectedNodeType === "notion" ? selectedNodeId : null;
  const selectedMarkdownId =
    selectedNodeType === "markdown" ? selectedNodeId : null;
  const selectedSheetId = selectedNodeType === "sheet" ? selectedNodeId : null;
  const selectedMindId = selectedNodeType === "mind" ? selectedNodeId : null;
  const selectedSlideId = selectedNodeType === "slide" ? selectedNodeId : null;
  const selectedWhiteboardId =
    selectedNodeType === "whiteboard" ? selectedNodeId : null;
  const selectedBaseId = selectedNodeType === "base" ? selectedNodeId : null;
  const selectedContentNodeId =
    selectedDocId ??
    selectedMarkdownId ??
    selectedSheetId ??
    selectedMindId ??
    selectedSlideId ??
    selectedWhiteboardId ??
    selectedBaseId;
  const currentFolderId = selectedNodeType === "folder" ? selectedNodeId : null;
  const browserQuery = api.docs.list.useQuery(
    {
      spaceId: spaceId ?? "",
      path: currentFolderId ?? "",
      tab: "all",
      pageSize: 500,
    },
    {
      enabled: !!spaceId && (!selectedNodeId || selectedNodeType === "folder"),
    },
  );
  const treeNodes = useMemo(
    () =>
      mergeNodesByRelPath(
        listQuery.data?.items,
        selectedFolderListQuery.data?.items,
        browserQuery.data?.items,
      ),
    [listQuery.data, selectedFolderListQuery.data, browserQuery.data],
  );
  const allNodes = useMemo(
    () =>
      mergeNodesByRelPath(
        listQuery.data?.items,
        selectedFolderListQuery.data?.items,
        browserQuery.data?.items,
      ),
    [listQuery.data, selectedFolderListQuery.data, browserQuery.data],
  );
  const browserNodes = useMemo(() => {
    if (tab !== "all") return listQuery.data?.items ?? [];
    const nodes = browserQuery.data?.items ?? listQuery.data?.items ?? [];
    if (currentFolderId) return nodes;
    return nodes.filter((node) => node.parentId === null);
  }, [browserQuery.data, currentFolderId, listQuery.data, tab]);
  const browserIsLoading =
    tab === "all"
      ? browserQuery.isLoading || browserQuery.isFetching
      : listQuery.isLoading || listQuery.isFetching;

  const navigateToNode = useCallback(
    (nodeId: string | null) => {
      if (!nodeId) {
        deselectNode();
        return;
      }
      const node = treeNodes.find((n) => n.relPath === nodeId);
      node ? selectNode(node) : deselectNode();
    },
    [treeNodes, selectNode, deselectNode],
  );

  const handleSelectNode = useCallback(
    (node: DocNode) => selectNode(node),
    [selectNode],
  );

  // ── Selected node detail ────────────────────────────────────────────
  const detailQuery = api.docs.getById.useQuery(
    { id: selectedContentNodeId ?? "", spaceId: spaceId ?? "" },
    {
      enabled: !!selectedContentNodeId && !!spaceId,
      staleTime: 0,
    },
  );
  const selectedDetail = useMemo(
    () => buildDocNodeDetail(selectedNode, detailQuery.data),
    [selectedNode, detailQuery.data],
  );
  const isSelectedNodeLoading =
    !!selectedNodeId &&
    !selectedNode &&
    (selectedFolderListQuery.isLoading ||
      selectedFolderListQuery.isFetching ||
      listQuery.isLoading ||
      listQuery.isFetching);
  const isEditorLoading =
    isSelectedNodeLoading ||
    (!!selectedContentNodeId &&
      (detailQuery.isLoading || detailQuery.isFetching || !detailQuery.data));
  const selectedDoc = selectedDocId ? selectedDetail : null;
  const selectedMarkdown = selectedMarkdownId ? selectedDetail : null;
  const selectedSheet = selectedSheetId ? selectedDetail : null;
  const selectedMind = selectedMindId ? selectedDetail : null;
  const selectedSlide = selectedSlideId ? selectedDetail : null;
  const selectedWhiteboard = selectedWhiteboardId ? selectedDetail : null;
  const selectedBase = selectedBaseId ? selectedDetail : null;
  const markdownText =
    typeof selectedMarkdown?.content === "string"
      ? selectedMarkdown.content
      : "";
  const queryClient = useQueryClient();

  // ── Version preview ─────────────────────────────────────────────────
  const versionQuery = api.docs.getVersion.useQuery(
    { spaceId: spaceId ?? "", versionId: previewingVersionId ?? "" },
    { enabled: !!spaceId && !!previewingVersionId },
  );
  const restoreVersionMutation = api.docs.restoreVersion.useMutation({
    onSuccess: () => {
      message.success("版本已恢复");
      setPreviewingVersionId(null);
      detailQuery.refetch();
      listQuery.refetch();
      api.docs.listVersions.invalidate(queryClient, {
        spaceId: spaceId ?? "",
        relPath: selectedDocId ?? "",
      });
    },
    onError: () => message.error("恢复失败"),
  });

  // ── Mutations ───────────────────────────────────────────────────────
  const selectNodeRef = useRef(selectNode);
  selectNodeRef.current = selectNode;
  const deselectNodeRef = useRef(deselectNode);
  deselectNodeRef.current = deselectNode;

  const refetchNodeQueries = useCallback(() => {
    api.docs.list.invalidate(queryClient);
    listQuery.refetch();
    if (selectedNodeId) selectedFolderListQuery.refetch();
    browserQuery.refetch();
  }, [
    queryClient,
    listQuery,
    selectedFolderListQuery,
    browserQuery,
    selectedNodeId,
  ]);

  const createMutation = api.docs.create.useMutation({
    onSuccess: (node: DocNodeListItem) => {
      if (node.type !== "folder") selectNodeRef.current(node);
      refetchNodeQueries();
    },
    onError: () => message.error("创建失败"),
  });

  const updateMutation = api.docs.update.useMutation({
    onSuccess: () => {
      refetchNodeQueries();
    },
  });

  const archiveMutation = api.docs.archive.useMutation({
    onSuccess: () => {
      deselectNodeRef.current();
      refetchNodeQueries();
      message.success("已归档");
    },
    onError: () => message.error("归档失败"),
  });

  const restoreMutation = api.docs.restore.useMutation({
    onSuccess: () => {
      deselectNodeRef.current();
      refetchNodeQueries();
      message.success("已恢复");
    },
    onError: () => message.error("恢复失败"),
  });

  const permanentDeleteMutation = api.docs.permanentDelete.useMutation({
    onSuccess: () => {
      deselectNodeRef.current();
      refetchNodeQueries();
      message.success("已永久删除");
    },
    onError: () => message.error("删除失败"),
  });

  const favoriteMutation = api.docs.toggleFavorite.useMutation({
    onSuccess: () => listQuery.refetch(),
  });

  const moveMut = api.docs.move.useMutation({
    onSuccess: () => {
      refetchNodeQueries();
      message.success("已移动");
    },
    onError: () => message.error("移动失败"),
  });

  // ── Refs for stable callbacks ───────────────────────────────────────
  const stateRef = useRef({
    spaceId,
    treeNodes,
    selectedDocId,
    selectedDocRelPath: selectedDoc?.relPath,
    selectedDocTitle: selectedDoc?.title,
  });
  stateRef.current = {
    spaceId,
    treeNodes,
    selectedDocId,
    selectedDocRelPath: selectedDoc?.relPath,
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
        const { spaceId: id, treeNodes: nodes } = stateRef.current;
        if (!id) return;
        const title = nextUniqueName(
          t(untitledI18nKey(type)),
          nodes,
          parentId ?? null,
        );
        createMutRef.current.mutate({
          spaceId: id,
          type,
          title,
          parentRelPath: parentId,
        });
      }
    },
    [t],
  );

  const handleTemplateSelect = useCallback(
    (template: DocTemplate) => {
      const { spaceId: id, treeNodes: nodes } = stateRef.current;
      if (!id) return;
      const baseName = template.title || t("docs.untitledDocument");
      const title = nextUniqueName(baseName, nodes, pendingParentId ?? null);
      createMutRef.current.mutate(
        { spaceId: id, type: "notion", parentRelPath: pendingParentId, title },
        {
          onSuccess: (doc: DocNodeListItem) => {
            if (template.id !== "blank") {
              updateMutRef.current.mutate({
                relPath: doc.relPath,
                spaceId: stateRef.current.spaceId,
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
        updateMutRef.current.mutate({
          id: selectedDocId,
          spaceId: stateRef.current.spaceId,
          content: value,
        });
      }, 800);
    },
    [selectedDocId],
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      if (!selectedDocId) return;
      updateMutRef.current.mutate({
        id: selectedDocId,
        spaceId: stateRef.current.spaceId,
        title,
      });
    },
    [selectedDocId],
  );

  const handleMarkdownContentChange = useCallback(
    (text: string) => {
      if (!selectedMarkdownId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateMutRef.current.mutate({
          id: selectedMarkdownId,
          spaceId: stateRef.current.spaceId,
          content: text,
        });
      }, 800);
    },
    [selectedMarkdownId],
  );

  const handleMarkdownTitleChange = useCallback(
    (title: string) => {
      if (!selectedMarkdownId) return;
      updateMutRef.current.mutate({
        id: selectedMarkdownId,
        spaceId: stateRef.current.spaceId,
        title,
      });
    },
    [selectedMarkdownId],
  );

  const handleSheetContentChange = useCallback(
    (snapshot: unknown) => {
      if (!selectedSheetId) return;
      updateMutRef.current.mutate({
        id: selectedSheetId,
        spaceId: stateRef.current.spaceId,
        content: snapshot,
      });
    },
    [selectedSheetId],
  );

  const handleMindContentChange = useCallback(
    (data: unknown) => {
      if (!selectedMindId) return;
      updateMutRef.current.mutate({
        id: selectedMindId,
        spaceId: stateRef.current.spaceId,
        content: data,
      });
    },
    [selectedMindId],
  );

  const handleSlideContentChange = useCallback(
    (data: unknown) => {
      if (!selectedSlideId) return;
      updateMutRef.current.mutate({
        id: selectedSlideId,
        spaceId: stateRef.current.spaceId,
        content: data,
      });
    },
    [selectedSlideId],
  );

  const handleWhiteboardContentChange = useCallback(
    (data: unknown) => {
      if (!selectedWhiteboardId) return;
      updateMutRef.current.mutate({
        id: selectedWhiteboardId,
        spaceId: stateRef.current.spaceId,
        content: data,
      });
    },
    [selectedWhiteboardId],
  );

  const handleBaseContentChange = useCallback(
    (data: unknown) => {
      if (!selectedBaseId) return;
      updateMutRef.current.mutate({
        id: selectedBaseId,
        spaceId: stateRef.current.spaceId,
        content: data,
      });
    },
    [selectedBaseId],
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
        await updateMutRef.current.mutateAsync({
          id: docId,
          spaceId: stateRef.current.spaceId,
          content: value,
        });
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

  const insertVfsFileNode = useCallback((file: VfsFileSelection) => {
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

  const handleInsertVfsFile = useCallback(async () => {
    try {
      const file = await pickWithBridge<VfsFileSelection>(openModalWindow, {
        component: () => import("@/apps/docs/components/VfsFilePickerWindow"),
        parentWindowId: windowId,
        title: "引用文件",
        width: 600,
        height: 480,
      });
      insertVfsFileNode(file);
    } catch (err) {
      if (err instanceof PickCancelled) return;
      throw err;
    }
  }, [openModalWindow, windowId, insertVfsFileNode]);

  // ── Attachment upload ──────────────────────────────────────────────
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);

  const handleAttachmentUpload = useCallback(() => {
    attachmentInputRef.current?.click();
  }, []);

  const uploadAndInsertAttachment = useCallback(
    async (file: File, insertAt?: number) => {
      const editor = editorRef.current;
      const relPath = stateRef.current.selectedDocRelPath;
      if (!editor || !relPath) return;

      // Insert placeholder block with upload progress
      const placeholderId = crypto.randomUUID();
      const insertOpts =
        insertAt != null ? { at: [insertAt] as [number] } : undefined;
      editor.tf.insertNodes(
        {
          type: "attachment",
          attachmentId: placeholderId,
          storageKey: "",
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
          height: null,
          uploadProgress: 0,
          children: [{ text: "" }],
        } as unknown as TElement,
        insertOpts,
      );

      try {
        const result = await docAttachmentApi.upload.mutate({
          spaceId: stateRef.current.spaceId,
          relPath,
          file,
          onProgress: (percent) => {
            // Update progress on the placeholder block (search whole doc)
            for (const [_node, path] of editor.api.nodes({
              at: [],
              match: (n: TElement) =>
                (n as unknown as Record<string, unknown>).attachmentId ===
                placeholderId,
            })) {
              editor.tf.setNodes(
                { uploadProgress: percent } as Partial<TElement>,
                { at: path },
              );
              break;
            }
          },
        });

        // Replace placeholder with final data
        for (const [_node, path] of editor.api.nodes({
          at: [],
          match: (n: TElement) =>
            (n as unknown as Record<string, unknown>).attachmentId ===
            placeholderId,
        })) {
          editor.tf.setNodes(
            {
              attachmentId: result.id,
              storageKey: result.storageKey,
              fileName: result.fileName,
              fileType: result.fileType,
              fileSize: result.fileSize,
              fileCategory: result.fileCategory ?? undefined,
              detectedMime: result.detectedMime ?? undefined,
              detectedLanguage: result.detectedLanguage ?? undefined,
              isBinary: result.isBinary ?? undefined,
              textEncoding: result.textEncoding ?? undefined,
              uploadProgress: undefined,
            } as Partial<TElement>,
            { at: path },
          );
          break;
        }
      } catch (err) {
        // Remove failed placeholder
        for (const [_node, path] of editor.api.nodes({
          at: [],
          match: (n: TElement) =>
            (n as unknown as Record<string, unknown>).attachmentId ===
            placeholderId,
        })) {
          editor.tf.removeNodes({ at: path });
          break;
        }
        message.error(
          `附件上传失败: ${err instanceof Error ? err.message : "未知错误"}`,
        );
      }
    },
    [message],
  );

  const handleAttachmentFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;
      for (const file of files) {
        uploadAndInsertAttachment(file);
      }
      // Reset so the same file can be re-selected
      e.target.value = "";
    },
    [uploadAndInsertAttachment],
  );

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
      await updateMutRef.current.mutateAsync({
        id: docId,
        spaceId: stateRef.current.spaceId,
        content: newValue,
      });
      await detailQueryRef.current.refetch();
    });
  }, []);

  const handleAiUndo = useCallback(async () => {
    if (!aiUndoContent) return;
    const docId = stateRef.current.selectedDocId;
    if (docId) {
      await updateMutRef.current.mutateAsync({
        id: docId,
        spaceId: stateRef.current.spaceId,
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
    spaceId,
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
    editorRef,
    effectiveSortField,
    effectiveSortDir,
    treeNodes,
    allNodes,
    browserNodes,
    browserIsLoading,
    isSelectedNodeLoading,
    isEditorLoading,
    selectedContentNodeId,
    selectedNodeId,
    selectedDocId,
    selectedSheetId,
    currentFolderId,
    selectedDoc,
    selectedMarkdown,
    markdownText,
    selectedSheet,
    selectedMind,
    selectedSlide,
    selectedWhiteboard,
    selectedBase,
    selectedSlideId,
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
    handleMarkdownContentChange,
    handleMarkdownTitleChange,
    handleSheetContentChange,
    handleMindContentChange,
    handleSlideContentChange,
    handleWhiteboardContentChange,
    handleBaseContentChange,
    handleExportMarkdown,
    handleImportMarkdown,
    handleExportDocx,
    toggleSidebar,
    handleAddComment,
    handleOpenAi,
    handleAiAction,
    handleInsertVfsFile,
    handleAttachmentUpload,
    handleAttachmentFileChange,
    attachmentInputRef,
    uploadAndInsertAttachment,
    aiUndoContent,
    aiUndoSummary,
    handleAiUndo,
    dismissAiUndo,
  };
}
