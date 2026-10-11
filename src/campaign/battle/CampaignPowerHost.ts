/**
 * CampaignPowerHost — carries out hero power commands on the battle through
 * the scene bridge: damage, repairs, shields, stress, summoned drones,
 * teleports, owned minefields and delayed orbital strikes (with visual cues).
 */

import type { ObjectivePoint } from "../../arcade/objectives";
import type { PowerHost } from "../../arcade/systems/CampaignHeroPowers";
import { strikeVictims } from "../powers/heroPowerEffects";
import type { HazardDefinition } from "../hazards/hazardTypes";
import type { CampaignBattleBridge } from "./battleTypes";

/** Mine trigger radius of a power's minefield (px). */
const POWER_MINE_RADIUS = 60;
/** Floating text offset above a cast (px). */
const FX_TEXT_OFFSET = 50;
/** Tag of summoned drones. */
export const DRONE_TAG = "drone";

/** Power cue labels. */
const FX_LABELS: Readonly<Record<string, string>> = {
  orbital_strike: "STRIKE INBOUND",
  shield_overcharge: "OVERCHARGE",
  rally: "RALLY!",
  field_repair: "REPAIRS",
  drone_swarm: "SWARM",
  emp_burst: "EMP",
  cloak_dash: "CLOAKED",
  scatter_mines: "MINES",
  time_slow: "TIME SLOW",
  psionic_lance: "LANCE",
};

/** What the host needs besides the bridge. */
export interface PowerHostDeps {
  readonly bridge: CampaignBattleBridge;
  /** Adds a minefield hazard to the mission. */
  readonly addHazard: (def: HazardDefinition) => void;
  /** Next unique number for ids. */
  readonly nextId: () => number;
}

/**
 * @param deps - Bridge and helpers.
 * @returns A PowerHost acting on the battle.
 */
export function createPowerHost(deps: PowerHostDeps): PowerHost {
  const { bridge } = deps;
  const wrap = (v: number): number =>
    ((v % bridge.worldSize) + bridge.worldSize) % bridge.worldSize;
  return {
    damage: (id, amount, ignoreShields) =>
      bridge.damage(id, amount, ignoreShields),
    repair: (id, fraction) => {
      const ship = bridge.ship(id);
      if (ship) bridge.repair(id, ship.maxHull * fraction);
    },
    refillShields: (id) => {
      const ship = bridge.ship(id);
      if (ship) bridge.setShields(id, ship.maxShields);
    },
    stripShields: (id) => bridge.setShields(id, 0),
    stress: (id, amount) => bridge.addStress(id, amount),
    spawnDrones: (shipId, points, lifetimeMs) =>
      spawnDrones(deps, shipId, points, lifetimeMs),
    teleport: (id, x, y) => {
      const ship = bridge.ship(id);
      if (ship) bridge.setPose(id, wrap(x), wrap(y), ship.angle);
    },
    addMines: (points, damage) =>
      deps.addHazard({
        id: `power_mines_${deps.nextId()}`,
        kind: "minefield",
        mines: points.map((p) => ({ x: wrap(p.x), y: wrap(p.y) })),
        triggerRadius: POWER_MINE_RADIUS,
        damage,
        harms: "enemy",
      }),
    strike: (x, y, radius, damage) => {
      const ships = [...bridge.ships()].map((s) => ({
        ...s,
        side: s.owner === "player" ? ("player" as const) : ("enemy" as const),
      }));
      for (const victim of strikeVictims(
        ships,
        { x, y },
        radius,
        "enemy",
        bridge.worldSize,
      )) {
        bridge.damage(victim.id, damage, false);
      }
      bridge.effects().createExplosion(x, y, "large");
    },
    fx: (kind, x, y) =>
      bridge
        .effects()
        .showFloatingText(
          x,
          y - FX_TEXT_OFFSET,
          FX_LABELS[kind] ?? kind.toUpperCase(),
          "#7fe0ff",
        ),
  };
}

/**
 * @param deps - Bridge and helpers.
 * @param shipId - Drone hull.
 * @param points - Where they appear.
 * @param lifetimeMs - How long they fight.
 */
function spawnDrones(
  deps: PowerHostDeps,
  shipId: string,
  points: readonly ObjectivePoint[],
  lifetimeMs: number,
): void {
  const { bridge } = deps;
  const angle = bridge.flagship()?.angle ?? 0;
  for (const p of points) {
    bridge.spawn({
      id: `drone_${deps.nextId()}`,
      definitionId: shipId,
      faction: bridge.factionId,
      owner: "player",
      pose: { x: p.x, y: p.y, angle },
      tags: [DRONE_TAG, "ally"],
      hullScale: 1,
      scripted: false,
      piloted: true,
      isAce: false,
      isBoss: false,
      lifetimeMs,
    });
  }
}
