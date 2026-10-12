/**
 * codec — JSON framing for wire messages, with a size guard on decode and a
 * shape check for server messages on the client side. Pure.
 */

import { isRecord } from "./fields";
import { NET_LIMITS } from "./limits";
import type {
  ClientMessage,
  ServerMessage,
  ServerMessageType,
} from "./messages";
import { validateClientMessage, type Validated } from "./validateClient";

const SERVER_TYPES: ReadonlySet<ServerMessageType> = new Set<ServerMessageType>(
  [
    "welcome",
    "refused",
    "pong",
    "error",
    "room",
    "room_left",
    "queue",
    "chat",
    "match_start",
    "go",
    "in",
    "resync",
    "snapshot_request",
    "snapshot",
    "peer",
    "authority",
    "match_end",
    "shutdown",
  ],
);

/**
 * @param message - A message to send.
 * @returns Its wire text.
 */
export function encodeMessage(message: ClientMessage | ServerMessage): string {
  return JSON.stringify(message);
}

/**
 * Relay side: parse and validate one inbound frame.
 *
 * @param text - Raw frame text.
 * @returns The typed client message, or why it was rejected.
 */
export function decodeClientMessage(text: string): Validated<ClientMessage> {
  if (text.length > NET_LIMITS.maxMessageBytes) {
    return { ok: false, error: "message too large" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalid JSON" };
  }
  return validateClientMessage(parsed);
}

/**
 * Client side: parse one frame from the (trusted) relay. Only the envelope is
 * checked; the relay validated everything it forwards.
 *
 * @param text - Raw frame text.
 * @returns The message, or null for anything that is not a known server message.
 */
export function decodeServerMessage(text: string): ServerMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const type = parsed["t"];
  if (typeof type !== "string" || !SERVER_TYPES.has(type as ServerMessageType))
    return null;
  return parsed as unknown as ServerMessage;
}
