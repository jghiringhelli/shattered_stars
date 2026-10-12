/**
 * createOnlineSession — the online composition root: builds the browser
 * OnlineSession (WebSocket transport, real clock, local / session storage,
 * page query) once and keeps it in the game registry so the room survives
 * scene changes (lobby → squad builder → lobby → battle → lobby).
 */

import {
  browserStore,
  createSafeStore,
  type KeyValueStore,
} from "../../systems/keyValueStore";
import { NetClient, type TokenStore } from "../client/NetClient";
import {
  buildServerUrl,
  gameBuildId,
  PLAYER_NAME_KEY,
  resolveServerUrl,
  saveServerOverride,
  SERVER_OVERRIDE_KEY,
  SESSION_TOKEN_KEY,
} from "../onlineConfig";
import { NET_LIMITS } from "../protocol";
import { createSystemScheduler } from "../time";
import { createWebSocketTransport } from "../transport/Transport";
import { OnlineSession } from "./OnlineSession";

/** Game-registry key of the OnlineSession. */
export const ONLINE_SESSION_KEY = "onlineSession";
/** Range of the random suffix in default pilot names. */
const NAME_SUFFIX_RANGE = 10_000;

/** The registry slice used here (Phaser's DataManager satisfies it). */
export interface SessionRegistry {
  get(key: string): unknown;
  set(key: string, value: unknown): unknown;
}

/**
 * @param registry - The game registry.
 * @returns The game's OnlineSession (created on first use).
 */
export function getOnlineSession(registry: SessionRegistry): OnlineSession {
  const existing = registry.get(ONLINE_SESSION_KEY);
  if (existing instanceof OnlineSession) return existing;
  const session = buildSession(browserStore());
  registry.set(ONLINE_SESSION_KEY, session);
  return session;
}

/**
 * Point the game at another relay (or back to the default with an empty
 * value): closes the old connection and builds a fresh session.
 *
 * @param registry - The game registry.
 * @param rawUrl - Address as typed ("" restores the default).
 * @returns The new session.
 */
export function changeServer(
  registry: SessionRegistry,
  rawUrl: string,
): OnlineSession {
  const store = browserStore();
  saveServerOverride(store, rawUrl);
  return rebuild(registry, store);
}

/**
 * @param registry - The game registry.
 * @param name - New pilot name (applies from the next connection).
 * @returns The new session.
 */
export function changePilotName(
  registry: SessionRegistry,
  name: string,
): OnlineSession {
  const store = browserStore();
  const trimmed = name.trim().slice(0, NET_LIMITS.nameMaxLength);
  if (trimmed) store.setItem(PLAYER_NAME_KEY, trimmed);
  return rebuild(registry, store);
}

/** @returns The stored pilot name (or a generated one). */
export function pilotName(store: KeyValueStore = browserStore()): string {
  const stored = store.getItem(PLAYER_NAME_KEY);
  if (stored) return stored;
  const generated = `Pilot-${String(Math.floor(Math.random() * NAME_SUFFIX_RANGE)).padStart(4, "0")}`;
  store.setItem(PLAYER_NAME_KEY, generated);
  return generated;
}

function rebuild(
  registry: SessionRegistry,
  store: KeyValueStore,
): OnlineSession {
  const existing = registry.get(ONLINE_SESSION_KEY);
  if (existing instanceof OnlineSession) existing.client.close();
  const session = buildSession(store);
  registry.set(ONLINE_SESSION_KEY, session);
  return session;
}

function buildSession(store: KeyValueStore): OnlineSession {
  const server = resolveServerUrl({
    query: new URLSearchParams(window.location.search).get("server"),
    override: store.getItem(SERVER_OVERRIDE_KEY),
    buildDefault: buildServerUrl(),
    isDev: import.meta.env.DEV,
  });
  const scheduler = createSystemScheduler();
  const client = new NetClient({
    url: server.url ?? "",
    build: gameBuildId(),
    name: pilotName(store),
    transport: createWebSocketTransport,
    scheduler,
    tokenStore: sessionTokenStore(),
  });
  return new OnlineSession(client, server, scheduler);
}

function sessionTokenStore(): TokenStore {
  const store = createSafeStore(() => window.sessionStorage);
  return {
    load: () => store.getItem(SESSION_TOKEN_KEY),
    save: (token) =>
      token
        ? store.setItem(SESSION_TOKEN_KEY, token)
        : store.removeItem(SESSION_TOKEN_KEY),
  };
}
