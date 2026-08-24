/**
 * DocsAppPage — Document editor application page.
 *
 * Left sidebar: folder-tree doc navigation (see DocSidebar.tsx)
 * Right area: Plate editor for the selected doc
 */

import { Empty, Modal, Spin } from "@tokimo/ui";
import {
  Clock,
  Download,
  FileType,
  MessageSquare,
  Sparkles,
  Upload,
} from "lucide-react";
import { useMenuBar } from "@tokimo/sdk";
import {
  Component,
  type ErrorInfo,
  type ReactNode,
  Suspense,
  lazy,
  memo,
  useMemo,
} from "react";
import { useTranslation } from "react-i18next";
import type { DocSpaceOutput } from "../api/generated";
import { CollabPresenceBar } from "../components/collab/CollabPresenceBar";
import { DocBrowserView } from "../components/DocBrowserView";
import { DocSidebar } from "../components/DocSidebar";
import { DocTemplateChooser } from "../components/DocTemplateChooser";
import {
  DocVersionHistory,
  VersionPreviewBar,
} from "../components/DocVersionHistory";
import { CommentSidebar } from "../components/editor/elements/comment-sidebar";
import {
  apiNodeToLocal,
  nextUniqueName,
  untitledI18nKey,
} from "../lib/doc-node";
import { DocEditorArea } from "./DocEditorArea";
import { DocPageHeader } from "./DocPageHeader";
import { useDocsPage } from "./useDocsPage";

const BaseEditor = lazy(() =>
  import("../components/base/BaseEditor").then((module) => ({
    default: module.BaseEditor,
  })),
);
const MarkdownEditor = lazy(() =>
  import("../components/markdown/MarkdownEditor").then((module) => ({
    default: module.MarkdownEditor,
  })),
);
const MindEditor = lazy(() =>
  import("../components/mind/MindEditor").then((module) => ({
    default: module.MindEditor,
  })),
);
const SheetEditor = lazy(() =>
  import("../components/sheet/SheetEditor").then((module) => ({
    default: module.SheetEditor,
  })),
);
const SlideEditor = lazy(() =>
  import("../components/slide/SlideEditor").then((module) => ({
    default: module.SlideEditor,
  })),
);
const WhiteboardEditor = lazy(() =>
  import("../components/whiteboard/WhiteboardEditor").then((module) => ({
    default: module.WhiteboardEditor,
  })),
);

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
        <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-state-danger-text">
          <p className="font-semibold">Page failed to load</p>
          <p className="max-w-lg text-center text-sm text-fg-muted">
            {this.state.error.message}
          </p>
          <button
            type="button"
            className="mt-2 cursor-pointer rounded bg-state-danger-subtle px-3 py-1 text-sm text-state-danger-text"
            onClick={() => this.setState({ error: null })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface DocsAppPageProps {
  spaceId: string;
  spaces: DocSpaceOutput[];
  onSelectSpace: (spaceId: string) => void;
  onCreateSpace: () => void;
  onSpaceSettings: () => void;
}

export default memo(function DocsAppPage(props: DocsAppPageProps) {
  return (
    <PageErrorBoundary>
      <DocsAppPageInner {...props} />
    </PageErrorBoundary>
  );
});

function DocsAppPageInner({
  spaceId,
  spaces,
  onSelectSpace,
  onCreateSpace,
  onSpaceSettings,
}: DocsAppPageProps) {
  const s = useDocsPage(spaceId);
  const { t } = useTranslation();

  // ── Menu bar ───────────────────────────────────────────────────────
  useMenuBar(
    useMemo(
      () => ({
        menus: [
          {
            key: "doc",
            label: t("menuBar.doc"),
            items: [
              {
                key: "new",
                label: t("menuBar.newDocument"),
                shortcut: "⌘N",
                onClick: () => s.handleCreate("notion"),
              },
              {
                key: "md-import",
                label: t("menuBar.importMarkdown"),
                icon: <Upload size={14} />,
                onClick: s.handleImportMarkdown,
              },
              {
                key: "md-export",
                label: t("menuBar.exportMarkdown"),
                icon: <Download size={14} />,
                onClick: s.handleExportMarkdown,
              },
              {
                key: "docx-export",
                label: t("menuBar.exportDocx"),
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
        t,
      ],
    ),
  );

  if (!s.spaceId) {
    return (
      <div className="flex h-full items-center justify-center">
        <Empty description={t("empty.notFound")} />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <DocSidebar
        spaceId={s.spaceId}
        spaces={spaces}
        onSelectSpace={onSelectSpace}
        onCreateSpace={onCreateSpace}
        onSpaceSettings={onSpaceSettings}
        nodes={s.sidebarNodes}
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
                ? t("confirm.deleteFolder")
                : t("confirm.delete"),
            )
          ) {
            s.archiveMutation.mutate({
              relPath: node.relPath,
              spaceId: s.spaceId,
            });
            if (s.selectedNodeId === node.id) {
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
          if (window.confirm(t("confirm.permanentDelete"))) {
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
      <div className="flex flex-1 flex-col overflow-hidden bg-surface-base">
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
          onRestored={s.reloadCurrentDoc}
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
  const { t } = useTranslation();
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
        s.allNodes.map((n: { relPath: string; title: string; icon?: string | null }) => [
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
    (leaf === s.selectedSheet || leaf === s.selectedMind || leaf === s.selectedSlide)
  ) {
    right = <CollabPresenceBar nodeId={leaf.id} saveState={s.saveState} />;
  }
  if (s.selectedDoc && leaf === s.selectedDoc) {
    right = (
      <>
        <CollabPresenceBar
          nodeId={s.selectedDoc.id}
          saveState={s.saveState}
        />
        <button
          type="button"
          onClick={s.handleOpenAi}
          className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-fill-tertiary hover:text-fg-secondary"
        >
          <Sparkles size={14} />
          {t("editor.aiAssistant")}
        </button>
        <button
          type="button"
          onClick={() => {
            s.setVersionHistoryOpen((v: boolean) => !v);
            if (s.versionHistoryOpen) s.setPreviewingVersionId(null);
          }}
          className={`flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
            s.versionHistoryOpen
              ? "bg-accent-subtle text-accent-text"
              : "text-fg-muted hover:bg-fill-tertiary hover:text-fg-secondary"
          }`}
        >
          <Clock size={14} />
          {t("editor.versionHistory")}
        </button>
        <button
          type="button"
          onClick={() => s.setCommentSidebarOpen((v: boolean) => !v)}
          className={`flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
            s.commentSidebarOpen
              ? "bg-accent-subtle text-accent-text"
              : "text-fg-muted hover:bg-fill-tertiary hover:text-fg-secondary"
          }`}
        >
          <MessageSquare size={14} />
          {t("editor.comments")}
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
      <Suspense fallback={<DocMainLoading />}>
        <DocsMainBody s={s} />
      </Suspense>
    </>
  );
}

function DocsMainBody({ s }: { s: DocsPageState }) {
  const { t } = useTranslation();
  if (s.isSelectedNodeLoading) return <DocMainLoading />;

  if (s.selectedSheet) {
    if (s.isEditorLoading) return <DocMainLoading />;
    return (
      <SheetEditor
        key={s.selectedSheet.relPath}
        content={s.selectedSheet.content}
        onChange={s.handleSheetContentChange}
        spaceId={s.spaceId}
        nodeId={s.selectedSheet.id}
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
        nodeId={s.selectedMind.id}
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
        nodeId={s.selectedSlide.id}
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
                const docId = s.selectedDocId;
                const versionId = s.previewingVersionId;
                Modal.confirm({
                  title: t("confirm.restoreVersion"),
                  content: t("confirm.restoreVersionContent"),
                  okText: t("confirm.restore"),
                  cancelText: t("common.cancel"),
                  variant: "warning",
                  onOk: () => {
                    s.restoreVersionMutation.mutate({
                      spaceId: s.spaceId,
                      relPath: s.selectedDoc?.relPath ?? "",
                      versionId,
                    });
                  },
                });
              }
            }}
            onBack={() => s.setPreviewingVersionId(null)}
            isRestoring={s.restoreVersionMutation.isPending}
          />
        )}
        {s.aiUndoContent && (
          <div className="flex items-center justify-between border-b border-accent bg-accent-subtle px-4 py-2 text-sm">
            <span className="text-accent-text">
              <Sparkles size={14} className="mr-1.5 inline" />
              {t("editor.aiModified")}{s.aiUndoSummary ? t("editor.aiSummary", { summary: s.aiUndoSummary }) : ""}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={s.handleAiUndo}
                className="cursor-pointer rounded px-2 py-0.5 text-xs font-medium text-accent-text hover:bg-accent-subtle-hover"
              >
                {t("editor.undo")}
              </button>
              <button
                type="button"
                onClick={s.dismissAiUndo}
                className="cursor-pointer rounded px-2 py-0.5 text-xs text-fg-muted hover:bg-fill-tertiary"
              >
                {t("editor.confirm")}
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
            nodeId={s.selectedDoc.id}
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
