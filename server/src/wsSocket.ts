/**
 * wsSocket — one WebSocket of the relay. It enforces connection caps, the
 * hello-first rule, rate limits, validation and the heartbeat, then hands
 * typed messages to RelayCore. A failing handler is logged, never fatal.
 */

import type { RawData, WebSocket } from "ws";
import {
  CLOSE_CODES,
  decodeClientMessage,
  encodeMessage,
  PROTOCOL_VERSION,
} from "../../src/net/protocol";
import {
  repeatEvery,
  type Scheduler,
  type TimerHandle,
} from "../../src/net/time";
import type { ServerConfig } from "./config";
import { runGuarded } from "./guarded";
import type { Logger } from "./logger";
import { ConnectionRateLimiter } from "./RateLimiter";
import type { RelayCore } from "./RelayCore";
import type { Connection, Session } from "./types";

/** A socket must say hello within this long (ms). */
export const HELLO_TIMEOUT_MS = 10_000;

/** What every socket of a relay shares. */
export interface SocketContext {
  readonly core: RelayCore;
  readonly config: ServerConfig;
  readonly scheduler: Scheduler;
  readonly logger: Logger;
  readonly perAddress: Map<string, number>;
  readonly totalOpen: number;
}

/** One socket's moving parts. */
interface SocketState {
  session: Session | null;
  lastSeen: number;
  readonly connection: Connection;
  readonly limiter: ConnectionRateLimiter;
  readonly helloTimer: TimerHandle;
}

/**
 * @param ws - The upgraded socket.
 * @param address - The client's address (per-address cap).
 * @param ctx - Shared relay state.
 */
export function handleSocket(
  ws: WebSocket,
  address: string,
  ctx: SocketContext,
): void {
  const connection = connectionOf(ws);
  const open = ctx.perAddress.get(address) ?? 0;
  if (refuseWhenFull(connection, open, ctx)) return;
  ctx.perAddress.set(address, open + 1);
  const state: SocketState = {
    session: null,
    lastSeen: ctx.scheduler.now(),
    connection,
    limiter: new ConnectionRateLimiter(ctx.scheduler),
    helloTimer: ctx.scheduler.setTimeout(
      () => connection.close(CLOSE_CODES.badHello, "no hello"),
      HELLO_TIMEOUT_MS,
    ),
  };
  const heartbeat = startHeartbeat(ws, state, ctx);
  ws.on("pong", () => {
    state.lastSeen = ctx.scheduler.now();
  });
  ws.on("message", (data: RawData) => onMessage(data, state, ctx));
  ws.on("close", () => onClose(address, state, heartbeat, ctx));
  ws.on("error", (error) =>
    ctx.logger.warn("socket error", { error: error.message }),
  );
}

function connectionOf(ws: WebSocket): Connection {
  return {
    send: (message) => {
      if (ws.readyState === ws.OPEN) ws.send(encodeMessage(message));
    },
    close: (code, reason) => ws.close(code, reason),
  };
}

/** @returns Whether the socket was refused (server or address cap reached). */
function refuseWhenFull(
  connection: Connection,
  openFromAddress: number,
  ctx: SocketContext,
): boolean {
  const full =
    ctx.totalOpen > ctx.config.maxConnections ||
    openFromAddress >= ctx.config.maxConnectionsPerAddress;
  if (!full) return false;
  connection.send({
    t: "refused",
    reason: "server_full",
    serverProtocol: PROTOCOL_VERSION,
  });
  connection.close(CLOSE_CODES.serverFull, "server full");
  return true;
}

function startHeartbeat(
  ws: WebSocket,
  state: SocketState,
  ctx: SocketContext,
): TimerHandle {
  return repeatEvery(
    ctx.scheduler,
    () => {
      if (ctx.scheduler.now() - state.lastSeen > ctx.config.heartbeatTimeoutMs)
        ws.terminate();
      else ws.ping();
    },
    ctx.config.heartbeatIntervalMs,
  );
}

function onMessage(data: RawData, state: SocketState, ctx: SocketContext): void {
  state.lastSeen = ctx.scheduler.now();
  const hadSession = state.session !== null;
  const ok = runGuarded(ctx.logger, "frame", () => {
    state.session = onFrame(data, state, ctx);
  });
  if (ok) return;
  if (hadSession)
    state.connection.send({
      t: "error",
      code: "server_busy",
      message: "The relay hit an internal error — please try again.",
    });
  else state.connection.close(CLOSE_CODES.badHello, "internal error");
}

function onClose(
  address: string,
  state: SocketState,
  heartbeat: TimerHandle,
  ctx: SocketContext,
): void {
  state.helloTimer.cancel();
  heartbeat.cancel();
  const remaining = (ctx.perAddress.get(address) ?? 1) - 1;
  if (remaining <= 0) ctx.perAddress.delete(address);
  else ctx.perAddress.set(address, remaining);
  const closing = state.session;
  if (closing)
    runGuarded(ctx.logger, "disconnect", () =>
      ctx.core.disconnected(closing, state.connection),
    );
}

function onFrame(
  data: RawData,
  state: SocketState,
  ctx: SocketContext,
): Session | null {
  const { connection, limiter, session } = state;
  const decoded = decodeClientMessage(rawToString(data));
  if (!decoded.ok) return onInvalid(decoded.error, state);
  const message = decoded.value;
  if (!limiter.allow(message.t)) {
    if (limiter.isAbusive())
      connection.close(CLOSE_CODES.policy, "rate limit exceeded");
    return session;
  }
  if (!session) {
    if (message.t !== "hello") {
      connection.close(CLOSE_CODES.badHello, "expected hello");
      return null;
    }
    state.helloTimer.cancel();
    return ctx.core.hello(connection, message);
  }
  ctx.core.handle(session, message);
  return session;
}

function onInvalid(error: string, state: SocketState): Session | null {
  const { connection, limiter, session } = state;
  limiter.recordViolation();
  if (!session) {
    connection.close(CLOSE_CODES.badHello, "expected hello");
    return null;
  }
  if (limiter.allow("invalid"))
    connection.send({ t: "error", code: "invalid_message", message: error });
  if (limiter.isAbusive())
    connection.close(CLOSE_CODES.policy, "too many invalid messages");
  return session;
}

function rawToString(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  return Buffer.from(data as ArrayBuffer).toString("utf8");
}
