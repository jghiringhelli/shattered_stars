/**
 * wsServer — the relay's I/O adapter: an HTTP server answering health checks
 * and upgrading `/ws` to WebSocket (origin list enforced here). Each socket is
 * handled by wsSocket, which hands typed messages to RelayCore.
 */

import { randomBytes, randomInt } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocketServer } from "ws";
import { NET_LIMITS, PROTOCOL_VERSION } from "../../src/net/protocol";
import { createSystemScheduler, type Scheduler } from "../../src/net/time";
import { isOriginAllowed, type ServerConfig } from "./config";
import { guardScheduler } from "./guarded";
import { createLogger, type Logger } from "./logger";
import { RelayCore } from "./RelayCore";
import type { RelayRandom } from "./types";
import { answerHttp, clientAddress, WS_PATH } from "./wsHttp";
import { handleSocket, type SocketContext } from "./wsSocket";

export { HELLO_TIMEOUT_MS } from "./wsSocket";
export { WS_PATH };

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
  const scheduler = guardScheduler(
    overrides.scheduler ?? createSystemScheduler(),
    logger,
  );
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
  routeUpgrades(http, wss, { core, config, scheduler, logger });
  await new Promise<void>((resolve) =>
    http.listen(config.port, config.host, resolve),
  );
  const port = (http.address() as AddressInfo).port;
  logger.info("relay listening", {
    port,
    protocol: PROTOCOL_VERSION,
    path: WS_PATH,
  });
  return { port, core, close: () => closeRelay(http, wss, core) };
}

/** Everything a socket shares, minus the live counters. */
type SharedContext = Omit<SocketContext, "perAddress" | "totalOpen">;

/** Upgrade `/ws` from an allowed origin to a WebSocket; refuse everything else. */
function routeUpgrades(
  http: Server,
  wss: WebSocketServer,
  shared: SharedContext,
): void {
  const perAddress = new Map<string, number>();
  http.on("upgrade", (req, socket, head) => {
    const path = (req.url ?? "/").split("?")[0];
    if (
      path !== WS_PATH ||
      !isOriginAllowed(shared.config, req.headers.origin)
    ) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const address = clientAddress(req, shared.config.trustProxy);
      handleSocket(ws, address, {
        ...shared,
        perAddress,
        totalOpen: wss.clients.size,
      });
    });
  });
}

function closeRelay(
  http: Server,
  wss: WebSocketServer,
  core: RelayCore,
): Promise<void> {
  return new Promise<void>((resolve) => {
    core.shutdown();
    for (const ws of wss.clients) ws.terminate();
    wss.close();
    http.close(() => resolve());
    http.closeAllConnections();
  });
}
