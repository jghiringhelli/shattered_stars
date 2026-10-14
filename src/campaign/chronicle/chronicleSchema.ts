/**
 * chronicleSchema — validates a raw Chronicle (any shape) into the current
 * schema: every known field is type-checked and kept, anything malformed falls
 * back to the empty value. Only non-objects are rejected. Pure.
 */

import type { FactionId } from "../../config";
import { CHRONICLE_FLAGS, CROSSOVERS } from "../../data/campaign/crossovers";
import type { EndingId } from "../../data/campaign/crossovers";
import {
  CHRONICLE_VERSION,
  type ChronicleData,
  type CrossoverRecord,
} from "./chronicleTypes";

type Raw = Record<string, unknown>;

const FACTIONS: readonly FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];
const ENDINGS: readonly EndingId[] = ["answer", "sever", "seal", "quiet"];
const CROSSOVER_IDS: ReadonlySet<string> = new Set(CROSSOVERS.map((c) => c.id));

const isRecord = (value: unknown): value is Raw =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const asFaction = (value: unknown): FactionId | undefined =>
  FACTIONS.find((f) => f === value);

/**
 * @param value - Raw crossover record.
 * @returns A valid record, or null.
 */
function recordOf(value: unknown): CrossoverRecord | null {
  if (!isRecord(value)) return null;
  const canon = asFaction(value["canonFaction"]);
  if (!canon || typeof value["canonMissionId"] !== "string") return null;
  const witnesses = Array.isArray(value["witnesses"])
    ? value["witnesses"].map(asFaction).filter((f): f is FactionId => !!f)
    : [];
  return {
    canonFaction: canon,
    canonMissionId: value["canonMissionId"],
    witnesses: [...new Set([canon, ...witnesses])],
  };
}

/**
 * @param raw - Parsed JSON.
 * @returns The Chronicle, or null when it is not an object.
 */
export function migrateChronicle(raw: unknown): ChronicleData | null {
  if (!isRecord(raw)) return null;
  const flags: Record<string, boolean> = {};
  if (isRecord(raw["flags"]))
    for (const [flag, value] of Object.entries(raw["flags"]))
      if (value === true && CHRONICLE_FLAGS.has(flag)) flags[flag] = true;
  const crossovers: Record<string, CrossoverRecord> = {};
  if (isRecord(raw["crossovers"]))
    for (const [id, value] of Object.entries(raw["crossovers"])) {
      const record = recordOf(value);
      if (record && CROSSOVER_IDS.has(id)) crossovers[id] = record;
    }
  const actsComplete: Record<string, number[]> = {};
  if (isRecord(raw["actsComplete"]))
    for (const [id, acts] of Object.entries(raw["actsComplete"]))
      if (Array.isArray(acts))
        actsComplete[id] = [
          ...new Set(acts.filter((a): a is number => Number.isInteger(a))),
        ].sort((a, b) => a - b);
  const ending = ENDINGS.find((e) => e === raw["ending"]) ?? null;
  return {
    version: CHRONICLE_VERSION,
    flags,
    crossovers,
    actsComplete,
    freeOrder: raw["freeOrder"] === true,
    ending,
  };
}
