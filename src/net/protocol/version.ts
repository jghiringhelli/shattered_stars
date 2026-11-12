/**
 * Wire-protocol version shared by the relay server and every client.
 *
 * Bump it whenever a message shape, the input-word layout
 * (src/net/input/PilotInputCodec.ts) or the lockstep timing constants
 * change: the server refuses a `hello` whose protocol differs, so a stale
 * cached client can never join a match it would desync.
 */
export const PROTOCOL_VERSION = 6;

/** WebSocket close codes the relay uses (4000–4999 is the application range). */
export const CLOSE_CODES = {
  /** Client protocol differs from the server's. */
  versionMismatch: 4001,
  /** The first message was not a valid `hello`. */
  badHello: 4002,
  /** Server or per-address connection cap reached. */
  serverFull: 4003,
  /** The resume token is unknown or its reconnection window expired. */
  sessionExpired: 4004,
  /** The same session connected again from elsewhere. */
  replaced: 4005,
  /** Heartbeat timed out. */
  timeout: 4006,
  /** Repeated rate-limit or validation violations. */
  policy: 4008,
  /** Server is shutting down (deploy / restart). */
  shutdown: 4010,
} as const;
