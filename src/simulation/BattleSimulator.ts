/**
 * Battle Simulator
 *
 * Headless simulation framework for balance testing:
 * - Runs AI vs AI battles without rendering
 * - Collects statistics on ship/faction performance
 * - Supports batch simulation for statistical significance
 * - Generates balance reports
 * - Supports seeded RNG for deterministic multiplayer (optional)
 */

import seedrandom from "seedrandom";
import type { FactionId } from "../config";
import { getShipDefinition, SHIP_DEFINITIONS } from "../data/ShipDefinitions";
import {
  getModeCombatStats,
  calculateHitChance,
  type ModeCombatStats,
} from "../data/ModeBalancing";

/** Abstract simulators stay on miniature hull/shield points. */
const MINIATURE_SCALE = 1;
import { applyManeuver, getManeuverTemplate } from "./SimManeuvers";
import type { ManeuverDirection } from "../core/types";
import { getLoadoutById } from "../data/ShipLoadouts";
import { UPGRADE_DEFINITIONS } from "../systems/UpgradeSystem";
import { PILOT_CARDS } from "../systems/SquadBuilder";
import { getQuickBuild, toSimSpecs } from "../data/SquadronPresets";

/** Ordnance fires at this px range or less (range 2 equivalent). */
const ORDNANCE_RANGE = 250;

/** Attack dice for each ordnance slot type. */
const ORDNANCE_DICE_BY_SLOT: Readonly<Record<string, number>> = {
  missile: 3,
  torpedo: 4,
  bomb: 2,
  mine: 2,
};

/**
 * Specifies a ship in simulation with an optional pre-built loadout and pilot.
 * Upgrade bonuses (attackBonus, shieldBonus, agilityBonus, hullBonus) are applied
 * to the SimShip's stats when a loadoutId is provided.
 */
export interface SimShipSpec {
  readonly shipId: string;
  readonly loadoutId?: string; // references SHIP_LOADOUTS[shipId][*].id
  readonly pilotId?: string; // references PILOT_CARDS — sets pilotSkill from initiative
}

// Simulation configuration
export interface SimulationConfig {
  mode: "arcade" | "continuous";
  maxTurns: number;
  battlefieldSize: number;
  verbose: boolean;
  seed?: number; // Optional deterministic seed for multiplayer
}

/** Fixed seed shared by balance-test suites so faction/matchup assertions are reproducible. */
export const BALANCE_TEST_SEED = 42;

// Ship in simulation
interface SimShip {
  id: string;
  definitionId: string;
  faction: FactionId;
  owner: "player" | "ai";
  x: number;
  y: number;
  angle: number;
  hull: number;
  maxHull: number;
  shields: number;
  maxShields: number;
  /** Flat damage reduction applied to every incoming hit before shields/hull. */
  armor: number;
  pilotSkill: number;
  combatStats: ModeCombatStats;
  currentSpeed: number;
  weaponCooldown: number;
  focusToken: boolean;
  evadeToken: boolean;
  targetLockToken: boolean;
  ordnanceCharges: number;
  ordnanceDice: number;
  hasStealthDevice: boolean;
  hasPredator: boolean;
}

// Battle result
export interface BattleResult {
  winner: "team1" | "team2" | "draw";
  turnsElapsed: number;
  team1ShipsRemaining: number;
  team2ShipsRemaining: number;
  team1TotalDamageDealt: number;
  team2TotalDamageDealt: number;
  team1ShipsDestroyed: number;
  team2ShipsDestroyed: number;
  shipStats: Map<string, ShipBattleStats>;
}

// Per-ship statistics
export interface ShipBattleStats {
  shipId: string;
  definitionId: string;
  faction: FactionId;
  team: "team1" | "team2";
  survived: boolean;
  damageDealt: number;
  damageTaken: number;
  kills: number;
  turnsAlive: number;
  shotsHit: number;
  shotsMissed: number;
}

// Aggregated statistics
export interface AggregatedStats {
  totalBattles: number;
  team1Wins: number;
  team2Wins: number;
  draws: number;
  averageTurns: number;
  shipPerformance: Map<string, ShipPerformanceStats>;
  factionPerformance: Map<FactionId, FactionPerformanceStats>;
}

export interface ShipPerformanceStats {
  definitionId: string;
  faction: FactionId;
  battles: number;
  survivalRate: number;
  averageKills: number;
  averageDamageDealt: number;
  averageDamageTaken: number;
  averageTurnsAlive: number;
  hitRate: number;
}

export interface FactionPerformanceStats {
  faction: FactionId;
  battles: number;
  winRate: number;
  averageShipsSurviving: number;
  averageDamageDealt: number;
}

// Default configuration
const DEFAULT_CONFIG: SimulationConfig = {
  mode: "continuous",
  maxTurns: 100,
  battlefieldSize: 1000, // Smaller battlefield for faster engagement
  verbose: false,
};

export class BattleSimulator {
  private config: SimulationConfig;
  private ships: Map<string, SimShip> = new Map();
  private team1ShipIds: string[] = [];
  private team2ShipIds: string[] = [];
  private currentTurn: number = 0;
  private shipStats: Map<string, ShipBattleStats> = new Map();
  private rng: () => number; // Deterministic RNG (seeded) or Math.random()

  constructor(config: Partial<SimulationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // Use seeded RNG if seed provided, otherwise use Math.random()
    this.rng =
      config.seed !== undefined
        ? seedrandom(String(config.seed))
        : () => Math.random();
  }

  /**
   * Run a single battle simulation.
   * Accepts either ship definition ID strings (backward-compat) or SimShipSpec objects.
   */
  runBattle(
    team1Ships: ReadonlyArray<SimShipSpec | string>,
    team2Ships: ReadonlyArray<SimShipSpec | string>,
  ): BattleResult {
    this.reset();
    this.spawnTeams(
      team1Ships.map((s) => (typeof s === "string" ? { shipId: s } : s)),
      team2Ships.map((s) => (typeof s === "string" ? { shipId: s } : s)),
    );

    while (this.currentTurn < this.config.maxTurns) {
      this.currentTurn++;
      this.simulateTurn();

      // Check victory conditions
      const team1Alive = this.team1ShipIds.filter((id) => {
        const ship = this.ships.get(id);
        return ship && ship.hull > 0;
      }).length;

      const team2Alive = this.team2ShipIds.filter((id) => {
        const ship = this.ships.get(id);
        return ship && ship.hull > 0;
      }).length;

      if (team1Alive === 0 || team2Alive === 0) {
        break;
      }
    }

    return this.generateResult();
  }

  /**
   * Run multiple battles and aggregate statistics
   */
  runBatchSimulation(
    team1Ships: ReadonlyArray<SimShipSpec | string>,
    team2Ships: ReadonlyArray<SimShipSpec | string>,
    numBattles: number,
  ): AggregatedStats {
    const results: BattleResult[] = [];

    for (let i = 0; i < numBattles; i++) {
      // Alternate spawn sides each battle to cancel out positional bias
      const swapped = i % 2 === 1;
      const rawResult = swapped
        ? this.runBattle(team2Ships, team1Ships)
        : this.runBattle(team1Ships, team2Ships);

      // Re-label the result so team1/team2 always refer to the original squads
      const result: BattleResult = swapped
        ? {
            ...rawResult,
            winner:
              rawResult.winner === "team1"
                ? "team2"
                : rawResult.winner === "team2"
                  ? "team1"
                  : "draw",
            team1ShipsRemaining: rawResult.team2ShipsRemaining,
            team2ShipsRemaining: rawResult.team1ShipsRemaining,
            team1TotalDamageDealt: rawResult.team2TotalDamageDealt,
            team2TotalDamageDealt: rawResult.team1TotalDamageDealt,
            team1ShipsDestroyed: rawResult.team2ShipsDestroyed,
            team2ShipsDestroyed: rawResult.team1ShipsDestroyed,
            shipStats: new Map(
              [...rawResult.shipStats.entries()].map(([k, v]) => [
                k,
                { ...v, team: v.team === "team1" ? "team2" : "team1" },
              ]),
            ),
          }
        : rawResult;

      results.push(result);

      if (this.config.verbose && (i + 1) % 10 === 0) {
        console.log(`[Simulator] Completed ${i + 1}/${numBattles} battles`);
      }
    }

    return this.aggregateResults(results);
  }

  /**
   * Run faction vs faction simulation
   */
  runFactionBattle(
    faction1: FactionId,
    faction2: FactionId,
    shipsPerTeam: number,
    numBattles: number,
  ): AggregatedStats {
    const faction1Ships = this.getRandomShipsForFaction(faction1, shipsPerTeam);
    const faction2Ships = this.getRandomShipsForFaction(faction2, shipsPerTeam);

    return this.runBatchSimulation(faction1Ships, faction2Ships, numBattles);
  }

  /**
   * Run all faction matchups
   */
  runAllFactionMatchups(
    shipsPerTeam: number,
    battlesPerMatchup: number,
  ): Map<string, AggregatedStats> {
    const factions: FactionId[] = [
      "terran_hegemony",
      "free_confederation",
      "synthetic_collective",
      "void_corsairs",
      "ascendant_empire",
    ];

    const results = new Map<string, AggregatedStats>();

    for (let i = 0; i < factions.length; i++) {
      for (let j = i + 1; j < factions.length; j++) {
        const matchupKey = `${factions[i]} vs ${factions[j]}`;
        if (this.config.verbose) {
          console.log(`[Simulator] Running matchup: ${matchupKey}`);
        }

        const stats = this.runFactionBattle(
          factions[i]!,
          factions[j]!,
          shipsPerTeam,
          battlesPerMatchup,
        );
        results.set(matchupKey, stats);
      }
    }

    return results;
  }

  /**
   * Get a simulation squad for a faction using preset loadouts.
   * Falls back to random ship selection when no preset is available.
   */
  getPresetSquadForFaction(faction: FactionId, budget: number): SimShipSpec[] {
    const preset = getQuickBuild(faction, budget);
    if (preset) return toSimSpecs(preset);
    return this.getRandomShipsForFaction(faction, Math.ceil(budget / 60)).map(
      (shipId) => ({ shipId }),
    );
  }

  // ==========================================
  // PRIVATE METHODS
  // ==========================================

  private reset(): void {
    this.ships.clear();
    this.team1ShipIds = [];
    this.team2ShipIds = [];
    this.currentTurn = 0;
    this.shipStats.clear();
  }

  private spawnTeams(
    team1Ships: SimShipSpec[],
    team2Ships: SimShipSpec[],
  ): void {
    const centerY = this.config.battlefieldSize / 2;
    const spacing = 60;

    // Calculate spawn distance - ships start closer for faster engagement
    // They should be just outside weapon range to start
    const spawnGap = 400; // Total gap between teams
    const team1X = (this.config.battlefieldSize - spawnGap) / 2;
    const team2X = (this.config.battlefieldSize + spawnGap) / 2;

    // Spawn team 1 on the left
    // Angle convention: 0=up, 90=right, 180=down, 270=left (Phaser standard)
    team1Ships.forEach((spec, i) => {
      const ship = this.createShip(spec, "team1", i);
      ship.x = team1X;
      ship.y = centerY + (i - team1Ships.length / 2) * spacing;
      ship.angle = 90; // Facing right (toward enemy)

      this.ships.set(ship.id, ship);
      this.team1ShipIds.push(ship.id);
      this.initShipStats(ship, "team1");
    });

    // Spawn team 2 on the right
    team2Ships.forEach((spec, i) => {
      const ship = this.createShip(spec, "team2", i);
      ship.x = team2X;
      ship.y = centerY + (i - team2Ships.length / 2) * spacing;
      ship.angle = 270; // Facing left (toward enemy)

      this.ships.set(ship.id, ship);
      this.team2ShipIds.push(ship.id);
      this.initShipStats(ship, "team2");
    });
  }

  private createShip(spec: SimShipSpec, team: string, index: number): SimShip {
    const def = getShipDefinition(spec.shipId);
    if (!def) {
      throw new Error(`Unknown ship definition: ${spec.shipId}`);
    }

    const combatStats = {
      ...getModeCombatStats(spec.shipId, this.config.mode, MINIATURE_SCALE),
    };
    let maxHull = def.baseStats.hull;
    let maxShields = def.baseStats.shields;
    const armor = def.baseStats.armor ?? 0;

    // Apply upgrade bonuses from loadout
    let ordnanceCharges = 0;
    let ordnanceDice = 0;
    let hasStealthDevice = false;
    let hasPredator = false;

    if (spec.loadoutId) {
      const loadout = getLoadoutById(spec.loadoutId);
      if (loadout) {
        for (const upgradeId of loadout.upgrades) {
          const upgrade = UPGRADE_DEFINITIONS[upgradeId];
          if (!upgrade?.effects) continue;
          const fx = upgrade.effects;
          if (fx.attackBonus) combatStats.attackDice += fx.attackBonus;
          if (fx.hullBonus) maxHull += fx.hullBonus;
          if (fx.shieldBonus) maxShields += fx.shieldBonus;
          if (fx.agilityBonus) {
            if (upgradeId === "stealth_device") {
              hasStealthDevice = true;
            } else {
              combatStats.agilityDice += fx.agilityBonus;
            }
          }
          if (fx.chargesAdded) {
            const slotDice = ORDNANCE_DICE_BY_SLOT[upgrade.slotType] ?? 0;
            if (slotDice > 0) {
              ordnanceCharges += fx.chargesAdded;
              ordnanceDice = Math.max(ordnanceDice, slotDice);
            }
          }
          if (fx.rerollCount) hasPredator = true;
        }
      }
    }

    // Use pilot initiative as skill level if pilot specified
    const pilotSkill = spec.pilotId
      ? (PILOT_CARDS[spec.pilotId]?.initiative ?? 3)
      : 3 + Math.floor(this.rng() * 4);

    return {
      id: `${team}_${spec.shipId}_${index}`,
      definitionId: spec.shipId,
      faction: def.faction,
      owner: team === "team1" ? "player" : "ai",
      x: 0,
      y: 0,
      angle: 0,
      hull: maxHull,
      maxHull,
      shields: maxShields,
      maxShields,
      armor,
      pilotSkill,
      combatStats,
      currentSpeed: 2,
      weaponCooldown: 0,
      focusToken: false,
      evadeToken: false,
      targetLockToken: false,
      ordnanceCharges,
      ordnanceDice,
      hasStealthDevice,
      hasPredator,
    };
  }

  private initShipStats(ship: SimShip, team: "team1" | "team2"): void {
    this.shipStats.set(ship.id, {
      shipId: ship.id,
      definitionId: ship.definitionId,
      faction: ship.faction,
      team,
      survived: true,
      damageDealt: 0,
      damageTaken: 0,
      kills: 0,
      turnsAlive: 0,
      shotsHit: 0,
      shotsMissed: 0,
    });
  }

  /**
   * Heuristic action selection per round.
   * Priority: ordnance available → target lock; bomber/support → evade; default → focus.
   */
  private selectAction(ship: SimShip): void {
    const role = getShipDefinition(ship.definitionId)?.role ?? "heavy_fighter";
    if (ship.ordnanceCharges > 0) {
      ship.targetLockToken = true;
      ship.focusToken = false;
      ship.evadeToken = false;
    } else if (role === "bomber" || role === "support") {
      ship.evadeToken = true;
      ship.focusToken = false;
      ship.targetLockToken = false;
    } else {
      ship.focusToken = true;
      ship.evadeToken = false;
      ship.targetLockToken = false;
    }
  }

  private simulateTurn(): void {
    // Action phase
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;
      this.selectAction(ship);
    }

    // Movement phase
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;

      const stats = this.shipStats.get(ship.id);
      if (stats) stats.turnsAlive++;

      // Simple AI: move towards nearest enemy
      const enemies = this.getEnemies(ship);
      if (enemies.length === 0) continue;

      const nearest = this.findNearest(ship, enemies);
      if (!nearest) continue;

      // Choose maneuver towards enemy
      const maneuver = this.chooseManeuver(ship, nearest);
      this.executeManeuver(ship, maneuver);

      // Reduce weapon cooldown
      if (ship.weaponCooldown > 0) {
        ship.weaponCooldown--;
      }
    }

    // Combat phase
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;
      if (ship.weaponCooldown > 0) continue;

      const target = this.findBestTarget(ship);
      if (target) {
        this.executeAttack(ship, target);
      }
    }
  }

  private getEnemies(ship: SimShip): SimShip[] {
    const isTeam1 = this.team1ShipIds.includes(ship.id);
    const enemyIds = isTeam1 ? this.team2ShipIds : this.team1ShipIds;

    return enemyIds
      .map((id) => this.ships.get(id))
      .filter((s): s is SimShip => s !== undefined && s.hull > 0);
  }

  private findNearest(ship: SimShip, targets: SimShip[]): SimShip | null {
    let nearest: SimShip | null = null;
    let minDist = Infinity;

    for (const target of targets) {
      const dist = this.distance(ship, target);
      if (dist < minDist) {
        minDist = dist;
        nearest = target;
      }
    }

    return nearest;
  }

  private distance(a: SimShip, b: SimShip): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  private chooseManeuver(
    ship: SimShip,
    target: SimShip,
  ): { direction: ManeuverDirection; speed: number } {
    // Calculate angle to target using Phaser convention: 0=up, 90=right, 180=down, 270=left
    // atan2 gives: 0=right, 90=down, 180=left, -90=up (screen space)
    // Conversion: phaserAngle = atan2Angle + 90
    const atan2Angle =
      Math.atan2(target.y - ship.y, target.x - ship.x) * (180 / Math.PI);
    const angleToTarget = (((atan2Angle + 90) % 360) + 360) % 360;

    let angleDiff = angleToTarget - ship.angle;

    // Normalize angle difference to -180 to 180
    while (angleDiff > 180) angleDiff -= 360;
    while (angleDiff < -180) angleDiff += 360;

    // Choose direction based on angle difference
    // Positive angleDiff = target is to the right of current facing
    // Negative angleDiff = target is to the left of current facing
    let direction: ManeuverDirection;
    if (Math.abs(angleDiff) < 20) {
      direction = "straight";
    } else if (angleDiff > 0) {
      direction = angleDiff > 45 ? "turn_right" : "bank_right";
    } else {
      direction = angleDiff < -45 ? "turn_left" : "bank_left";
    }

    // Choose speed - always aggressive, faster movement
    const dist = this.distance(ship, target);
    const speed = dist > 200 ? 3 : dist > 100 ? 2 : 1;

    return { direction, speed };
  }

  private executeManeuver(
    ship: SimShip,
    maneuver: { direction: ManeuverDirection; speed: number },
  ): void {
    const template = getManeuverTemplate(maneuver.direction, maneuver.speed);
    if (!template) return;

    const result = applyManeuver(ship.x, ship.y, ship.angle, template);

    ship.x = result.x;
    ship.y = result.y;
    ship.angle = result.angle;
    ship.currentSpeed = maneuver.speed;

    // Keep within bounds
    ship.x = Math.max(50, Math.min(this.config.battlefieldSize - 50, ship.x));
    ship.y = Math.max(50, Math.min(this.config.battlefieldSize - 50, ship.y));
  }

  private findBestTarget(attacker: SimShip): SimShip | null {
    const enemies = this.getEnemies(attacker);
    let best: SimShip | null = null;
    let bestScore = -Infinity;

    const maxRange = attacker.combatStats.weaponRange;
    const maxArc = attacker.combatStats.firingArc / 2;

    for (const enemy of enemies) {
      const dist = this.distance(attacker, enemy);
      if (dist > maxRange) continue;

      // Check firing arc using Phaser angle convention: 0=up, 90=right, 180=down, 270=left
      const atan2Angle =
        Math.atan2(enemy.y - attacker.y, enemy.x - attacker.x) *
        (180 / Math.PI);
      const angleToTarget = (((atan2Angle + 90) % 360) + 360) % 360;

      // Calculate angle difference between ship facing and target direction
      let angleDiff = angleToTarget - attacker.angle;
      // Normalize to -180 to 180
      while (angleDiff > 180) angleDiff -= 360;
      while (angleDiff < -180) angleDiff += 360;

      if (Math.abs(angleDiff) > maxArc) continue;

      // Score based on distance (closer is better) and health (lower is better)
      const score = maxRange - dist + (enemy.maxHull - enemy.hull) * 10;
      if (score > bestScore) {
        bestScore = score;
        best = enemy;
      }
    }

    return best;
  }

  private executeAttack(attacker: SimShip, target: SimShip): void {
    const attackerStats = this.shipStats.get(attacker.id);
    const targetStats = this.shipStats.get(target.id);
    const dist = this.distance(attacker, target);

    const canFireOrdnance =
      attacker.ordnanceCharges > 0 &&
      attacker.targetLockToken &&
      dist <= ORDNANCE_RANGE;

    const baseAttackDice = canFireOrdnance
      ? attacker.ordnanceDice
      : attacker.combatStats.attackDice;

    const effectiveAttack =
      baseAttackDice +
      (attacker.focusToken ? 1.0 : 0) +
      (attacker.targetLockToken && !canFireOrdnance ? 0.6 : 0) +
      (attacker.hasPredator ? 0.4 : 0);

    const stealthBonus =
      target.hasStealthDevice && target.hull === target.maxHull ? 1 : 0;
    const effectiveAgility =
      target.combatStats.agilityDice +
      stealthBonus +
      (target.focusToken ? 1.0 : 0) +
      (target.evadeToken ? 1.0 : 0);

    // Consume tokens regardless of hit/miss
    if (canFireOrdnance) attacker.ordnanceCharges--;
    attacker.focusToken = false;
    attacker.targetLockToken = false;
    target.focusToken = false;
    target.evadeToken = false;

    const hitChance = calculateHitChance(effectiveAttack, effectiveAgility);
    const hit = this.rng() < hitChance;

    if (hit) {
      const damage = Math.max(1, baseAttackDice - target.armor);
      let remainingDamage = damage;
      if (target.shields > 0) {
        const shieldDamage = Math.min(target.shields, remainingDamage);
        target.shields -= shieldDamage;
        remainingDamage -= shieldDamage;
      }
      if (remainingDamage > 0) target.hull -= remainingDamage;
      if (attackerStats) {
        attackerStats.damageDealt += damage;
        attackerStats.shotsHit++;
      }
      if (targetStats) targetStats.damageTaken += damage;
      if (target.hull <= 0) {
        if (targetStats) targetStats.survived = false;
        if (attackerStats) attackerStats.kills++;
      }
    } else {
      if (attackerStats) attackerStats.shotsMissed++;
    }

    attacker.weaponCooldown = Math.ceil(
      attacker.combatStats.weaponCooldown / 300,
    );
  }

  private generateResult(): BattleResult {
    let team1Alive = 0;
    let team2Alive = 0;
    let team1Damage = 0;
    let team2Damage = 0;
    let team1Destroyed = 0;
    let team2Destroyed = 0;

    for (const [shipId, stats] of this.shipStats) {
      if (stats.team === "team1") {
        if (stats.survived) team1Alive++;
        else team2Destroyed++;
        team1Damage += stats.damageDealt;
      } else {
        if (stats.survived) team2Alive++;
        else team1Destroyed++;
        team2Damage += stats.damageDealt;
      }
    }

    let winner: "team1" | "team2" | "draw";
    if (team1Alive > 0 && team2Alive === 0) {
      winner = "team1";
    } else if (team2Alive > 0 && team1Alive === 0) {
      winner = "team2";
    } else {
      winner = "draw";
    }

    return {
      winner,
      turnsElapsed: this.currentTurn,
      team1ShipsRemaining: team1Alive,
      team2ShipsRemaining: team2Alive,
      team1TotalDamageDealt: team1Damage,
      team2TotalDamageDealt: team2Damage,
      team1ShipsDestroyed: team1Destroyed,
      team2ShipsDestroyed: team2Destroyed,
      shipStats: new Map(this.shipStats),
    };
  }

  private aggregateResults(results: BattleResult[]): AggregatedStats {
    const stats: AggregatedStats = {
      totalBattles: results.length,
      team1Wins: 0,
      team2Wins: 0,
      draws: 0,
      averageTurns: 0,
      shipPerformance: new Map(),
      factionPerformance: new Map(),
    };

    let totalTurns = 0;
    const shipAggregates = new Map<
      string,
      {
        battles: number;
        survived: number;
        kills: number;
        damageDealt: number;
        damageTaken: number;
        turnsAlive: number;
        shotsHit: number;
        shotsMissed: number;
        faction: FactionId;
      }
    >();

    const factionAggregates = new Map<
      FactionId,
      {
        battles: number;
        wins: number;
        shipsTotal: number;
        shipsSurvived: number;
        damageDealt: number;
      }
    >();

    for (const result of results) {
      // Count wins
      if (result.winner === "team1") stats.team1Wins++;
      else if (result.winner === "team2") stats.team2Wins++;
      else stats.draws++;

      totalTurns += result.turnsElapsed;

      // Aggregate ship stats
      for (const [shipId, shipStats] of result.shipStats) {
        const defId = shipStats.definitionId;
        let agg = shipAggregates.get(defId);
        if (!agg) {
          agg = {
            battles: 0,
            survived: 0,
            kills: 0,
            damageDealt: 0,
            damageTaken: 0,
            turnsAlive: 0,
            shotsHit: 0,
            shotsMissed: 0,
            faction: shipStats.faction,
          };
          shipAggregates.set(defId, agg);
        }

        agg.battles++;
        if (shipStats.survived) agg.survived++;
        agg.kills += shipStats.kills;
        agg.damageDealt += shipStats.damageDealt;
        agg.damageTaken += shipStats.damageTaken;
        agg.turnsAlive += shipStats.turnsAlive;
        agg.shotsHit += shipStats.shotsHit;
        agg.shotsMissed += shipStats.shotsMissed;

        // Faction aggregates
        const faction = shipStats.faction;
        let factionAgg = factionAggregates.get(faction);
        if (!factionAgg) {
          factionAgg = {
            battles: 0,
            wins: 0,
            shipsTotal: 0,
            shipsSurvived: 0,
            damageDealt: 0,
          };
          factionAggregates.set(faction, factionAgg);
        }

        // This ship's team won?
        const teamWon =
          (shipStats.team === "team1" && result.winner === "team1") ||
          (shipStats.team === "team2" && result.winner === "team2");
        if (teamWon && !factionAggregates.get(faction)!.battles) {
          factionAgg.wins++;
        }
        factionAgg.shipsTotal++;
        if (shipStats.survived) factionAgg.shipsSurvived++;
        factionAgg.damageDealt += shipStats.damageDealt;
      }

      // Count faction battles (once per battle)
      const factionsInBattle = new Set<FactionId>();
      for (const shipStats of result.shipStats.values()) {
        factionsInBattle.add(shipStats.faction);
      }
      for (const faction of factionsInBattle) {
        const factionAgg = factionAggregates.get(faction);
        if (factionAgg) factionAgg.battles++;
      }
    }

    stats.averageTurns = totalTurns / results.length;

    // Convert ship aggregates to performance stats
    for (const [defId, agg] of shipAggregates) {
      const totalShots = agg.shotsHit + agg.shotsMissed;
      stats.shipPerformance.set(defId, {
        definitionId: defId,
        faction: agg.faction,
        battles: agg.battles,
        survivalRate: agg.survived / agg.battles,
        averageKills: agg.kills / agg.battles,
        averageDamageDealt: agg.damageDealt / agg.battles,
        averageDamageTaken: agg.damageTaken / agg.battles,
        averageTurnsAlive: agg.turnsAlive / agg.battles,
        hitRate: totalShots > 0 ? agg.shotsHit / totalShots : 0,
      });
    }

    // Convert faction aggregates
    for (const [faction, agg] of factionAggregates) {
      stats.factionPerformance.set(faction, {
        faction,
        battles: agg.battles,
        winRate: agg.battles > 0 ? agg.wins / agg.battles : 0,
        averageShipsSurviving:
          agg.battles > 0 ? agg.shipsSurvived / agg.battles : 0,
        averageDamageDealt: agg.battles > 0 ? agg.damageDealt / agg.battles : 0,
      });
    }

    return stats;
  }

  private getRandomShipsForFaction(
    faction: FactionId,
    count: number,
  ): string[] {
    const allShips = Object.values(SHIP_DEFINITIONS);
    const factionShips = allShips.filter((def) => def.faction === faction);
    const result: string[] = [];

    for (let i = 0; i < count; i++) {
      const ship = factionShips[Math.floor(this.rng() * factionShips.length)];
      if (ship) result.push(ship.id);
    }

    return result;
  }

  /**
   * Generate a balance report
   */
  generateBalanceReport(stats: AggregatedStats): string {
    let report = "=== BALANCE SIMULATION REPORT ===\n\n";

    report += `Total Battles: ${stats.totalBattles}\n`;
    report += `Team 1 Wins: ${stats.team1Wins} (${((stats.team1Wins / stats.totalBattles) * 100).toFixed(1)}%)\n`;
    report += `Team 2 Wins: ${stats.team2Wins} (${((stats.team2Wins / stats.totalBattles) * 100).toFixed(1)}%)\n`;
    report += `Draws: ${stats.draws} (${((stats.draws / stats.totalBattles) * 100).toFixed(1)}%)\n`;
    report += `Average Turns: ${stats.averageTurns.toFixed(1)}\n\n`;

    report += "--- FACTION PERFORMANCE ---\n";
    for (const [faction, perf] of stats.factionPerformance) {
      report += `\n${faction}:\n`;
      report += `  Win Rate: ${(perf.winRate * 100).toFixed(1)}%\n`;
      report += `  Avg Ships Surviving: ${perf.averageShipsSurviving.toFixed(2)}\n`;
      report += `  Avg Damage Dealt: ${perf.averageDamageDealt.toFixed(1)}\n`;
    }

    report += "\n--- SHIP PERFORMANCE ---\n";
    const sortedShips = Array.from(stats.shipPerformance.values()).sort(
      (a, b) => b.survivalRate - a.survivalRate,
    );

    for (const ship of sortedShips) {
      report += `\n${ship.definitionId} (${ship.faction}):\n`;
      report += `  Survival Rate: ${(ship.survivalRate * 100).toFixed(1)}%\n`;
      report += `  Avg Kills: ${ship.averageKills.toFixed(2)}\n`;
      report += `  Avg Damage: ${ship.averageDamageDealt.toFixed(1)} dealt / ${ship.averageDamageTaken.toFixed(1)} taken\n`;
      report += `  Hit Rate: ${(ship.hitRate * 100).toFixed(1)}%\n`;
      report += `  Avg Turns Alive: ${ship.averageTurnsAlive.toFixed(1)}\n`;
    }

    return report;
  }
}

// Singleton for easy access
export const battleSimulator = new BattleSimulator({ verbose: true });
