import { getCommentKeys } from "@platejs/comment";
import { cn } from "@tokiomo/components";
import type { PlateLeafProps } from "platejs/react";
import { PlateLeaf } from "platejs/react";

export function CommentLeaf({ leaf, className, ...props }: PlateLeafProps) {
  const commentKeys = getCommentKeys(leaf);
  const hasMultiple = commentKeys.length > 1;

  return (
    <PlateLeaf
      {...props}
      leaf={leaf}
      className={cn(
        "border-b-2 border-yellow-400 bg-yellow-100/40 dark:border-yellow-600 dark:bg-yellow-900/30",
        hasMultiple &&
          "border-yellow-500 bg-yellow-200/50 dark:border-yellow-500 dark:bg-yellow-800/40",
        className,
      )}
    />
  );
}
