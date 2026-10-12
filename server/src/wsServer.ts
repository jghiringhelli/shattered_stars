/**
 * wsServer — the relay's I/O adapter: an HTTP server answering health checks
 * and upgrading `/ws` to WebSocket. Per socket it enforces the origin list,
 * connection caps, frame size, the hello-first rule, rate limits, validation
 * and the heartbeat, then hands typed messages to RelayCore.
 */

import { randomBytes, randomInt } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import {
  CLOSE_CODES,
  decodeClientMessage,
  encodeMessage,
  NET_LIMITS,
  PROTOCOL_VERSION,
} from "../../src/net/protocol";
import {
  createSystemScheduler,
  repeatEvery,
  type Scheduler,
} from "../../src/net/time";
import { isOriginAllowed, type ServerConfig } from "./config";
import { createLogger, type Logger } from "./logger";
import { ConnectionRateLimiter } from "./RateLimiter";
import { RelayCore } from "./RelayCore";
import type { Connection, RelayRandom, Session } from "./types";

/** A socket must say hello within this long (ms). */
export const HELLO_TIMEOUT_MS = 10_000;
/** WebSocket path (anything else is HTTP only). */
export const WS_PATH = "/ws";

/** A started relay. */
export interface RunningRelay {
  readonly port: number;
  readonly core: RelayCore;
  close(): Promise<void>;
}

/** Optional overrides (tests). */
export interface RelayOverrides {
  readonly logger?: Logger;
  readonly scheduler?: Scheduler;
  readonly random?: RelayRandom;
}

/** @returns Crypto-backed randomness. */
export function createCryptoRandom(): RelayRandom {
  return {
    int: (n) => randomInt(n),
    token: () => randomBytes(24).toString("base64url"),
  };
}

/**
 * @param config - Validated settings.
 * @param overrides - Logger / scheduler / randomness for tests.
 * @returns The listening relay.
 */
export async function startRelayServer(
  config: ServerConfig,
  overrides: RelayOverrides = {},
): Promise<RunningRelay> {
  const logger = overrides.logger ?? createLogger(config.logLevel);
  const scheduler = overrides.scheduler ?? createSystemScheduler();
  const core = new RelayCore({
    scheduler,
    logger,
    config,
    random: overrides.random ?? createCryptoRandom(),
  });
  const startedAt = scheduler.now();
  const http = createServer((req, res) =>
    answerHttp(req, res, core, scheduler.now() - startedAt),
  );
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: NET_LIMITS.maxMessageBytes,
  });
  const perAddress = new Map<string, number>();
  http.on("upgrade", (req, socket, head) => {
    const path = (req.url ?? "/").split("?")[0];
    if (path !== WS_PATH || !isOriginAllowed(config, req.headers.origin)) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const address = clientAddress(req, config.trustProxy);
      const opened = {
        core,
        config,
        scheduler,
        logger,
        perAddress,
        totalOpen: wss.clients.size,
      };
      handleSocket(ws, address, opened);
    });
  });
  await new Promise<void>((resolve) =>
    http.listen(config.port, config.host, resolve),
  );
  const port = (http.address() as AddressInfo).port;
  logger.info("relay listening", {
    port,
    protocol: PROTOCOL_VERSION,
    path: WS_PATH,
  });
  return {
    port,
    core,
    close: () =>
      new Promise<void>((resolve) => {
        core.shutdown();
        for (const ws of wss.clients) ws.terminate();
        wss.close();
        http.close(() => resolve());
        http.closeAllConnections();
      }),
  };
}

interface SocketContext {
  readonly core: RelayCore;
  readonly config: ServerConfig;
  readonly scheduler: Scheduler;
  readonly logger: Logger;
  readonly perAddress: Map<string, number>;
  readonly totalOpen: number;
}

function handleSocket(
  ws: WebSocket,
  address: string,
  ctx: SocketContext,
): void {
  const connection: Connection = {
    send: (message) => {
      if (ws.readyState === ws.OPEN) ws.send(encodeMessage(message));
    },
    close: (code, reason) => ws.close(code, reason),
  };
  const open = ctx.perAddress.get(address) ?? 0;
  if (
    ctx.totalOpen > ctx.config.maxConnections ||
    open >= ctx.config.maxConnectionsPerAddress
  ) {
    connection.send({
      t: "refused",
      reason: "server_full",
      serverProtocol: PROTOCOL_VERSION,
    });
    connection.close(CLOSE_CODES.serverFull, "server full");
    return;
  }
  ctx.perAddress.set(address, open + 1);
  const limiter = new ConnectionRateLimiter(ctx.scheduler);
  let session: Session | null = null;
  let lastSeen = ctx.scheduler.now();
  const helloTimer = ctx.scheduler.setTimeout(
    () => connection.close(CLOSE_CODES.badHello, "no hello"),
    HELLO_TIMEOUT_MS,
  );
  const heartbeat = repeatEvery(
    ctx.scheduler,
    () => {
      if (ctx.scheduler.now() - lastSeen > ctx.config.heartbeatTimeoutMs)
        ws.terminate();
      else ws.ping();
    },
    ctx.config.heartbeatIntervalMs,
  );
  ws.on("pong", () => {
    lastSeen = ctx.scheduler.now();
  });
  ws.on("message", (data: RawData) => {
    lastSeen = ctx.scheduler.now();
    session = onFrame(data, session, {
      connection,
      limiter,
      ctx,
      helloTimer: () => helloTimer.cancel(),
    });
  });
  ws.on("close", () => {
    helloTimer.cancel();
    heartbeat.cancel();
    const remaining = (ctx.perAddress.get(address) ?? 1) - 1;
    if (remaining <= 0) ctx.perAddress.delete(address);
    else ctx.perAddress.set(address, remaining);
    if (session) ctx.core.disconnected(session, connection);
  });
  ws.on("error", (error) =>
    ctx.logger.warn("socket error", { error: error.message }),
  );
}

interface FrameContext {
  readonly connection: Connection;
  readonly limiter: ConnectionRateLimiter;
  readonly ctx: SocketContext;
  readonly helloTimer: () => void;
}

function onFrame(
  data: RawData,
  session: Session | null,
  frame: FrameContext,
): Session | null {
  const { connection, limiter, ctx } = frame;
  const decoded = decodeClientMessage(rawToString(data));
  if (!decoded.ok) {
    limiter.recordViolation();
    if (!session) {
      connection.close(CLOSE_CODES.badHello, "expected hello");
      return null;
    }
    if (limiter.allow("invalid"))
      connection.send({
        t: "error",
        code: "invalid_message",
        message: decoded.error,
      });
    if (limiter.isAbusive())
      connection.close(CLOSE_CODES.policy, "too many invalid messages");
    return session;
  }
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
    frame.helloTimer();
    return ctx.core.hello(connection, message);
  }
  ctx.core.handle(session, message);
  return session;
}

function answerHttp(
  req: IncomingMessage,
  res: ServerResponse,
  core: RelayCore,
  uptimeMs: number,
): void {
  const path = (req.url ?? "/").split("?")[0];
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405).end();
    return;
  }
  if (path === "/healthz") {
    const body = JSON.stringify({
      status: "ok",
      protocol: PROTOCOL_VERSION,
      uptimeS: Math.round(uptimeMs / 1000),
      ...core.stats(),
    });
    res
      .writeHead(200, {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "cache-control": "no-store",
      })
      .end(body);
    return;
  }
  if (path === "/") {
    res
      .writeHead(200, { "content-type": "text/plain" })
      .end(
        `Shattered Stars relay (protocol ${PROTOCOL_VERSION}). WebSocket: ${WS_PATH}\n`,
      );
    return;
  }
  res.writeHead(404).end();
}

function clientAddress(req: IncomingMessage, trustProxy: boolean): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
    ?.split(",")[0]
    ?.trim();
  if (trustProxy && first) return first;
  return req.socket.remoteAddress ?? "unknown";
}

function rawToString(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  return Buffer.from(data as ArrayBuffer).toString("utf8");
}
