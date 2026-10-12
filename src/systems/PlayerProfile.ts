/**
 * Player Profile store — global, cross-mode progression persisted to localStorage.
 *
 * Holds multiple named profiles (including seeded dev/test profiles) and awards XP from
 * battle outcomes. All unlock DECISIONS live in ProgressionData (pure); this module only
 * owns state + persistence. See docs/specs/progression.md and docs/adr/ADR-0002.
 */

import type { FactionId } from "../config";
import { XP_REWARDS } from "../data/ProgressionData";
import { browserStore } from "./keyValueStore";

export interface PlayerProfileStats {
  battles: number;
  kills: number;
  wins: number;
  losses: number;
}

/** Structurally compatible with ProgressionData.ProgressionState (mutable superset). */
export interface PlayerProfile {
  id: string;
  name: string;
  totalXp: number;
  unlockAll: boolean;
  unlockedFactionIds: FactionId[];
  unlockedShipIds: string[];
  stats: PlayerProfileStats;
  createdAt: number;
  lastPlayed: number;
}

interface ProfileStore {
  version: number;
  activeId: string;
  profiles: PlayerProfile[];
}

const STORAGE_KEY = "shattered_stars_profiles";
const STORE_VERSION = 1;

function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultStats(): PlayerProfileStats {
  return { battles: 0, kills: 0, wins: 0, losses: 0 };
}

/** Build a profile with sensible defaults; `opts` overrides individual fields. */
export function createProfile(
  name: string,
  opts: Partial<PlayerProfile> = {},
): PlayerProfile {
  const now = Date.now();
  return {
    id: opts.id ?? newId(),
    name,
    totalXp: opts.totalXp ?? 0,
    unlockAll: opts.unlockAll ?? false,
    unlockedFactionIds: opts.unlockedFactionIds ?? [],
    unlockedShipIds: opts.unlockedShipIds ?? [],
    stats: opts.stats ?? defaultStats(),
    createdAt: opts.createdAt ?? now,
    lastPlayed: now,
  };
}

/** Seed set (PRG-8): fresh player + dev unlock-all + graded progression-test profiles. */
function seedStore(): ProfileStore {
  const player = createProfile("Comandante", { id: "player-default" });
  const dev = createProfile("DEV — Todo Desbloqueado", {
    id: "dev-unlock-all",
    unlockAll: true,
  });
  const novice = createProfile("Test — Novato", {
    id: "test-novice",
    totalXp: 0,
  });
  const veteran = createProfile("Test — Veterano", {
    id: "test-veteran",
    totalXp: 3000,
  });
  const admiral = createProfile("Test — Almirante", {
    id: "test-admiral",
    totalXp: 8000,
  });
  return {
    version: STORE_VERSION,
    activeId: player.id,
    profiles: [player, dev, novice, veteran, admiral],
  };
}

function persist(store: ProfileStore): void {
  try {
    browserStore().setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.error("Failed to save player profiles:", e);
  }
}

function readStore(): ProfileStore {
  try {
    const raw = browserStore().getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedStore();
      persist(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as ProfileStore;
    if (!parsed.profiles?.length) throw new Error("empty profiles");
    return parsed;
  } catch {
    const seeded = seedStore();
    persist(seeded);
    return seeded;
  }
}

export const PlayerProfileManager = {
  STORAGE_KEY,

  /** All profiles, seeding the store on first use. */
  list(): PlayerProfile[] {
    return readStore().profiles;
  },

  /** The currently active profile (falls back to the first if the id is stale). */
  getActive(): PlayerProfile {
    const store = readStore();
    const active = store.profiles.find((p) => p.id === store.activeId);
    return active ?? (store.profiles[0] as PlayerProfile);
  },

  /** Switch the active profile; no-op if the id is unknown. */
  setActive(id: string): void {
    const store = readStore();
    if (!store.profiles.some((p) => p.id === id)) return;
    store.activeId = id;
    persist(store);
  },

  /** Create and persist a new profile, returning it. */
  create(name: string, opts: Partial<PlayerProfile> = {}): PlayerProfile {
    const store = readStore();
    const profile = createProfile(name, opts);
    store.profiles.push(profile);
    persist(store);
    return profile;
  },

  /** Replace a profile by id (matched on `id`) and persist. */
  update(profile: PlayerProfile): void {
    const store = readStore();
    const idx = store.profiles.findIndex((p) => p.id === profile.id);
    if (idx === -1) return;
    store.profiles[idx] = { ...profile, lastPlayed: Date.now() };
    persist(store);
  },

  /** Add XP to a profile (never negative) and return the updated profile. */
  addXp(id: string, amount: number): PlayerProfile | null {
    const store = readStore();
    const profile = store.profiles.find((p) => p.id === id);
    if (!profile) return null;
    profile.totalXp += Math.max(0, Math.floor(amount));
    profile.lastPlayed = Date.now();
    persist(store);
    return profile;
  },

  /** Award XP + stats for a finished battle (PRG-6) and return the updated profile. */
  awardBattleResult(
    id: string,
    result: { kills: number; won: boolean },
  ): PlayerProfile | null {
    const store = readStore();
    const profile = store.profiles.find((p) => p.id === id);
    if (!profile) return null;
    const kills = Math.max(0, Math.floor(result.kills));
    profile.totalXp +=
      kills * XP_REWARDS.perKill +
      (result.won ? XP_REWARDS.win : XP_REWARDS.loss);
    profile.stats.battles += 1;
    profile.stats.kills += kills;
    if (result.won) profile.stats.wins += 1;
    else profile.stats.losses += 1;
    profile.lastPlayed = Date.now();
    persist(store);
    return profile;
  },

  /** Delete a profile; refuses to delete the last remaining profile. */
  delete(id: string): void {
    const store = readStore();
    if (store.profiles.length <= 1) return;
    store.profiles = store.profiles.filter((p) => p.id !== id);
    if (store.activeId === id)
      store.activeId = (store.profiles[0] as PlayerProfile).id;
    persist(store);
  },
};
