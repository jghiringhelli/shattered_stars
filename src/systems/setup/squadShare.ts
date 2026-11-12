/**
 * squadShare — SHARE CODES for builder squads and the SAVED SQUADS library.
 *
 * A code is `SS1:` + base64 of `{ v, f, s, l }` (faction, ships, loadout
 * picks). Decoding validates everything: shape, size limits, that every ship
 * exists and belongs to the faction. Pure apart from the injected store.
 */

import { getShipDefinition } from "../../data/ShipDefinitions";
import { browserStore, type KeyValueStore } from "../keyValueStore";
import type { SquadMemory } from "./setupMemory";
import { isWingmenType, type WingmenType } from "./wingmenTypes";

/** Prefix that marks a share code. */
export const SHARE_CODE_PREFIX = "SS1:";
/** Most ships a code may carry. */
export const MAX_SHARED_SHIPS = 12;
/** Longest accepted loadout id. */
const MAX_ID_LENGTH = 64;
/** Library storage key and capacity. */
export const SQUAD_LIBRARY_KEY = "ss_saved_squads_v1";
export const MAX_SAVED_SQUADS = 20;
/** Longest saved-squad name. */
export const MAX_SQUAD_NAME = 32;

/** The part of a squad that is shared (`wingmen`: Skirmish WINGMEN choice, absent in older codes). */
export type SharedSquad = Pick<SquadMemory, "factionId" | "ships" | "loadoutChoices"> & {
  readonly wingmen?: WingmenType;
};

/** Ship lookup (injectable for tests). */
export type FactionOfShip = (shipId: string) => string | undefined;

const LIVE_FACTION_OF: FactionOfShip = (id) => getShipDefinition(id)?.faction;

/** Result of decoding a code. */
export type DecodedSquad =
  | { readonly squad: SharedSquad }
  | { readonly error: string };

/**
 * @param squad - A builder squad.
 * @returns Its share code.
 */
export function encodeSquadCode(squad: SharedSquad): string {
  const payload = {
    v: 1,
    f: squad.factionId,
    s: squad.ships,
    l: squad.loadoutChoices,
    ...(squad.wingmen ? { w: squad.wingmen } : {}),
  };
  return SHARE_CODE_PREFIX + btoa(JSON.stringify(payload));
}

function isIdMap(value: unknown, shipCount: number): value is Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.entries(value).every(
    ([key, id]) =>
      Number.isInteger(Number(key)) &&
      Number(key) >= 0 &&
      Number(key) < shipCount &&
      typeof id === "string" &&
      id.length > 0 &&
      id.length <= MAX_ID_LENGTH,
  );
}

/**
 * @param code - Text pasted by the player.
 * @param factionOf - Ship → faction lookup (default: the game's catalog).
 * @returns The squad, or why the code is unusable.
 */
export function decodeSquadCode(
  code: string,
  factionOf: FactionOfShip = LIVE_FACTION_OF,
): DecodedSquad {
  const text = code.trim();
  if (!text.startsWith(SHARE_CODE_PREFIX)) return { error: "Not a squad code" };
  let data: unknown;
  try {
    data = JSON.parse(atob(text.slice(SHARE_CODE_PREFIX.length)));
  } catch {
    return { error: "The code is damaged" };
  }
  if (typeof data !== "object" || data === null) return { error: "The code is damaged" };
  const { v, f, s, l, w } = data as Record<string, unknown>;
  if (v !== 1) return { error: "Unsupported code version" };
  if (typeof f !== "string") return { error: "The code is damaged" };
  if (!Array.isArray(s) || s.length === 0 || s.length > MAX_SHARED_SHIPS)
    return { error: "Squad size is not valid" };
  if (!s.every((id) => typeof id === "string")) return { error: "The code is damaged" };
  const unknownShip = (s as string[]).find((id) => factionOf(id) === undefined);
  if (unknownShip) return { error: `Unknown ship: ${unknownShip}` };
  if ((s as string[]).some((id) => factionOf(id) !== f))
    return { error: "A ship does not belong to the squad's faction" };
  if (l !== undefined && !isIdMap(l, s.length)) return { error: "Loadouts are not valid" };
  return {
    squad: {
      factionId: f,
      ships: s as string[],
      loadoutChoices: (l ?? {}) as Record<string, string>,
      ...(isWingmenType(w) ? { wingmen: w } : {}),
    },
  };
}

/** One saved squad. */
export interface SavedSquad {
  readonly id: string;
  readonly name: string;
  readonly savedAt: number;
  readonly squad: SharedSquad;
}

function readLibrary(store: KeyValueStore, factionOf: FactionOfShip): SavedSquad[] {
  try {
    const parsed: unknown = JSON.parse(store.getItem(SQUAD_LIBRARY_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry: unknown): SavedSquad[] => {
      const e = entry as Partial<SavedSquad> | null;
      if (typeof e?.id !== "string" || typeof e.name !== "string" || !e.squad) return [];
      const decoded = decodeSquadCode(encodeSquadCode(e.squad), factionOf);
      return "squad" in decoded
        ? [{ id: e.id, name: e.name, savedAt: Number(e.savedAt) || 0, squad: decoded.squad }]
        : [];
    });
  } catch {
    return [];
  }
}

/**
 * @param store - Storage (default: the browser's safe store).
 * @param factionOf - Ship lookup used to drop entries with retired ships.
 * @returns The saved squads, newest first.
 */
export function listSavedSquads(
  store: KeyValueStore = browserStore(),
  factionOf: FactionOfShip = LIVE_FACTION_OF,
): readonly SavedSquad[] {
  return readLibrary(store, factionOf).sort((a, b) => b.savedAt - a.savedAt);
}

/**
 * Save a squad under a name (an existing name is replaced; the oldest entry
 * goes when the library is full).
 *
 * @param name - Display name (trimmed, limited to {@link MAX_SQUAD_NAME}).
 * @param squad - The squad.
 * @param store - Storage (default: the browser's safe store).
 * @param now - Clock (ms).
 * @returns The library after saving, or an error for an empty name.
 */
export function saveSquad(
  name: string,
  squad: SharedSquad,
  store: KeyValueStore = browserStore(),
  now: () => number = Date.now,
  factionOf: FactionOfShip = LIVE_FACTION_OF,
): readonly SavedSquad[] | { readonly error: string } {
  const trimmed = name.trim().slice(0, MAX_SQUAD_NAME);
  if (trimmed.length === 0) return { error: "Give the squad a name" };
  const kept = listSavedSquads(store, factionOf).filter(
    (s) => s.name.toLowerCase() !== trimmed.toLowerCase(),
  );
  const next = [{ id: `sq_${now()}`, name: trimmed, savedAt: now(), squad }, ...kept]
    .slice(0, MAX_SAVED_SQUADS);
  store.setItem(SQUAD_LIBRARY_KEY, JSON.stringify(next));
  return next;
}

/**
 * @param id - Saved squad id.
 * @param store - Storage (default: the browser's safe store).
 * @param factionOf - Ship lookup used to drop entries with retired ships.
 * @returns The library after deleting.
 */
export function deleteSavedSquad(
  id: string,
  store: KeyValueStore = browserStore(),
  factionOf: FactionOfShip = LIVE_FACTION_OF,
): readonly SavedSquad[] {
  const next = listSavedSquads(store, factionOf).filter((s) => s.id !== id);
  store.setItem(SQUAD_LIBRARY_KEY, JSON.stringify(next));
  return next;
}
