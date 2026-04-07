/**
 * Custom Yjs WebSocket provider for Tokimo's collab backend.
 *
 * Wraps y-websocket's WebsocketProvider (standard Yjs sync protocol)
 * and implements @platejs/yjs's UnifiedProvider interface so it integrates
 * with BaseYjsPlugin's lifecycle (connect → sync → seed → editor.connect).
 */
import { registerProviderType } from "@platejs/yjs";
import type { Awareness } from "y-protocols/awareness";
import { WebsocketProvider } from "y-websocket";
import type * as Y from "yjs";

import {
  registerAwareness,
  unregisterAwareness,
  updateConnectionStatus,
} from "../collab/awareness-store";

export const PROVIDER_TYPE = "tokimo-ws";

export interface TokimoWsProviderOptions {
  /** WebSocket server base URL (without room name). */
  url: string;
  /** Room name (typically the doc node ID). */
  roomName: string;
}

interface ProviderEventHandlers {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  onSyncChange?: (isSynced: boolean) => void;
}

/**
 * UnifiedProvider implementation backed by y-websocket.
 * Speaks standard Yjs binary sync protocol, compatible with the yrs backend.
 */
class TokimoWsProvider {
  private _isConnected = false;
  private _isSynced = false;
  private wsProvider: WebsocketProvider | null = null;
  private readonly onConnectCb?: () => void;
  private readonly onDisconnectCb?: () => void;
  private readonly onErrorCb?: (error: Error) => void;
  private readonly onSyncChangeCb?: (isSynced: boolean) => void;
  private readonly _awareness: Awareness;
  private readonly _doc: Y.Doc;
  private readonly options: TokimoWsProviderOptions;
  private _beforeUnloadHandler: (() => void) | null = null;

  type = PROVIDER_TYPE;

  constructor({
    options,
    doc,
    awareness,
    onConnect,
    onDisconnect,
    onError,
    onSyncChange,
  }: {
    options: TokimoWsProviderOptions;
    doc?: Y.Doc;
    awareness?: Awareness;
  } & ProviderEventHandlers) {
    if (!doc) throw new Error("TokimoWsProvider requires a Y.Doc instance");
    if (!awareness)
      throw new Error("TokimoWsProvider requires an Awareness instance");

    this._doc = doc;
    this._awareness = awareness;
    this.options = options;
    this.onConnectCb = onConnect;
    this.onDisconnectCb = onDisconnect;
    this.onErrorCb = onError;
    this.onSyncChangeCb = onSyncChange;
  }

  get awareness(): Awareness {
    return this._awareness;
  }

  get document(): Y.Doc {
    return this._doc;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  get isSynced(): boolean {
    return this._isSynced;
  }

  connect(): void {
    if (this.wsProvider) return;

    // Register awareness in the shared store for CollabPresenceBar
    registerAwareness(this.options.roomName, this._awareness, false);

    try {
      this.wsProvider = new WebsocketProvider(
        this.options.url,
        this.options.roomName,
        this._doc,
        {
          connect: true,
          awareness: this._awareness,
        },
      );

      this.wsProvider.on("status", ({ status }: { status: string }) => {
        if (status === "connected") {
          this._isConnected = true;
          updateConnectionStatus(this.options.roomName, true);
          this.onConnectCb?.();
        } else if (status === "disconnected") {
          this._isConnected = false;
          updateConnectionStatus(this.options.roomName, false);
          this.onDisconnectCb?.();
        }
      });

      this.wsProvider.on("sync", (synced: boolean) => {
        this._isSynced = synced;
        this.onSyncChangeCb?.(synced);
      });

      this.wsProvider.on("connection-error", (event: Event) => {
        this.onErrorCb?.(
          new Error(
            `WebSocket connection error: ${(event as ErrorEvent).message ?? "unknown"}`,
          ),
        );
      });

      // Broadcast awareness null on tab close/refresh so peers see immediate removal
      this._beforeUnloadHandler = () => {
        this._awareness.setLocalState(null);
      };
      window.addEventListener("beforeunload", this._beforeUnloadHandler);
    } catch (error) {
      this.onErrorCb?.(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  disconnect(): void {
    if (this.wsProvider) {
      this.wsProvider.disconnect();
      this._isConnected = false;
      if (this._isSynced) {
        this._isSynced = false;
        this.onSyncChangeCb?.(false);
      }
    }
  }

  destroy(): void {
    if (this._beforeUnloadHandler) {
      window.removeEventListener("beforeunload", this._beforeUnloadHandler);
      this._beforeUnloadHandler = null;
    }
    if (this.wsProvider) {
      // Broadcast cursor removal to peers BEFORE closing the WebSocket
      this._awareness.setLocalState(null);
      unregisterAwareness(this.options.roomName);
      this.wsProvider.destroy();
      this.wsProvider = null;
      this._isConnected = false;
      this._isSynced = false;
    }
  }
}

// Register with @platejs/yjs so BaseYjsPlugin can create instances from config
registerProviderType(PROVIDER_TYPE, TokimoWsProvider as never);

export { TokimoWsProvider };
