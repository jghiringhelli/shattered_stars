/**
 * Transport — the text-frame socket the NetClient talks through, so the
 * client is testable without a network: the browser WebSocket in the game,
 * an in-memory link to the relay logic in tests.
 */

/** Callbacks a transport drives. */
export interface TransportHandlers {
  onOpen(): void;
  onMessage(text: string): void;
  /** The socket closed (code 1006 when it failed to open or dropped). */
  onClose(code: number, reason: string): void;
}

/** An open (or opening) socket. */
export interface Transport {
  send(text: string): void;
  close(code?: number, reason?: string): void;
}

/** Opens a transport to a URL. */
export type TransportFactory = (
  url: string,
  handlers: TransportHandlers,
) => Transport;

/** Close code for an abnormal drop (no close frame). */
export const ABNORMAL_CLOSE = 1006;

/**
 * @param url - ws:// or wss:// URL.
 * @param handlers - Socket callbacks.
 * @returns A transport over the browser's (or Node's) global WebSocket.
 */
export function createWebSocketTransport(
  url: string,
  handlers: TransportHandlers,
): Transport {
  let socket: WebSocket;
  try {
    socket = new WebSocket(url);
  } catch {
    queueMicrotask(() =>
      handlers.onClose(ABNORMAL_CLOSE, "invalid server address"),
    );
    return { send: () => undefined, close: () => undefined };
  }
  socket.onopen = () => handlers.onOpen();
  socket.onmessage = (event: MessageEvent) => {
    if (typeof event.data === "string") handlers.onMessage(event.data);
  };
  socket.onclose = (event: CloseEvent) =>
    handlers.onClose(event.code, event.reason);
  return {
    send: (text) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(text);
    },
    close: (code, reason) => {
      if (
        socket.readyState === WebSocket.CLOSED ||
        socket.readyState === WebSocket.CLOSING
      )
        return;
      socket.close(code, reason);
    },
  };
}
