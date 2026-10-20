/**
 * strategyPresets — pre-planned deployment strategies, built from the
 * curated quick builds (SquadronPresets) and the faction's loadouts:
 * - Balanced: the faction's balanced / control quick-build squads in order;
 * - Swarm: its swarm squads and cheap swarm-role builds — many small ships;
 * - Aces: unique-pilot builds, each followed by a cheap escort;
 * - Heavy-Bombers: bombers and gunships (offense builds first), an escort
 *   every two heavies, led by a capital ship in Epic.
 * A rotation is the strategy's repeating order of ships; a reserve repeats
 * the rotation until it covers a budget (the player's editable list).
 *
 * Pure (reads the static data).
 */

import type { FactionId } from "../../config";
import {
  QUICK_BUILD_SQUADS,
  type QuickBuildSquad,
} from "../../data/SquadronPresets";
import { getLoadoutById } from "../../data/ShipLoadouts";
import { factionCatalog, isFormatShip, toDeployOption } from "./shipOptions";
import type {
  DeployOption,
  ReinforcementFormat,
  ReserveEntry,
  StrategyId,
} from "./reinforcementTypes";

/** Strategy ids in picker order. */
export const STRATEGY_IDS: readonly StrategyId[] = [
  "balanced",
  "swarm",
  "aces",
  "heavy",
];

/** Name and one-line summary of each strategy. */
export const STRATEGY_LABELS: Readonly<
  Record<StrategyId, { readonly name: string; readonly summary: string }>
> = {
  balanced: { name: "Balanced", summary: "Curated mixed squads" },
  swarm: { name: "Swarm", summary: "Many cheap fighters" },
  aces: { name: "Aces", summary: "Named pilots with escorts" },
  heavy: { name: "Heavy-Bombers", summary: "Bombers and gunships" },
};

/** Longest reserve list a player keeps (editor rows / storage). */
export const MAX_RESERVE_ENTRIES = 24;

/**
 * @param value - Anything.
 * @returns Whether it names a strategy.
 */
export function isStrategyId(value: unknown): value is StrategyId {
  return (
    typeof value === "string" &&
    (STRATEGY_IDS as readonly string[]).includes(value)
  );
}

/** Ships per rotation at most (keeps plans varied but short). */
const MAX_ROTATION = 12;

/**
 * Strategy knobs the balance sweeps tune as one table:
 * - heavyMaxCost: Heavy-Bombers skip hulls dearer than this (a 100-point
 *   gunship eats 40 % of the field cap and measures 15–25 % below its price);
 * - heaviesPerEscort: heavies that bring one escort (Heavy-Bombers);
 * - acesPerEscort: aces that bring one escort (Aces);
 * - balancedStyles: the curated quick-build styles Balanced rotates through;
 * - supportPerRotation: support hulls (aura projectors) every non-Balanced
 *   rotation brings once per lap, as Balanced's curated squads do (without
 *   them Balanced won 66–71 % of the strategy matrix, with one 59 %; round 5:
 *   three of them 57 %, with Swarm / Aces / Heavy at 46–49 %).
 */
export const STRATEGY_TUNING: {
  heavyMaxCost: number;
  heaviesPerEscort: number;
  acesPerEscort: number;
  balancedStyles: readonly QuickBuildSquad["style"][];
  supportPerRotation: number;
} = {
  heavyMaxCost: Number.POSITIVE_INFINITY,
  heaviesPerEscort: 2,
  acesPerEscort: 1,
  balancedStyles: ["balanced", "control"],
  supportPerRotation: 3,
};

/**
 * @param faction - The faction.
 * @param strategy - The strategy.
 * @param format - The battle's format (capital ships only in Epic).
 * @returns The strategy's repeating order of ships (never empty for a real faction).
 */
export function strategyRotation(
  faction: FactionId,
  strategy: StrategyId,
  format: ReinforcementFormat,
): ReserveEntry[] {
  const catalog = factionCatalog(faction, format);
  const planned = withSupport(
    PLANNERS[strategy](faction, catalog, format),
    catalog,
    strategy,
  );
  const rotation = (planned.length > 0 ? planned : catalog.slice(0, 3)).slice(
    0,
    MAX_ROTATION,
  );
  return rotation.map(toEntry);
}

/**
 * @param faction - The faction.
 * @param strategy - The strategy.
 * @param budgetPoints - Points the reserve should cover.
 * @param format - The battle's format.
 * @returns The rotation repeated until it covers the budget (capped length).
 */
export function buildReserve(
  faction: FactionId,
  strategy: StrategyId,
  budgetPoints: number,
  format: ReinforcementFormat,
): ReserveEntry[] {
  const rotation = strategyRotation(faction, strategy, format);
  const reserve: ReserveEntry[] = [];
  let total = 0;
  for (
    let i = 0;
    total < budgetPoints && reserve.length < MAX_RESERVE_ENTRIES;
    i++
  ) {
    const entry = rotation[i % rotation.length]!;
    reserve.push(entry);
    total += toDeployOption(entry)?.cost ?? 0;
  }
  return reserve;
}

/**
 * @param planned - A strategy's planned ships.
 * @param catalog - The faction's deployable ships.
 * @param strategy - The strategy.
 * @returns Non-Balanced plans with the cheapest generic support hulls added
 *   (STRATEGY_TUNING.supportPerRotation of them) after the first two ships.
 */
function withSupport(
  planned: readonly DeployOption[],
  catalog: readonly DeployOption[],
  strategy: StrategyId,
): DeployOption[] {
  const count = STRATEGY_TUNING.supportPerRotation;
  if (strategy === "balanced" || count <= 0 || planned.length === 0)
    return [...planned];
  const supports = catalog
    .filter((o) => o.role === "support" && isGeneric(o))
    .sort((a, b) => a.cost - b.cost)
    .slice(0, count);
  return [...planned.slice(0, 2), ...supports, ...planned.slice(2)];
}

type Planner = (
  faction: FactionId,
  catalog: readonly DeployOption[],
  format: ReinforcementFormat,
) => DeployOption[];

const PLANNERS: Readonly<Record<StrategyId, Planner>> = {
  balanced: (faction, catalog, format) => {
    const squads = quickBuildOptions(
      faction,
      STRATEGY_TUNING.balancedStyles,
      format,
    );
    return squads.length > 0 ? squads : catalog.filter(isGeneric);
  },
  swarm: (faction, catalog, format) => {
    const squads = quickBuildOptions(faction, ["swarm"], format);
    const swarmBuilds = catalog.filter(
      (o) => loadoutRole(o) === "swarm" || o.role === "light_fighter",
    );
    return dedupe([...squads, ...swarmBuilds]).filter(isGeneric);
  },
  aces: (_faction, catalog) => {
    const aces = catalog.filter(
      (o) => o.uniquePilotId !== null && !o.categories.includes("capital"),
    );
    const escorts = escortsOf(catalog);
    return interleave(aces, escorts, STRATEGY_TUNING.acesPerEscort);
  },
  heavy: (_faction, catalog, format) => {
    const heavies = catalog
      .filter(
        (o) =>
          (o.role === "bomber" || o.role === "gunship") &&
          isGeneric(o) &&
          o.cost <= STRATEGY_TUNING.heavyMaxCost,
      )
      .sort(byOffenseThenCost);
    const capital =
      format === "epic"
        ? catalog.filter(
            (o) => o.categories.includes("capital") && isGeneric(o),
          )
        : [];
    return [
      ...capital.slice(0, 1),
      ...interleave(
        heavies,
        escortsOf(catalog),
        STRATEGY_TUNING.heaviesPerEscort,
      ),
    ];
  },
};

function quickBuildOptions(
  faction: FactionId,
  styles: readonly QuickBuildSquad["style"][],
  format: ReinforcementFormat,
): DeployOption[] {
  return QUICK_BUILD_SQUADS.filter(
    (squad) => squad.factionId === faction && styles.includes(squad.style),
  )
    .sort((a, b) => a.pointLimit - b.pointLimit)
    .flatMap((squad) => squad.ships)
    .flatMap((ship) => {
      const loadout = getLoadoutById(ship.loadoutId);
      const option = loadout
        ? toDeployOption({
            definitionId: loadout.shipId,
            loadoutId: loadout.id,
          })
        : null;
      return option && isFormatShip(format, option.definitionId)
        ? [option]
        : [];
    });
}

/** The cheapest generic light fighters / interceptors (escorts). */
function escortsOf(catalog: readonly DeployOption[]): DeployOption[] {
  return catalog.filter(
    (o) =>
      (o.role === "light_fighter" || o.role === "interceptor") && isGeneric(o),
  );
}

function interleave(
  leads: readonly DeployOption[],
  escorts: readonly DeployOption[],
  leadsPerEscort: number,
): DeployOption[] {
  const out: DeployOption[] = [];
  leads.forEach((lead, i) => {
    out.push(lead);
    const escort =
      escorts[Math.floor(i / leadsPerEscort) % Math.max(1, escorts.length)];
    if ((i + 1) % leadsPerEscort === 0 && escort) out.push(escort);
  });
  return out;
}

function byOffenseThenCost(a: DeployOption, b: DeployOption): number {
  const offense = (o: DeployOption): number =>
    loadoutRole(o) === "offense" ? 0 : 1;
  return offense(a) - offense(b) || b.cost - a.cost;
}

function dedupe(options: readonly DeployOption[]): DeployOption[] {
  const seen = new Set<string>();
  return options.filter((o) => {
    const key = `${o.definitionId}/${o.loadoutId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isGeneric(option: DeployOption): boolean {
  return option.uniquePilotId === null;
}

function loadoutRole(option: DeployOption): string | null {
  return option.loadoutId
    ? (getLoadoutById(option.loadoutId)?.role ?? null)
    : null;
}

function toEntry(option: DeployOption): ReserveEntry {
  return { definitionId: option.definitionId, loadoutId: option.loadoutId };
}
