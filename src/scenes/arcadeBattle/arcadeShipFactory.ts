/**
 * arcadeShipFactory — the Skirmish scene's ship record and how one is made:
 * real-time durability, the cycle-engine control state, crew/capital
 * state, the equipped loadout (stats, modifier sheet, ordnance and turret
 * with one-attack-per-cycle reloads) and the arcade durability floors of
 * the player's ship and its wingmen. Shared by the opening deployment and
 * reinforcements so both make identical ships.
 *
 * Pure: no Phaser.
 */

import {
  createControlState,
  type ShipControlState,
} from "../../core/ArcadeControls";
import {
  NEUTRAL_MODIFIERS,
  type CombatModifiers,
} from "../../core/CombatModifiers";
import type { ManeuverDefinition, ShipRole, ShipState } from "../../core/types";
import {
  buildOrdnanceSlots,
  type ArcadeOrdnanceSlot,
} from "../../arcade/ArcadeOrdnance";
import { INITIAL_STRESS, type StressState } from "../../arcade/ArcadeStress";
import {
  buildTurretSlot,
  type ArcadeTurretSlot,
} from "../../arcade/ArcadeTurret";
import {
  applyControlModifiers,
  applyOrdnanceModifiers,
  applyTurretModifiers,
  loadoutUpgradeIds,
  resolveLoadoutModifiers,
} from "../../arcade/ArcadeUpgradeEffects";
import { attackIntervalMs } from "../../arcade/systems/CombatTempo";
import { SHIP_SIZES, type FactionId } from "../../config";
import {
  getMovementProfile,
  getShipDefinition,
  getShipDial,
} from "../../data/ShipDefinitions";
import { uniquePilotOf } from "../../data/squadRules";
import { applyLoadoutEffects } from "../../systems/BattleHelpers";
import {
  createCapitalSystems,
  type CapitalSystemsState,
} from "../../systems/CapitalSystems";
import {
  createCommanderOrders,
  type CommanderOrders,
  type CrewRole,
} from "../../systems/ShipCrew";
import {
  PLAYER_HULL_FLOOR,
  PLAYER_SHIELD_FLOOR,
  WINGMAN_HULL_FLOOR,
  realTimeDurability,
} from "./arcadeDurability";

/** Base size of a ship whose size class is unknown (px). */
const FALLBACK_BASE_SIZE = 32;

/** A Skirmish ship record. */
export interface ArcadeShip extends ShipState {
  control: ShipControlState;
  /** Secondary weapon slots (1/2/3 keys). */
  ordnanceSlots: ArcadeOrdnanceSlot[];
  /** Turret slot if the ship has a turret upgrade equipped. */
  turretSlot: ArcadeTurretSlot | null;
  /** 'pilot' flies the ship; 'gunner' controls the turret; 'commander' issues ship orders (capital only). */
  crewMode: CrewRole;
  /** Ship role cached from ShipDefinition — drives support auras. */
  role: ShipRole;
  /** Current pilot stress state — built from this ship's maneuver dial. */
  stress: StressState;
  /** Maneuver dial for this ship; drives stress classification each frame. */
  shipDial: readonly ManeuverDefinition[];
  /** Seconds remaining while cloak is active (0 = not cloaked). */
  cloakTimer: number;
  /** Subsystem damage state (engines/turrets/bridge) — only set for capital-role ships. */
  capitalSystems: CapitalSystemsState | null;
  /** Commander order state (concentrate fire/power redirect/main beam/repair) — only set for capital-role ships. */
  commanderOrders: CommanderOrders | null;
  /** The quick-build loadout equipped, or null for the bare ship. */
  loadoutId: string | null;
  /** Upgrade ids equipped by this ship's loadout. */
  upgradeIds: ReadonlyArray<string>;
  /** Real-time effects of those upgrades, folded into one sheet. */
  modifiers: CombatModifiers;
  /** True when a named (unique) pilot flies this ship — projects a hero aura. */
  isUniquePilot: boolean;
  /** Scene time (ms) until which a kill-frenzy pilot ability is active. */
  frenzyUntilMs: number;
}

/** Where and what a new ship is. */
export interface ArcadeShipSpec {
  readonly id: string;
  readonly definitionId: string;
  readonly faction: FactionId;
  readonly owner: "player" | "ai";
  readonly x: number;
  readonly y: number;
  /** Heading in degrees, 0 = up, clockwise. */
  readonly angle: number;
}

/** Who flies a spawned ship (sets its durability floors). */
export type ArcadePilot = "player" | "wingman" | "ai";

/** A ship to spawn with its loadout and pilot. */
export interface ArcadeSpawnSpec extends Omit<ArcadeShipSpec, "owner"> {
  readonly loadoutId: string | null;
  readonly pilot: ArcadePilot;
}

/**
 * @param spec - Id, ship, faction, owner and pose.
 * @returns A bare ship record (no loadout) at real-time durability.
 */
export function createArcadeShip(spec: ArcadeShipSpec): ArcadeShip {
  const def = getShipDefinition(spec.definitionId);
  const durability = realTimeDurability(def?.baseStats);
  const baseShip: ShipState = {
    id: spec.id,
    definitionId: spec.definitionId,
    faction: spec.faction,
    owner: spec.owner,
    x: spec.x,
    y: spec.y,
    angle: spec.angle,
    hull: durability.hull,
    maxHull: durability.hull,
    shields: durability.shields,
    maxShields: durability.shields,
    isStressed: false,
    hasFocus: false,
    hasEvade: false,
    hasTargetLock: null,
    isCloaked: false,
    currentManeuver: null,
    maneuverProgress: 0,
    mobileArcDirection: "front",
    charges: 0,
    maxCharges: 0,
  };
  const isCapital = def?.role === "capital";
  return {
    ...baseShip,
    control: createControlState(
      baseShip,
      SHIP_SIZES[def?.baseStats.size ?? "small"] ?? FALLBACK_BASE_SIZE,
      getMovementProfile(spec.definitionId),
      def?.baseStats.speed ?? { min: 1, max: 5 },
    ),
    ordnanceSlots: [],
    turretSlot: null,
    crewMode: "pilot",
    role: def?.role ?? "heavy_fighter",
    stress: INITIAL_STRESS,
    shipDial: getShipDial(spec.definitionId),
    cloakTimer: 0,
    capitalSystems: isCapital ? createCapitalSystems(baseShip.hull) : null,
    commanderOrders: isCapital ? createCommanderOrders() : null,
    loadoutId: null,
    upgradeIds: [],
    modifiers: NEUTRAL_MODIFIERS,
    isUniquePilot: false,
    frenzyUntilMs: 0,
  };
}

/**
 * Equip a loadout on a freshly created ship: stat bonuses, the real-time
 * modifier sheet (upgrades + the pilot's ability), upgraded maneuver
 * recharge times, and the ordnance/turret weapons with their reload
 * modifiers baked in — no weapon reloads faster than once per cycle.
 *
 * @param ship - The ship to equip (mutated in place, before first update).
 * @param loadoutId - Chosen loadout id, or undefined for the bare ship.
 */
export function equipLoadout(
  ship: ArcadeShip,
  loadoutId: string | undefined,
): void {
  applyLoadoutEffects(ship, loadoutId);
  const upgradeIds = loadoutUpgradeIds(ship.definitionId, loadoutId);
  const modifiers = resolveLoadoutModifiers(ship.definitionId, loadoutId);
  ship.loadoutId = loadoutId ?? null;
  ship.upgradeIds = upgradeIds;
  ship.modifiers = modifiers;
  ship.isUniquePilot = uniquePilotOf(loadoutId ?? null) !== null;
  ship.control = applyControlModifiers(ship.control, modifiers);
  ship.ordnanceSlots = applyOrdnanceModifiers(
    buildOrdnanceSlots(upgradeIds),
    modifiers,
  ).map((slot) => ({
    ...slot,
    cooldownMax: attackIntervalMs(slot.cooldownMax),
  }));
  const turret = applyTurretModifiers(buildTurretSlot(upgradeIds), modifiers);
  ship.turretSlot = turret && {
    ...turret,
    cooldownMax: attackIntervalMs(turret.cooldownMax),
  };
}

/**
 * A ship ready to fly: created, its arcade floors applied (the player's
 * hull and shields before the loadout; a wingman's hull after it, so
 * glass-cannon light fighters survive a hit) and its loadout equipped.
 *
 * @param spec - Id, ship, loadout, faction, pilot and pose.
 * @returns The ship record.
 */
export function spawnArcadeShip(spec: ArcadeSpawnSpec): ArcadeShip {
  const ship = createArcadeShip({
    ...spec,
    owner: spec.pilot === "player" ? "player" : "ai",
  });
  if (spec.pilot === "player") {
    ship.hull = ship.maxHull = Math.max(PLAYER_HULL_FLOOR, ship.maxHull);
    ship.shields = ship.maxShields = Math.max(
      PLAYER_SHIELD_FLOOR,
      ship.maxShields,
    );
  }
  equipLoadout(ship, spec.loadoutId ?? undefined);
  if (spec.pilot === "wingman")
    ship.hull = ship.maxHull = Math.max(WINGMAN_HULL_FLOOR, ship.maxHull);
  return ship;
}
