/**
 * Continuous Tactical Battle Scene
 *
 * Hybrid between X-Wing style movement and smooth gameplay:
 * - Ships commit to maneuvers at short intervals (~300ms)
 * - Movement is smoothly animated over each interval
 * - Maneuver templates still determine distance and direction
 * - Ship maneuverability creates meaningful tactical differences
 * - Combat happens in real-time based on position and arc
 *
 * Key differences from full turn-based:
 * - No discrete planning/activation phases
 * - Ships can change maneuvers at each interval
 * - Faster, more arcade-like feel while maintaining tactical depth
 */

import Phaser from "phaser";
import { ShipStatCard } from "../ui/ShipStatCard";
import { addShipVisual } from "../rendering/ShipVisual";
import type {
  ShipState,
  ManeuverDefinition,
  ManeuverDirection,
} from "../core/types";
import type { FactionId } from "../config";
import { BATTLEFIELD_SIZE, SHIP_SIZES } from "../config";
import { getShipDefinition, getShipDial } from "../data/ShipDefinitions";
import {
  getModeCombatStats,
  calculateHitChance,
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
import {
  getManeuverTemplate,
  applyManeuver,
} from "../systems/ManeuverTemplates";
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
import {
  findClosestEnemy as battleFindClosestEnemy,
  applyLoadoutEffects,
} from "../systems/BattleHelpers";
import {
  ContinuousBaseScene,
  type ContinuousShip,
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
  applyCapitalSystemDamage,
  createCapitalSystems,
  isEnginesOffline,
  sumSystemsHull,
  turretDamageMultiplier,
  SYSTEM_LABELS,
} from "../systems/CapitalSystems";

interface TacticalShip extends ShipState, ContinuousShip {
  pilotSkill: number;
  currentManeuverDir: ManeuverDirection;
  currentSpeed: number;
  targetX: number;
  targetY: number;
  targetAngle: number;
  combatStats: ModeCombatStats;
  weaponCooldown: number;
  stressTokens: number;
}

interface ShipSprite extends Phaser.GameObjects.Container {
  shipId: string;
  shipBody: Phaser.GameObjects.Graphics;
  thruster: Phaser.GameObjects.Graphics;
  speedIndicator: Phaser.GameObjects.Text;
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
  private selectedManeuverDir: ManeuverDirection = "straight";
  private selectedSpeed: number = 2;

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
  private telemetry: ShipTelemetry | null = null;
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

    this.lastManeuverTime = this.time.now;
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
        this.telemetry?.sample(ship.id, ship.x, ship.y, ship.angle);
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

  protected override performAttack(
    attacker: TacticalShip,
    target: TacticalShip,
  ): void {
    let hitChance = calculateHitChance(
      attacker.combatStats.attackDice,
      target.combatStats.agilityDice,
    );

    if (attacker.owner === "ai") {
      hitChance = getModifiedHitChance(hitChance, this.aiDifficulty);
    }

    const hit = Math.random() < hitChance;

    this.effectsManager.fireLaser(
      attacker.x,
      attacker.y,
      target.x,
      target.y,
      attacker.faction as FactionId,
      hit,
    );

    if (!hit) return;

    let damage = attacker.combatStats.attackDice;
    if (attacker.owner === "ai") {
      damage = getModifiedDamage(damage, this.aiDifficulty, true);
    } else if (target.owner === "ai") {
      damage = getModifiedDamage(damage, this.aiDifficulty, false);
    }
    if (attacker.capitalSystems) {
      damage = Math.round(
        damage * turretDamageMultiplier(attacker.capitalSystems),
      );
    }

    let shieldDamage = 0;
    if (target.shields > 0) {
      shieldDamage = Math.min(target.shields, damage);
      target.shields -= shieldDamage;
      const hullDamage = damage - shieldDamage;
      if (hullDamage > 0) {
        target.hull = Math.max(0, target.hull - hullDamage);
        audioManager.playSound("hull_hit", 0.4);
      }
    } else if (target.capitalSystems) {
      const result = applyCapitalSystemDamage(target.capitalSystems, damage);
      target.capitalSystems = result.systems;
      target.hull = sumSystemsHull(result.systems);
      audioManager.playSound("hull_hit", 0.4);
      if (result.justDisabled && result.hitSystemId) {
        this.effectsManager.showFloatingText(
          target.x,
          target.y - 45,
          `${SYSTEM_LABELS[result.hitSystemId]} DISABLED!`,
          "#ff8800",
        );
      }
    } else {
      target.hull = Math.max(0, target.hull - damage);
      audioManager.playSound("hull_hit", 0.4);
    }

    if (attacker.owner === "player") {
      this.stats.damageDealt += damage;
    }

    this.effectsManager.showDamageNumber(
      target.x,
      target.y,
      damage,
      damage >= 3,
    );
    if (shieldDamage > 0) {
      this.effectsManager.shieldImpact(
        target.x,
        target.y,
        0,
        target.faction as FactionId,
      );
    }

    this.healthBars.get(target.id)?.update(target.hull, target.shields);

    if (target.hull <= 0) {
      this.onShipDestroyed(target.id, attacker.id);
    }
  }

  protected override runManeuverStep(): void {
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;
      if (ship.capitalSystems && isEnginesOffline(ship.capitalSystems))
        continue;

      const template = getManeuverTemplate(
        ship.currentManeuverDir,
        ship.currentSpeed,
      );
      const result = applyManeuver(ship.x, ship.y, ship.angle, template);
      ship.targetX = result.x;
      ship.targetY = result.y;
      ship.targetAngle = result.angle;

      const dial = getShipDial(ship.definitionId);
      const maneuver = dial.find(
        (m) =>
          m.direction === ship.currentManeuverDir &&
          m.speed === ship.currentSpeed,
      );
      if (maneuver?.difficulty === "red") {
        ship.stressTokens++;
      } else if (maneuver?.difficulty === "green" && ship.stressTokens > 0) {
        ship.stressTokens--;
      }

      if (ship.id === this.selectedShipId && ship.owner === "player") {
        ship.currentManeuverDir = this.selectedManeuverDir;
        ship.currentSpeed = this.selectedSpeed;
      }
    }
  }

  protected override pickManeuverForShip(ship: TacticalShip): void {
    let target: TacticalShip | null;
    if (shouldPickOptimalTarget(this.aiDifficulty)) {
      target = battleFindClosestEnemy(ship, this.ships);
    } else {
      const enemies: TacticalShip[] = [];
      for (const other of this.ships.values()) {
        if (other.faction !== ship.faction && other.hull > 0)
          enemies.push(other);
      }
      target =
        enemies.length > 0
          ? (enemies[Math.floor(Math.random() * enemies.length)] ?? null)
          : null;
    }
    if (!target) return;

    const dial = getShipDial(ship.definitionId);
    const available =
      ship.stressTokens > 0 ? dial.filter((m) => m.difficulty !== "red") : dial;

    if (shouldPickOptimalManeuver(this.aiDifficulty)) {
      const angleDiff = this.getAngleDiff(ship, target);
      if (Math.abs(angleDiff) < 20) {
        const m = available.find((d) => d.direction === "straight");
        if (m) {
          ship.currentManeuverDir = "straight";
          ship.currentSpeed = m.speed;
        }
      } else if (angleDiff > 0) {
        const m = available.find(
          (d) => d.direction === "bank_right" || d.direction === "turn_right",
        );
        if (m) {
          ship.currentManeuverDir = m.direction;
          ship.currentSpeed = m.speed;
        }
      } else {
        const m = available.find(
          (d) => d.direction === "bank_left" || d.direction === "turn_left",
        );
        if (m) {
          ship.currentManeuverDir = m.direction;
          ship.currentSpeed = m.speed;
        }
      }
    } else {
      const chosen = available[Math.floor(Math.random() * available.length)];
      if (chosen) {
        ship.currentManeuverDir = chosen.direction;
        ship.currentSpeed = chosen.speed;
      }
    }
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
      | {
          factions: Array<{
            factionId: FactionId;
            controller: "player" | "ai";
            ships: string[];
            loadoutChoices?: Record<string, string>;
          }>;
          aiDifficulty?: AIDifficultyLevel;
        }
      | undefined;

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

  private spawnFromConfig(config: {
    factions: Array<{
      factionId: FactionId;
      controller: "player" | "ai";
      ships: string[];
      loadoutChoices?: Record<string, string>;
    }>;
  }): void {
    const centerX = BATTLEFIELD_SIZE / 2;
    const centerY = BATTLEFIELD_SIZE / 2;
    const spawnRadius = 300;

    config.factions.forEach((faction, factionIndex) => {
      const factionAngle =
        (factionIndex / config.factions.length) * Math.PI * 2;
      const factionX = centerX + Math.cos(factionAngle) * spawnRadius;
      const factionY = centerY + Math.sin(factionAngle) * spawnRadius;
      const facingAngle = ((factionAngle * 180) / Math.PI + 180) % 360;

      faction.ships.forEach((shipDefId, shipIndex) => {
        const shipOffset = (shipIndex - (faction.ships.length - 1) / 2) * 60;
        const perpAngle = factionAngle + Math.PI / 2;
        const shipX = factionX + Math.cos(perpAngle) * shipOffset;
        const shipY = factionY + Math.sin(perpAngle) * shipOffset;

        const ship = this.createShip(
          `${faction.factionId}_${shipIndex}`,
          shipDefId,
          faction.factionId,
          faction.controller,
          shipX,
          shipY,
          facingAngle,
          3 + Math.floor(Math.random() * 4),
        );

        this.ships.set(ship.id, ship);
        applyLoadoutEffects(ship, faction.loadoutChoices?.[String(shipIndex)]);
        this.effectsManager.registerEngineTrail(
          ship.id,
          faction.factionId,
          ship.currentSpeed,
        );

        if (faction.controller === "player") {
          this.playerFaction = faction.factionId;
          this.playerShipIds.push(ship.id);
        } else {
          this.enemyShipIds.push(ship.id);
        }
      });
    });
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
    this.ships.set(playerShip.id, playerShip);
    this.effectsManager.registerEngineTrail(
      playerShip.id,
      "free_confederation",
      playerShip.currentSpeed,
    );
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
      this.ships.set(ally.id, ally);
      this.effectsManager.registerEngineTrail(
        ally.id,
        "free_confederation",
        ally.currentSpeed,
      );
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
      this.ships.set(enemy.id, enemy);
      this.effectsManager.registerEngineTrail(
        enemy.id,
        "terran_hegemony",
        enemy.currentSpeed,
      );
      this.enemyShipIds.push(enemy.id);
    }
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

    return {
      id,
      definitionId: defId,
      faction,
      owner,
      x,
      y,
      angle,
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
      currentManeuverDir: "straight",
      currentSpeed: 2,
      targetX: x,
      targetY: y,
      targetAngle: angle,
      weaponCooldown: 0,
      stressTokens: 0,
      capitalSystems: isCapital ? createCapitalSystems(combatStats.hull) : null,
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
      `S${ship.currentSpeed}`,
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
        "Arrow keys: Change maneuver | W/S: Speed | Click: Select ship | Space: Pause",
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
      this.selectedManeuverDir = ship.currentManeuverDir;
      this.selectedSpeed = ship.currentSpeed;
      this.updateHUD();
      this.cameras.main.startFollow(
        this.shipSprites.get(shipId) as Phaser.GameObjects.Container,
        true,
        0.1,
        0.1,
      );
    }
  }

  private changeManeuverDirection(delta: number): void {
    if (!this.selectedShipId) return;
    const ship = this.ships.get(this.selectedShipId);
    if (!ship) return;

    const dial = getShipDial(ship.definitionId);
    const directions: ManeuverDirection[] = [
      "turn_left",
      "bank_left",
      "straight",
      "bank_right",
      "turn_right",
    ];

    let currentIdx = directions.indexOf(this.selectedManeuverDir);
    if (currentIdx === -1) currentIdx = 2;

    const newDir =
      directions[
        Phaser.Math.Clamp(currentIdx + delta, 0, directions.length - 1)
      ];
    if (!newDir) return;

    const available =
      dial.find(
        (m) => m.direction === newDir && m.speed === this.selectedSpeed,
      ) ?? dial.find((m) => m.direction === newDir);

    if (available) {
      if (ship.stressTokens > 0 && available.difficulty === "red") return;
      this.selectedManeuverDir = newDir;
      this.selectedSpeed = available.speed;
    }

    this.updateHUD();
  }

  private changeSpeed(delta: number): void {
    if (!this.selectedShipId) return;
    const ship = this.ships.get(this.selectedShipId);
    if (!ship) return;

    const dial = getShipDial(ship.definitionId);
    const available = dial
      .filter((m) => m.direction === this.selectedManeuverDir)
      .map((m) => m.speed)
      .sort((a, b) => a - b);

    if (available.length === 0) return;

    let currentIdx = available.indexOf(this.selectedSpeed);
    if (currentIdx === -1) currentIdx = 0;

    const newSpeed =
      available[Phaser.Math.Clamp(currentIdx + delta, 0, available.length - 1)];
    if (newSpeed === undefined) return;

    const maneuver = dial.find(
      (m) => m.direction === this.selectedManeuverDir && m.speed === newSpeed,
    );
    if (maneuver && !(ship.stressTokens > 0 && maneuver.difficulty === "red")) {
      this.selectedSpeed = newSpeed;
    }

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
    this.speedText.setText(`Speed: ${this.selectedSpeed}`);
    this.maneuverText.setText(
      `Maneuver: ${dirNames[this.selectedManeuverDir]}`,
    );
    this.updateDialDisplay();
  }

  private updateDialDisplay(): void {
    this.dialGraphics.clear();
    if (!this.selectedShipId) return;
    const ship = this.ships.get(this.selectedShipId);
    if (!ship) return;

    const dial = getShipDial(ship.definitionId);
    const cx = 100;
    const cy = 200;
    const radius = 40;

    this.dialGraphics.fillStyle(0x000000, 0.6);
    this.dialGraphics.fillCircle(cx, cy, radius + 10);

    const positions: Record<ManeuverDirection, { angle: number }> = {
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
      if (m.speed !== this.selectedSpeed) continue;
      const pos = positions[m.direction];
      if (!pos) continue;

      const angle = (pos.angle - 90) * Phaser.Math.DEG_TO_RAD;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      const isSelected = m.direction === this.selectedManeuverDir;
      const color =
        m.difficulty === "green"
          ? 0x44ff44
          : m.difficulty === "red"
            ? 0xff4444
            : 0xffffff;

      this.dialGraphics.fillStyle(color, isSelected ? 1 : 0.5);
      this.dialGraphics.fillCircle(x, y, isSelected ? 8 : 5);
    }
  }

  private updatePreview(): void {
    if (this.previewGraphics) {
      this.previewGraphics.destroy();
      this.previewGraphics = null;
    }
    if (!this.selectedShipId) return;
    const ship = this.ships.get(this.selectedShipId);
    if (!ship) return;

    const template = getManeuverTemplate(
      this.selectedManeuverDir,
      this.selectedSpeed,
    );
    const result = applyManeuver(ship.x, ship.y, ship.angle, template);

    this.previewGraphics = this.add.graphics();
    this.previewGraphics.setDepth(5);

    const dial = getShipDial(ship.definitionId);
    const maneuver = dial.find(
      (m) =>
        m.direction === this.selectedManeuverDir &&
        m.speed === this.selectedSpeed,
    );
    const color =
      maneuver?.difficulty === "green"
        ? 0x44ff44
        : maneuver?.difficulty === "red"
          ? 0xff4444
          : 0xffffff;

    this.previewGraphics.lineStyle(2, color, 0.5);
    this.previewGraphics.lineBetween(ship.x, ship.y, result.x, result.y);
    this.previewGraphics.lineStyle(1, color, 0.3);
    this.previewGraphics.strokeCircle(result.x, result.y, 15);
  }

  private updateSpriteHighlights(): void {
    for (const [id, sprite] of this.shipSprites) {
      sprite.setAlpha(id === this.selectedShipId ? 1 : 0.8);
      const ship = this.ships.get(id);
      if (ship) sprite.speedIndicator.setText(`S${ship.currentSpeed}`);
      const thrusterAlpha = ship ? 0.3 + ship.currentSpeed * 0.15 : 0.3;
      sprite.thruster.setAlpha(thrusterAlpha);
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

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────

  /** Returns signed heading difference in degrees from ship's facing to target. */
  private getAngleDiff(ship: TacticalShip, target: TacticalShip): number {
    const angleToTarget =
      Phaser.Math.Angle.Between(ship.x, ship.y, target.x, target.y) *
      Phaser.Math.RAD_TO_DEG;
    const shipFacing = ship.angle - 90;
    let diff = angleToTarget - shipFacing;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return diff;
  }
}
