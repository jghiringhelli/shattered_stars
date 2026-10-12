/**
 * onlineConfig — which relay the game connects to, and which build it is.
 *
 * Server URL, first match wins:
 * 1. `?server=wss://…` in the page URL (testing a deploy, playtests),
 * 2. the player's override in the online settings (stored locally),
 * 3. `VITE_ONLINE_URL` baked in at build time (the published alpha),
 * 4. in dev builds only, a relay on this machine (`npm run start:server`).
 * Normal players never type an address.
 *
 * The build id (`VITE_GAME_BUILD`, the commit in CI) must match between
 * players: the relay only pairs and seats identical builds.
 */

import type { KeyValueStore } from "../systems/keyValueStore";

/** Local-storage key of the player's server override. */
export const SERVER_OVERRIDE_KEY = "ss_online_server_v1";
/** Session-storage key of the resume token (survives a reload, not a new tab). */
export const SESSION_TOKEN_KEY = "ss_online_session_v1";
/** Local-storage key of the player's online name. */
export const PLAYER_NAME_KEY = "ss_online_name_v1";
/** Dev-only fallback relay (`npm run start:server`). */
export const DEV_SERVER_URL = "ws://localhost:8080/ws";
/** WebSocket path of the relay. */
export const RELAY_PATH = "/ws";

/** Where the URL came from (shown in the lobby). */
export type ServerUrlSource = "query" | "settings" | "build" | "dev" | "none";

/** Inputs to {@link resolveServerUrl}. */
export interface ServerUrlSources {
  readonly query: string | null;
  readonly override: string | null;
  readonly buildDefault: string | undefined;
  readonly isDev: boolean;
}

/**
 * @param raw - A user- or build-supplied address ("relay.fly.dev", "https://…", "wss://…/ws").
 * @returns A ws:// or wss:// URL ending in the relay path, or null when unusable.
 */
export function normalizeServerUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z]+:\/\//i.test(trimmed)
    ? trimmed
    : `wss://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  const scheme = {
    "https:": "wss:",
    "http:": "ws:",
    "wss:": "wss:",
    "ws:": "ws:",
  }[url.protocol];
  if (!scheme || !url.hostname) return null;
  const path =
    url.pathname === "/" || url.pathname === ""
      ? RELAY_PATH
      : url.pathname.replace(/\/$/, "");
  return `${scheme}//${url.host}${path}`;
}

/**
 * @param sources - Query parameter, stored override, build default, dev flag.
 * @returns The relay URL and where it came from (null when none is configured).
 */
export function resolveServerUrl(sources: ServerUrlSources): {
  url: string | null;
  source: ServerUrlSource;
} {
  const candidates: Array<[string | null | undefined, ServerUrlSource]> = [
    [sources.query, "query"],
    [sources.override, "settings"],
    [sources.buildDefault, "build"],
    [sources.isDev ? DEV_SERVER_URL : null, "dev"],
  ];
  for (const [raw, source] of candidates) {
    const url = raw ? normalizeServerUrl(raw) : null;
    if (url) return { url, source };
  }
  return { url: null, source: "none" };
}

/**
 * @param store - Local storage.
 * @param url - New override, or null / "" to clear it (back to the default).
 * @returns The stored normalized URL, or null when cleared or invalid.
 */
export function saveServerOverride(
  store: KeyValueStore,
  url: string | null,
): string | null {
  const normalized = url ? normalizeServerUrl(url) : null;
  if (normalized) store.setItem(SERVER_OVERRIDE_KEY, normalized);
  else store.removeItem(SERVER_OVERRIDE_KEY);
  return normalized;
}

/** @returns The relay URL baked in at build time, if any. */
export function buildServerUrl(): string | undefined {
  const value = import.meta.env["VITE_ONLINE_URL"] as string | undefined;
  return value && value.trim() ? value : undefined;
}

/** @returns This client's build id (players must match to play together). */
export function gameBuildId(): string {
  const value = import.meta.env["VITE_GAME_BUILD"] as string | undefined;
  return value && value.trim() ? value.trim().slice(0, 40) : "dev";
}
