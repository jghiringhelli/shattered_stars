/**
 * reinforcementSetup — the pure half of the Skirmish scene's reinforcement
 * glue: which team sides fight (the player's team first) and their member
 * squads, what the opening squads cost, every squad's sub-reserve (a human
 * squad's reserve — planned in the Squad Builder or built from its
 * strategy — and an AI squad's strategy rotation), where an arrival warps
 * in (Skirmish deploy edges, or a scenario's deployment lines) and fresh
 * ship ids.
 *
 * Pools and field caps are per TEAM; each squad of a team (human or AI)
 * keeps its own sub-reserve and deploys ships of its own faction; every
 * human squad has its own picker.
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
  type DirectorMemberSetup,
  type DirectorSetup,
  type ReinforcementSetup,
  type SquadPlan,
} from "../../../arcade/reinforcements";
import { homePoint } from "../../../arcade/scenarios";
import { teamKey, type TeamId } from "../../../arcade/teams";
import { getShipDefinition } from "../../../data/ShipDefinitions";
import { memberKey } from "./reinforcementPilots";

export {
  freshShipId,
  memberKey,
  scenePilotOf,
  squadOfMember,
} from "./reinforcementPilots";

/** Heading of each scenario side's deployment line (0 = up). */
const SCENARIO_FACING = { player: 0, enemy: 180 } as const;

/** An opening-squad ship as the setup reads it. */
export interface OpeningShip {
  readonly id: string;
  readonly faction: string;
  readonly team: TeamId;
  /** Its battle-config squad. */
  readonly squad: number;
  readonly definitionId: string;
  readonly loadoutId: string | null;
}

/** An opening ship's registration with the director. */
export interface OpeningRegistration {
  readonly shipId: string;
  /** Its squad's member key. */
  readonly member: string;
  readonly option: DeployOption;
  readonly pilot: DeployPilot;
}

/** What the director setup is built from. */
export interface DirectorSetupInput {
  readonly setup: ReinforcementSetup;
  readonly playerTeam: TeamId;
  /** Every config squad's team (index = squad). */
  readonly squadTeams: readonly TeamId[];
  /** Human squads → the ship their human flies at the start. */
  readonly humanSquads: ReadonlyMap<number, string>;
  readonly ships: readonly OpeningShip[];
  readonly ownsOutcome: boolean;
  readonly nextShipId: DirectorSetup["nextShipId"];
}

/** Where an arrival goes. */
export interface PoseInput {
  /** The arrival's team side key. */
  readonly side: string;
  /** The side's arrival number. */
  readonly slot: number;
  /** Side order (the player's first). */
  readonly sides: readonly string[];
  readonly worldSize: number;
  /** Scenario battles deploy on the scenario's lines. */
  readonly scenario: boolean;
}

/**
 * @param playerTeam - The human's team.
 * @param squadTeams - Every squad's team.
 * @returns Every team, the player's first, then in order of appearance.
 */
export function sideOrder(
  playerTeam: TeamId,
  squadTeams: readonly TeamId[],
): TeamId[] {
  return [...new Set([playerTeam, ...squadTeams])];
}

/**
 * @param ships - The opening ships.
 * @param humanSquads - Human squads → their human's opening ship.
 * @returns Their registrations (humans' ships, their wingmen, AI squads' ships).
 */
export function openingRegistrations(
  ships: readonly OpeningShip[],
  humanSquads: ReadonlyMap<number, string>,
): OpeningRegistration[] {
  return ships.map((ship) => ({
    shipId: ship.id,
    member: memberKey(ship.squad),
    option: optionOf(ship),
    pilot:
      humanSquads.get(ship.squad) === ship.id
        ? "player"
        : humanSquads.has(ship.squad)
          ? "wingman"
          : "ai",
  }));
}

/**
 * @param input - Parsed setup, teams, humans, opening ships, ids.
 * @returns The director's setup: one side per team, one member per squad.
 */
export function buildDirectorSetup(input: DirectorSetupInput): DirectorSetup {
  const { setup, squadTeams } = input;
  const sides = sideOrder(input.playerTeam, squadTeams).map((team) => ({
    key: teamKey(team),
    members: squadTeams.flatMap((squadTeam, squad) =>
      squadTeam === team ? [memberSetup(input, squad)] : [],
    ),
  }));
  return {
    rules: setup.rules,
    playerSide: teamKey(input.playerTeam),
    sides,
    ownsOutcome: input.ownsOutcome,
    nextShipId: input.nextShipId,
  };
}

/**
 * @param input - The side, its arrival number, side order, world, scenario flag.
 * @returns The arrival's pose.
 */
export function reinforcementPose(input: PoseInput): DeployPose {
  const index = Math.max(0, input.sides.indexOf(input.side));
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
 * @param battleConfig - The registry's battle config.
 * @returns Every ship a reinforced battle may deploy (texture preload), or
 *   none for a classic battle.
 */
export function reinforcementShipIds(battleConfig: unknown): string[] {
  const setup = parseReinforcementSetup(battleConfig);
  if (!setup) return [];
  const format = setup.rules.format;
  const ids = setup.squads
    .filter((plan) => plan.faction !== "")
    .flatMap((plan) => {
      const faction = plan.faction as FactionId;
      return [
        ...strategyRotation(faction, plan.strategy, format),
        ...(plan.reserve ?? []),
        ...(setup.rules.choice === "open"
          ? factionCatalog(faction, format)
          : buildReserve(
              faction,
              plan.strategy,
              setup.rules.poolPoints,
              format,
            )),
      ];
    });
  return [...new Set(ids.map((entry) => entry.definitionId))];
}

function memberSetup(
  input: DirectorSetupInput,
  squad: number,
): DirectorMemberSetup {
  const plan: SquadPlan = input.setup.squads[squad] ?? {
    faction: input.ships.find((s) => s.squad === squad)?.faction ?? "",
    strategy: "balanced",
    reserve: null,
  };
  const { rules } = input.setup;
  const faction = plan.faction as FactionId;
  const human = input.humanSquads.has(squad);
  return {
    key: memberKey(squad),
    faction: plan.faction,
    human,
    strategy: plan.strategy,
    plan: human
      ? humanReserve(input, squad, plan)
      : toDeployOptions(strategyRotation(faction, plan.strategy, rules.format)),
    catalog: human ? factionCatalog(faction, rules.format) : [],
  };
}

function humanReserve(
  input: DirectorSetupInput,
  squad: number,
  plan: SquadPlan,
): DeployOption[] {
  const { rules } = input.setup;
  if (plan.reserve && plan.reserve.length > 0)
    return toDeployOptions(plan.reserve);
  const opening = input.ships
    .filter((ship) => ship.squad === squad)
    .reduce((sum, ship) => sum + optionOf(ship).cost, 0);
  const budget = Math.max(rules.fieldCapPoints, rules.poolPoints - opening);
  return toDeployOptions(
    buildReserve(
      plan.faction as FactionId,
      plan.strategy,
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
