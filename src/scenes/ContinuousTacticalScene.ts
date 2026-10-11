/**
 * Continuous Tactical Battle Scene
 *
 * Squad command on the X-Wing cycle engine:
 * - Every ship flies true template arcs in fixed 500 ms cycles
 * - The player dials a standing maneuver order (direction + speed) for the
 *   selected ship; it latches into the engine's queue and flies at the next
 *   cycle boundary, every cycle, until another is dialed
 * - Red maneuvers build stress; a stressed pilot's red order is calmed
 * - The preview shows the rest of the current cycle and the queued order
 * - Combat happens in real-time based on position and arc
 */

import Phaser from "phaser";
import { ShipStatCard } from "../ui/ShipStatCard";
import { addShipVisual } from "../rendering/ShipVisual";
import type {
  ShipState,
  ManeuverDefinition,
  ManeuverDifficulty,
  ManeuverDirection,
} from "../core/types";
import type { FactionId } from "../config";
import { BATTLEFIELD_SIZE, SHIP_SIZES } from "../config";
import { getShipDefinition, getShipDial } from "../data/ShipDefinitions";
import {
  getModeCombatStats,
  type ModeCombatStats,
} from "../data/ModeBalancing";
import {
  type AIDifficultyLevel,
  DIFFICULTY_SETTINGS,
  getModifiedHitChance,
  getModifiedDamage,
  getModifiedCooldown,
  shouldPickOptimalTarget,
  shouldPickOptimalManeuver,
} from "../ai/AIDifficulty";
import { createCycleFlight } from "../arcade/systems/CycleFlight";
import {
  squadQuickBuilds,
  type LoadoutChoices,
} from "../arcade/systems/SquadQuickBuilds";
import type { DiceAttackResult } from "../arcade/systems/DiceAttack";
import { NEUTRAL_MODIFIERS } from "../core/CombatModifiers";
import {
  calmOrderIfStressed,
  chooseAiHeadingError,
  initialOrder,
  latchManeuverOrder,
  nearestDialManeuver,
  planOrderPreview,
  type PreviewPose,
} from "../arcade/systems/TacticalOrders";
import { HealthBar } from "../ui/HealthBar";
import { Minimap, type MinimapShip } from "../ui/Minimap";
import { PauseMenu } from "../ui/PauseMenu";
import { GameOverScreen } from "../ui/GameOverScreen";
import { EffectsManager } from "../rendering/EffectsManager";
import { renderBattleStarfield } from "../rendering/Starfield";
import { ParallaxBackground } from "../rendering/ParallaxBackground";
import { audioManager } from "../audio/AudioManager";
import { addPaintedSpaceBackground } from "../ui/TexturedPanel";
import { createPerformanceState } from "../systems/PerformanceSystem";
import { findClosestEnemy as battleFindClosestEnemy } from "../systems/BattleHelpers";
import {
  ContinuousBaseScene,
  type ContinuousShip,
  type ShotDice,
} from "./ContinuousBaseScene";
import { ShipTelemetry } from "../debug/ShipTelemetry";
import { InputManager } from "../input/InputManager";
import { setupSceneInput, teardownSceneInput } from "../input/setupSceneInput";
import {
  createSideScore,
  creditKill,
  resolveByPoints,
  type SideScore,
} from "../systems/arena/BattleScore";
import {
  createMatchTimer,
  tickMatchTimer,
  formatMatchClock,
  type MatchTimerState,
} from "../systems/arena/MatchTimer";
import {
  createCapitalSystems,
  turretDamageMultiplier,
} from "../systems/CapitalSystems";

/** One faction slot of the squad builder's battle config. */
interface TacticalFactionSlot {
  readonly factionId: FactionId;
  readonly controller: "player" | "ai";
  readonly ships: readonly string[];
  /** Quick builds chosen in the squad builder, by ship index. */
  readonly loadoutChoices?: LoadoutChoices;
}

/** The squad builder's battle config (registry `battleConfig`). */
interface TacticalBattleConfig {
  readonly factions: readonly TacticalFactionSlot[];
  readonly aiDifficulty?: AIDifficultyLevel;
}

/** Distance (px) from the battlefield center to each faction's spawn point. */
const FACTION_SPAWN_RADIUS = 300;
/** Spacing (px) between ships of a squad at spawn. */
const SQUAD_SHIP_SPACING = 60;
/** Damage from which a hit's damage number is shown as a critical. */
const HEAVY_HIT_DAMAGE = 3;

interface TacticalShip extends ShipState, ContinuousShip {
  pilotSkill: number;
  /**
   * Standing maneuver order dialed by the player (player ships only; AI
   * ships steer by heading error). Latched into the engine queue each frame.
   */
  order: ManeuverDefinition;
  combatStats: ModeCombatStats;
  weaponCooldown: number;
}

interface ShipSprite extends Phaser.GameObjects.Container {
  shipId: string;
  shipBody: Phaser.GameObjects.Graphics;
  thruster: Phaser.GameObjects.Graphics;
  speedIndicator: Phaser.GameObjects.Text;
}

/** Dim line color for the rest of the cycle already in flight. */
const PREVIEW_REMAINING_COLOR = 0xaaaaaa;
/** Radius (px) of the ghost ring where the queued order ends. */
const PREVIEW_GHOST_RADIUS = 15;
/** Dial color per maneuver difficulty. */
const DIFFICULTY_HEX: Readonly<Record<ManeuverDifficulty, number>> = {
  green: 0x44ff44,
  white: 0xffffff,
  red: 0xff4444,
};

/**
 * Dial color for a maneuver difficulty.
 * @param difficulty - Green, white or red.
 * @returns The fill/line color.
 */
function difficultyHex(difficulty: ManeuverDifficulty): number {
  return DIFFICULTY_HEX[difficulty];
}

/**
 * Strokes a polyline through a list of poses (current line style).
 * @param graphics - Target graphics.
 * @param poses - Points in draw order.
 */
function strokePoseLine(
  graphics: Phaser.GameObjects.Graphics,
  poses: readonly PreviewPose[],
): void {
  if (poses.length < 2) return;
  graphics.strokePoints(poses.map((p) => ({ x: p.x, y: p.y })));
}

export class ContinuousTacticalScene extends ContinuousBaseScene<
  TacticalShip,
  ShipSprite
> {
  private minimap!: Minimap;

  private playerShipIds: string[] = [];
  private enemyShipIds: string[] = [];
  private aiDifficulty: AIDifficultyLevel = "normal";
  private playerFaction: FactionId = "free_confederation";

  private selectedShipId: string | null = null;

  private battleStartTime: number = 0;

  private speedText!: Phaser.GameObjects.Text;
  private maneuverText!: Phaser.GameObjects.Text;
  private instructionText!: Phaser.GameObjects.Text;
  private hudTitleText!: Phaser.GameObjects.Text;
  private dialGraphics!: Phaser.GameObjects.Graphics;
  private pauseMenu: PauseMenu | null = null;

  private stats = { shipsDestroyed: 0, shipsLost: 0, damageDealt: 0 };

  /** Match time limit (ms); on timeout, destroyed point cost decides the winner. */
  private static readonly MATCH_DURATION_MS = 240_000;
  private matchTimer: MatchTimerState = createMatchTimer(
    ContinuousTacticalScene.MATCH_DURATION_MS,
  );
  private timerText: Phaser.GameObjects.Text | null = null;
  /** Point cost of enemy ships the player destroyed. */
  private playerSideScore: SideScore = createSideScore();
  /** Point cost of the player's ships the enemy destroyed. */
  private enemySideScore: SideScore = createSideScore();

  private previewGraphics: Phaser.GameObjects.Graphics | null = null;
  /** Rising-edge tracking so held STEER/THRUST intents still step the dial once per press. */
  private prevSteerLeft = false;
  private prevSteerRight = false;
  private prevThrustUp = false;
  private prevThrustDown = false;
  private inputSubscriptionIds: number[] = [];

  constructor() {
    super({ key: "ContinuousTacticalScene" });
  }

  create(): void {
    // Phaser never calls shutdown() on its own; without this, every restart
    // stacks another set of input subscriptions.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.cameras.main.setBounds(0, 0, BATTLEFIELD_SIZE, BATTLEFIELD_SIZE);
    this.cameras.main.setBackgroundColor(0x050510);
    addPaintedSpaceBackground(this, "nebula_blue", 0);

    audioManager.initialize();

    this.effectsManager = new EffectsManager(this);
    const savedSettings = this.registry.get("settings") as
      { cameraShake: boolean; showDamageNumbers: boolean } | undefined;
    if (savedSettings) {
      this.effectsManager.setUserSettings({
        cameraShake: savedSettings.cameraShake,
        showDamageNumbers: savedSettings.showDamageNumbers,
      });
    }
    this.background = new ParallaxBackground(
      this,
      BATTLEFIELD_SIZE,
      BATTLEFIELD_SIZE,
    );
    this.background.startShootingStars();
    this.background.addDistantPlanet(
      BATTLEFIELD_SIZE * 0.8,
      BATTLEFIELD_SIZE * 0.3,
      80,
      0x446688,
    );
    this.background.addSpaceStation(
      BATTLEFIELD_SIZE * 0.2,
      BATTLEFIELD_SIZE * 0.15,
      0.8,
    );
    this.performanceState = createPerformanceState();

    renderBattleStarfield(this, BATTLEFIELD_SIZE, { includeNebula: false });
    this.spawnShips();
    this.createHealthBars();
    this.createMinimap();
    this.createHUD();
    this.setupInput();

    this.cameras.main.centerOn(BATTLEFIELD_SIZE / 2, BATTLEFIELD_SIZE / 2);
    this.cameras.main.setZoom(0.9);

    this.battleStartTime = this.time.now;
    this.stats = { shipsDestroyed: 0, shipsLost: 0, damageDealt: 0 };
    this.matchTimer = createMatchTimer(
      ContinuousTacticalScene.MATCH_DURATION_MS,
    );
    this.playerSideScore = createSideScore();
    this.enemySideScore = createSideScore();

    this.createPauseMenu();

    if (ShipTelemetry.isEnabled()) {
      this.telemetry = new ShipTelemetry();
      this.telemetry.start();
      (
        window as unknown as { __shipTelemetry: ShipTelemetry }
      ).__shipTelemetry = this.telemetry;
    }

    if (this.playerShipIds.length > 0) {
      this.selectShip(this.playerShipIds[0] as string);
    }
  }

  shutdown(): void {
    this.inputSubscriptionIds.forEach((id) => InputManager.off(id));
    this.inputSubscriptionIds = [];
    teardownSceneInput();
  }

  override update(time: number, delta: number): void {
    InputManager.update();
    if (this.isPaused) return;
    this.pollDialInput();
    super.update(time, delta);

    if (this.updateMatchTimer(delta)) return;

    for (const ship of this.ships.values()) {
      if (ship.hull > 0) {
        this.effectsManager.updateTrailPosition(
          ship.id,
          ship.x,
          ship.y,
          ship.angle,
        );
      }
    }
    this.effectsManager.renderTrails();

    this.updateMinimapDisplay();
    this.updatePreview();
    this.updateSpriteHighlights();
  }

  // ──────────────────────────────────────────────
  // ContinuousBaseScene abstract implementations
  // ──────────────────────────────────────────────

  protected onShipDestroyed(shipId: string, killerId?: string): void {
    const ship = this.ships.get(shipId);
    const wasPlayerShip = ship?.owner === "player";

    const sprite = this.shipSprites.get(shipId);
    if (sprite) {
      this.effectsManager.createExplosion(sprite.x, sprite.y, "medium");
      sprite.destroy();
      this.shipSprites.delete(shipId);
    }

    this.effectsManager.removeEngineTrail(shipId);

    const healthBar = this.healthBars.get(shipId);
    if (healthBar) {
      healthBar.destroy();
      this.healthBars.delete(shipId);
    }

    if (killerId && ship) {
      const killer = this.ships.get(killerId);
      if (killer) {
        const killerName =
          killer.owner === "player"
            ? killer.definitionId.replace(/_/g, " ")
            : `Enemy ${killer.definitionId.replace(/_/g, " ")}`;
        const victimName =
          ship.owner === "player"
            ? ship.definitionId.replace(/_/g, " ")
            : `Enemy ${ship.definitionId.replace(/_/g, " ")}`;
        this.effectsManager.showKillNotification(
          killerName,
          victimName,
          640,
          60,
        );
      }
    }

    if (wasPlayerShip) {
      this.stats.shipsLost++;
      this.enemySideScore = creditKill(this.enemySideScore, ship!.definitionId);
    } else {
      this.stats.shipsDestroyed++;
      if (ship) {
        this.playerSideScore = creditKill(
          this.playerSideScore,
          ship.definitionId,
        );
      }
    }

    this.playerShipIds = this.playerShipIds.filter((id) => id !== shipId);
    this.enemyShipIds = this.enemyShipIds.filter((id) => id !== shipId);

    if (shipId === this.selectedShipId) {
      this.selectedShipId = this.playerShipIds[0] ?? null;
    }
  }

  protected checkRoundEnd(): void {
    const playerAlive = this.playerShipIds.some(
      (id) => (this.ships.get(id)?.hull ?? 0) > 0,
    );
    const enemyAlive = this.enemyShipIds.some(
      (id) => (this.ships.get(id)?.hull ?? 0) > 0,
    );

    if (!enemyAlive) {
      this.showGameOver(true, "Player Forces");
    } else if (!playerAlive) {
      this.showGameOver(false, "Enemy Forces");
    }
  }

  /**
   * Advance the match clock. On timeout the winner is decided by destroyed
   * squad-point cost (miniatures-style), else kills, else the enemy holds.
   * @returns true if the match ended this frame.
   */
  private updateMatchTimer(deltaMs: number): boolean {
    this.matchTimer = tickMatchTimer(this.matchTimer, deltaMs);
    if (this.timerText) {
      const remaining = this.matchTimer.remainingMs;
      this.timerText.setText(formatMatchClock(remaining));
      this.timerText.setColor(
        remaining <= 30_000
          ? "#ff4444"
          : remaining <= 60_000
            ? "#ffcc00"
            : "#ffffff",
      );
    }
    if (!this.matchTimer.expired) return false;
    const outcome = resolveByPoints(this.playerSideScore, this.enemySideScore);
    this.showGameOver(
      outcome === "side1",
      outcome === "side1" ? "Player Forces" : "Enemy Forces",
    );
    return true;
  }

  // ──────────────────────────────────────────────
  // ContinuousBaseScene overrides
  // ──────────────────────────────────────────────

  protected override getAIShipIds(): string[] {
    return this.enemyShipIds;
  }

  /**
   * The continuous dice model with AI difficulty on the hit chance and
   * damage, and a capital attacker's turret damage.
   *
   * @param attacker - The ship firing.
   * @param target - The ship fired at.
   * @returns Hit chance and base damage before equipment.
   */
  protected override shotDice(
    attacker: TacticalShip,
    target: TacticalShip,
  ): ShotDice {
    const dice = super.shotDice(attacker, target);
    return {
      hitChance:
        attacker.owner === "ai"
          ? getModifiedHitChance(dice.hitChance, this.aiDifficulty)
          : dice.hitChance,
      baseDamage: this.modeDamage(attacker, target, dice.baseDamage),
    };
  }

  /**
   * Dice damage scaled by AI difficulty and the attacker's turret systems.
   *
   * @param attacker - The ship firing.
   * @param target - The ship fired at.
   * @param damage - The mode's dice damage.
   * @returns Damage before equipment.
   */
  private modeDamage(
    attacker: TacticalShip,
    target: TacticalShip,
    damage: number,
  ): number {
    let scaled = damage;
    if (attacker.owner === "ai") {
      scaled = getModifiedDamage(scaled, this.aiDifficulty, true);
    } else if (target.owner === "ai") {
      scaled = getModifiedDamage(scaled, this.aiDifficulty, false);
    }
    if (attacker.capitalSystems) {
      scaled = Math.round(
        scaled * turretDamageMultiplier(attacker.capitalSystems),
      );
    }
    return scaled;
  }

  /**
   * Hit feedback (damage number, shield impact) and the player's damage
   * tally, then the hit itself.
   *
   * @param attacker - The ship that fired.
   * @param target - The ship hit.
   * @param result - The resolved shot.
   */
  protected override landShot(
    attacker: TacticalShip,
    target: TacticalShip,
    result: DiceAttackResult,
  ): void {
    if (attacker.owner === "player") {
      this.stats.damageDealt += result.damage;
    }
    this.effectsManager.showDamageNumber(
      target.x,
      target.y,
      result.damage,
      result.damage >= HEAVY_HIT_DAMAGE,
    );
    if (target.shields > 0) {
      this.effectsManager.shieldImpact(target.x, target.y, 0, target.faction);
    }
    super.landShot(attacker, target, result);
  }

  /** Steers the AI ships, then latches every player ship's standing order. */
  protected override updateAI(): void {
    super.updateAI();
    for (const id of this.playerShipIds) {
      const ship = this.ships.get(id);
      if (ship && this.canFly(ship)) this.latchOrder(ship);
    }
  }

  /**
   * Keeps a player ship's standing order queued on the cycle engine (the
   * engine clears its queue at each commit). A stressed pilot's red order
   * is calmed first.
   *
   * @param ship - A player ship.
   */
  private latchOrder(ship: TacticalShip): void {
    const calmed = calmOrderIfStressed(
      ship.order,
      ship.dial,
      ship.flight.stress.isStressed,
    );
    if (calmed !== ship.order) {
      ship.order = calmed;
      if (ship.id === this.selectedShipId) this.updateHUD();
    }
    const { control } = ship.flight.motion;
    const latched = latchManeuverOrder(control, ship.order);
    if (latched === control) return;
    this.setFlight(ship, {
      ...ship.flight,
      motion: { ...ship.flight.motion, control: latched },
    });
  }

  /**
   * Steers an AI ship: difficulty decides whether it chases the closest
   * enemy or a random one, and whether it flies the true heading error or a
   * sloppy one.
   *
   * @param ship - The AI ship.
   */
  protected override steerAiShip(ship: TacticalShip): void {
    const target = this.pickAiTarget(ship);
    if (!target) return;
    const headingErrorDeg = chooseAiHeadingError(
      this.headingErrorTo(ship, target),
      shouldPickOptimalManeuver(this.aiDifficulty),
      Math.random(),
    );
    this.steerToward(ship, target, headingErrorDeg);
  }

  /**
   * The enemy an AI ship chases this frame.
   *
   * @param ship - The AI ship.
   * @returns The closest enemy (optimal) or a random living one.
   */
  private pickAiTarget(ship: TacticalShip): TacticalShip | null {
    if (shouldPickOptimalTarget(this.aiDifficulty)) {
      return battleFindClosestEnemy(ship, this.ships);
    }
    const enemies = [...this.ships.values()].filter(
      (other) => other.faction !== ship.faction && other.hull > 0,
    );
    return enemies[Math.floor(Math.random() * enemies.length)] ?? null;
  }

  protected override processCombat(delta: number): void {
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;
      ship.weaponCooldown = Math.max(0, ship.weaponCooldown - delta);
      if (ship.weaponCooldown <= 0) {
        const target = this.findWeaponTarget(ship);
        if (target) {
          this.performAttack(ship, target);
          let cooldown = ship.combatStats.weaponCooldown;
          if (ship.owner === "ai")
            cooldown = getModifiedCooldown(cooldown, this.aiDifficulty);
          ship.weaponCooldown = cooldown;
        }
      }
    }
  }

  // ──────────────────────────────────────────────
  // Setup
  // ──────────────────────────────────────────────

  private spawnShips(): void {
    const battleConfig = this.registry.get("battleConfig") as
      TacticalBattleConfig | undefined;

    if (battleConfig?.aiDifficulty) {
      this.aiDifficulty = battleConfig.aiDifficulty;
    }

    if (battleConfig && battleConfig.factions.length > 0) {
      this.spawnFromConfig(battleConfig);
    } else {
      this.spawnDefaultShips();
    }
    audioManager.playFactionMusic(this.playerFaction, "tactical");

    for (const ship of this.ships.values()) {
      this.createShipSprite(ship);
    }
  }

  /**
   * Spawns every faction of the configured battle, evenly around the
   * battlefield center, facing it.
   *
   * @param config - The squad builder's battle config.
   */
  private spawnFromConfig(config: TacticalBattleConfig): void {
    config.factions.forEach((faction, factionIndex) => {
      const factionAngle =
        (factionIndex / config.factions.length) * Math.PI * 2;
      const ships = this.spawnFaction(faction, factionAngle);
      this.equipSquad(ships, faction.loadoutChoices);
      ships.forEach((ship) => this.registerShip(ship));

      const ids = ships.map((ship) => ship.id);
      if (faction.controller === "player") {
        this.playerFaction = faction.factionId;
        this.playerShipIds.push(...ids);
      } else {
        this.enemyShipIds.push(...ids);
      }
    });
  }

  /**
   * Builds one faction's ships in a line across its spawn bearing.
   *
   * @param faction - The faction slot.
   * @param factionAngle - Bearing (rad) of its spawn point from the center.
   * @returns Its new (unregistered, unequipped) ships, in squad order.
   */
  private spawnFaction(
    faction: TacticalFactionSlot,
    factionAngle: number,
  ): TacticalShip[] {
    const center = BATTLEFIELD_SIZE / 2;
    const factionX = center + Math.cos(factionAngle) * FACTION_SPAWN_RADIUS;
    const factionY = center + Math.sin(factionAngle) * FACTION_SPAWN_RADIUS;
    const facingAngle = ((factionAngle * 180) / Math.PI + 180) % 360;
    const perpAngle = factionAngle + Math.PI / 2;

    return faction.ships.map((shipDefId, shipIndex) => {
      const shipOffset =
        (shipIndex - (faction.ships.length - 1) / 2) * SQUAD_SHIP_SPACING;
      return this.createShip(
        `${faction.factionId}_${shipIndex}`,
        shipDefId,
        faction.factionId,
        faction.controller,
        factionX + Math.cos(perpAngle) * shipOffset,
        factionY + Math.sin(perpAngle) * shipOffset,
        facingAngle,
        3 + Math.floor(Math.random() * 4),
      );
    });
  }

  /**
   * Equips a squad with quick builds: the ones chosen in the squad builder,
   * a default for every other ship.
   *
   * @param ships - The squad, in squad order.
   * @param loadoutChoices - Loadouts chosen by ship index, if any.
   */
  private equipSquad(
    ships: readonly TacticalShip[],
    loadoutChoices?: LoadoutChoices,
  ): void {
    const loadouts = squadQuickBuilds(
      ships.map((ship) => ship.definitionId),
      loadoutChoices,
    );
    ships.forEach((ship, index) =>
      this.equipShip(ship, loadouts[index] ?? null),
    );
  }

  private spawnDefaultShips(): void {
    const centerX = BATTLEFIELD_SIZE / 2;
    const centerY = BATTLEFIELD_SIZE / 2;

    const playerShip = this.createShip(
      "player_0",
      "confed_falcon",
      "free_confederation",
      "player",
      centerX,
      centerY + 200,
      0,
      5,
    );
    this.registerShip(playerShip);
    this.playerShipIds.push(playerShip.id);

    for (let i = 0; i < 2; i++) {
      const ally = this.createShip(
        `ally_${i}`,
        "confed_sparrow",
        "free_confederation",
        "player",
        centerX + (i === 0 ? -100 : 100),
        centerY + 250,
        0,
        3,
      );
      this.registerShip(ally);
      this.playerShipIds.push(ally.id);
    }

    for (let i = 0; i < 3; i++) {
      const angle = ((i - 1) / 3) * Math.PI * 0.5;
      const enemy = this.createShip(
        `enemy_${i}`,
        i === 1 ? "terran_gladius" : "terran_viper",
        "terran_hegemony",
        "ai",
        centerX + Math.sin(angle) * 250,
        centerY - 200 + Math.cos(angle) * 50,
        180,
        i === 1 ? 4 : 2,
      );
      this.registerShip(enemy);
      this.enemyShipIds.push(enemy.id);
    }
    this.equipSquad(this.squadShips(this.playerShipIds));
    this.equipSquad(this.squadShips(this.enemyShipIds));
  }

  /**
   * @param shipIds - Ship ids, in squad order.
   * @returns The ships with those ids that exist.
   */
  private squadShips(shipIds: readonly string[]): TacticalShip[] {
    return shipIds.flatMap((id) => this.ships.get(id) ?? []);
  }

  /**
   * Adds a spawned ship to the battle and gives it an engine trail.
   *
   * @param ship - The new ship.
   */
  private registerShip(ship: TacticalShip): void {
    this.ships.set(ship.id, ship);
    this.effectsManager.registerEngineTrail(
      ship.id,
      ship.faction,
      ship.flight.motion.control.speed,
    );
  }

  private createShip(
    id: string,
    defId: string,
    faction: FactionId,
    owner: "player" | "ai",
    x: number,
    y: number,
    angle: number,
    pilotSkill: number,
  ): TacticalShip {
    const combatStats = getModeCombatStats(defId, "continuous");
    const isCapital = getShipDefinition(defId)?.role === "capital";
    const flight = createCycleFlight(defId, { x, y, angle });
    const dial = getShipDial(defId);

    return {
      id,
      definitionId: defId,
      faction,
      owner,
      x: flight.motion.x,
      y: flight.motion.y,
      angle: flight.motion.angle,
      hull: combatStats.hull,
      maxHull: combatStats.maxHull,
      shields: combatStats.shields,
      maxShields: combatStats.maxShields,
      isStressed: false,
      hasFocus: false,
      hasEvade: false,
      hasTargetLock: null,
      isCloaked: false,
      mobileArcDirection: "front",
      charges: 0,
      maxCharges: 0,
      currentManeuver: null,
      maneuverProgress: 0,
      pilotSkill,
      combatStats,
      flight,
      dial,
      cycleCommitted: false,
      order: initialOrder(dial, flight.motion.control.speed),
      weaponCooldown: 0,
      capitalSystems: isCapital ? createCapitalSystems(combatStats.hull) : null,
      loadoutId: null,
      modifiers: NEUTRAL_MODIFIERS,
      frenzyUntilMs: 0,
    };
  }

  private createShipSprite(ship: TacticalShip): void {
    const container = this.add.container(
      ship.x,
      ship.y,
    ) as unknown as ShipSprite;
    container.shipId = ship.id;

    const shipDef = getShipDefinition(ship.definitionId);
    const size = SHIP_SIZES[shipDef?.baseStats.size ?? "small"];

    const thruster = this.add.graphics();
    thruster.fillStyle(0xff4400, 0.6);
    thruster.fillTriangle(-6, size / 2, 6, size / 2, 0, size / 2 + 12);
    container.add(thruster);
    container.thruster = thruster;

    const visual = addShipVisual(this, container, {
      definitionId: ship.definitionId,
      faction: ship.faction as FactionId,
      fallbackSizeName: shipDef?.baseStats.size ?? "small",
      size,
      isPlayer: ship.owner === "player",
    });

    const skillText = this.add.text(0, -size / 2 - 12, `${ship.pilotSkill}`, {
      fontSize: "12px",
      color: "#ffff00",
    });
    skillText.setOrigin(0.5, 0.5);
    container.add(skillText);

    const speedIndicator = this.add.text(
      0,
      size / 2 + 10,
      `S${ship.flight.motion.control.speed}`,
      {
        fontSize: "10px",
        color: "#aaaaaa",
      },
    );
    speedIndicator.setOrigin(0.5, 0.5);
    container.add(speedIndicator);
    container.speedIndicator = speedIndicator;

    container.shipBody = visual.hull;
    container.setAngle(ship.angle);
    container.setDepth(10);

    if (ship.owner === "player") {
      container.setInteractive(
        new Phaser.Geom.Circle(0, 0, size),
        Phaser.Geom.Circle.Contains,
      );
      container.on("pointerdown", () => this.selectShip(ship.id));
    } else {
      container.setSize(size * 2, size * 2);
      container.setInteractive();
    }
    ShipStatCard.attachHoverCard(this, container, ship.definitionId);
    this.shipSprites.set(ship.id, container);
  }

  private createHealthBars(): void {
    for (const [id, ship] of this.ships) {
      const healthBar = new HealthBar({
        scene: this,
        x: ship.x,
        y: ship.y - 40,
        faction: ship.faction as FactionId,
        maxHull: ship.maxHull,
        maxShields: ship.maxShields,
        currentHull: ship.hull,
        currentShields: ship.shields,
      });
      this.healthBars.set(id, healthBar);
    }
  }

  private createMinimap(): void {
    this.minimap = new Minimap({
      scene: this,
      x: this.scale.width - 160,
      y: this.scale.height - 160,
      width: 150,
      height: 150,
    });
  }

  private createHUD(): void {
    const style = { font: "bold 18px monospace", color: "#ffffff" };

    this.hudTitleText = this.add
      .text(this.scale.width / 2, 20, "TACTICAL COMBAT", {
        font: "bold 24px monospace",
        color: "#00ff88",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    this.speedText = this.add
      .text(20, 100, "Speed: 2", style)
      .setScrollFactor(0)
      .setDepth(1000);
    this.maneuverText = this.add
      .text(20, 130, "Maneuver: STRAIGHT", style)
      .setScrollFactor(0)
      .setDepth(1000);

    this.instructionText = this.add
      .text(
        20,
        this.scale.height - 40,
        "LEFT/RIGHT: Dial maneuver | UP/DOWN: Speed | Orders fly next cycle | Click: Select ship | ESC: Pause",
        { font: "14px monospace", color: "#888888" },
      )
      .setScrollFactor(0)
      .setDepth(1000);

    this.timerText = this.add
      .text(
        this.scale.width / 2,
        52,
        formatMatchClock(ContinuousTacticalScene.MATCH_DURATION_MS),
        {
          font: "bold 22px monospace",
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: 3,
        },
      )
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    this.dialGraphics = this.add.graphics();
    this.dialGraphics.setScrollFactor(0);
    this.dialGraphics.setDepth(1000);
  }

  private setupInput(): void {
    setupSceneInput(this);
    this.inputSubscriptionIds.push(
      InputManager.on("PAUSE", () => this.togglePause()),
    );

    this.input.on(
      "wheel",
      (
        _pointer: Phaser.Input.Pointer,
        _gos: unknown,
        _dx: number,
        deltaY: number,
      ) => {
        const zoom = this.cameras.main.zoom;
        this.cameras.main.setZoom(
          Phaser.Math.Clamp(zoom - deltaY * 0.001, 0.5, 2),
        );
      },
    );
  }

  /**
   * STEER/THRUST are HELD intents (fire every frame while down) so gamepad
   * sticks and the touch stick feel continuous elsewhere — this scene needs
   * a single dial-step per press instead, so it does its own rising-edge
   * detection on top of InputManager.isHeld() rather than using .on().
   */
  private pollDialInput(): void {
    const steerLeft = InputManager.isHeld("STEER_LEFT");
    const steerRight = InputManager.isHeld("STEER_RIGHT");
    const thrustUp = InputManager.isHeld("THRUST_UP");
    const thrustDown = InputManager.isHeld("THRUST_DOWN");

    if (steerLeft && !this.prevSteerLeft) this.changeManeuverDirection(-1);
    if (steerRight && !this.prevSteerRight) this.changeManeuverDirection(1);
    if (thrustUp && !this.prevThrustUp) this.changeSpeed(1);
    if (thrustDown && !this.prevThrustDown) this.changeSpeed(-1);

    this.prevSteerLeft = steerLeft;
    this.prevSteerRight = steerRight;
    this.prevThrustUp = thrustUp;
    this.prevThrustDown = thrustDown;
  }

  private createPauseMenu(): void {
    this.pauseMenu = new PauseMenu({
      scene: this,
      onResume: () => {
        this.isPaused = false;
      },
      onRestart: () => {
        this.scene.restart();
      },
      onSettings: () => {
        this.scene.launch("SettingsScene", {
          returnScene: "ContinuousTacticalScene",
        });
      },
      onQuit: () => {
        this.scene.start("MainMenuScene");
      },
    });
  }

  // ──────────────────────────────────────────────
  // Player input
  // ──────────────────────────────────────────────

  private selectShip(shipId: string): void {
    this.selectedShipId = shipId;
    const ship = this.ships.get(shipId);
    if (ship) {
      this.updateHUD();
      this.cameras.main.startFollow(
        this.shipSprites.get(shipId) as Phaser.GameObjects.Container,
        true,
        0.1,
        0.1,
      );
    }
  }

  /**
   * The selected player ship, if it is still alive.
   * @returns The ship whose dial the player is setting, or null.
   */
  private selectedShip(): TacticalShip | null {
    const ship = this.ships.get(this.selectedShipId ?? "");
    return ship && ship.hull > 0 ? ship : null;
  }

  /**
   * Sets the selected ship's standing order unless a stressed pilot would
   * be ordered into a red maneuver. It flies from the next cycle boundary.
   *
   * @param ship - The selected ship.
   * @param order - The dialed maneuver.
   */
  private dialOrder(ship: TacticalShip, order: ManeuverDefinition): void {
    if (ship.flight.stress.isStressed && order.difficulty === "red") return;
    ship.order = order;
  }

  /**
   * Steps the selected ship's dial one notch left/right through
   * turn/bank/straight, keeping the speed as close as the dial allows.
   *
   * @param delta - -1 = one notch left, +1 = one notch right.
   */
  private changeManeuverDirection(delta: number): void {
    const ship = this.selectedShip();
    if (!ship) return;
    const directions: ManeuverDirection[] = [
      "turn_left",
      "bank_left",
      "straight",
      "bank_right",
      "turn_right",
    ];
    const currentIdx = directions.indexOf(ship.order.direction);
    const fromIdx = currentIdx === -1 ? 2 : currentIdx;
    const newDir =
      directions[Phaser.Math.Clamp(fromIdx + delta, 0, directions.length - 1)];
    if (!newDir) return;
    const dialed = nearestDialManeuver(ship.dial, newDir, ship.order.speed);
    if (dialed) this.dialOrder(ship, dialed);
    this.updateHUD();
  }

  /**
   * Steps the selected ship's ordered speed through the speeds its dial
   * offers for the ordered direction.
   *
   * @param delta - +1 = faster, -1 = slower.
   */
  private changeSpeed(delta: number): void {
    const ship = this.selectedShip();
    if (!ship) return;
    const { direction, speed } = ship.order;
    const options = ship.dial
      .filter((m) => m.direction === direction)
      .sort((a, b) => a.speed - b.speed);
    if (options.length === 0) return;
    const currentIdx = options.findIndex((m) => m.speed === speed);
    const dialed =
      options[
        Phaser.Math.Clamp(
          Math.max(0, currentIdx) + delta,
          0,
          options.length - 1,
        )
      ];
    if (dialed) this.dialOrder(ship, dialed);
    this.updateHUD();
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    this.instructionText.setColor(this.isPaused ? "#ff4444" : "#888888");
    if (this.isPaused && this.pauseMenu) {
      // Same scrollFactor(0)-vs-zoom hit-test issue seen elsewhere in this
      // codebase: a GameObject with scrollFactor(0) is not correctly
      // hit-tested by Phaser's pointer input when the camera zoom != 1.0.
      this.cameras.main.setZoom(1.0);
      this.pauseMenu.show();
    }
  }

  // ──────────────────────────────────────────────
  // UI updates
  // ──────────────────────────────────────────────

  private updateHUD(): void {
    const dirNames: Record<ManeuverDirection, string> = {
      straight: "STRAIGHT",
      drift_left: "TURNING LEFT",
      drift_right: "TURNING RIGHT",
      bank_left: "BANK LEFT",
      bank_right: "BANK RIGHT",
      turn_left: "TURN LEFT",
      turn_right: "TURN RIGHT",
      kturn: "K-TURN",
      segnor_left: "SEGNOR L",
      segnor_right: "SEGNOR R",
      tallon_left: "TALLON L",
      tallon_right: "TALLON R",
    };
    const ship = this.selectedShip();
    if (!ship) {
      this.dialGraphics.clear();
      return;
    }
    this.speedText.setText(`Speed: ${ship.order.speed}`);
    this.maneuverText.setText(`Maneuver: ${dirNames[ship.order.direction]}`);
    this.updateDialDisplay();
  }

  private updateDialDisplay(): void {
    this.dialGraphics.clear();
    const ship = this.selectedShip();
    if (!ship) return;

    const dial = ship.dial;
    const cx = 100;
    const cy = 200;
    const radius = 40;

    this.dialGraphics.fillStyle(0x000000, 0.6);
    this.dialGraphics.fillCircle(cx, cy, radius + 10);

    const positions: Partial<Record<ManeuverDirection, { angle: number }>> = {
      turn_left: { angle: -90 },
      bank_left: { angle: -45 },
      straight: { angle: 0 },
      bank_right: { angle: 45 },
      turn_right: { angle: 90 },
      kturn: { angle: 180 },
      segnor_left: { angle: 135 },
      segnor_right: { angle: -135 },
      tallon_left: { angle: -135 },
      tallon_right: { angle: 135 },
    };

    for (const m of dial) {
      if (m.speed !== ship.order.speed) continue;
      const pos = positions[m.direction];
      if (!pos) continue;

      const angle = (pos.angle - 90) * Phaser.Math.DEG_TO_RAD;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      const isSelected = m.direction === ship.order.direction;
      const color = difficultyHex(m.difficulty);

      this.dialGraphics.fillStyle(color, isSelected ? 1 : 0.5);
      this.dialGraphics.fillCircle(x, y, isSelected ? 8 : 5);
    }
  }

  /**
   * Draws where the selected ship will fly: the rest of the cycle in flight
   * (dim) then its queued order (dial color) ending in a ghost ring — the
   * same template geometry the cycle engine flies.
   */
  private updatePreview(): void {
    this.previewGraphics?.clear();
    const ship = this.selectedShip();
    if (!ship) return;
    if (!this.previewGraphics) {
      this.previewGraphics = this.add.graphics().setDepth(5);
    }
    const preview = planOrderPreview(
      ship,
      ship.flight.motion.control,
      ship.order,
    );
    const color = difficultyHex(ship.order.difficulty);
    const end = preview.queued[preview.queued.length - 1];

    this.previewGraphics.lineStyle(1, PREVIEW_REMAINING_COLOR, 0.35);
    strokePoseLine(this.previewGraphics, preview.remaining);
    this.previewGraphics.lineStyle(2, color, 0.5);
    strokePoseLine(this.previewGraphics, preview.queued);
    if (end) {
      this.previewGraphics.lineStyle(1, color, 0.3);
      this.previewGraphics.strokeCircle(end.x, end.y, PREVIEW_GHOST_RADIUS);
    }
  }

  private updateSpriteHighlights(): void {
    for (const [id, sprite] of this.shipSprites) {
      sprite.setAlpha(id === this.selectedShipId ? 1 : 0.8);
      const speed = this.ships.get(id)?.flight.motion.control.speed;
      if (speed !== undefined) sprite.speedIndicator.setText(`S${speed}`);
      sprite.thruster.setAlpha(0.3 + (speed ?? 0) * 0.15);
    }
  }

  private updateMinimapDisplay(): void {
    const minimapShips: MinimapShip[] = [];
    for (const ship of this.ships.values()) {
      minimapShips.push({
        id: ship.id,
        x: ship.x,
        y: ship.y,
        faction: ship.faction as FactionId,
        isPlayer: ship.owner === "player",
        isAlive: ship.hull > 0,
      });
    }
    this.minimap.update(minimapShips);
  }

  private showGameOver(isPlayerVictory: boolean, winner: string): void {
    this.isPaused = true;
    audioManager.playFactionStinger(
      this.playerFaction,
      isPlayerVictory ? "victory" : "defeat",
    );
    // Hide the in-battle HUD — previously bled through the semi-transparent overlay.
    this.hudTitleText.setVisible(false);
    this.speedText.setVisible(false);
    this.maneuverText.setVisible(false);
    this.instructionText.setVisible(false);
    this.timerText?.setVisible(false);
    this.minimap?.setVisible(false);
    new GameOverScreen({
      scene: this,
      stats: {
        winner,
        isPlayerVictory,
        shipsDestroyed: this.stats.shipsDestroyed,
        shipsLost: this.stats.shipsLost,
        damageDealt: this.stats.damageDealt,
        battleDuration: this.time.now - this.battleStartTime,
      },
      onRestart: () => {
        this.scene.restart();
      },
      onQuit: () => {
        this.scene.start("MainMenuScene");
      },
    });
  }
}
