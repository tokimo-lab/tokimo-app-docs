/**
 * DocsAppPage — Document editor application page.
 *
 * Left sidebar: folder-tree doc navigation (see DocSidebar.tsx)
 * Right area: Plate editor for the selected doc
 */

import { deserializeMd, serializeMd } from "@platejs/markdown";
import { useQueryClient } from "@tanstack/react-query";
import { Empty, Spin } from "@tokiomo/components";
import {
  ArrowLeft,
  Clock,
  Download,
  FileType,
  Folder,
  MessageSquare,
  Sparkles,
  Upload,
} from "lucide-react";
import type { TElement, Value } from "platejs";
import {
  Component,
  type ErrorInfo,
  type MutableRefObject,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { CollabPresenceBar } from "@/apps/docs/components/collab/CollabPresenceBar";
import { DocBrowserView } from "@/apps/docs/components/DocBrowserView";
import {
  DocSidebar,
  type SidebarTab,
  type SortDir,
  type SortField,
} from "@/apps/docs/components/DocSidebar";
import { DocTagInput } from "@/apps/docs/components/DocTagInput";
import { DocTemplateChooser } from "@/apps/docs/components/DocTemplateChooser";
import {
  DocVersionHistory,
  VersionPreviewBar,
} from "@/apps/docs/components/DocVersionHistory";
import type { DocTemplate } from "@/apps/docs/components/doc-templates";
import { DocEditor, type DocEditorHandle } from "@/apps/docs/components/editor";
import { CommentSidebar } from "@/apps/docs/components/editor/elements/comment-sidebar";
import { SheetEditor } from "@/apps/docs/components/sheet/SheetEditor";
import VfsFilePickerModal, {
  type VfsFileSelection,
} from "@/apps/docs/components/VfsFilePickerModal";
import type { DocNode, DocNodeType } from "@/apps/docs/lib/doc-node";
import {
  apiNodeToLocal,
  buildNodePath,
  nextUniqueName,
  resolveNodeByPath,
  untitledI18nKey,
} from "@/apps/docs/lib/doc-node";
import type { DocNodeListItem, DocNodeOutput } from "@/generated/rust-api";
import { api } from "@/generated/rust-api";
import { onAiDocumentEdit, openAiAssistant } from "@/lib/ai-assistant-events";
import { useMenuBar, useMessage, useWindowNav } from "@/system";
import { useAuth } from "@/system/auth/useAuth";

class PageErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[DocsAppPage crash]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-red-500">
          <p className="font-semibold">页面加载失败</p>
          <pre className="max-w-lg overflow-auto whitespace-pre-wrap text-xs text-red-400">
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </pre>
          <button
            type="button"
            className="mt-2 rounded bg-red-100 px-3 py-1 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300"
            onClick={() => this.setState({ error: null })}
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function DocsAppPage() {
  return (
    <PageErrorBoundary>
      <DocsAppPageInner />
    </PageErrorBoundary>
  );
}

function DocsAppPageInner() {
  const { metadata, route, navigate, replace } = useWindowNav();
  const appId = metadata.appId as string | undefined;
  const message = useMessage();
  const { t } = useTranslation();
  const { user } = useAuth();

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

  // Override sort for "recent" tab
  const effectiveSortField = tab === "recent" ? "updatedAt" : sortField;
  const effectiveSortDir = tab === "recent" ? "desc" : sortDir;

  // ── Unfiltered tree index (for path ↔ node resolution) ────────────
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

  // Auto-repair route when node path changes (ancestor rename/move)
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
      const path = buildNodePath(node.id, treeNodes);
      navigate(path, node.title);
      setPreviewingVersionId(null);
    },
    [treeNodes, navigate],
  );
  const deselectNode = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const navigateToNode = useCallback(
    (nodeId: string | null) => {
      if (!nodeId) {
        deselectNode();
        return;
      }
      const node = treeNodes.find((n) => n.id === nodeId);
      if (node) {
        selectNode(node);
      } else {
        deselectNode();
      }
    },
    [treeNodes, selectNode, deselectNode],
  );

  // Derived selections
  const selectedDocId = selectedNodeType === "notion" ? selectedNodeId : null;
  const selectedSheetId = selectedNodeType === "sheet" ? selectedNodeId : null;
  const selectedContentNodeId = selectedDocId ?? selectedSheetId;
  const currentFolderId = selectedNodeType === "folder" ? selectedNodeId : null;

  const handleSelectNode = useCallback(
    (node: DocNode) => {
      selectNode(node);
    },
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

  // ── Selected node detail ──────────────────────────────────────────
  const detailQuery = api.docs.getById.useQuery(
    { id: selectedContentNodeId ?? "" },
    { enabled: !!selectedContentNodeId },
  );

  const selectedDoc = selectedDocId ? (detailQuery.data ?? null) : null;
  const selectedSheet = selectedSheetId ? (detailQuery.data ?? null) : null;

  const queryClient = useQueryClient();

  // ── Version preview ────────────────────────────────────────────────
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

  // ── Mutations (unified for all node types) ──────────────────────────
  const selectNodeRef = useRef(selectNode);
  selectNodeRef.current = selectNode;
  const deselectNodeRef = useRef(deselectNode);
  deselectNodeRef.current = deselectNode;

  const createMutation = api.docs.create.useMutation({
    onSuccess: (node: DocNodeOutput) => {
      if (node.type !== "folder") {
        selectNodeRef.current(node);
      }
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

  // ── Node mutations (unified for all types) ─────────────────────────
  const moveMut = api.docs.move.useMutation({
    onSuccess: () => {
      listQuery.refetch();
      treeQuery.refetch();
      message.success("已移动");
    },
    onError: () => message.error("移动失败"),
  });

  // ── Refs for stable callbacks (avoid infinite useMenuBar re-register) ──
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

  // ── Handlers ───────────────────────────────────────────────────────
  const handleCreate = useCallback(
    (type: DocNodeType, parentId?: string) => {
      if (type === "notion") {
        setPendingParentId(parentId);
        setTemplateChooserOpen(true);
      } else {
        // sheet / folder — create directly without template chooser
        const { appId: id, treeNodes: nodes } = stateRef.current;
        if (!id) return;
        const baseName = t(untitledI18nKey(type));
        const title = nextUniqueName(baseName, nodes, parentId ?? null);
        createMutRef.current.mutate({
          appId: id,
          type,
          title,
          parentId,
        });
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

  // ── Debounced auto-save ─────────────────────────────────────────
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
      updateMutRef.current.mutate({
        id: selectedSheetId,
        content: snapshot,
      });
    },
    [selectedSheetId],
  );

  // ── Markdown export/import ─────────────────────────────────────────
  const handleExportMarkdown = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const md = serializeMd(editor, { value: editor.children });
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${stateRef.current.selectedDocTitle || "notion"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImportMarkdown = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.markdown,.txt";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const mdText = reader.result as string;
        const value = deserializeMd(editor, mdText);
        const docId = stateRef.current.selectedDocId;
        if (docId) {
          await updateMutRef.current.mutateAsync({
            id: docId,
            content: value,
          });
          await detailQueryRef.current.refetch();
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  // ── DOCX export ──────────────────────────────────────────────────────
  const handleExportDocx = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;
    const { exportDocx } = await import(
      "@/apps/docs/components/export/serialize-docx"
    );
    await exportDocx(
      editor.children,
      stateRef.current.selectedDocTitle || "notion",
    );
  }, []);

  const toggleSidebar = useCallback(() => setSidebarCollapsed((v) => !v), []);

  const handleAddComment = useCallback((_commentKey: string) => {
    setCommentSidebarOpen(true);
  }, []);

  /** Extract plain text from the editor for AI context. */
  const getEditorText = useCallback((): string => {
    const editor = editorRef.current;
    if (!editor?.children) return "";
    const extractText = (nodes: unknown[]): string =>
      nodes
        .map((node: unknown) => {
          const n = node as Record<string, unknown>;
          if (typeof n.text === "string") return n.text;
          if (Array.isArray(n.children)) return extractText(n.children);
          return "";
        })
        .join("\n");
    return extractText(editor.children as unknown[]);
  }, []);

  const handleOpenAi = useCallback(() => {
    const text = getEditorText();
    openAiAssistant({
      context: text || undefined,
      contextLabel: selectedDoc?.title || "文档",
    });
  }, [getEditorText, selectedDoc?.title]);

  /** Get selected text from the editor. */
  const getSelectedText = useCallback((): string => {
    const editor = editorRef.current;
    if (!editor?.selection) return "";
    try {
      const domSelection = window.getSelection();
      return domSelection?.toString() ?? "";
    } catch {
      return "";
    }
  }, []);

  const handleAiAction = useCallback(
    (actionId: string) => {
      const selected = getSelectedText();
      const full = getEditorText();

      const actionPrompts: Record<
        string,
        { build: (sel: string, doc: string) => string }
      > = {
        improve: {
          build: (s) => `请帮我润色优化以下文本：\n\n${s}`,
        },
        continue: {
          build: (_, d) => `请从以下文本继续写作：\n\n${d.slice(-2000)}`,
        },
        summarize: {
          build: (_, d) => `请总结以下文档：\n\n${d}`,
        },
        "translate-en": {
          build: (s) => `请将以下文本翻译为英文：\n\n${s}`,
        },
      };

      const prompt = actionPrompts[actionId];
      if (prompt) {
        const text = prompt.build(selected, full);
        openAiAssistant({ message: text, autoSend: true });
      } else {
        openAiAssistant();
      }
    },
    [getSelectedText, getEditorText],
  );

  const handleInsertVfsFile = useCallback(() => {
    setVfsPickerOpen(true);
  }, []);

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

      // Save current content for undo
      setAiUndoContent([...editor.children] as Value);
      setAiUndoSummary(summary);

      // Convert AI markdown → Plate Value, persist, then refetch to re-render editor
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

  // ── Menu bar ───────────────────────────────────────────────────────
  useMenuBar(
    useMemo(
      () => ({
        menus: [
          {
            key: "doc",
            label: "文档",
            items: [
              {
                key: "new",
                label: "新建文档",
                shortcut: "⌘N",
                onClick: () => handleCreate("notion"),
              },
              {
                key: "md-import",
                label: "从 Markdown 导入",
                icon: <Upload size={14} />,
                onClick: handleImportMarkdown,
              },
              {
                key: "md-export",
                label: "导出为 Markdown",
                icon: <Download size={14} />,
                onClick: handleExportMarkdown,
              },
              {
                key: "docx-export",
                label: "导出为 Word (.docx)",
                icon: <FileType size={14} />,
                onClick: handleExportDocx,
              },
            ],
          },
        ],
      }),
      [
        handleCreate,
        handleImportMarkdown,
        handleExportMarkdown,
        handleExportDocx,
      ],
    ),
  );

  if (!appId) {
    return (
      <div className="flex h-full items-center justify-center">
        <Empty description="未找到应用" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <DocSidebar
        appId={appId}
        nodes={allNodes}
        isLoadingNodes={listQuery.isLoading}
        selectedNodeId={selectedNodeId}
        onSelectNode={handleSelectNode}
        tab={tab}
        onSetTab={setTab}
        search={search}
        onSetSearch={setSearch}
        onCreateNode={handleCreate}
        onCreateFolder={(parentId) => {
          if (!appId) return;
          const title = nextUniqueName(
            t("docs.newFolder"),
            treeNodes,
            parentId ?? null,
          );
          createMutation.mutate({
            appId,
            type: "folder",
            title,
            parentId: parentId ?? undefined,
          });
        }}
        onFavoriteNode={(id) => favoriteMutation.mutate({ id })}
        onDeleteNode={(node) => {
          if (
            window.confirm(
              node.type === "folder"
                ? "确定删除此文件夹？子节点将移至上级。"
                : "确定删除？",
            )
          ) {
            archiveMutation.mutate({ id: node.id });
            if (selectedNodeId === node.id) {
              deselectNode();
            }
          }
        }}
        onUpdateNode={(id, title) => updateMutation.mutate({ id, title })}
        onMoveNode={(id, parentId, sortOrder) =>
          moveMut.mutate({ id, parentId, sortOrder })
        }
        onRestoreNode={(id) => restoreMutation.mutate({ id })}
        onPermanentDeleteNode={(id) => {
          if (window.confirm("确定永久删除？此操作不可恢复。")) {
            permanentDeleteMutation.mutate({ id });
          }
        }}
        sortField={sortField}
        sortDir={sortDir}
        onSetSortField={setSortField}
        onSetSortDir={setSortDir}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebar}
        filterTags={filterTags}
        onSetFilterTags={setFilterTags}
      />

      {/* ── Main area ────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {selectedSheet ? (
          <>
            {/* Sheet toolbar: back + breadcrumb */}
            <div className="flex items-center gap-1 border-b border-border-subtle px-3 py-1">
              <button
                type="button"
                onClick={() => {
                  deselectNode();
                }}
                className="mr-1 flex items-center gap-1 rounded px-1.5 py-1 text-xs text-fg-muted transition-colors hover:bg-fill-tertiary hover:text-fg-secondary cursor-pointer"
                title={t("docs.backToList")}
              >
                <ArrowLeft size={14} />
              </button>
              <DocBreadcrumb
                doc={selectedSheet}
                allNodes={allNodes}
                onNavigateFolder={(fid) => {
                  navigateToNode(fid);
                }}
              />
              <div className="flex-1" />
              <CollabPresenceBar nodeId={selectedSheet.id} />
            </div>
            {detailQuery.isLoading ? (
              <Spin className="flex-1" />
            ) : (
              <SheetEditor
                key={selectedSheet.id}
                content={selectedSheet.content}
                onChange={handleSheetContentChange}
                nodeId={selectedSheet.id}
                userName={user?.name}
              />
            )}
          </>
        ) : selectedDoc ? (
          <>
            {/* Toolbar: back + breadcrumb + comment + version history toggles */}
            <div className="flex items-center gap-1 border-b border-border-subtle px-3 py-1">
              <button
                type="button"
                onClick={() => {
                  deselectNode();
                }}
                className="mr-1 flex items-center gap-1 rounded px-1.5 py-1 text-xs text-fg-muted transition-colors hover:bg-fill-tertiary hover:text-fg-secondary"
                title="返回文档列表"
              >
                <ArrowLeft size={14} />
              </button>
              {/* Breadcrumb */}
              <DocBreadcrumb
                doc={selectedDoc}
                allNodes={allNodes}
                onNavigateFolder={(fid) => {
                  navigateToNode(fid);
                }}
              />
              <div className="flex-1" />
              <CollabPresenceBar nodeId={selectedDoc.id} />
              <button
                type="button"
                onClick={handleOpenAi}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-fill-tertiary hover:text-fg-secondary"
              >
                <Sparkles size={14} />
                AI 助手
              </button>
              <button
                type="button"
                onClick={() => {
                  setVersionHistoryOpen((v) => !v);
                  if (versionHistoryOpen) setPreviewingVersionId(null);
                }}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
                  versionHistoryOpen
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    : "text-fg-muted hover:bg-fill-tertiary hover:text-fg-secondary"
                }`}
              >
                <Clock size={14} />
                版本历史
              </button>
              <button
                type="button"
                onClick={() => setCommentSidebarOpen((v) => !v)}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
                  commentSidebarOpen
                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                    : "text-fg-muted hover:bg-fill-tertiary hover:text-fg-secondary"
                }`}
              >
                <MessageSquare size={14} />
                评论
              </button>
            </div>

            {/* Version preview bar */}
            {previewingVersionId && versionQuery.data && (
              <VersionPreviewBar
                version={versionQuery.data.version}
                createdAt={versionQuery.data.createdAt}
                onRestore={() => {
                  if (selectedDocId && previewingVersionId) {
                    restoreVersionMutation.mutate({
                      nodeId: selectedDocId,
                      versionId: previewingVersionId,
                    });
                  }
                }}
                onBack={() => setPreviewingVersionId(null)}
                isRestoring={restoreVersionMutation.isPending}
              />
            )}
            {/* AI edit undo bar */}
            {aiUndoContent && (
              <div className="flex items-center justify-between border-b border-blue-200 bg-blue-50 px-4 py-2 text-sm dark:border-blue-800 dark:bg-blue-950/50">
                <span className="text-blue-700 dark:text-blue-300">
                  <Sparkles size={14} className="mr-1.5 inline" />
                  AI 已修改文档{aiUndoSummary ? `：${aiUndoSummary}` : ""}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAiUndo}
                    className="rounded px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900"
                  >
                    撤销
                  </button>
                  <button
                    type="button"
                    onClick={dismissAiUndo}
                    className="rounded px-2 py-0.5 text-xs text-fg-muted hover:bg-fill-tertiary "
                  >
                    确认
                  </button>
                </div>
              </div>
            )}
            {previewingVersionId && versionQuery.data ? (
              <DocEditorArea
                doc={{
                  ...selectedDoc,
                  title: versionQuery.data.title,
                  content: versionQuery.data.content,
                  wordCount: versionQuery.data.wordCount,
                }}
                appId={appId}
                isLoading={versionQuery.isLoading}
                onTitleChange={() => {}}
                onContentChange={() => {}}
                onTagsChange={() => {}}
                readOnly
              />
            ) : (
              <DocEditorArea
                doc={selectedDoc}
                appId={appId}
                isLoading={detailQuery.isLoading}
                onTitleChange={handleTitleChange}
                onContentChange={handleContentChange}
                onTagsChange={(tags: string[]) => {
                  updateMutation.mutate({ id: selectedDoc.id, tags });
                }}
                editorRef={editorRef}
                onAddComment={handleAddComment}
                onOpenAi={handleOpenAi}
                onAiAction={handleAiAction}
                onInsertVfsFile={handleInsertVfsFile}
              />
            )}
          </>
        ) : (
          <DocBrowserView
            nodes={allNodes.map(apiNodeToLocal)}
            currentFolderId={currentFolderId}
            onNavigateFolder={(fid) => {
              navigateToNode(fid);
            }}
            onOpenDoc={(id, _type) => {
              navigateToNode(id);
            }}
            onCreateNode={handleCreate}
            onCreateFolder={(parentId) => {
              if (!appId) return;
              const title = nextUniqueName(
                t("docs.newFolder"),
                treeNodes,
                parentId ?? null,
              );
              createMutation.mutate({
                appId,
                type: "folder",
                title,
                parentId: parentId ?? undefined,
              });
            }}
            onFavoriteNode={(id) => favoriteMutation.mutate({ id })}
            onDeleteNode={(id) => archiveMutation.mutate({ id })}
            onMoveNode={(id, parentId, sortOrder) =>
              moveMut.mutate({ id, parentId, sortOrder })
            }
            onUpdateNode={(id, title) => updateMutation.mutate({ id, title })}
            sortField={effectiveSortField}
            sortDir={effectiveSortDir}
            onSetSortField={setSortField}
            onSetSortDir={setSortDir}
            isLoading={listQuery.isLoading}
            viewMode={tab}
          />
        )}
      </div>

      {/* ── Comment sidebar ──────────────────────────────────────────── */}
      {selectedDoc && (
        <CommentSidebar
          nodeId={selectedDoc.id}
          open={commentSidebarOpen}
          onClose={() => setCommentSidebarOpen(false)}
        />
      )}

      {/* ── Version history sidebar ──────────────────────────────────── */}
      {selectedDoc && (
        <DocVersionHistory
          nodeId={selectedDoc.id}
          open={versionHistoryOpen}
          onClose={() => setVersionHistoryOpen(false)}
          onPreviewVersion={setPreviewingVersionId}
          onClearPreview={() => setPreviewingVersionId(null)}
          previewingVersionId={previewingVersionId}
        />
      )}

      {/* ── Template chooser ──────────────────────────────────────────── */}
      <DocTemplateChooser
        open={templateChooserOpen}
        onClose={() => setTemplateChooserOpen(false)}
        onSelect={handleTemplateSelect}
      />

      {/* ── VFS file picker ──────────────────────────────────────────── */}
      <VfsFilePickerModal
        open={vfsPickerOpen}
        onClose={() => setVfsPickerOpen(false)}
        onSelect={handleVfsFileSelected}
      />
    </div>
  );
}

// ── Editor area with title ─────────────────────────────────────────────────

function DocEditorArea({
  doc,
  appId,
  isLoading,
  onTitleChange,
  onContentChange,
  onTagsChange,
  editorRef,
  onAddComment,
  onOpenAi,
  onAiAction,
  onInsertVfsFile,
  readOnly,
}: {
  doc: DocNodeOutput;
  appId: string;
  isLoading: boolean;
  onTitleChange: (title: string) => void;
  onContentChange: (value: Value) => void;
  onTagsChange: (tags: string[]) => void;
  editorRef?: MutableRefObject<DocEditorHandle | null>;
  onAddComment?: (commentKey: string) => void;
  onOpenAi?: () => void;
  onAiAction?: (actionId: string) => void;
  onInsertVfsFile?: () => void;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [title, setTitle] = useState(doc.title);

  // Sync title when doc changes
  const [prevId, setPrevId] = useState(doc.id);
  const [prevTitle, setPrevTitle] = useState(doc.title);
  if (doc.id !== prevId || doc.title !== prevTitle) {
    setPrevId(doc.id);
    setPrevTitle(doc.title);
    setTitle(doc.title);
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spin />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Title input */}
      <div className="mx-auto w-full max-w-3xl px-6 pt-12 pb-2">
        <input
          type="text"
          value={title}
          readOnly={readOnly}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (!readOnly && title !== doc.title) {
              onTitleChange(title);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="w-full border-none bg-transparent text-4xl font-bold text-fg-primary outline-none placeholder:text-fg-muted  "
          placeholder={t(untitledI18nKey(doc.type))}
        />
      </div>

      {/* Tags */}
      {!readOnly && (
        <div className="mx-auto w-full max-w-3xl px-6 pb-2">
          <DocTagInput
            nodeId={doc.id}
            appId={appId}
            tags={doc.tags}
            onChange={onTagsChange}
          />
        </div>
      )}

      {/* Plate editor */}
      <div className="flex-1">
        <DocEditor
          key={readOnly ? `preview-${doc.id}` : doc.id}
          value={doc.content as Value | null}
          onChange={readOnly ? () => {} : onContentChange}
          editorRef={readOnly ? undefined : editorRef}
          onAddComment={readOnly ? undefined : onAddComment}
          onOpenAi={readOnly ? undefined : onOpenAi}
          onAiAction={readOnly ? undefined : onAiAction}
          onInsertVfsFile={readOnly ? undefined : onInsertVfsFile}
          readOnly={readOnly}
          nodeId={readOnly ? undefined : doc.id}
          userName={user?.name}
        />
      </div>
    </div>
  );
}

// ── Breadcrumb ─────────────────────────────────────────────────────────────

function DocBreadcrumb({
  doc,
  allNodes,
  onNavigateFolder,
}: {
  doc: DocNodeOutput;
  allNodes: DocNodeListItem[];
  onNavigateFolder?: (folderId: string | null) => void;
}) {
  const { t } = useTranslation();
  const path = useMemo(() => {
    if (!doc.parentId) return [];
    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));
    const result: DocNodeListItem[] = [];
    let current = nodeMap.get(doc.parentId);
    while (current) {
      result.unshift(current);
      current = current.parentId ? nodeMap.get(current.parentId) : undefined;
    }
    return result;
  }, [doc.parentId, allNodes]);

  return (
    <div className="flex items-center gap-1 text-xs text-fg-muted">
      <Folder size={12} />
      <button
        type="button"
        className="hover:text-fg-secondary"
        onClick={() => onNavigateFolder?.(null)}
      >
        知识库
      </button>
      {path.map((node) => (
        <span key={node.id} className="flex items-center gap-1">
          <span className="text-fg-muted">/</span>
          <button
            type="button"
            className="hover:text-fg-secondary"
            onClick={() => onNavigateFolder?.(node.id)}
          >
            {node.icon ? `${node.icon} ` : ""}
            {node.title}
          </button>
        </span>
      ))}
      <span className="text-fg-muted">/</span>
      <span className="text-fg-secondary">
        {doc.icon ? `${doc.icon} ` : ""}
        {doc.title || t(untitledI18nKey(doc.type))}
      </span>
    </div>
  );
}
