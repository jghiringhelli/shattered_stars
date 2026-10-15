/**
 * Relay configuration from environment variables. Every value has a safe
 * default for local development; anything malformed fails fast at startup.
 *
 * | Variable | Default | Meaning |
 * |---|---|---|
 * | PORT | 8080 | HTTP + WebSocket port (Fly/Render inject it) |
 * | HOST | 0.0.0.0 | Bind address |
 * | ALLOWED_ORIGINS | * (dev) | Comma-separated browser origins allowed to connect; REQUIRED when NODE_ENV=production |
 * | ALLOW_ANY_ORIGIN | false | Production opt-in to accept any origin (ALLOWED_ORIGINS unset or *) |
 * | MAX_CONNECTIONS | 500 | Open sockets, server-wide |
 * | MAX_CONNECTIONS_PER_ADDRESS | 8 | Open sockets per client address |
 * | MAX_ROOMS | 200 | Concurrent rooms |
 * | RECONNECT_WINDOW_MS | 30000 | How long a dropped player keeps their seat |
 * | HEARTBEAT_INTERVAL_MS | 5000 | Server WebSocket ping period |
 * | HEARTBEAT_TIMEOUT_MS | 15000 | Silence after which a socket is dropped |
 * | QUICK_MATCH_READY_MS | 20000 | Ready-check window of a quick-match room |
 * | START_COUNTDOWN_MS | 3000 | All-ready countdown before a match starts |
 * | LOAD_TIMEOUT_MS | 30000 | Longest wait for every client to load the battle |
 * | TRUST_PROXY | false | Read the client address from X-Forwarded-For (set true behind Fly/Render) |
 * | LOG_LEVEL | info | debug, info, warn or error |
 */

/** Log verbosity. */
export type LogLevel = "debug" | "info" | "warn" | "error";

/** Validated relay settings. */
export interface ServerConfig {
  readonly port: number;
  readonly host: string;
  /** Allowed `Origin` headers, or "*" for any. */
  readonly allowedOrigins: readonly string[] | "*";
  readonly maxConnections: number;
  readonly maxConnectionsPerAddress: number;
  readonly maxRooms: number;
  readonly reconnectWindowMs: number;
  readonly heartbeatIntervalMs: number;
  readonly heartbeatTimeoutMs: number;
  readonly quickMatchReadyMs: number;
  readonly startCountdownMs: number;
  readonly loadTimeoutMs: number;
  readonly trustProxy: boolean;
  readonly logLevel: LogLevel;
}

/** A malformed environment variable. */
export class ConfigError extends Error {
  /**
   * @param variable - The variable's name.
   * @param value - Its raw value.
   * @param expected - What was expected.
   */
  constructor(
    readonly variable: string,
    readonly value: string,
    expected: string,
  ) {
    super(`Invalid ${variable}='${value}': expected ${expected}`);
    this.name = "ConfigError";
  }
}

/** Defaults used when a variable is absent. */
export const DEFAULT_CONFIG: ServerConfig = {
  port: 8080,
  host: "0.0.0.0",
  allowedOrigins: "*",
  maxConnections: 500,
  maxConnectionsPerAddress: 8,
  maxRooms: 200,
  reconnectWindowMs: 30_000,
  heartbeatIntervalMs: 5_000,
  heartbeatTimeoutMs: 15_000,
  quickMatchReadyMs: 20_000,
  startCountdownMs: 3_000,
  loadTimeoutMs: 30_000,
  trustProxy: false,
  logLevel: "info",
};

const LOG_LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"];
/** Largest TCP port. */
const MAX_PORT = 65_535;

type Env = Readonly<Record<string, string | undefined>>;

/**
 * @param env - Process environment.
 * @returns The validated configuration.
 * @throws ConfigError when a variable is malformed.
 */
export function loadConfig(env: Env): ServerConfig {
  const d = DEFAULT_CONFIG;
  return {
    port: intVar(env, "PORT", d.port, 0, MAX_PORT),
    host: env["HOST"]?.trim() || d.host,
    allowedOrigins: originsVar(env),
    maxConnections: intVar(env, "MAX_CONNECTIONS", d.maxConnections, 1),
    maxConnectionsPerAddress: intVar(
      env,
      "MAX_CONNECTIONS_PER_ADDRESS",
      d.maxConnectionsPerAddress,
      1,
    ),
    maxRooms: intVar(env, "MAX_ROOMS", d.maxRooms, 1),
    reconnectWindowMs: intVar(
      env,
      "RECONNECT_WINDOW_MS",
      d.reconnectWindowMs,
      0,
    ),
    heartbeatIntervalMs: intVar(
      env,
      "HEARTBEAT_INTERVAL_MS",
      d.heartbeatIntervalMs,
      100,
    ),
    heartbeatTimeoutMs: intVar(
      env,
      "HEARTBEAT_TIMEOUT_MS",
      d.heartbeatTimeoutMs,
      200,
    ),
    quickMatchReadyMs: intVar(
      env,
      "QUICK_MATCH_READY_MS",
      d.quickMatchReadyMs,
      1_000,
    ),
    startCountdownMs: intVar(env, "START_COUNTDOWN_MS", d.startCountdownMs, 0),
    loadTimeoutMs: intVar(env, "LOAD_TIMEOUT_MS", d.loadTimeoutMs, 1_000),
    trustProxy: boolVar(env, "TRUST_PROXY", d.trustProxy),
    logLevel: logLevelVar(env["LOG_LEVEL"]),
  };
}

function intVar(
  env: Env,
  name: string,
  fallback: number,
  min: number,
  max = Number.MAX_SAFE_INTEGER,
): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ConfigError(name, raw, `an integer in [${min}, ${max}]`);
  }
  return value;
}

function boolVar(env: Env, name: string, fallback: boolean): boolean {
  const raw = env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  throw new ConfigError(name, raw, "true or false");
}

function originsVar(env: Env): readonly string[] | "*" {
  const trimmed = env["ALLOWED_ORIGINS"]?.trim();
  if (!trimmed || trimmed === "*") {
    const production = env["NODE_ENV"] === "production";
    if (production && !boolVar(env, "ALLOW_ANY_ORIGIN", false)) {
      throw new ConfigError(
        "ALLOWED_ORIGINS",
        trimmed ?? "",
        "an explicit origin list in production (or ALLOW_ANY_ORIGIN=true)",
      );
    }
    return "*";
  }
  const origins = trimmed
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
  for (const origin of origins) {
    if (!/^https?:\/\/[^/\s]+$/.test(origin)) {
      throw new ConfigError(
        "ALLOWED_ORIGINS",
        origin,
        "origins like https://user.github.io",
      );
    }
  }
  return origins;
}

function logLevelVar(raw: string | undefined): LogLevel {
  const value = raw?.trim().toLowerCase();
  if (!value) return DEFAULT_CONFIG.logLevel;
  if (LOG_LEVELS.includes(value as LogLevel)) return value as LogLevel;
  throw new ConfigError("LOG_LEVEL", value, LOG_LEVELS.join(", "));
}

/**
 * @param config - Relay settings.
 * @param origin - The request's Origin header (absent for non-browser clients).
 * @returns Whether a socket from that origin may connect.
 */
export function isOriginAllowed(
  config: Pick<ServerConfig, "allowedOrigins">,
  origin: string | undefined,
): boolean {
  if (config.allowedOrigins === "*") return true;
  if (!origin) return true;
  return config.allowedOrigins.includes(origin.replace(/\/$/, ""));
}
