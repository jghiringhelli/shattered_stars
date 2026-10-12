/**
 * squadDeployment — where a Skirmish / Epic / Scenario battle's squads
 * spawn and which team each flies for, offline and online alike. The home
 * squad (offline: the player's; online: seat 0's, never the local seat)
 * holds the "player" lines — its flagship is `player_0`; every squad on
 * the home team flies beside it as wingmen, whatever its faction; every
 * other team spawns around the far side, each team on its own arc of the
 * ring. Each online seat's flagship is the first ship of its squad.
 *
 * Teams come from the squads' `teamId` (assignSquadTeams): a squad without
 * one is its own team, so a mirror match fields one faction on two sides.
 *
 * Pure: no Phaser.
 */

import type { FactionId } from "../../config";
import { assignSquadTeams, type TeamId } from "../../arcade/teams";
import type { ArcadeSpawnSpec } from "./arcadeShipFactory";

/** One squad of the battle config. */
export interface SquadSlot {
  readonly factionId: FactionId | string;
  readonly ships: readonly string[];
  readonly controller?: string;
  readonly teamId?: string | number;
  readonly seat?: number;
  /** Squad Builder's quick-build pick per ship index. */
  readonly loadoutChoices?: Record<string, string>;
}

/** How the plan is built. */
export interface SquadDeploymentOptions {
  /** Battlefield edge (px). */
  readonly worldSize: number;
  /** Quick build per ship of a squad. */
  readonly buildsOf: (slot: SquadSlot) => readonly (string | null)[];
  /** Online: the seat whose squad is home (seat 0). Offline: omitted. */
  readonly homeSeat?: number;
}

/** What spawns where, which team every squad flies for, and the seats' ships. */
export interface SquadDeployment {
  readonly specs: readonly ArcadeSpawnSpec[];
  /** Seat → its flagship's id (online). */
  readonly seatShips: ReadonlyMap<number, string>;
  /** Every squad's team, by config index. */
  readonly squadTeams: readonly TeamId[];
  /** The home squad's team: the simulation's "player" side. */
  readonly playerTeam: TeamId;
  /** The home squad's faction (music, stingers). */
  readonly playerFaction: FactionId;
  /** The home squad's config index. */
  readonly playerSquad: number;
}

/** Allied wing slots around the home flagship (px from the centre). */
const WING_OFFSETS: readonly { x: number; y: number }[] = [
  { x: -280, y: 350 },
  { x: 280, y: 350 },
  { x: 0, y: 550 },
  { x: -560, y: 350 },
  { x: 560, y: 350 },
  { x: -280, y: 550 },
  { x: 280, y: 550 },
  { x: 0, y: 750 },
];
/** Spacing of wing slots past the table (px). */
const EXTRA_WING_SPACING = 160;
const EXTRA_WING_Y = 900;
/** The home flagship sits just below the centre (px). */
const FLAGSHIP_OFFSET_Y = 50;
/** The far side's ring (px) and its shift up the map. */
const ENEMY_RING_RADIUS = 1200;
const ENEMY_RING_SHIFT_Y = 1000;
/** Home ships face up the map; the far side faces down (degrees). */
const HOME_ANGLE = 0;
const ENEMY_ANGLE = 180;

interface IndexedSlot {
  readonly slot: SquadSlot;
  readonly squad: number;
  readonly team: TeamId;
}

/**
 * @param slots - The battle config's squads (online: each human seat's squad carries `seat`).
 * @param options - World size, quick builds, online home seat.
 * @returns Every spawn, every squad's team, the seats' flagships and the home side.
 */
export function planSquadDeployment(
  slots: readonly SquadSlot[],
  options: SquadDeploymentOptions,
): SquadDeployment {
  const teams = assignSquadTeams(slots);
  const indexed = slots.map((slot, squad) => ({
    slot,
    squad,
    team: teams[squad]!,
  }));
  const home = homeOf(indexed, options.homeSeat);
  const seatShips = new Map<number, string>();
  const homeSide = indexed.filter((s) => s.team === home.team);
  const homeLines = [home, ...homeSide.filter((s) => s !== home)];
  const enemies = byTeamOfAppearance(
    indexed.filter((s) => s.team !== home.team),
  );
  return {
    specs: [
      ...homeSpecs(homeLines, options, seatShips),
      ...enemySpecs(enemies, options, seatShips),
    ],
    seatShips,
    squadTeams: teams,
    playerTeam: home.team,
    playerFaction: home.slot.factionId as FactionId,
    playerSquad: home.squad,
  };
}

function homeOf(
  indexed: readonly IndexedSlot[],
  homeSeat: number | undefined,
): IndexedSlot {
  const home =
    (homeSeat !== undefined
      ? indexed.find((s) => s.slot.seat === homeSeat)
      : indexed.find((s) => s.slot.controller === "player")) ?? indexed[0];
  if (!home) throw new Error("Squad battle without squads");
  return home;
}

function byTeamOfAppearance(slots: readonly IndexedSlot[]): IndexedSlot[] {
  const order = [...new Set(slots.map((s) => s.team))];
  return [...slots].sort(
    (a, b) => order.indexOf(a.team) - order.indexOf(b.team),
  );
}

function homeSpecs(
  lines: readonly IndexedSlot[],
  options: SquadDeploymentOptions,
  seatShips: Map<number, string>,
): ArcadeSpawnSpec[] {
  const centre = options.worldSize / 2;
  const specs: ArcadeSpawnSpec[] = [];
  let wing = 0;
  lines.forEach((entry, lineIndex) => {
    const builds = options.buildsOf(entry.slot);
    entry.slot.ships.forEach((definitionId, index) => {
      const flagship = lineIndex === 0 && index === 0;
      const offset = flagship
        ? { x: 0, y: FLAGSHIP_OFFSET_Y }
        : wingOffset(wing);
      const id = flagship ? "player_0" : `ally_${wing++}`;
      if (index === 0 && entry.slot.seat !== undefined)
        seatShips.set(entry.slot.seat, id);
      specs.push({
        id,
        definitionId,
        loadoutId: builds[index] ?? null,
        faction: entry.slot.factionId as FactionId,
        team: entry.team,
        squad: entry.squad,
        pilot: flagship ? "player" : "wingman",
        x: centre + offset.x,
        y: centre + offset.y,
        angle: HOME_ANGLE,
      });
    });
  });
  return specs;
}

function wingOffset(index: number): { x: number; y: number } {
  return (
    WING_OFFSETS[index] ?? {
      x: (index - WING_OFFSETS.length / 2) * EXTRA_WING_SPACING,
      y: EXTRA_WING_Y,
    }
  );
}

function enemySpecs(
  slots: readonly IndexedSlot[],
  options: SquadDeploymentOptions,
  seatShips: Map<number, string>,
): ArcadeSpawnSpec[] {
  const centre = options.worldSize / 2;
  const total = slots.reduce((sum, s) => sum + s.slot.ships.length, 0);
  const specs: ArcadeSpawnSpec[] = [];
  for (const entry of slots) {
    const builds = options.buildsOf(entry.slot);
    entry.slot.ships.forEach((definitionId, index) => {
      const n = specs.length;
      const angle = (n / Math.max(total, 1)) * Math.PI * 2;
      const id = `enemy_${n}`;
      if (index === 0 && entry.slot.seat !== undefined)
        seatShips.set(entry.slot.seat, id);
      specs.push({
        id,
        definitionId,
        loadoutId: builds[index] ?? null,
        faction: entry.slot.factionId as FactionId,
        team: entry.team,
        squad: entry.squad,
        pilot: "ai",
        x: centre + Math.cos(angle) * ENEMY_RING_RADIUS,
        y: centre + Math.sin(angle) * ENEMY_RING_RADIUS - ENEMY_RING_SHIFT_Y,
        angle: ENEMY_ANGLE,
      });
    });
  }
  return specs;
}
