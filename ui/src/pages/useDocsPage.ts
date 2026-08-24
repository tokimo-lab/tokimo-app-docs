import { deserializeMd } from "@platejs/markdown";
import { useQueryClient } from "@tanstack/react-query";
import {
  PickCancelled,
  pickWithBridge,
  useShellApi,
  useWindowActions,
  useWindowId,
  useWindowNav,
} from "@tokimo/sdk";
import type { TElement, Value } from "platejs";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, docAttachmentApi, type DocNodeListItem, type DocsTab } from "../api/generated";
import type {
  SidebarTab,
  SortDir,
  SortField,
} from "../components/DocSidebar";
import type { DocTemplate } from "../components/doc-templates";
import type { DocEditorHandle } from "../components/editor";
import type { VfsFileSelection } from "../components/VfsFilePickerWindow";
import type { DocNode, DocNodeType } from "../lib/doc-node";
import {
  buildNodePath,
  isStableNodeId,
  nextUniqueName,
  parentRelPathOf,
  resolveNodeByPath,
  untitledI18nKey,
} from "../lib/doc-node";
import { onAiDocumentEdit, openAiAssistant } from "../lib/ai-assistant-events";
import { useAuth } from "../hooks/use-auth";
import { useToast as useMessage } from "@tokimo/ui";
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
  const record = asDetailRecord(detail);
  if (!node && !record) return null;
  const meta = asDetailRecord(record?.meta);
  const id = stringField(record, "id") ?? stringField(meta, "id") ?? node?.id;
  const relPath = stringField(record, "relPath") ?? node?.relPath;
  const resolvedSpaceId = stringField(record, "spaceId") ?? node?.spaceId;
  const type = stringField(record, "type") ?? node?.type;
  const title = stringField(record, "title") ?? node?.title;
  if (!id || !relPath || !resolvedSpaceId || !type || title == null) return null;
  return {
    id,
    relPath,
    spaceId: resolvedSpaceId,
    parentId:
      stringField(record, "parentId") ??
      node?.parentId ??
      parentRelPathOf(relPath) ??
      undefined,
    type,
    title,
    icon: stringField(meta, "icon") ?? node?.icon,
    tags: stringArrayField(meta, "tags") ?? node?.tags,
    isFavorite: booleanField(meta, "isFavorite") ?? node?.isFavorite ?? false,
    isPinned: booleanField(meta, "isPinned") ?? node?.isPinned ?? false,
    isArchived: booleanField(meta, "isArchived") ?? node?.isArchived ?? false,
    wordCount: numberField(meta, "wordCount") ?? node?.wordCount ?? 0,
    sortOrder: numberField(meta, "sortOrder") ?? node?.sortOrder ?? 0,
    lastOpenedAt: stringField(meta, "lastOpenedAt") ?? node?.lastOpenedAt,
    createdAt:
      stringField(meta, "createdAt") ?? node?.createdAt ?? new Date().toISOString(),
    updatedAt:
      stringField(record, "updatedAt") ??
      stringField(meta, "updatedAt") ??
      node?.updatedAt ??
      new Date().toISOString(),
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

function sortDocNodes(
  nodes: readonly DocNodeListItem[],
  field: SortField,
  direction: SortDir,
): DocNodeListItem[] {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...nodes].sort((left, right) => {
    if (left.type === "folder" && right.type !== "folder") return -1;
    if (left.type !== "folder" && right.type === "folder") return 1;
    const comparison =
      field === "title"
        ? left.title.localeCompare(right.title)
        : field === "wordCount"
          ? left.wordCount - right.wordCount
          : new Date(left[field]).getTime() - new Date(right[field]).getTime();
    return comparison === 0
      ? left.title.localeCompare(right.title)
      : comparison * multiplier;
  });
}

export function useDocsPage(spaceId: string) {
  const { route, navigate, replace } = useWindowNav();
  const message = useMessage();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { bridge } = useShellApi();

  // ── UI state ─────────────────────────────────────────────────────────
  const [tab, setTab] = useState<SidebarTab>("all");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<
    "saved" | "saving" | "error"
  >("saved");
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
  // New routes contain a stable UUID. Legacy relPath routes remain readable
  // and are replaced after the detail endpoint resolves their stable ID.
  const selectedRouteRef = useMemo(() => resolveNodeByPath(route), [route]);
  const detailQuery = api.docs.getById.useQuery(
    {
      spaceId: spaceId ?? "",
      ...(selectedRouteRef && isStableNodeId(selectedRouteRef)
        ? { nodeId: selectedRouteRef }
        : { relPath: selectedRouteRef ?? "" }),
    },
    {
      enabled: !!selectedRouteRef && !!spaceId,
      staleTime: 0,
    },
  );
  const listedNode = useMemo(
    () =>
      listQuery.data?.items.find(
        (node: DocNodeListItem) =>
          node.id === selectedRouteRef || node.relPath === selectedRouteRef,
      ) ?? null,
    [listQuery.data, selectedRouteRef],
  );
  const selectedDetail = useMemo(
    () => buildDocNodeDetail(listedNode, detailQuery.data),
    [listedNode, detailQuery.data],
  );
  const selectedNodeId = selectedDetail?.id ?? selectedRouteRef;
  const selectedNodeType = (selectedDetail?.type as DocNodeType) ?? null;

  useEffect(() => {
    if (!selectedDetail || route === "/") return;
    const correctPath = buildNodePath(spaceId, selectedDetail.id);
    if (correctPath !== route) {
      replace(correctPath, selectedDetail.title);
    }
  }, [selectedDetail, spaceId, route, replace]);

  // Navigation helpers
  const selectNode = useCallback(
    (node: { id: string; title: string }) => {
      navigate(
        buildNodePath(spaceId, node.id),
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

  const selectedDocId = selectedNodeType === "notion" ? selectedDetail?.id ?? null : null;
  const selectedMarkdownId =
    selectedNodeType === "markdown" ? selectedDetail?.id ?? null : null;
  const selectedSheetId = selectedNodeType === "sheet" ? selectedDetail?.id ?? null : null;
  const selectedMindId = selectedNodeType === "mind" ? selectedDetail?.id ?? null : null;
  const selectedSlideId = selectedNodeType === "slide" ? selectedDetail?.id ?? null : null;
  const selectedWhiteboardId =
    selectedNodeType === "whiteboard" ? selectedDetail?.id ?? null : null;
  const selectedBaseId = selectedNodeType === "base" ? selectedDetail?.id ?? null : null;
  const selectedContentNodeId =
    selectedDocId ??
    selectedMarkdownId ??
    selectedSheetId ??
    selectedMindId ??
    selectedSlideId ??
    selectedWhiteboardId ??
    selectedBaseId;
  const currentFolderId =
    selectedNodeType === "folder" ? selectedDetail?.relPath ?? null : null;
  const browserQuery = api.docs.list.useQuery(
    {
      spaceId: spaceId ?? "",
      path: currentFolderId ?? "",
      tab: "all",
      pageSize: 500,
    },
    {
      enabled: !!spaceId && (!selectedRouteRef || selectedNodeType === "folder"),
    },
  );
  const treeNodes = useMemo(
    () =>
      mergeNodesByRelPath(listQuery.data?.items, browserQuery.data?.items),
    [listQuery.data, browserQuery.data],
  );
  const allNodes = useMemo(
    () =>
      mergeNodesByRelPath(listQuery.data?.items, browserQuery.data?.items),
    [listQuery.data, browserQuery.data],
  );
  const browserNodes = useMemo(() => {
    if (tab !== "all") {
      return sortDocNodes(
        listQuery.data?.items ?? [],
        effectiveSortField,
        effectiveSortDir,
      );
    }
    const nodes = browserQuery.data?.items ?? listQuery.data?.items ?? [];
    const visible = currentFolderId
      ? nodes
      : nodes.filter((node: DocNodeListItem) => node.parentId === null);
    return sortDocNodes(visible, effectiveSortField, effectiveSortDir);
  }, [
    browserQuery.data,
    currentFolderId,
    listQuery.data,
    tab,
    effectiveSortField,
    effectiveSortDir,
  ]);
  const sidebarNodes = useMemo(
    () =>
      sortDocNodes(
        listQuery.data?.items ?? [],
        effectiveSortField,
        effectiveSortDir,
      ),
    [listQuery.data, effectiveSortField, effectiveSortDir],
  );
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
      // Don't require the node to exist in already-loaded queries —
      // ancestor folders may not be in treeNodes yet. Just navigate to the
      // relPath; the route-driven queries will resolve type/metadata.
      const node = treeNodes.find(
        (n: DocNodeListItem) => n.id === nodeId || n.relPath === nodeId,
      );
      const title = node?.title ?? nodeId.split("/").pop() ?? nodeId;
      navigate(
        buildNodePath(spaceId, node?.id ?? nodeId),
        `TokimoDocs · ${title}`,
      );
      setPreviewingVersionId(null);
    },
    [treeNodes, navigate, spaceId, deselectNode],
  );

  const handleSelectNode = useCallback(
    (node: DocNode) => selectNode(node),
    [selectNode],
  );

  const isSelectedNodeLoading =
    !!selectedRouteRef &&
    (detailQuery.isLoading || detailQuery.isFetching || !selectedDetail);
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
      message.success(t("versions.restored"));
      setPreviewingVersionId(null);
      detailQuery.refetch();
      listQuery.refetch();
      api.docs.listVersions.invalidate(queryClient, {
        spaceId: spaceId ?? "",
        relPath: selectedDoc?.relPath ?? "",
      });
      // Force editor remount so the collab session is dropped and the doc is
      // reloaded from VFS (the Yjs cache otherwise still holds the pre-restore
      // content). See `reloadCurrentDoc` below — declared later but in scope
      // by the time this callback runs.
      reloadCurrentDoc();
    },
    onError: () => message.error(t("versions.restoreFailed")),
  });

  // ── Mutations ───────────────────────────────────────────────────────
  const selectNodeRef = useRef(selectNode);
  selectNodeRef.current = selectNode;
  const deselectNodeRef = useRef(deselectNode);
  deselectNodeRef.current = deselectNode;

  const refetchNodeQueries = useCallback(() => {
    api.docs.list.invalidate(queryClient);
    listQuery.refetch();
    browserQuery.refetch();
  }, [queryClient, listQuery, browserQuery]);

  const createMutation = api.docs.create.useMutation({
    onSuccess: (node: DocNodeListItem) => {
      if (node.type !== "folder") selectNodeRef.current(node);
      refetchNodeQueries();
    },
    onError: () => message.error(t("actions.created")),
  });

  const updateMutation = api.docs.update.useMutation({
    onSuccess: (_data: DocNodeListItem, variables: { content?: unknown }) => {
      refetchNodeQueries();
      if (variables.content !== undefined) setSaveState("saved");
      else detailQueryRef.current.refetch();
    },
    onError: (_error, variables) => {
      if (variables.content !== undefined) setSaveState("error");
    },
  });

  const archiveMutation = api.docs.archive.useMutation({
    onSuccess: () => {
      deselectNodeRef.current();
      refetchNodeQueries();
      message.success(t("actions.archived"));
    },
    onError: () => message.error(t("actions.archiveFailed")),
  });

  const restoreMutation = api.docs.restore.useMutation({
    onSuccess: () => {
      deselectNodeRef.current();
      refetchNodeQueries();
      message.success(t("actions.restored"));
    },
    onError: () => message.error(t("actions.restoreFailed")),
  });

  const permanentDeleteMutation = api.docs.permanentDelete.useMutation({
    onSuccess: () => {
      deselectNodeRef.current();
      refetchNodeQueries();
      message.success(t("actions.permanentlyDeleted"));
    },
    onError: () => message.error(t("actions.deleteFailed")),
  });

  const favoriteMutation = api.docs.toggleFavorite.useMutation({
    onSuccess: () => listQuery.refetch(),
  });

  const moveMut = api.docs.move.useMutation({
    onSuccess: () => {
      refetchNodeQueries();
      message.success(t("actions.moved"));
    },
    onError: () => message.error(t("actions.moveFailed")),
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

  // Close-and-reopen the currently selected doc to force the editor (and its
  // Yjs collab provider) to remount. Used after destructive operations like
  // version restore where the on-disk content changes but the collab session
  // would otherwise keep serving the stale Yjs doc.
  const reloadCurrentDoc = useCallback(() => {
    const sid = stateRef.current.spaceId;
    const nodeId = stateRef.current.selectedDocId;
    const title = stateRef.current.selectedDocTitle;
    if (!sid || !nodeId) return;
    navigate(`/space/${encodeURIComponent(sid)}`);
    setTimeout(() => {
      navigate(buildNodePath(sid, nodeId), `TokimoDocs · ${title ?? nodeId}`);
    }, 200);
  }, [navigate]);

  // ── Handlers ────────────────────────────────────────────────────────
  const handleCreate = useCallback(
    (type: DocNodeType, parentId?: string) => {
      if (type === "notion") {
        const { spaceId: id, treeNodes: nodes } = stateRef.current;
        if (!id) return;
        const title = nextUniqueName(
          t("docs.untitledDocument"),
          nodes,
          parentId ?? null,
        );
        createMutRef.current.mutate({
          spaceId: id,
          type: "notion",
          title,
          parentRelPath: parentId,
        });
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
  const pendingContentRef = useRef<{
    nodeId: string;
    spaceId: string;
    content: unknown;
  } | null>(null);

  const flushPendingContent = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingContentRef.current;
    if (!pending) return;
    pendingContentRef.current = null;
    updateMutRef.current.mutate({
      nodeId: pending.nodeId,
      spaceId: pending.spaceId,
      content: pending.content,
    });
  }, []);

  useEffect(
    () => () => flushPendingContent(),
    [selectedContentNodeId, flushPendingContent],
  );

  const handleContentChange = useCallback(
    (value: Value) => {
      if (!selectedDocId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setSaveState("saving");
      pendingContentRef.current = {
        nodeId: selectedDocId,
        spaceId: stateRef.current.spaceId,
        content: value,
      };
      saveTimerRef.current = setTimeout(flushPendingContent, 800);
    },
    [selectedDocId, flushPendingContent],
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      if (!selectedDocId) return;
      updateMutRef.current.mutate({
        nodeId: selectedDocId,
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
      setSaveState("saving");
      pendingContentRef.current = {
        nodeId: selectedMarkdownId,
        spaceId: stateRef.current.spaceId,
        content: text,
      };
      saveTimerRef.current = setTimeout(flushPendingContent, 800);
    },
    [selectedMarkdownId, flushPendingContent],
  );

  const handleMarkdownTitleChange = useCallback(
    (title: string) => {
      if (!selectedMarkdownId) return;
      updateMutRef.current.mutate({
        nodeId: selectedMarkdownId,
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
        nodeId: selectedSheetId,
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
        nodeId: selectedMindId,
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
        nodeId: selectedSlideId,
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
        nodeId: selectedWhiteboardId,
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
        nodeId: selectedBaseId,
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
          nodeId: docId,
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

  const toggleSidebar = useCallback(() => setSidebarCollapsed((v: boolean) => !v), []);

  const handleAddComment = useCallback(
    (_: string) => setCommentSidebarOpen(true),
    [],
  );

  const handleOpenAi = useCallback(() => {
    const editor = editorRef.current;
    const text = editor ? getEditorPlainText(editor) : "";
    openAiAssistant({
      context: text || undefined,
      contextLabel: selectedDoc?.title || t("header.root"),
    });
  }, [selectedDoc?.title, t]);

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
      const file = await pickWithBridge<VfsFileSelection>(bridge, openModalWindow, {
        component: () => import("../components/VfsFilePickerWindow"),
        title: t("header.root"),
        width: 600,
        height: 480,
      });
      insertVfsFileNode(file);
    } catch (err) {
      if (err instanceof PickCancelled) return;
      throw err;
    }
  }, [bridge, openModalWindow, windowId, insertVfsFileNode]);

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
          t("actions.attachmentUploadFailed", { error: err instanceof Error ? err.message : t("actions.unknownError") }),
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
        nodeId: docId,
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
        nodeId: docId,
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
    saveState,
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
    sidebarNodes,
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
    reloadCurrentDoc,
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
