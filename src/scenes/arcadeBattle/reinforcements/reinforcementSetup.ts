/**
 * reinforcementSetup — the pure half of the Skirmish scene's reinforcement
 * glue: which sides fight (the player's first), what the opening squads
 * cost, every side's plan (the player's reserve — planned in the Squad
 * Builder or built from its strategy — and the AI's strategy rotations),
 * where an arrival warps in (Skirmish deploy edges, or a scenario's
 * deployment lines) and fresh ship ids.
 *
 * Pure: no Phaser.
 */

import type { FactionId } from "../../../config";
import {
  buildReserve,
  deployPose,
  factionCatalog,
  parseReinforcementSetup,
  sideHome,
  strategyRotation,
  toDeployOption,
  toDeployOptions,
  type DeployOption,
  type DeployPilot,
  type DeployPose,
  type DirectorSetup,
  type ReinforcementSetup,
} from "../../../arcade/reinforcements";
import { homePoint } from "../../../arcade/scenarios";
import { getShipDefinition } from "../../../data/ShipDefinitions";

/** Heading of each scenario side's deployment line (0 = up). */
const SCENARIO_FACING = { player: 0, enemy: 180 } as const;

/** Id prefix of each pilot's ships (matches the opening squad's ids). */
const ID_PREFIX: Readonly<Record<DeployPilot, string>> = {
  player: "player",
  wingman: "ally",
  ai: "enemy",
};

/** An opening-squad ship as the setup reads it. */
export interface OpeningShip {
  readonly id: string;
  readonly faction: string;
  readonly definitionId: string;
  readonly loadoutId: string | null;
  readonly owner: "player" | "ai";
}

/** An opening ship's registration with the director. */
export interface OpeningRegistration {
  readonly shipId: string;
  readonly faction: string;
  readonly option: DeployOption;
  readonly pilot: DeployPilot;
}

/** What the director setup is built from. */
export interface DirectorSetupInput {
  readonly setup: ReinforcementSetup;
  readonly playerFaction: string;
  readonly ships: readonly OpeningShip[];
  readonly ownsOutcome: boolean;
  readonly nextShipId: DirectorSetup["nextShipId"];
}

/** Where an arrival goes. */
export interface PoseInput {
  readonly faction: string;
  /** The side's arrival number. */
  readonly slot: number;
  /** Side order (the player's first). */
  readonly sides: readonly string[];
  readonly worldSize: number;
  /** Scenario battles deploy on the scenario's lines. */
  readonly scenario: boolean;
}

/**
 * @param playerFaction - The human's faction.
 * @param ships - The opening ships.
 * @returns Every faction, the player's first, then in order of appearance.
 */
export function sideOrder(
  playerFaction: string,
  ships: readonly OpeningShip[],
): string[] {
  return [...new Set([playerFaction, ...ships.map((s) => s.faction)])];
}

/**
 * @param ships - The opening ships.
 * @returns Their registrations (the player's ship, wingmen, AI ships).
 */
export function openingRegistrations(
  ships: readonly OpeningShip[],
): OpeningRegistration[] {
  const player = ships.find((s) => s.owner === "player");
  return ships.map((ship) => ({
    shipId: ship.id,
    faction: ship.faction,
    option: optionOf(ship),
    pilot:
      ship.owner === "player"
        ? "player"
        : ship.faction === player?.faction
          ? "wingman"
          : "ai",
  }));
}

/**
 * @param input - Parsed setup, the player's faction, opening ships, ids.
 * @returns The director's setup.
 */
export function buildDirectorSetup(input: DirectorSetupInput): DirectorSetup {
  const { setup, playerFaction } = input;
  const { rules } = setup;
  const sides = sideOrder(playerFaction, input.ships).map((faction) => {
    const plan = setup.sides[faction] ?? {
      strategy: "balanced",
      reserve: null,
    };
    const options =
      faction === playerFaction
        ? playerReserve(input, plan.strategy, plan.reserve)
        : toDeployOptions(
            strategyRotation(faction as FactionId, plan.strategy, rules.format),
          );
    return { faction, strategy: plan.strategy, plan: options };
  });
  return {
    rules,
    playerFaction,
    sides,
    playerCatalog: factionCatalog(playerFaction as FactionId, rules.format),
    ownsOutcome: input.ownsOutcome,
    nextShipId: input.nextShipId,
  };
}

/**
 * @param input - The side, its arrival number, side order, world, scenario flag.
 * @returns The arrival's pose.
 */
export function reinforcementPose(input: PoseInput): DeployPose {
  const index = Math.max(0, input.sides.indexOf(input.faction));
  if (!input.scenario)
    return deployPose(
      sideHome(index, input.sides.length, input.worldSize),
      input.slot,
    );
  const side = index === 0 ? "player" : "enemy";
  const home = homePoint(side, input.worldSize);
  return deployPose({ ...home, angle: SCENARIO_FACING[side] }, input.slot);
}

/**
 * @param pilot - Who will fly the ship.
 * @param isTaken - Whether an id is in use.
 * @returns The pilot's first free id (`enemy_3`, `ally_1`, `player_2`...).
 */
export function freshShipId(
  pilot: DeployPilot,
  isTaken: (id: string) => boolean,
): string {
  for (let n = 0; ; n++) {
    const id = `${ID_PREFIX[pilot]}_${n}`;
    if (!isTaken(id)) return id;
  }
}

/**
 * @param battleConfig - The registry's battle config.
 * @returns Every ship a reinforced battle may deploy (texture preload), or
 *   none for a classic battle.
 */
export function reinforcementShipIds(battleConfig: unknown): string[] {
  const setup = parseReinforcementSetup(battleConfig);
  if (!setup) return [];
  const format = setup.rules.format;
  const ids = Object.entries(setup.sides).flatMap(([faction, plan]) => [
    ...strategyRotation(faction as FactionId, plan.strategy, format),
    ...(plan.reserve ?? []),
    ...(setup.rules.choice === "open"
      ? factionCatalog(faction as FactionId, format)
      : buildReserve(
          faction as FactionId,
          plan.strategy,
          setup.rules.poolPoints,
          format,
        )),
  ]);
  return [...new Set(ids.map((entry) => entry.definitionId))];
}

function playerReserve(
  input: DirectorSetupInput,
  strategy: Parameters<typeof buildReserve>[1],
  planned: ReinforcementSetup["sides"][string]["reserve"],
): DeployOption[] {
  const { rules } = input.setup;
  if (planned && planned.length > 0) return toDeployOptions(planned);
  const opening = openingRegistrations(input.ships)
    .filter((r) => r.faction === input.playerFaction)
    .reduce((sum, r) => sum + r.option.cost, 0);
  const budget = Math.max(rules.fieldCapPoints, rules.poolPoints - opening);
  return toDeployOptions(
    buildReserve(
      input.playerFaction as FactionId,
      strategy,
      budget,
      rules.format,
    ),
  );
}

function optionOf(ship: OpeningShip): DeployOption {
  const option = toDeployOption(ship);
  if (option) return option;
  const def = getShipDefinition(ship.definitionId);
  return {
    definitionId: ship.definitionId,
    loadoutId: null,
    cost: def?.baseStats.pointCost ?? 0,
    role: def?.role ?? "heavy_fighter",
    categories: [],
    uniquePilotId: null,
    label: def?.name ?? ship.definitionId,
  };
}
