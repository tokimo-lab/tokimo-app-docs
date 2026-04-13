/**
 * DocsAppPage — Document editor application page.
 *
 * Left sidebar: folder-tree doc navigation (see DocSidebar.tsx)
 * Right area: Plate editor for the selected doc
 */

import { Empty, Spin } from "@tokiomo/components";
import {
  ArrowLeft,
  Clock,
  Download,
  FileType,
  MessageSquare,
  Sparkles,
  Upload,
} from "lucide-react";
import { Component, type ErrorInfo, type ReactNode, useMemo } from "react";
import { CollabPresenceBar } from "@/apps/docs/components/collab/CollabPresenceBar";
import { DocBrowserView } from "@/apps/docs/components/DocBrowserView";
import { DocSidebar } from "@/apps/docs/components/DocSidebar";
import { DocTemplateChooser } from "@/apps/docs/components/DocTemplateChooser";
import {
  DocVersionHistory,
  VersionPreviewBar,
} from "@/apps/docs/components/DocVersionHistory";
import { CommentSidebar } from "@/apps/docs/components/editor/elements/comment-sidebar";
import { MindEditor } from "@/apps/docs/components/mind/MindEditor";
import { SheetEditor } from "@/apps/docs/components/sheet/SheetEditor";
import { SlideEditor } from "@/apps/docs/components/slide/SlideEditor";
import VfsFilePickerModal from "@/apps/docs/components/VfsFilePickerModal";
import { WhiteboardEditor } from "@/apps/docs/components/whiteboard/WhiteboardEditor";
import { apiNodeToLocal, nextUniqueName } from "@/apps/docs/lib/doc-node";
import { useMenuBar } from "@/system";
import { DocBreadcrumb } from "./DocBreadcrumb";
import { DocEditorArea } from "./DocEditorArea";
import { useDocsPage } from "./useDocsPage";

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

export default function DocsAppPage({ spaceId }: { spaceId: string }) {
  return (
    <PageErrorBoundary>
      <DocsAppPageInner spaceId={spaceId} />
    </PageErrorBoundary>
  );
}

function DocsAppPageInner({ spaceId }: { spaceId: string }) {
  const s = useDocsPage(spaceId);

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
                onClick: () => s.handleCreate("notion"),
              },
              {
                key: "md-import",
                label: "从 Markdown 导入",
                icon: <Upload size={14} />,
                onClick: s.handleImportMarkdown,
              },
              {
                key: "md-export",
                label: "导出为 Markdown",
                icon: <Download size={14} />,
                onClick: s.handleExportMarkdown,
              },
              {
                key: "docx-export",
                label: "导出为 Word (.docx)",
                icon: <FileType size={14} />,
                onClick: s.handleExportDocx,
              },
            ],
          },
        ],
      }),
      [
        s.handleCreate,
        s.handleImportMarkdown,
        s.handleExportMarkdown,
        s.handleExportDocx,
      ],
    ),
  );

  if (!s.spaceId) {
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
        spaceId={s.spaceId}
        nodes={s.allNodes}
        isLoadingNodes={s.listQuery.isLoading}
        selectedNodeId={s.selectedNodeId}
        onSelectNode={s.handleSelectNode}
        tab={s.tab}
        onSetTab={s.setTab}
        search={s.search}
        onSetSearch={s.setSearch}
        onCreateNode={s.handleCreate}
        onCreateFolder={(parentId) => {
          if (!s.spaceId) return;
          const title = nextUniqueName(
            s.t("docs.newFolder"),
            s.treeNodes,
            parentId ?? null,
          );
          s.createMutation.mutate({
            spaceId: s.spaceId,
            type: "folder",
            title,
            parentId: parentId ?? undefined,
          });
        }}
        onFavoriteNode={(id) => s.favoriteMutation.mutate({ id })}
        onDeleteNode={(node) => {
          if (
            window.confirm(
              node.type === "folder"
                ? "确定删除此文件夹？子节点将移至上级。"
                : "确定删除？",
            )
          ) {
            s.archiveMutation.mutate({ id: node.id });
            if (s.selectedNodeId === node.id) {
              s.deselectNode();
            }
          }
        }}
        onUpdateNode={(id, title) => s.updateMutation.mutate({ id, title })}
        onMoveNode={(id, parentId, sortOrder) =>
          s.moveMut.mutate({ id, parentId, sortOrder })
        }
        onRestoreNode={(id) => s.restoreMutation.mutate({ id })}
        onPermanentDeleteNode={(id) => {
          if (window.confirm("确定永久删除？此操作不可恢复。")) {
            s.permanentDeleteMutation.mutate({ id });
          }
        }}
        sortField={s.sortField}
        sortDir={s.sortDir}
        onSetSortField={s.setSortField}
        onSetSortDir={s.setSortDir}
        collapsed={s.sidebarCollapsed}
        onToggleCollapsed={s.toggleSidebar}
        filterTags={s.filterTags}
        onSetFilterTags={s.setFilterTags}
      />

      {/* ── Main area ────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {s.selectedSheet ? (
          <>
            {/* Sheet toolbar: back + breadcrumb */}
            <div className="flex items-center gap-1 border-b border-border-subtle px-3 py-1">
              <button
                type="button"
                onClick={() => s.deselectNode()}
                className="mr-1 flex items-center gap-1 rounded px-1.5 py-1 text-xs text-fg-muted transition-colors hover:bg-fill-tertiary hover:text-fg-secondary cursor-pointer"
                title={s.t("docs.backToList")}
              >
                <ArrowLeft size={14} />
              </button>
              <DocBreadcrumb
                doc={s.selectedSheet}
                allNodes={s.allNodes}
                onNavigateFolder={(fid) => s.navigateToNode(fid)}
              />
              <div className="flex-1" />
              <CollabPresenceBar nodeId={s.selectedSheet.id} />
            </div>
            {s.detailQuery.isLoading ? (
              <Spin className="flex-1" />
            ) : (
              <SheetEditor
                key={s.selectedSheet.id}
                content={s.selectedSheet.content}
                onChange={s.handleSheetContentChange}
                nodeId={s.selectedSheet.id}
                userName={s.user?.name}
              />
            )}
          </>
        ) : s.selectedMind ? (
          <>
            {/* Mind map toolbar: back + breadcrumb */}
            <div className="flex items-center gap-1 border-b border-border-subtle px-3 py-1">
              <button
                type="button"
                onClick={() => s.deselectNode()}
                className="mr-1 flex items-center gap-1 rounded px-1.5 py-1 text-xs text-fg-muted transition-colors hover:bg-fill-tertiary hover:text-fg-secondary cursor-pointer"
                title={s.t("docs.backToList")}
              >
                <ArrowLeft size={14} />
              </button>
              <DocBreadcrumb
                doc={s.selectedMind}
                allNodes={s.allNodes}
                onNavigateFolder={(fid) => s.navigateToNode(fid)}
              />
              <div className="flex-1" />
              <CollabPresenceBar nodeId={s.selectedMind.id} />
            </div>
            {s.detailQuery.isLoading ? (
              <Spin className="flex-1" />
            ) : (
              <MindEditor
                key={s.selectedMind.id}
                content={s.selectedMind.content}
                onChange={s.handleMindContentChange}
                nodeId={s.selectedMind.id}
                userName={s.user?.name}
              />
            )}
          </>
        ) : s.selectedSlide ? (
          <>
            <div className="flex items-center gap-1 border-b border-border-subtle px-3 py-1">
              <button
                type="button"
                onClick={() => s.deselectNode()}
                className="mr-1 flex items-center gap-1 rounded px-1.5 py-1 text-xs text-fg-muted transition-colors hover:bg-fill-tertiary hover:text-fg-secondary cursor-pointer"
                title={s.t("docs.backToList")}
              >
                <ArrowLeft size={14} />
              </button>
              <DocBreadcrumb
                doc={s.selectedSlide}
                allNodes={s.allNodes}
                onNavigateFolder={(fid) => s.navigateToNode(fid)}
              />
              <div className="flex-1" />
              <CollabPresenceBar nodeId={s.selectedSlide.id} />
            </div>
            {s.detailQuery.isLoading ? (
              <Spin className="flex-1" />
            ) : (
              <SlideEditor
                key={s.selectedSlide.id}
                content={s.selectedSlide.content}
                onChange={s.handleSlideContentChange}
                nodeId={s.selectedSlide.id}
                userName={s.user?.name}
              />
            )}
          </>
        ) : s.selectedWhiteboard ? (
          <>
            <div className="flex items-center gap-1 border-b border-border-subtle px-3 py-1">
              <button
                type="button"
                onClick={() => s.deselectNode()}
                className="mr-1 flex items-center gap-1 rounded px-1.5 py-1 text-xs text-fg-muted transition-colors hover:bg-fill-tertiary hover:text-fg-secondary cursor-pointer"
                title={s.t("docs.backToList")}
              >
                <ArrowLeft size={14} />
              </button>
              <DocBreadcrumb
                doc={s.selectedWhiteboard}
                allNodes={s.allNodes}
                onNavigateFolder={(fid) => s.navigateToNode(fid)}
              />
              <div className="flex-1" />
              <CollabPresenceBar nodeId={s.selectedWhiteboard.id} />
            </div>
            {s.detailQuery.isLoading ? (
              <Spin className="flex-1" />
            ) : (
              <WhiteboardEditor
                key={s.selectedWhiteboard.id}
                content={s.selectedWhiteboard.content}
                onChange={s.handleWhiteboardContentChange}
                nodeId={s.selectedWhiteboard.id}
                userName={s.user?.name}
              />
            )}
          </>
        ) : s.selectedDoc ? (
          <>
            {/* Toolbar: back + breadcrumb + comment + version history toggles */}
            <div className="flex items-center gap-1 border-b border-border-subtle px-3 py-1">
              <button
                type="button"
                onClick={() => s.deselectNode()}
                className="mr-1 flex items-center gap-1 rounded px-1.5 py-1 text-xs text-fg-muted transition-colors hover:bg-fill-tertiary hover:text-fg-secondary cursor-pointer"
                title="返回文档列表"
              >
                <ArrowLeft size={14} />
              </button>
              <DocBreadcrumb
                doc={s.selectedDoc}
                allNodes={s.allNodes}
                onNavigateFolder={(fid) => s.navigateToNode(fid)}
              />
              <div className="flex-1" />
              <CollabPresenceBar nodeId={s.selectedDoc.id} />
              <button
                type="button"
                onClick={s.handleOpenAi}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-fill-tertiary hover:text-fg-secondary cursor-pointer"
              >
                <Sparkles size={14} />
                AI 助手
              </button>
              <button
                type="button"
                onClick={() => {
                  s.setVersionHistoryOpen((v) => !v);
                  if (s.versionHistoryOpen) s.setPreviewingVersionId(null);
                }}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors cursor-pointer ${
                  s.versionHistoryOpen
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    : "text-fg-muted hover:bg-fill-tertiary hover:text-fg-secondary"
                }`}
              >
                <Clock size={14} />
                版本历史
              </button>
              <button
                type="button"
                onClick={() => s.setCommentSidebarOpen((v) => !v)}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors cursor-pointer ${
                  s.commentSidebarOpen
                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                    : "text-fg-muted hover:bg-fill-tertiary hover:text-fg-secondary"
                }`}
              >
                <MessageSquare size={14} />
                评论
              </button>
            </div>

            {/* Version preview bar */}
            {s.previewingVersionId && s.versionQuery.data && (
              <VersionPreviewBar
                version={s.versionQuery.data.version}
                createdAt={s.versionQuery.data.createdAt}
                onRestore={() => {
                  if (s.selectedDocId && s.previewingVersionId) {
                    s.restoreVersionMutation.mutate({
                      nodeId: s.selectedDocId,
                      versionId: s.previewingVersionId,
                    });
                  }
                }}
                onBack={() => s.setPreviewingVersionId(null)}
                isRestoring={s.restoreVersionMutation.isPending}
              />
            )}
            {/* AI edit undo bar */}
            {s.aiUndoContent && (
              <div className="flex items-center justify-between border-b border-blue-200 bg-blue-50 px-4 py-2 text-sm dark:border-blue-800 dark:bg-blue-950/50">
                <span className="text-blue-700 dark:text-blue-300">
                  <Sparkles size={14} className="mr-1.5 inline" />
                  AI 已修改文档{s.aiUndoSummary ? `：${s.aiUndoSummary}` : ""}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={s.handleAiUndo}
                    className="rounded px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900 cursor-pointer"
                  >
                    撤销
                  </button>
                  <button
                    type="button"
                    onClick={s.dismissAiUndo}
                    className="rounded px-2 py-0.5 text-xs text-fg-muted hover:bg-fill-tertiary cursor-pointer"
                  >
                    确认
                  </button>
                </div>
              </div>
            )}
            {s.previewingVersionId && s.versionQuery.data ? (
              <DocEditorArea
                doc={{
                  ...s.selectedDoc,
                  title: s.versionQuery.data.title,
                  content: s.versionQuery.data.content,
                  wordCount: s.versionQuery.data.wordCount,
                }}
                spaceId={s.spaceId}
                isLoading={s.versionQuery.isLoading}
                onTitleChange={() => {}}
                onContentChange={() => {}}
                onTagsChange={() => {}}
                readOnly
              />
            ) : (
              <DocEditorArea
                doc={s.selectedDoc}
                spaceId={s.spaceId}
                isLoading={s.detailQuery.isLoading}
                onTitleChange={s.handleTitleChange}
                onContentChange={s.handleContentChange}
                onTagsChange={(tags: string[]) => {
                  s.updateMutation.mutate({ id: s.selectedDoc!.id, tags });
                }}
                editorRef={s.editorRef}
                onAddComment={s.handleAddComment}
                onOpenAi={s.handleOpenAi}
                onAiAction={s.handleAiAction}
                onInsertVfsFile={s.handleInsertVfsFile}
              />
            )}
          </>
        ) : (
          <DocBrowserView
            nodes={s.allNodes.map(apiNodeToLocal)}
            currentFolderId={s.currentFolderId}
            onNavigateFolder={(fid) => s.navigateToNode(fid)}
            onOpenDoc={(id) => s.navigateToNode(id)}
            onCreateNode={s.handleCreate}
            onCreateFolder={(parentId) => {
              if (!s.spaceId) return;
              const title = nextUniqueName(
                s.t("docs.newFolder"),
                s.treeNodes,
                parentId ?? null,
              );
              s.createMutation.mutate({
                spaceId: s.spaceId,
                type: "folder",
                title,
                parentId: parentId ?? undefined,
              });
            }}
            onFavoriteNode={(id) => s.favoriteMutation.mutate({ id })}
            onDeleteNode={(id) => s.archiveMutation.mutate({ id })}
            onMoveNode={(id, parentId, sortOrder) =>
              s.moveMut.mutate({ id, parentId, sortOrder })
            }
            onUpdateNode={(id, title) => s.updateMutation.mutate({ id, title })}
            sortField={s.effectiveSortField}
            sortDir={s.effectiveSortDir}
            onSetSortField={s.setSortField}
            onSetSortDir={s.setSortDir}
            isLoading={s.listQuery.isLoading}
            viewMode={s.tab}
          />
        )}
      </div>

      {/* ── Comment sidebar ──────────────────────────────────────────── */}
      {s.selectedDoc && (
        <CommentSidebar
          nodeId={s.selectedDoc.id}
          open={s.commentSidebarOpen}
          onClose={() => s.setCommentSidebarOpen(false)}
        />
      )}

      {/* ── Version history sidebar ──────────────────────────────────── */}
      {s.selectedDoc && (
        <DocVersionHistory
          nodeId={s.selectedDoc.id}
          open={s.versionHistoryOpen}
          onClose={() => s.setVersionHistoryOpen(false)}
          onPreviewVersion={s.setPreviewingVersionId}
          onClearPreview={() => s.setPreviewingVersionId(null)}
          previewingVersionId={s.previewingVersionId}
        />
      )}

      {/* ── Template chooser ──────────────────────────────────────────── */}
      <DocTemplateChooser
        open={s.templateChooserOpen}
        onClose={() => s.setTemplateChooserOpen(false)}
        onSelect={s.handleTemplateSelect}
      />

      {/* ── VFS file picker ──────────────────────────────────────────── */}
      <VfsFilePickerModal
        open={s.vfsPickerOpen}
        onClose={() => s.setVfsPickerOpen(false)}
        onSelect={s.handleVfsFileSelected}
      />
    </div>
  );
}
