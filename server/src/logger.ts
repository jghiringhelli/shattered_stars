/**
 * Minimal structured logger: one JSON object per line on stdout/stderr, the
 * format Fly.io and Render ingest without configuration.
 */

import type { LogLevel } from "./config";

/** Context fields attached to a log line. */
export type LogFields = Readonly<
  Record<string, string | number | boolean | null | undefined>
>;

/** Leveled logging. */
export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

/** Where log lines go. */
export interface LogSink {
  out(line: string): void;
  err(line: string): void;
}

const RANK: Readonly<Record<LogLevel, number>> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * @param level - Lowest level written.
 * @param sink - Output (defaults to the console).
 * @param now - Time source for the timestamp.
 * @returns A logger.
 */
export function createLogger(
  level: LogLevel,
  sink: LogSink = { out: (l) => console.log(l), err: (l) => console.error(l) },
  now: () => number = Date.now,
): Logger {
  const write = (
    lineLevel: LogLevel,
    message: string,
    fields?: LogFields,
  ): void => {
    if (RANK[lineLevel] < RANK[level]) return;
    const line = JSON.stringify({
      ts: new Date(now()).toISOString(),
      level: lineLevel,
      msg: message,
      ...fields,
    });
    if (RANK[lineLevel] >= RANK.warn) sink.err(line);
    else sink.out(line);
  };
  return {
    debug: (m, f) => write("debug", m, f),
    info: (m, f) => write("info", m, f),
    warn: (m, f) => write("warn", m, f),
    error: (m, f) => write("error", m, f),
  };
}

/** @returns A logger that writes nothing (tests). */
export function createSilentLogger(): Logger {
  const ignore = (): void => undefined;
  return { debug: ignore, info: ignore, warn: ignore, error: ignore };
}
