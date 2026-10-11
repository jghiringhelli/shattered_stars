/**
 * reinforcementConfig — reads the reinforced battle out of the registry's
 * battle config (`battle: "reinforcements"` plus an optional
 * `reinforcements` block from the Squad Builder or a test):
 *
 * ```ts
 * {
 *   battle: "reinforcements",
 *   reinforcements: {
 *     format?: "skirmish" | "epic" | "scenario",  // inferred when absent
 *     poolPoints?: number, fieldCapPoints?: number,
 *     choice?: "open" | "planned",
 *     sides?: { [factionId]: { strategy?: StrategyId, reserve?: ReserveEntry[] } },
 *   },
 * }
 * ```
 *
 * Anything malformed falls back to the format's defaults. Pure.
 */

import { rulesFor } from "./reinforcementRules";
import { isStrategyId } from "./strategyPresets";
import type {
  ReinforcementChoice,
  ReinforcementFormat,
  ReinforcementRules,
  ReserveEntry,
  StrategyId,
} from "./reinforcementTypes";

/** The battle-config value that turns reinforcements on. */
export const REINFORCEMENTS_BATTLE = "reinforcements";

/** One side's plan: its strategy, and the player's explicit reserve (or null). */
export interface SidePlan {
  readonly strategy: StrategyId;
  readonly reserve: readonly ReserveEntry[] | null;
}

/** A reinforced battle's rules and every faction's plan. */
export interface ReinforcementSetup {
  readonly rules: ReinforcementRules;
  readonly sides: Readonly<Record<string, SidePlan>>;
}

type Loose = Readonly<Record<string, unknown>>;

/**
 * @param battleConfig - The registry's battle config.
 * @returns The setup, or null for a classic battle.
 */
export function parseReinforcementSetup(
  battleConfig: unknown,
): ReinforcementSetup | null {
  if (!isRecord(battleConfig)) return null;
  if (battleConfig["battle"] !== REINFORCEMENTS_BATTLE) return null;
  const block = isRecord(battleConfig["reinforcements"])
    ? battleConfig["reinforcements"]
    : {};
  const base = rulesFor(formatOf(battleConfig, block), {
    ...numberField(block, "poolPoints"),
    ...numberField(block, "fieldCapPoints"),
  });
  const choice = block["choice"];
  const rules: ReinforcementRules = isChoice(choice)
    ? { ...base, choice }
    : base;
  return { rules, sides: sidePlans(battleConfig, block) };
}

/**
 * @param raw - Anything.
 * @returns The well-formed reserve entries in it (others dropped).
 */
export function parseReserveEntries(raw: unknown): ReserveEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item: unknown) => {
    if (!isRecord(item) || typeof item["definitionId"] !== "string") return [];
    const loadoutId = item["loadoutId"];
    return [
      {
        definitionId: item["definitionId"],
        loadoutId: typeof loadoutId === "string" ? loadoutId : null,
      },
    ];
  });
}

function formatOf(config: Loose, block: Loose): ReinforcementFormat {
  const explicit = block["format"];
  if (explicit === "skirmish" || explicit === "epic" || explicit === "scenario")
    return explicit;
  if (typeof config["scenario"] === "string") return "scenario";
  return config["gameMode"] === "epic" ? "epic" : "skirmish";
}

function sidePlans(config: Loose, block: Loose): Record<string, SidePlan> {
  const declared = isRecord(block["sides"]) ? block["sides"] : {};
  const plans: Record<string, SidePlan> = {};
  const factions = Array.isArray(config["factions"]) ? config["factions"] : [];
  const ids = factions.flatMap((slot: unknown) =>
    isRecord(slot) && typeof slot["factionId"] === "string"
      ? [slot["factionId"]]
      : [],
  );
  for (const id of new Set([...ids, ...Object.keys(declared)])) {
    const raw = declared[id];
    const side = isRecord(raw) ? raw : {};
    const strategy = side["strategy"];
    plans[id] = {
      strategy: isStrategyId(strategy) ? strategy : "balanced",
      reserve: Array.isArray(side["reserve"])
        ? parseReserveEntries(side["reserve"])
        : null,
    };
  }
  return plans;
}

function numberField(
  block: Loose,
  key: "poolPoints" | "fieldCapPoints",
): { [K in typeof key]?: number } {
  const value = block[key];
  return typeof value === "number" ? { [key]: value } : {};
}

function isChoice(value: unknown): value is ReinforcementChoice {
  return value === "open" || value === "planned";
}

function isRecord(value: unknown): value is Loose {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
