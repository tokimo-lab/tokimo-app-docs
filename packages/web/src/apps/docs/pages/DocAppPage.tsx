/**
 * DocAppPage — Document editor application page.
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
import VfsFilePickerModal, {
  type VfsFileSelection,
} from "@/apps/docs/components/VfsFilePickerModal";
import type { DocFolderOutput, DocOutput } from "@/generated/rust-api";
import { api } from "@/generated/rust-api";
import { onAiDocumentEdit, openAiAssistant } from "@/lib/ai-assistant-events";
import { useMenuBar, useMessage, useWindowNav } from "@/system";

class PageErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[DocAppPage crash]", error, info.componentStack);
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

export default function DocAppPage() {
  return (
    <PageErrorBoundary>
      <DocAppPageInner />
    </PageErrorBoundary>
  );
}

function DocAppPageInner() {
  const { metadata } = useWindowNav();
  const appId = metadata.appId as string | undefined;
  const message = useMessage();

  const [tab, setTab] = useState<SidebarTab>("all");
  const [search, setSearch] = useState("");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
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
  const [pendingFolderId, setPendingFolderId] = useState<string | undefined>();
  const [vfsPickerOpen, setVfsPickerOpen] = useState(false);
  const editorRef = useRef<DocEditorHandle | null>(null);

  // Override sort for "recent" tab
  const effectiveSortField = tab === "recent" ? "updatedAt" : sortField;
  const effectiveSortDir = tab === "recent" ? "desc" : sortDir;

  // ── Doc list query ─────────────────────────────────────────────────
  const listQuery = api.doc.list.useQuery(
    {
      appId: appId ?? "",
      pageSize: 200,
      sortBy: effectiveSortField,
      sortDir: effectiveSortDir,
      search: search || undefined,
      favoritesOnly: tab === "favorites" ? true : undefined,
      tags: filterTags.length > 0 ? filterTags.join(",") : undefined,
      archived: tab === "trash" ? true : undefined,
    },
    { enabled: !!appId },
  );

  const docs = useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);

  // ── Folders (for breadcrumb) ───────────────────────────────────────
  const foldersQuery = api.doc.listFolders.useQuery(
    { appId: appId ?? "" },
    { enabled: !!appId },
  );
  const folders = foldersQuery.data ?? [];

  // ── Selected doc detail ────────────────────────────────────────────
  const detailQuery = api.doc.getById.useQuery(
    { id: selectedDocId ?? "" },
    { enabled: !!selectedDocId },
  );

  const selectedDoc = detailQuery.data ?? null;

  const queryClient = useQueryClient();

  // ── Version preview ────────────────────────────────────────────────
  const versionQuery = api.doc.getVersion.useQuery(
    { versionId: previewingVersionId ?? "" },
    { enabled: !!previewingVersionId },
  );

  const restoreVersionMutation = api.doc.restoreVersion.useMutation({
    onSuccess: () => {
      message.success("版本已恢复");
      setPreviewingVersionId(null);
      detailQuery.refetch();
      listQuery.refetch();
      api.doc.listVersions.invalidate(queryClient, {
        docId: selectedDocId ?? "",
      });
    },
    onError: () => message.error("恢复失败"),
  });

  // ── Mutations ──────────────────────────────────────────────────────
  const createMutation = api.doc.create.useMutation({
    onSuccess: (doc: DocOutput) => {
      setSelectedDocId(doc.id);
      listQuery.refetch();
    },
    onError: () => message.error("创建文档失败"),
  });

  const updateMutation = api.doc.update.useMutation({
    onSuccess: () => listQuery.refetch(),
  });

  const deleteMutation = api.doc.delete.useMutation({
    onSuccess: () => {
      setSelectedDocId(null);
      listQuery.refetch();
      message.success("文档已删除");
    },
    onError: () => message.error("删除失败"),
  });

  const restoreMutation = api.doc.restore.useMutation({
    onSuccess: () => {
      setSelectedDocId(null);
      listQuery.refetch();
      message.success("文档已恢复");
    },
    onError: () => message.error("恢复失败"),
  });

  const permanentDeleteMutation = api.doc.permanentDelete.useMutation({
    onSuccess: () => {
      setSelectedDocId(null);
      listQuery.refetch();
      message.success("文档已永久删除");
    },
    onError: () => message.error("删除失败"),
  });

  const favoriteMutation = api.doc.toggleFavorite.useMutation({
    onSuccess: () => listQuery.refetch(),
  });

  // ── Folder mutations (shared between sidebar & browser view) ──────
  const createFolderMut = api.doc.createFolder.useMutation({
    onSuccess: () => {
      foldersQuery.refetch();
      message.success("文件夹已创建");
    },
    onError: () => message.error("创建文件夹失败"),
  });
  const updateFolderMut = api.doc.updateFolder.useMutation({
    onSuccess: () => foldersQuery.refetch(),
  });
  const deleteFolderMut = api.doc.deleteFolder.useMutation({
    onSuccess: () => {
      foldersQuery.refetch();
      listQuery.refetch();
      message.success("文件夹已删除");
    },
    onError: () => message.error("删除文件夹失败"),
  });
  const moveMut = api.doc.move.useMutation({
    onSuccess: () => {
      listQuery.refetch();
      message.success("文档已移动");
    },
    onError: () => message.error("移动失败"),
  });

  // ── Refs for stable callbacks (avoid infinite useMenuBar re-register) ──
  const stateRef = useRef({
    appId,
    selectedDocId,
    selectedDocTitle: selectedDoc?.title,
  });
  stateRef.current = {
    appId,
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
  const handleCreate = useCallback((folderId?: string) => {
    setPendingFolderId(folderId);
    setTemplateChooserOpen(true);
  }, []);

  const handleTemplateSelect = useCallback(
    (template: DocTemplate) => {
      const { appId: id } = stateRef.current;
      if (!id) return;
      const title = template.title || undefined;
      createMutRef.current.mutate(
        { appId: id, folderId: pendingFolderId, title },
        {
          onSuccess: (doc: DocOutput) => {
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
    [pendingFolderId],
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

  // ── Markdown export/import ─────────────────────────────────────────
  const handleExportMarkdown = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const md = serializeMd(editor, { value: editor.children });
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${stateRef.current.selectedDocTitle || "document"}.md`;
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
      stateRef.current.selectedDocTitle || "document",
    );
  }, []);

  const handleRefreshDocs = useCallback(() => {
    listQuery.refetch();
  }, [listQuery]);

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
                onClick: handleCreate,
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
        docs={docs}
        isLoadingDocs={listQuery.isLoading}
        selectedDocId={selectedDocId}
        onSelectDoc={(id) => {
          setSelectedDocId(id);
          setPreviewingVersionId(null);
        }}
        tab={tab}
        onSetTab={setTab}
        search={search}
        onSetSearch={setSearch}
        onCreateDoc={handleCreate}
        isCreatingDoc={createMutation.isPending}
        onFavoriteDoc={(id) => favoriteMutation.mutate({ id })}
        onDeleteDoc={(id) => deleteMutation.mutate({ id })}
        onRestoreDoc={(id) => restoreMutation.mutate({ id })}
        onPermanentDeleteDoc={(id) => {
          if (window.confirm("确定永久删除此文档？此操作不可恢复。")) {
            permanentDeleteMutation.mutate({ id });
          }
        }}
        onRefreshDocs={handleRefreshDocs}
        sortField={sortField}
        sortDir={sortDir}
        onSetSortField={setSortField}
        onSetSortDir={setSortDir}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebar}
        filterTags={filterTags}
        onSetFilterTags={setFilterTags}
        currentFolderId={currentFolderId}
        onNavigateFolder={(fid) => {
          setCurrentFolderId(fid);
          setSelectedDocId(null);
        }}
      />

      {/* ── Main area ────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {selectedDoc ? (
          <>
            {/* Toolbar: back + breadcrumb + comment + version history toggles */}
            <div className="flex items-center gap-1 border-b border-border-subtle px-3 py-1">
              <button
                type="button"
                onClick={() => setSelectedDocId(null)}
                className="mr-1 flex items-center gap-1 rounded px-1.5 py-1 text-xs text-fg-muted transition-colors hover:bg-fill-tertiary hover:text-fg-secondary"
                title="返回文档列表"
              >
                <ArrowLeft size={14} />
              </button>
              {/* Breadcrumb */}
              <DocBreadcrumb
                doc={selectedDoc}
                folders={folders}
                onNavigateFolder={(fid) => {
                  setCurrentFolderId(fid);
                  setSelectedDocId(null);
                }}
              />
              <div className="flex-1" />
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
                      docId: selectedDocId,
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
            docs={docs}
            folders={folders}
            currentFolderId={currentFolderId}
            onNavigateFolder={setCurrentFolderId}
            onOpenDoc={(id) => {
              setSelectedDocId(id);
              setPreviewingVersionId(null);
            }}
            onCreateDoc={handleCreate}
            onCreateFolder={(parentId) => {
              if (!appId) return;
              createFolderMut.mutate({
                appId,
                name: "新文件夹",
                parentId: parentId ?? null,
              });
            }}
            onFavoriteDoc={(id) => favoriteMutation.mutate({ id })}
            onDeleteDoc={(id) => deleteMutation.mutate({ id })}
            onMoveDoc={(docId, folderId) =>
              moveMut.mutate({ id: docId, folderId })
            }
            onRenameFolder={(id, name) => updateFolderMut.mutate({ id, name })}
            onDeleteFolder={(id) => {
              deleteFolderMut.mutate({ id });
              if (currentFolderId === id) setCurrentFolderId(null);
            }}
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
          docId={selectedDoc.id}
          open={commentSidebarOpen}
          onClose={() => setCommentSidebarOpen(false)}
        />
      )}

      {/* ── Version history sidebar ──────────────────────────────────── */}
      {selectedDoc && (
        <DocVersionHistory
          docId={selectedDoc.id}
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
  doc: DocOutput;
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
          placeholder="无标题"
        />
      </div>

      {/* Tags */}
      {!readOnly && (
        <div className="mx-auto w-full max-w-3xl px-6 pb-2">
          <DocTagInput
            docId={doc.id}
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
        />
      </div>
    </div>
  );
}

// ── Breadcrumb ─────────────────────────────────────────────────────────────

function DocBreadcrumb({
  doc,
  folders,
  onNavigateFolder,
}: {
  doc: DocOutput;
  folders: DocFolderOutput[];
  onNavigateFolder?: (folderId: string | null) => void;
}) {
  const path = useMemo(() => {
    if (!doc.folderId) return [];
    const folderMap = new Map(folders.map((f) => [f.id, f]));
    const result: DocFolderOutput[] = [];
    let current = folderMap.get(doc.folderId);
    while (current) {
      result.unshift(current);
      current = current.parentId ? folderMap.get(current.parentId) : undefined;
    }
    return result;
  }, [doc.folderId, folders]);

  return (
    <div className="flex items-center gap-1 text-xs text-fg-muted">
      <Folder size={12} />
      <button
        type="button"
        className="hover:text-fg-secondary"
        onClick={() => onNavigateFolder?.(null)}
      >
        文档
      </button>
      {path.map((folder) => (
        <span key={folder.id} className="flex items-center gap-1">
          <span className="text-fg-muted">/</span>
          <button
            type="button"
            className="hover:text-fg-secondary"
            onClick={() => onNavigateFolder?.(folder.id)}
          >
            {folder.icon ? `${folder.icon} ` : ""}
            {folder.name}
          </button>
        </span>
      ))}
      <span className="text-fg-muted">/</span>
      <span className="text-fg-secondary">
        {doc.icon ? `${doc.icon} ` : ""}
        {doc.title || "无标题"}
      </span>
    </div>
  );
}
