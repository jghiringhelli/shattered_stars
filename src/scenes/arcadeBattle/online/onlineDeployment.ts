/**
 * onlineDeployment — where an online Skirmish battle's squads spawn, built
 * from the canonical seat order (never the local point of view): seat 0's
 * squad holds the "player" lines (its flagship is `player_0`), its
 * teammates' squads fly beside it as allies, the other team spawns around
 * the far side. Each seat's flagship is the first ship of its squad.
 * Pure: no Phaser.
 */

import type { FactionId } from "../../../config";
import type { ArcadeSpawnSpec } from "../arcadeShipFactory";

/** One squad of the battle config. */
export interface OnlineSquadSlot {
  readonly factionId: FactionId;
  readonly ships: readonly string[];
  readonly teamId?: string;
  readonly seat?: number;
}

/** What spawns where, and which ship each seat flies. */
export interface OnlineDeployment {
  readonly specs: readonly ArcadeSpawnSpec[];
  /** Seat → its flagship's id. */
  readonly seatShips: ReadonlyMap<number, string>;
  /** Seat 0's faction: the simulation's "player" side. */
  readonly playerFaction: FactionId;
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

/**
 * @param slots - The battle config's squads (each human seat's squad carries `seat`).
 * @param worldSize - Battlefield edge (px).
 * @param buildsOf - Quick build per ship of a squad.
 * @returns Every spawn, the seats' flagships and the "player" side.
 */
export function planOnlineDeployment(
  slots: readonly OnlineSquadSlot[],
  worldSize: number,
  buildsOf: (slot: OnlineSquadSlot) => readonly (string | null)[],
): OnlineDeployment {
  const home = slots.find((s) => s.seat === 0) ?? slots[0];
  if (!home) throw new Error("Online battle without squads");
  const centre = worldSize / 2;
  const specs: ArcadeSpawnSpec[] = [];
  const seatShips = new Map<number, string>();
  const allies = slots.filter((s) => s !== home && s.teamId === home.teamId);
  const enemies = slots.filter((s) => s !== home && s.teamId !== home.teamId);
  let wing = 0;
  [home, ...allies].forEach((slot) => {
    const builds = buildsOf(slot);
    slot.ships.forEach((definitionId, index) => {
      const flagship = slot === home && index === 0;
      const offset = flagship
        ? { x: 0, y: FLAGSHIP_OFFSET_Y }
        : wingOffset(wing);
      const id = flagship ? "player_0" : `ally_${wing++}`;
      if (index === 0 && slot.seat !== undefined) seatShips.set(slot.seat, id);
      specs.push({
        id,
        definitionId,
        loadoutId: builds[index] ?? null,
        faction: slot.factionId,
        pilot: flagship ? "player" : "wingman",
        x: centre + offset.x,
        y: centre + offset.y,
        angle: HOME_ANGLE,
      });
    });
  });
  specs.push(...enemySpecs(enemies, centre, buildsOf, seatShips));
  return { specs, seatShips, playerFaction: home.factionId };
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
  slots: readonly OnlineSquadSlot[],
  centre: number,
  buildsOf: (slot: OnlineSquadSlot) => readonly (string | null)[],
  seatShips: Map<number, string>,
): ArcadeSpawnSpec[] {
  const total = slots.reduce((sum, s) => sum + s.ships.length, 0);
  const specs: ArcadeSpawnSpec[] = [];
  for (const slot of slots) {
    const builds = buildsOf(slot);
    slot.ships.forEach((definitionId, index) => {
      const n = specs.length;
      const angle = (n / Math.max(total, 1)) * Math.PI * 2;
      const id = `enemy_${n}`;
      if (index === 0 && slot.seat !== undefined) seatShips.set(slot.seat, id);
      specs.push({
        id,
        definitionId,
        loadoutId: builds[index] ?? null,
        faction: slot.factionId,
        pilot: "ai",
        x: centre + Math.cos(angle) * ENEMY_RING_RADIUS,
        y: centre + Math.sin(angle) * ENEMY_RING_RADIUS - ENEMY_RING_SHIFT_Y,
        angle: ENEMY_ANGLE,
      });
    });
  }
  return specs;
}
