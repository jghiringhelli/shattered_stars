/**
 * Survival roguelite — saving and resuming a run (save at every map node).
 *
 * The save is a versioned JSON RunState under its own key, separate from
 * campaign saves and the meta profile. Loading validates the shape and
 * migrates older versions; anything corrupt or from a newer build is
 * discarded rather than crashing the menu.
 */

import { ALL_FACTIONS } from "../../data/survival/enemyFactions";
import { BRANCHES } from "../../data/survival/model";
import { SECTOR_COUNT } from "../../data/survival/sectors";
import {
  isFiniteNumber,
  isRecord,
  readJson,
  type KeyValueStore,
} from "./KeyValueStore";
import { RUN_SCHEMA_VERSION, type RunState } from "./RunTypes";

/** localStorage key of the in-progress Survival run. */
export const RUN_SAVE_KEY = "shattered_stars_survival_run";

/** Upgrades raw saves of an older version to the next one. */
type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/**
 * Migrations by source version. v1 is the first roguelite schema, so
 * there is nothing to migrate yet; add `1: (raw) => ({ ...raw, version: 2 })`
 * when the schema changes.
 */
const RUN_MIGRATIONS: Readonly<Record<number, Migration>> = {};

/**
 * @param store - The storage port.
 * @param run - The run to persist.
 */
export function saveRun(store: KeyValueStore, run: RunState): void {
  store.setItem(RUN_SAVE_KEY, JSON.stringify(run));
}

/**
 * @param store - The storage port.
 * @returns The saved active run, or null when none / invalid / finished.
 */
export function loadRun(store: KeyValueStore): RunState | null {
  const migrated = migrateRun(readJson(store, RUN_SAVE_KEY));
  if (!migrated || !isValidRun(migrated)) return null;
  return migrated.status === "active" ? migrated : null;
}

/** @param store - The storage port. */
export function clearRun(store: KeyValueStore): void {
  store.removeItem(RUN_SAVE_KEY);
}

/**
 * @param raw - Parsed save JSON.
 * @returns The save at RUN_SCHEMA_VERSION, or null when it cannot be read.
 */
export function migrateRun(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw) || !isFiniteNumber(raw["version"])) return null;
  let current = raw;
  while ((current["version"] as number) < RUN_SCHEMA_VERSION) {
    const step = RUN_MIGRATIONS[current["version"] as number];
    if (!step) return null;
    current = step(current);
  }
  return current["version"] === RUN_SCHEMA_VERSION ? current : null;
}

/**
 * @param raw - A migrated save.
 * @returns True when it has every field a RunState needs.
 */
export function isValidRun(
  raw: Record<string, unknown>,
): raw is Record<string, unknown> & RunState {
  const numbers = [
    "seed",
    "ascension",
    "sector",
    "salvage",
    "rerolls",
    "rerollsSpentHere",
    "startedAt",
  ];
  if (!numbers.every((key) => isFiniteNumber(raw[key]))) return false;
  if (!ALL_FACTIONS.includes(raw["faction"] as never)) return false;
  const sector = raw["sector"] as number;
  if (sector < 1 || sector > SECTOR_COUNT) return false;
  const arrays = [
    "path",
    "relics",
    "escorts",
    "pools",
    "pendingRewards",
    "seenEvents",
    "shopBought",
    "log",
  ];
  if (!arrays.every((key) => Array.isArray(raw[key]))) return false;
  if (!isValidShip(raw["flagship"])) return false;
  if (!(raw["escorts"] as unknown[]).every(isValidShip)) return false;
  return (
    isValidMap(raw["map"]) &&
    isValidProgression(raw["progression"]) &&
    isRecord(raw["stats"])
  );
}

function isValidShip(raw: unknown): boolean {
  return (
    isRecord(raw) &&
    typeof raw["definitionId"] === "string" &&
    (raw["loadoutId"] === null || typeof raw["loadoutId"] === "string") &&
    isFiniteNumber(raw["hull"]) &&
    isFiniteNumber(raw["shields"]) &&
    isFiniteNumber(raw["upgrades"])
  );
}

function isValidMap(raw: unknown): boolean {
  if (!isRecord(raw) || !Array.isArray(raw["rows"]) || raw["rows"].length === 0)
    return false;
  return (raw["rows"] as unknown[]).every(
    (row) =>
      Array.isArray(row) &&
      row.every(
        (node) =>
          isRecord(node) &&
          typeof node["id"] === "string" &&
          Array.isArray(node["next"]),
      ),
  );
}

function isValidProgression(raw: unknown): boolean {
  if (!isRecord(raw) || !isRecord(raw["branch"]) || !isRecord(raw["bonuses"]))
    return false;
  const branch = raw["branch"];
  return (
    isFiniteNumber(raw["level"]) &&
    BRANCHES.every((b) => isFiniteNumber(branch[b]))
  );
}
