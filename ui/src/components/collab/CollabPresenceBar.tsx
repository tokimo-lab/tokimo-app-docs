/**
 * CollabPresenceBar — Shows online collaborators and connection status.
 *
 * Renders a row of user avatars (max 5 + overflow count) and a small
 * connection status dot. Designed to sit in the document/sheet toolbar.
 */

import { Avatar } from "@tokimo/ui";
import { Check, LoaderCircle, TriangleAlert, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCollabPresence } from "./awareness-store";

interface CollabPresenceBarProps {
  nodeId: string;
  saveState?: "saved" | "saving" | "error";
  showConnection?: boolean;
}

const MAX_AVATARS = 5;

export function CollabPresenceBar({
  nodeId,
  saveState = "saved",
  showConnection = true,
}: CollabPresenceBarProps) {
  const { users, connected } = useCollabPresence(nodeId);
  const { t } = useTranslation();

  if (!nodeId) return null;

  const visibleUsers = users.slice(0, MAX_AVATARS);
  const overflow = users.length - MAX_AVATARS;
  const status = showConnection && !connected
    ? { label: t("docs.offline", "离线，等待重连"), kind: "offline" as const }
    : saveState === "saving"
      ? { label: t("docs.saving", "保存中"), kind: "saving" as const }
      : saveState === "error"
        ? { label: t("docs.saveFailed", "保存失败"), kind: "error" as const }
        : { label: t("docs.saved", "已保存"), kind: "saved" as const };

  return (
    <div className="flex items-center gap-1.5">
      {/* Connection status */}
      <div
        className="flex items-center gap-1 text-xs text-fg-muted"
        title={status.label}
      >
        {status.kind === "offline" ? (
          <WifiOff size={12} className="text-fg-disabled" />
        ) : status.kind === "saving" ? (
          <LoaderCircle size={12} className="animate-spin" />
        ) : status.kind === "error" ? (
          <TriangleAlert size={12} className="text-state-danger-text" />
        ) : (
          <Check size={12} className="text-state-success-text" />
        )}
        <span>{status.label}</span>
      </div>

      {/* User avatars */}
      {visibleUsers.length > 0 && (
        <div className="flex items-center -space-x-1.5">
          {visibleUsers.map((user) => (
            <Avatar
              key={user.clientId}
              size={22}
              shape="circle"
              className="ring-2 ring-bg-primary"
              style={{ backgroundColor: user.color }}
              alt={user.name}
            >
              {user.name.slice(0, 1).toUpperCase()}
            </Avatar>
          ))}
          {overflow > 0 && (
            <span className="ml-1 text-xs text-fg-muted">+{overflow}</span>
          )}
        </div>
      )}
    </div>
  );
}
