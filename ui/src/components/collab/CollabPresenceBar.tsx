/**
 * CollabPresenceBar — Shows online collaborators and connection status.
 *
 * Renders a row of user avatars (max 5 + overflow count) and a small
 * connection status dot. Designed to sit in the document/sheet toolbar.
 */

import { Avatar } from "@tokimo/ui";
import { Wifi, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCollabPresence } from "./awareness-store";

interface CollabPresenceBarProps {
  spaceId: string;
  relPath: string;
}

const MAX_AVATARS = 5;

export function CollabPresenceBar({
  spaceId,
  relPath,
}: CollabPresenceBarProps) {
  const { users, connected } = useCollabPresence(`${spaceId}:${relPath}`);
  const { t } = useTranslation();

  if (!spaceId || !relPath) return null;

  const visibleUsers = users.slice(0, MAX_AVATARS);
  const overflow = users.length - MAX_AVATARS;

  return (
    <div className="flex items-center gap-1.5">
      {/* Connection status */}
      <div
        className="flex items-center gap-1 text-xs text-fg-muted"
        title={
          connected
            ? t("docs.collabConnected", "Connected")
            : t("docs.collabDisconnected", "Disconnected")
        }
      >
        {connected ? (
          <Wifi size={12} className="text-green-500" />
        ) : (
          <WifiOff size={12} className="text-fg-disabled" />
        )}
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
