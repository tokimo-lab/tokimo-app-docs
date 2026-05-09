/**
 * DocsAppPage — Document editor application page.
 *
 * Left sidebar: folder-tree doc navigation (see DocSidebar.tsx)
 * Right area: Plate editor for the selected doc
 */

import { Empty, Spin } from "@tokimo/ui";
import {
  Clock,
  Download,
  FileType,
  MessageSquare,
  Sparkles,
  Upload,
} from "lucide-react";
import { Component, type ErrorInfo, type ReactNode, useMemo } from "react";
import { BaseEditor } from "@/apps/docs/components/base/BaseEditor";
import { CollabPresenceBar } from "@/apps/docs/components/collab/CollabPresenceBar";
import { DocBrowserView } from "@/apps/docs/components/DocBrowserView";
import { DocSidebar } from "@/apps/docs/components/DocSidebar";
import { DocTemplateChooser } from "@/apps/docs/components/DocTemplateChooser";
import {
  DocVersionHistory,
  VersionPreviewBar,
} from "@/apps/docs/components/DocVersionHistory";
import { CommentSidebar } from "@/apps/docs/components/editor/elements/comment-sidebar";
import { MarkdownEditor } from "@/apps/docs/components/markdown/MarkdownEditor";
import { MindEditor } from "@/apps/docs/components/mind/MindEditor";
import { SheetEditor } from "@/apps/docs/components/sheet/SheetEditor";
import { SlideEditor } from "@/apps/docs/components/slide/SlideEditor";
import { WhiteboardEditor } from "@/apps/docs/components/whiteboard/WhiteboardEditor";
import {
  apiNodeToLocal,
  nextUniqueName,
  untitledI18nKey,
} from "@/apps/docs/lib/doc-node";
import { useMenuBar } from "@/system";
import { DocEditorArea } from "./DocEditorArea";
import { DocPageHeader } from "./DocPageHeader";
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

  const goToParent = (relPath: string) => {
    const i = relPath.lastIndexOf("/");
    s.navigateToNode(i > 0 ? relPath.slice(0, i) : null);
  };

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
        nodes={s.listQuery.data?.items ?? []}
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
            parentRelPath: parentId ?? undefined,
          });
        }}
        onFavoriteNode={(id) =>
          s.favoriteMutation.mutate({ relPath: id, spaceId: s.spaceId })
        }
        onDeleteNode={(node) => {
          if (
            window.confirm(
              node.type === "folder"
                ? "确定删除此文件夹？子节点将移至上级。"
                : "确定删除？",
            )
          ) {
            s.archiveMutation.mutate({
              relPath: node.relPath,
              spaceId: s.spaceId,
            });
            if (s.selectedNodeId === node.relPath) {
              s.deselectNode();
            }
          }
        }}
        onUpdateNode={(id, title) =>
          s.updateMutation.mutate({ relPath: id, spaceId: s.spaceId, title })
        }
        onRestoreNode={(id) =>
          s.restoreMutation.mutate({ relPath: id, spaceId: s.spaceId })
        }
        onPermanentDeleteNode={(id) => {
          if (window.confirm("确定永久删除？此操作不可恢复。")) {
            s.permanentDeleteMutation.mutate({
              relPath: id,
              spaceId: s.spaceId,
            });
          }
        }}
        onMoveNode={(from, to) => {
          if (!s.spaceId) return;
          const basename = from.split("/").pop() ?? from;
          const target = to ? `${to}/${basename}` : basename;
          s.moveMut.mutate({ spaceId: s.spaceId, from, to: target });
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
        <DocsMainArea s={s} />
      </div>

      {/* ── Comment sidebar ──────────────────────────────────────────── */}
      {s.selectedDoc && (
        <CommentSidebar
          spaceId={s.spaceId}
          relPath={s.selectedDoc.relPath}
          open={s.commentSidebarOpen}
          onClose={() => s.setCommentSidebarOpen(false)}
        />
      )}

      {/* ── Version history sidebar ──────────────────────────────────── */}
      {s.selectedDoc && (
        <DocVersionHistory
          spaceId={s.spaceId}
          relPath={s.selectedDoc.relPath}
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

      {/* Hidden file input for attachment upload */}
      <input
        ref={s.attachmentInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={s.handleAttachmentFileChange}
      />
    </div>
  );
}
function DocMainLoading() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Spin />
    </div>
  );
}

type DocsPageState = ReturnType<typeof useDocsPage>;

function DocsMainArea({ s }: { s: DocsPageState }) {
  const leaf =
    s.selectedSheet ??
    s.selectedMind ??
    s.selectedSlide ??
    s.selectedWhiteboard ??
    s.selectedBase ??
    s.selectedMarkdown ??
    s.selectedDoc;

  const currentRelPath = leaf?.relPath ?? s.currentFolderId;

  const nodeByPath = useMemo(
    () =>
      new Map(
        s.allNodes.map((n) => [
          n.relPath,
          { title: n.title, icon: n.icon ?? null },
        ]),
      ),
    [s.allNodes],
  );

  const leafInfo = leaf
    ? {
        title: leaf.title || s.t(untitledI18nKey(leaf.type)),
        icon: leaf.icon ?? null,
      }
    : null;

  const onBack = leaf
    ? () => {
        const i = leaf.relPath.lastIndexOf("/");
        s.navigateToNode(i > 0 ? leaf.relPath.slice(0, i) : null);
      }
    : s.currentFolderId
      ? () => {
          const i = (s.currentFolderId ?? "").lastIndexOf("/");
          s.navigateToNode(
            i > 0 ? (s.currentFolderId ?? "").slice(0, i) : null,
          );
        }
      : undefined;

  const viewModeSuffix =
    !leaf && !s.currentFolderId && s.tab !== "all"
      ? (s.tab as "favorites" | "archived")
      : null;

  // Right-side action slot based on current selection type.
  let right: ReactNode = null;
  if (
    leaf &&
    leaf !== s.selectedBase &&
    leaf !== s.selectedMarkdown &&
    leaf !== s.selectedDoc
  ) {
    right = <CollabPresenceBar spaceId={s.spaceId} relPath={leaf.relPath} />;
  }
  if (s.selectedDoc && leaf === s.selectedDoc) {
    right = (
      <>
        <CollabPresenceBar
          spaceId={s.spaceId}
          relPath={s.selectedDoc.relPath}
        />
        <button
          type="button"
          onClick={s.handleOpenAi}
          className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-fill-tertiary hover:text-fg-secondary"
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
          className={`flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
            s.versionHistoryOpen
              ? "bg-[var(--accent-subtle)] text-[var(--accent)] dark:bg-[var(--accent-subtle)] dark:text-[var(--accent)]"
              : "text-fg-muted hover:bg-fill-tertiary hover:text-fg-secondary"
          }`}
        >
          <Clock size={14} />
          版本历史
        </button>
        <button
          type="button"
          onClick={() => s.setCommentSidebarOpen((v) => !v)}
          className={`flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
            s.commentSidebarOpen
              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
              : "text-fg-muted hover:bg-fill-tertiary hover:text-fg-secondary"
          }`}
        >
          <MessageSquare size={14} />
          评论
        </button>
      </>
    );
  }

  return (
    <>
      <DocPageHeader
        currentRelPath={currentRelPath}
        leaf={leafInfo}
        nodeByPath={nodeByPath}
        onNavigateFolder={(rp) => s.navigateToNode(rp)}
        onBack={onBack}
        viewModeSuffix={viewModeSuffix}
        right={right}
      />
      <DocsMainBody s={s} />
    </>
  );
}

function DocsMainBody({ s }: { s: DocsPageState }) {
  if (s.isSelectedNodeLoading) return <DocMainLoading />;

  if (s.selectedSheet) {
    if (s.isEditorLoading) return <DocMainLoading />;
    return (
      <SheetEditor
        key={s.selectedSheet.relPath}
        content={s.selectedSheet.content}
        onChange={s.handleSheetContentChange}
        spaceId={s.spaceId}
        relPath={s.selectedSheet.relPath}
        userName={s.user?.name}
      />
    );
  }

  if (s.selectedMind) {
    if (s.isEditorLoading) return <DocMainLoading />;
    return (
      <MindEditor
        key={s.selectedMind.relPath}
        content={s.selectedMind.content}
        onChange={s.handleMindContentChange}
        spaceId={s.spaceId}
        relPath={s.selectedMind.relPath}
        userName={s.user?.name}
      />
    );
  }

  if (s.selectedSlide) {
    if (s.isEditorLoading) return <DocMainLoading />;
    return (
      <SlideEditor
        key={s.selectedSlide.relPath}
        content={s.selectedSlide.content}
        onChange={s.handleSlideContentChange}
        spaceId={s.spaceId}
        relPath={s.selectedSlide.relPath}
        userName={s.user?.name}
      />
    );
  }

  if (s.selectedWhiteboard) {
    if (s.isEditorLoading) return <DocMainLoading />;
    return (
      <WhiteboardEditor
        key={s.selectedWhiteboard.relPath}
        content={s.selectedWhiteboard.content}
        onChange={s.handleWhiteboardContentChange}
        spaceId={s.spaceId}
        relPath={s.selectedWhiteboard.relPath}
        userName={s.user?.name}
      />
    );
  }

  if (s.selectedBase) {
    if (s.isEditorLoading) return <DocMainLoading />;
    return (
      <BaseEditor
        key={s.selectedBase.relPath}
        spaceId={s.spaceId}
        relPath={s.selectedBase.relPath}
      />
    );
  }

  if (s.selectedMarkdown) {
    if (s.isEditorLoading) return <DocMainLoading />;
    return (
      <MarkdownEditor
        key={s.selectedMarkdown.id}
        spaceId={s.spaceId}
        relPath={s.selectedMarkdown.relPath}
        content={s.markdownText}
        title={s.selectedMarkdown.title}
        onContentChange={s.handleMarkdownContentChange}
        onTitleChange={s.handleMarkdownTitleChange}
      />
    );
  }

  if (s.selectedDoc) {
    return (
      <>
        {s.previewingVersionId && s.versionQuery.data && (
          <VersionPreviewBar
            version={s.versionQuery.data.version}
            createdAt={s.versionQuery.data.createdAt}
            onRestore={() => {
              if (s.selectedDocId && s.previewingVersionId) {
                s.restoreVersionMutation.mutate({
                  spaceId: s.spaceId,
                  relPath: s.selectedDocId,
                  versionId: s.previewingVersionId,
                });
              }
            }}
            onBack={() => s.setPreviewingVersionId(null)}
            isRestoring={s.restoreVersionMutation.isPending}
          />
        )}
        {s.aiUndoContent && (
          <div className="flex items-center justify-between border-b border-[var(--accent)]/30 bg-[var(--accent-subtle)] px-4 py-2 text-sm dark:border-[var(--accent)] dark:bg-[var(--accent-subtle)]">
            <span className="text-[var(--accent)] dark:text-[var(--accent-text)]">
              <Sparkles size={14} className="mr-1.5 inline" />
              AI 已修改文档{s.aiUndoSummary ? `：${s.aiUndoSummary}` : ""}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={s.handleAiUndo}
                className="cursor-pointer rounded px-2 py-0.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-subtle)] dark:text-[var(--accent-text)] dark:hover:bg-[var(--accent-subtle-hover)]"
              >
                撤销
              </button>
              <button
                type="button"
                onClick={s.dismissAiUndo}
                className="cursor-pointer rounded px-2 py-0.5 text-xs text-fg-muted hover:bg-fill-tertiary"
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
            isLoading={s.versionQuery.isLoading || s.versionQuery.isFetching}
            onTitleChange={() => {}}
            onContentChange={() => {}}
            onTagsChange={() => {}}
            readOnly
          />
        ) : (
          <DocEditorArea
            doc={s.selectedDoc}
            spaceId={s.spaceId}
            isLoading={s.isEditorLoading}
            onTitleChange={s.handleTitleChange}
            onContentChange={s.handleContentChange}
            onTagsChange={(tags: string[]) => {
              s.updateMutation.mutate({
                relPath: s.selectedDoc!.relPath,
                spaceId: s.spaceId,
                tags,
              });
            }}
            editorRef={s.editorRef}
            onAddComment={s.handleAddComment}
            onOpenAi={s.handleOpenAi}
            onAiAction={s.handleAiAction}
            onInsertVfsFile={s.handleInsertVfsFile}
            onAttachmentUpload={s.handleAttachmentUpload}
            onDropFiles={(files, insertAt) => {
              for (const file of files) {
                s.uploadAndInsertAttachment(file, insertAt);
              }
            }}
          />
        )}
      </>
    );
  }

  return (
    <DocBrowserView
      nodes={s.browserNodes.map(apiNodeToLocal)}
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
          parentRelPath: parentId ?? undefined,
        });
      }}
      onDeleteNode={(id) =>
        s.archiveMutation.mutate({ relPath: id, spaceId: s.spaceId })
      }
      onUpdateNode={(id, title) =>
        s.updateMutation.mutate({
          relPath: id,
          spaceId: s.spaceId,
          title,
        })
      }
      isLoading={s.browserIsLoading}
      viewMode={s.tab}
      onMoveNode={(from, to) => {
        if (!s.spaceId) return;
        const basename = from.split("/").pop() ?? from;
        const target = to ? `${to}/${basename}` : basename;
        s.moveMut.mutate({ spaceId: s.spaceId, from, to: target });
      }}
    />
  );
}
