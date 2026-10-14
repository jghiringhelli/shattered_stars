/**
 * Survival roguelite — run state contracts (pure data). A RunState is a
 * plain, JSON-serialisable snapshot: it is what gets saved at every map
 * node and restored by "Continue run". All randomness is re-derived from
 * `seed` (RunRng), so no RNG state is stored.
 */

import type { FactionId } from "../../config";
import type { SurvivalRunState } from "../../data/survival/model";
import type { MutationSlot } from "../../data/survival/mutations";
import type { RelicPool, RelicRarity } from "../../data/survival/relics";
import type { EventOutcome } from "../../data/survival/eventTypes";
import type { SectorMap } from "./SectorMapGenerator";

/** Version of the saved run schema (bump + migrate on change). */
export const RUN_SCHEMA_VERSION = 1;

/** One ship of the player's fleet between battles. */
export interface ShipRecord {
  readonly definitionId: string;
  readonly loadoutId: string | null;
  /** Hull left as a fraction of max (damage persists between nodes). */
  readonly hull: number;
  /** Shields left as a fraction of max. */
  readonly shields: number;
  /** Repair-dock / event upgrade level (0..MAX_SHIP_UPGRADES). */
  readonly upgrades: number;
}

/** Run-long counters for the summary and history. */
export interface RunStats {
  readonly kills: number;
  readonly elitesKilled: number;
  readonly bossesKilled: number;
  readonly nodesCleared: number;
  readonly salvageEarned: number;
  readonly escortsLost: number;
  /** Star Charts found in events (added to the end-of-run payout). */
  readonly bonusCharts: number;
  /** Total played time (ms): battles plus map time. */
  readonly elapsedMs: number;
}

/** What the current node turned out to be once entered. */
export type ResolvedNodeKind =
  "combat" | "elite" | "boss" | "event" | "shop" | "repair" | "treasure";

/** A reward the player still has to claim on the map. */
export type PendingReward =
  | { readonly kind: "power"; readonly key: string }
  | {
      readonly kind: "relic";
      readonly key: string;
      readonly minRarity: RelicRarity;
    }
  | { readonly kind: "hangar" }
  | { readonly kind: "mutation"; readonly slot: MutationSlot }
  | { readonly kind: "nextSector" };

/** A battle an event started (fight now, bonus outcomes after victory). */
export interface EventCombat {
  readonly elite: boolean;
  /** A creature the battle adds to its last wave (Survival events). */
  readonly creature?: string | undefined;
  readonly bonus: readonly EventOutcome[];
}

export type RunStatus = "active" | "victory" | "defeat" | "abandoned";

/** The whole state of a Survival roguelite run. */
export interface RunState {
  readonly version: number;
  readonly seed: number;
  readonly faction: FactionId;
  readonly ascension: number;
  readonly sector: number;
  readonly map: SectorMap;
  /** Last node resolved in this sector (null at sector start). */
  readonly currentNodeId: string | null;
  /** Node entered but not finished (a battle in progress, an open shop…). */
  readonly activeNodeId: string | null;
  readonly activeKind: ResolvedNodeKind | null;
  readonly activeEventId: string | null;
  readonly eventCombat: EventCombat | null;
  /** Node ids visited this sector, in order (the drawn path). */
  readonly path: readonly string[];
  readonly salvage: number;
  readonly rerolls: number;
  /** Rerolls spent on the reward currently on screen (re-derives its draw). */
  readonly rerollsSpentHere: number;
  readonly relics: readonly string[];
  readonly mutations: Readonly<Partial<Record<MutationSlot, string>>>;
  readonly flagship: ShipRecord;
  readonly escorts: readonly ShipRecord[];
  readonly progression: SurvivalRunState;
  readonly pools: readonly RelicPool[];
  readonly pendingRewards: readonly PendingReward[];
  readonly seenEvents: readonly string[];
  /** Shop item ids bought at the shop currently open. */
  readonly shopBought: readonly string[];
  readonly stats: RunStats;
  readonly status: RunStatus;
  readonly cause: string | null;
  /** Wall-clock start (ms since epoch). */
  readonly startedAt: number;
  /** Most recent notable messages (newest last). */
  readonly log: readonly string[];
}

/** Messages kept in the run log. */
export const RUN_LOG_LIMIT = 6;
