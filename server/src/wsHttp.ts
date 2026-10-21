/**
 * wsHttp — the relay's plain-HTTP side: health check, a landing line and the
 * client address (honouring a trusted proxy's X-Forwarded-For).
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { PROTOCOL_VERSION } from "../../src/net/protocol";
import type { RelayCore } from "./RelayCore";

/** WebSocket path (anything else is HTTP only). */
export const WS_PATH = "/ws";

/**
 * @param req - The request.
 * @param res - The response.
 * @param core - The relay core (health counters).
 * @param uptimeMs - Time since the relay started.
 */
export function answerHttp(
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

/**
 * @param req - The upgrade request.
 * @param trustProxy - Whether X-Forwarded-For comes from a proxy we control.
 * @returns The client's address.
 */
export function clientAddress(req: IncomingMessage, trustProxy: boolean): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
    ?.split(",")[0]
    ?.trim();
  if (trustProxy && first) return first;
  return req.socket.remoteAddress ?? "unknown";
}
