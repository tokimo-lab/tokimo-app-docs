import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@tokiomo/components";
import {
  Check,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Reply,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import { api } from "@/generated/rust-api";
import type { DocCommentOutput } from "@/generated/rust-types/index";
import { useAuth } from "@/system";

interface CommentSidebarProps {
  docId: string;
  open: boolean;
  onClose: () => void;
}

export function CommentSidebar({ docId, open, onClose }: CommentSidebarProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const commentsQuery = api.doc.listComments.useQuery(
    { docId },
    { enabled: open && !!docId },
  );

  const comments = commentsQuery.data ?? [];
  const [showResolved, setShowResolved] = useState(false);

  const activeComments = comments.filter((c) => !c.isResolved);
  const resolvedComments = comments.filter((c) => c.isResolved);

  const invalidateComments = useCallback(() => {
    api.doc.listComments.invalidate(queryClient, { docId });
  }, [queryClient, docId]);

  if (!open) return null;

  return (
    <div className="flex w-72 shrink-0 flex-col border-l border-border-base bg-surface-elevated ">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-base px-3 py-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-fg-secondary">
          <MessageSquare className="size-4" />
          <span>评论</span>
          {activeComments.length > 0 && (
            <span className="rounded-full bg-yellow-100 px-1.5 text-xs text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400">
              {activeComments.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-6 items-center justify-center rounded text-fg-muted transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto">
        {commentsQuery.isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-fg-muted">
            加载中…
          </div>
        ) : activeComments.length === 0 && resolvedComments.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-fg-muted">
            <MessageSquare className="size-8" strokeWidth={1} />
            <p className="text-sm">暂无评论</p>
            <p className="px-4 text-center text-xs text-fg-muted">
              选择文本后点击工具栏中的评论按钮添加评论
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Active comments */}
            {activeComments.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                currentUserId={user?.id ?? ""}
                docId={docId}
                onMutated={invalidateComments}
              />
            ))}

            {/* Resolved comments toggle */}
            {resolvedComments.length > 0 && (
              <div className="border-t border-border-base">
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: toggle */}
                {/* biome-ignore lint/a11y/noStaticElementInteractions: toggle */}
                <div
                  className="flex cursor-pointer items-center gap-1.5 px-3 py-2 text-xs text-fg-muted transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                  onClick={() => setShowResolved((v) => !v)}
                >
                  {showResolved ? (
                    <ChevronDown className="size-3" />
                  ) : (
                    <ChevronRight className="size-3" />
                  )}
                  <span>已解决 ({resolvedComments.length})</span>
                </div>
                {showResolved &&
                  resolvedComments.map((comment) => (
                    <CommentThread
                      key={comment.id}
                      comment={comment}
                      currentUserId={user?.id ?? ""}
                      docId={docId}
                      onMutated={invalidateComments}
                      resolved
                    />
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Single comment thread ──────────────────────────────────────────────────

interface CommentThreadProps {
  comment: DocCommentOutput;
  currentUserId: string;
  docId: string;
  onMutated: () => void;
  resolved?: boolean;
}

function CommentThread({
  comment,
  currentUserId,
  docId,
  onMutated,
  resolved,
}: CommentThreadProps) {
  const [replyText, setReplyText] = useState("");
  const [showReplyInput, setShowReplyInput] = useState(false);

  const createMutation = api.doc.createComment.useMutation({
    onSuccess: () => {
      setReplyText("");
      setShowReplyInput(false);
      onMutated();
    },
  });

  const resolveMutation = api.doc.resolveComment.useMutation({
    onSuccess: onMutated,
  });

  const deleteMutation = api.doc.deleteComment.useMutation({
    onSuccess: onMutated,
  });

  const handleReply = useCallback(() => {
    if (!replyText.trim()) return;
    createMutation.mutate({
      docId,
      commentKey: comment.commentKey,
      content: replyText.trim(),
      parentId: comment.id,
    });
  }, [createMutation, docId, comment.commentKey, comment.id, replyText]);

  const handleResolve = useCallback(() => {
    resolveMutation.mutate({ id: comment.id, resolved: !comment.isResolved });
  }, [resolveMutation, comment.id, comment.isResolved]);

  const handleDelete = useCallback(
    (id: string) => {
      deleteMutation.mutate({ id });
    },
    [deleteMutation],
  );

  return (
    <div
      className={cn(
        "border-b border-border-subtle px-3 py-2.5 dark:border-zinc-800",
        resolved && "opacity-60",
      )}
    >
      {/* Main comment */}
      <CommentItem
        comment={comment}
        isOwn={comment.userId === currentUserId}
        onDelete={() => handleDelete(comment.id)}
      />

      {/* Replies */}
      {comment.replies.length > 0 && (
        <div className="ml-3 mt-1.5 border-l-2 border-border-base pl-2.5">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              isOwn={reply.userId === currentUserId}
              onDelete={() => handleDelete(reply.id)}
              isReply
            />
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-1.5 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setShowReplyInput((v) => !v)}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-fg-muted transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <Reply className="size-3" />
          回复
        </button>
        <button
          type="button"
          onClick={handleResolve}
          className={cn(
            "flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors",
            resolved
              ? "text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
              : "text-fg-muted hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300",
          )}
        >
          <Check className="size-3" />
          {resolved ? "重新打开" : "解决"}
        </button>
      </div>

      {/* Reply input */}
      {showReplyInput && (
        <div className="mt-2 flex gap-1.5">
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleReply();
              }
            }}
            placeholder="输入回复…"
            className="flex-1 rounded border border-border-base bg-transparent px-2 py-1 text-xs text-zinc-800 outline-none placeholder:text-fg-muted focus:border-blue-400 dark:text-zinc-200  dark:focus:border-blue-500"
          />
          <button
            type="button"
            onClick={handleReply}
            disabled={!replyText.trim() || createMutation.isPending}
            className="rounded bg-blue-500 px-2 py-1 text-xs text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
          >
            发送
          </button>
        </div>
      )}
    </div>
  );
}

// ── Single comment item ────────────────────────────────────────────────────

function CommentItem({
  comment,
  isOwn,
  onDelete,
  isReply,
}: {
  comment: DocCommentOutput;
  isOwn: boolean;
  onDelete: () => void;
  isReply?: boolean;
}) {
  return (
    <div className={cn("group", isReply && "mt-1.5")}>
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("text-xs font-medium text-fg-secondary")}>
            {comment.userName}
          </span>
          <span className="text-[10px] text-fg-muted">
            {formatTime(comment.createdAt)}
          </span>
        </div>
        {isOwn && (
          <button
            type="button"
            onClick={onDelete}
            className="flex size-5 items-center justify-center rounded text-fg-muted opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            title="删除"
          >
            <Trash2 className="size-3" />
          </button>
        )}
      </div>
      <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">
        {comment.content}
      </p>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin}分钟前`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}小时前`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}天前`;

  return date.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
}
