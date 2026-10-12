/**
 * Relay entry point: `node dist/server.mjs` in the container, or
 * `npm run start:server` (tsx) locally. Configuration comes from the
 * environment (see config.ts); SIGTERM drains gracefully so a deploy tells
 * connected players to reconnect instead of silently dropping them.
 */

import { ConfigError, loadConfig } from "./config";
import { createLogger } from "./logger";
import { startRelayServer } from "./wsServer";

/** Longest graceful shutdown before the process exits anyway (ms). */
const SHUTDOWN_GRACE_MS = 3_000;

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
  const logger = createLogger(config.logLevel);
  const relay = await startRelayServer(config, { logger });
  const stop = (signal: string): void => {
    logger.info("shutting down", { signal });
    setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS).unref();
    void relay.close().then(() => process.exit(0));
  };
  process.once("SIGTERM", () => stop("SIGTERM"));
  process.once("SIGINT", () => stop("SIGINT"));
}

void main();
