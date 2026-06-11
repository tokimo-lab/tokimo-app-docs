import { useWindowActions, type WindowState } from "@tokimo/sdk";
import { useState } from "react";
import { queryClient } from "../index";
import { getBridge, type SpaceEditorBridge } from "../modal-bridge";
import { withProviders } from "../shared/providers";
import DocSpaceEditor from "./DocSpaceEditor";

function DocSpaceEditorContent({
  win,
  bridge,
}: {
  win: WindowState;
  bridge: SpaceEditorBridge;
}) {
  const { closeWindow } = useWindowActions();
  const spaceId =
    typeof win.metadata?.spaceId === "string"
      ? win.metadata.spaceId
      : undefined;

  return (
    <DocSpaceEditor
      spaceId={spaceId}
      onSaved={(savedId) => {
        bridge.onSaved?.(savedId);
        closeWindow(win.id);
      }}
      onDeleted={() => {
        bridge.onDeleted?.();
        closeWindow(win.id);
      }}
      onCancel={() => closeWindow(win.id)}
    />
  );
}

export default function DocSpaceEditorWindow({
  win,
}: {
  win: WindowState;
}) {
  const bridgeId =
    typeof win.metadata?.bridgeId === "string"
      ? win.metadata.bridgeId
      : undefined;
  const [bridge] = useState(() => (bridgeId ? getBridge(bridgeId) : undefined));

  if (bridge?.kind !== "space-editor") return null;

  return withProviders(
    bridge.ctx,
    queryClient,
    <DocSpaceEditorContent win={win} bridge={bridge} />,
  );
}
