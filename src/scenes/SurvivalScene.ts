/**
 * Survival Mode Scene
 *
 * Roguelite survival mode (see docs/adr/ADR-0003):
 * - Start with one ship
 * - Defeat threat-scaled waves of enemies
 * - Two parallel choices per wave: draft a power for your ship AND decide the
 *   escort track (recruit a weak basic escort or bank a reroll)
 * - Milestone waves open the Hangar (graduate / evolve)
 * - Permanent death - start over on loss
 */

import Phaser from "phaser";
import { ShipStatCard } from "../ui/ShipStatCard";
import type { FactionId } from "../config";
import { BATTLEFIELD_SIZE, FACTION_COLORS, SHIP_SIZES } from "../config";
import {
  getShipDefinition,
  getShipsByFaction,
  getShipDial,
} from "../data/ShipDefinitions";
import {
  getModeCombatStats,
  calculateHitChance,
  type ModeCombatStats,
} from "../data/ModeBalancing";
import {
  getManeuverTemplate,
  applyManeuver,
} from "../systems/ManeuverTemplates";
import {
  beltDamageForFrame,
  tightenBelt,
  type BeltConfig,
} from "../systems/arena/ArenaBoundary";
import { HealthBar } from "../ui/HealthBar";
import { EffectsManager } from "../rendering/EffectsManager";
import { headingDiffToTarget } from "../systems/MovementSystem";
import { ParallaxBackground } from "../rendering/ParallaxBackground";
import { audioManager } from "../audio/AudioManager";
import { addPaintedSpaceBackground } from "../ui/TexturedPanel";
import {
  createPerformanceState,
  updateFPS,
  evaluateQuality,
  type PerformanceState,
} from "../systems/PerformanceSystem";
import { findClosestEnemy as battleFindClosestEnemy } from "../systems/BattleHelpers";
import type { ManeuverDirection } from "../core/types";
import {
  applyCapitalSystemDamage,
  createCapitalSystems,
  isEnginesOffline,
  sumSystemsHull,
  SYSTEM_LABELS,
  type CapitalSystemsState,
} from "../systems/CapitalSystems";
import { SurvivalRunController } from "../systems/survival/SurvivalRunController";
import {
  SurvivalChoicePanel,
  type ChoiceCard,
} from "../ui/survival/SurvivalChoicePanel";
import type { Power } from "../data/survival/powers";
import type { HangarOption } from "../data/survival/hangar";
import type { EscortOption } from "../data/survival/escorts";
import { ShipTelemetry } from "../debug/ShipTelemetry";
import { PauseMenu } from "../ui/PauseMenu";
import { InputManager } from "../input/InputManager";
import { setupSceneInput, teardownSceneInput } from "../input/setupSceneInput";

/**
 * Default starting ship for each faction in Survival mode.
 * terran_hegemony used terran_stiletto (agility 3, no boost action) — the
 * weakest of the 5 starters on every axis (hull/attack tied-lowest, agility
 * lowest, missing the boost escape tool every other starter has). Verified
 * via repeated self-play: died at Wave 1 in 4/4 runs under identical play,
 * while synth_scout_drone (agility 4) reliably reached Wave 2+. Swapped to
 * terran_viper (agility 3 too, but +1 hull, +1 attack, has boost + target_lock)
 * to bring it in line with the other factions' starters.
 */
const FACTION_STARTER_SHIPS: Record<FactionId, string> = {
  terran_hegemony: "terran_viper",
  free_confederation: "confed_sparrow",
  synthetic_collective: "synth_scout_drone",
  void_corsairs: "corsair_fang",
  ascendant_empire: "ascendant_herald",
};

/**
 * The 2 flagship choices offered on the Survival setup screen for each
 * faction — one nimble/high-agility pick, one tankier pick. No squad
 * builder, no loadouts: pick a faction, pick one of these, go. Escorts
 * (recruited during the run) always use FACTION_STARTER_SHIPS regardless of
 * this choice — see reconcileEscorts().
 */
export const SURVIVAL_STARTER_CHOICES: Record<FactionId, readonly string[]> = {
  terran_hegemony: ["terran_viper", "terran_raptor"],
  free_confederation: ["confed_wasp", "confed_sparrow"],
  synthetic_collective: ["synth_scout_drone", "synth_drone"],
  void_corsairs: ["corsair_fang", "corsair_blade"],
  ascendant_empire: ["ascendant_herald", "ascendant_seraph"],
};

/** Maximum ships (flagship + escorts) the player fleet may field. */
const MAX_FLEET = 6;

/** Extra weapon range in pixels granted per point of the range bonus. */
const RANGE_PER_POINT = 40;

/**
 * Base asteroid-belt containment field before per-wave tightening. The belt is
 * harmless within `safeRadius` of the arena center and impassable at
 * `wallRadius`; each wave squeezes it inward (see tightenBelt).
 */
const BASE_BELT: BeltConfig = {
  safeRadius: 2600,
  wallRadius: 3000,
  maxDamagePerSecond: 3,
};

interface SurvivalShip {
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
  combatStats: ModeCombatStats;
  currentManeuverDir: ManeuverDirection;
  currentSpeed: number;
  targetX: number;
  targetY: number;
  targetAngle: number;
  weaponCooldown: number;
  /** Present only for boss-tier ships — Survival's closest analog to a capital. */
  capitalSystems?: CapitalSystemsState | null;
}

interface ShipSprite extends Phaser.GameObjects.Container {
  shipId: string;
}

export class SurvivalScene extends Phaser.Scene {
  private ships: Map<string, SurvivalShip> = new Map();
  private shipSprites: Map<string, ShipSprite> = new Map();
  private healthBars: Map<string, HealthBar> = new Map();

  private playerShipIds: string[] = [];
  private enemyShipIds: string[] = [];

  /** Player ship ids that are escorts (weak basic bodies, no flagship bonuses). */
  private escortShipIds: Set<string> = new Set();

  // Survival state
  private wave = 0;
  private score = 0;

  // Asteroid-belt containment (see docs/adr/ADR-0003): tightens each wave.
  private beltConfig: BeltConfig = BASE_BELT;
  private beltGraphics!: Phaser.GameObjects.Graphics;
  private playerFaction: FactionId = "free_confederation";
  private isWaveActive = false;
  private isPaused = false;
  private isChoicePhase = false;
  /** Zoom to restore when a choice panel closes — see showDraft()/showHangar(). */
  private preChoiceZoom = 1;

  // Progression — single source of truth for pacing, drafts and bonuses.
  private run!: SurvivalRunController;
  private choicePanel!: SurvivalChoicePanel;

  // UI
  private waveText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;

  // Timing
  private lastManeuverTime = 0;
  private maneuverInterval = 300;

  // Player input (routed through InputManager — see setupInput())
  private pauseMenu!: PauseMenu;
  private inputSubscriptionIds: number[] = [];

  // Camera follow (manual — toroid wrap makes Phaser's startFollow jump at the seam)
  private cameraVirtualX = BATTLEFIELD_SIZE / 2;
  private cameraVirtualY = BATTLEFIELD_SIZE / 2;

  // Effects
  private effectsManager!: EffectsManager;
  private background!: ParallaxBackground;
  private performanceState: PerformanceState = createPerformanceState();
  private telemetry: ShipTelemetry | null = null;
  /** Flagship override from the setup screen; falls back to the faction default. */
  private starterShipId: string | null = null;

  constructor() {
    super({ key: "SurvivalScene" });
  }

  init(data: { factionId?: FactionId; shipId?: string }): void {
    if (data?.factionId) this.playerFaction = data.factionId;
    this.starterShipId = data?.shipId ?? null;
  }

  create(): void {
    // No setBounds — camera is driven manually for seamless toroid wrapping (see updateCameraFollow).
    this.cameras.main.setBackgroundColor(0x050510);
    addPaintedSpaceBackground(this, "starfield_deep", 0);

    audioManager.initialize();
    audioManager.playMusic("combat_medium");

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

    this.choicePanel = new SurvivalChoicePanel(this);
    this.beltGraphics = this.add.graphics().setDepth(1);
    this.resetState();
    this.createHUD();
    this.setupInput();

    if (ShipTelemetry.isEnabled()) {
      this.telemetry = new ShipTelemetry();
      this.telemetry.start();
      (
        window as unknown as { __shipTelemetry: ShipTelemetry }
      ).__shipTelemetry = this.telemetry;
    }

    this.cameras.main.centerOn(BATTLEFIELD_SIZE / 2, BATTLEFIELD_SIZE / 2);
    this.cameras.main.setZoom(0.9);

    // Start first wave after brief delay
    this.showMessage("SURVIVAL MODE", "Survive as long as you can!");
    this.time.delayedCall(2000, () => this.startNextWave());
  }

  shutdown(): void {
    this.inputSubscriptionIds.forEach((id) => InputManager.off(id));
    this.inputSubscriptionIds = [];
    teardownSceneInput();
  }

  private resetState(): void {
    this.wave = 0;
    this.score = 0;
    this.beltConfig = BASE_BELT;
    this.drawBelt();
    this.run = new SurvivalRunController(this.rollSeed());
    this.isWaveActive = false;
    this.isPaused = false;
    this.isChoicePhase = false;
    this.choicePanel.hide();

    this.ships.clear();
    this.shipSprites.forEach((s) => s.destroy());
    this.shipSprites.clear();
    this.healthBars.forEach((h) => h.destroy());
    this.healthBars.clear();
    this.playerShipIds = [];
    this.enemyShipIds = [];
    this.escortShipIds.clear();

    // Spawn initial player ship based on chosen faction (+ optional flagship choice)
    this.spawnPlayerShip(
      this.starterShipId ?? FACTION_STARTER_SHIPS[this.playerFaction],
      BATTLEFIELD_SIZE / 2,
      BATTLEFIELD_SIZE / 2 + 100,
    );
  }

  /** Fresh, unpredictable seed for a run's deterministic draft sequence. */
  private rollSeed(): number {
    return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  }

  update(time: number, delta: number): void {
    InputManager.update();
    if (this.isPaused || this.isChoicePhase) return;
    this.performanceState = updateFPS(this.performanceState, delta);
    this.performanceState = evaluateQuality(this.performanceState, time);
    this.effectsManager.setQualitySettings(
      this.performanceState.effectSettings,
    );

    this.background.update();

    if (time - this.lastManeuverTime >= this.maneuverInterval) {
      this.processManeuvers();
      this.lastManeuverTime = time;
    }

    this.interpolatePositions(delta);
    this.processCombat(delta);
    this.applyBeltDamage(delta);
    this.updateAI();
    this.updateSprites();
    this.updateCameraFollow();
    this.checkWaveComplete();
  }

  /**
   * Manually follows the flagship with toroid-aware shortest-path lerp
   * (mirrors ArcadeBattleScene/DogfightScene) so the camera doesn't stay
   * pinned to the battlefield center while the ship flies away.
   */
  private updateCameraFollow(): void {
    const ship = this.ships.get(this.playerShipIds[0] ?? "");
    if (!ship) return;

    let dx = ship.x - this.cameraVirtualX;
    let dy = ship.y - this.cameraVirtualY;
    if (dx > BATTLEFIELD_SIZE / 2) dx -= BATTLEFIELD_SIZE;
    if (dx < -BATTLEFIELD_SIZE / 2) dx += BATTLEFIELD_SIZE;
    if (dy > BATTLEFIELD_SIZE / 2) dy -= BATTLEFIELD_SIZE;
    if (dy < -BATTLEFIELD_SIZE / 2) dy += BATTLEFIELD_SIZE;

    const lerp = 0.09;
    this.cameraVirtualX += dx * lerp;
    this.cameraVirtualY += dy * lerp;
    this.cameraVirtualX =
      ((this.cameraVirtualX % BATTLEFIELD_SIZE) + BATTLEFIELD_SIZE) %
      BATTLEFIELD_SIZE;
    this.cameraVirtualY =
      ((this.cameraVirtualY % BATTLEFIELD_SIZE) + BATTLEFIELD_SIZE) %
      BATTLEFIELD_SIZE;

    const zoom = this.cameras.main.zoom;
    this.cameras.main.setScroll(
      this.cameraVirtualX - this.scale.width / (2 * zoom),
      this.cameraVirtualY - this.scale.height / (2 * zoom),
    );
  }

  private createHUD(): void {
    const style = { font: "bold 20px monospace", color: "#ffffff" };

    this.waveText = this.add
      .text(20, 20, "WAVE 0", style)
      .setScrollFactor(0)
      .setDepth(1000);

    this.scoreText = this.add
      .text(this.scale.width - 20, 20, "SCORE: 0", style)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    this.messageText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, "", {
        font: "bold 36px Arial",
        color: "#00ffaa",
        stroke: "#004422",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001)
      .setAlpha(0);

    this.add
      .text(
        this.scale.width / 2,
        this.scale.height - 30,
        "UP/DOWN: Speed | LEFT/RIGHT: Turn | SPACE: Fire | ESC: Pause",
        {
          font: "14px monospace",
          color: "#666666",
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);
  }

  private setupInput(): void {
    setupSceneInput(this);
    this.createPauseMenu();
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
        const zoom = this.cameras.main.zoom - deltaY * 0.001;
        this.cameras.main.setZoom(Phaser.Math.Clamp(zoom, 0.5, 2));
      },
    );
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
        this.scene.launch("SettingsScene", { returnScene: "SurvivalScene" });
      },
      onQuit: () => {
        this.scene.start("MainMenuScene");
      },
    });
  }

  /**
   * ESC previously just showed a "PAUSED" text with no real menu — same
   * looks-like-a-freeze bug fixed elsewhere this session. Zoom resets to
   * 1.0 first for the scrollFactor(0)-vs-zoom hit-test reason documented in
   * DogfightScene.
   */
  private togglePause(): void {
    if (this.isChoicePhase) return;
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.cameras.main.setZoom(1.0);
      this.pauseMenu.show();
    }
  }

  private showMessage(title: string, subtitle: string): void {
    this.messageText.setText(`${title}\n${subtitle}`);
    this.messageText.setAlpha(1);

    this.tweens.add({
      targets: this.messageText,
      alpha: 0,
      delay: 1500,
      duration: 500,
    });
  }

  // ==========================================
  // WAVE MANAGEMENT
  // ==========================================

  /**
   * Wave Structure (from spec):
   * 1-5: Basic fighters and interceptors, Wave 5 mini-boss
   * 6-10: Mixed squadrons with bombers, Wave 10 boss
   * 11-15: Elite pilots and heavy ships, Wave 15 boss
   * 16-20: Epic ship sections appear, Wave 20 boss
   * 21+: Endless scaling, boss every 5 waves
   */
  private startNextWave(): void {
    this.wave = this.run.beginWave();
    this.beltConfig = tightenBelt(BASE_BELT, this.wave);
    this.drawBelt();
    this.waveText.setText(`WAVE ${this.wave}`);
    this.isWaveActive = true;

    if (this.run.isMilestone) {
      this.showMessage(`WAVE ${this.wave}`, "BOSS INCOMING!");
    } else {
      this.showMessage(`WAVE ${this.wave}`, this.getWaveType());
    }

    this.spawnWaveEnemies();
  }

  private getWaveType(): string {
    if (this.wave <= 5) return "Basic Fighters";
    if (this.wave <= 10) return "Mixed Squadron";
    if (this.wave <= 15) return "Elite Pilots";
    if (this.wave <= 20) return "Epic Forces";
    return "Endless Wave";
  }

  /**
   * Redraw the asteroid-belt rings for the current belt config. The inner ring
   * marks the safe zone; the outer ring is the impassable wall.
   */
  private drawBelt(): void {
    const cx = BATTLEFIELD_SIZE / 2;
    const cy = BATTLEFIELD_SIZE / 2;
    this.beltGraphics.clear();
    this.beltGraphics.lineStyle(6, 0x884422, 0.5);
    this.beltGraphics.strokeCircle(cx, cy, this.beltConfig.safeRadius);
    this.beltGraphics.lineStyle(10, 0xaa3311, 0.8);
    this.beltGraphics.strokeCircle(cx, cy, this.beltConfig.wallRadius);
  }

  /**
   * Apply asteroid-belt damage to every living ship based on its distance from
   * the arena center; ships driven to zero hull are destroyed as belt kills.
   */
  private applyBeltDamage(deltaMs: number): void {
    const cx = BATTLEFIELD_SIZE / 2;
    const cy = BATTLEFIELD_SIZE / 2;
    for (const ship of [...this.ships.values()]) {
      if (ship.hull <= 0) continue;
      const dist = Math.hypot(ship.x - cx, ship.y - cy);
      const damage = beltDamageForFrame(dist, this.beltConfig, deltaMs);
      if (damage <= 0) continue;
      ship.hull = Math.max(0, ship.hull - damage);
      this.healthBars.get(ship.id)?.update(ship.hull, ship.shields);
      if (ship.hull <= 0) this.destroyShip(ship.id, false);
    }
  }

  private checkWaveComplete(): void {
    if (!this.isWaveActive) return;

    const enemiesAlive = this.enemyShipIds.filter((id) => {
      const ship = this.ships.get(id);
      return ship && ship.hull > 0;
    }).length;

    if (enemiesAlive === 0) {
      this.isWaveActive = false;
      this.score += this.wave * 100;
      this.updateHUD();

      const heading = this.run.isMilestone ? "HANGAR" : "WAVE COMPLETE!";
      this.showMessage(heading, "Choose your upgrade");

      this.time.delayedCall(2000, () => {
        if (this.run.isMilestone) {
          this.showHangar();
        } else {
          this.showDraft();
        }
      });
    }

    const playersAlive = this.playerShipIds.filter((id) => {
      const ship = this.ships.get(id);
      return ship && ship.hull > 0;
    }).length;

    if (playersAlive === 0) {
      this.gameOver();
    }
  }

  private spawnEliteShip(
    defId: string,
    faction: FactionId,
    x: number,
    y: number,
  ): void {
    const id = `elite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const ship = this.createShip(id, defId, faction, "ai", x, y, 180);
    // Elite ships have +50% hull and +1 attack
    ship.maxHull = Math.floor(ship.maxHull * 1.5);
    ship.hull = ship.maxHull;
    ship.combatStats = {
      ...ship.combatStats,
      attackDice: ship.combatStats.attackDice + 1,
    };
    this.ships.set(id, ship);
    this.enemyShipIds.push(id);
    this.createShipSprite(ship, true);
    this.createHealthBar(ship);
  }

  private spawnBossShip(
    defId: string,
    faction: FactionId,
    x: number,
    y: number,
    multiplier: number,
  ): void {
    const id = `boss_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const ship = this.createShip(id, defId, faction, "ai", x, y, 180);
    // Boss ships scale with multiplier
    ship.maxHull = ship.maxHull * multiplier;
    ship.hull = ship.maxHull;
    ship.maxShields = ship.maxShields * multiplier;
    ship.shields = ship.maxShields;
    ship.combatStats = {
      ...ship.combatStats,
      attackDice: ship.combatStats.attackDice + Math.floor(multiplier / 2),
    };
    // Boss-tier ships get capital-style engines/turrets/bridge subsystems.
    ship.capitalSystems = createCapitalSystems(ship.maxHull);
    this.ships.set(id, ship);
    this.enemyShipIds.push(id);
    this.createShipSprite(ship, false, true);
    this.createHealthBar(ship);
  }

  private spawnWaveEnemies(): void {
    const enemyFaction = this.rotatingEnemyFaction();
    const roster = getShipsByFaction(enemyFaction);
    if (roster.length === 0) return;

    const { enemyCount, eliteCount } = this.run.waveSize(
      this.playerShipIds.length,
    );
    const centerX = BATTLEFIELD_SIZE / 2;

    for (let i = 0; i < enemyCount; i++) {
      const def = roster[i % roster.length]!;
      const slot = this.spawnSlot(i, enemyCount, centerX);
      this.spawnEnemyShip(def.id, enemyFaction, slot.x, slot.y);
    }

    for (let i = 0; i < eliteCount; i++) {
      const def =
        roster.find((s) => s.role === "gunship" || s.role === "bomber") ??
        roster[0]!;
      this.spawnEliteShip(def.id, enemyFaction, centerX + (i - 1) * 120, 160);
    }

    if (this.run.isMilestone) {
      const boss =
        roster.find((s) => s.role === "gunship") ?? roster[roster.length - 1]!;
      const multiplier = 2 + Math.floor(this.wave / 5);
      this.spawnBossShip(boss.id, enemyFaction, centerX, 150, multiplier);
    }
  }

  /** Cycles the enemy faction so successive waves feel varied. */
  private rotatingEnemyFaction(): FactionId {
    const factions: FactionId[] = [
      "terran_hegemony",
      "synthetic_collective",
      "void_corsairs",
      "ascendant_empire",
    ];
    return factions[(this.wave - 1) % factions.length]!;
  }

  /** Spread spawn point for the i-th enemy of a wave along an entry arc. */
  private spawnSlot(
    index: number,
    total: number,
    centerX: number,
  ): { x: number; y: number } {
    const angle = (index / Math.max(1, total)) * Math.PI - Math.PI / 2;
    const radius = 350 + Math.random() * 120;
    return {
      x: centerX + Math.cos(angle) * radius,
      y: 100 + Math.sin(angle) * 60 + index * 18,
    };
  }

  private showDraft(): void {
    this.isChoicePhase = true;
    this.preChoiceZoom = this.cameras.main.zoom;
    this.cameras.main.setZoom(1.0);
    const powers = this.run.draft();
    const cards: ChoiceCard[] = powers.map((p) => ({
      icon: p.icon,
      name: p.name,
      description: p.description,
    }));
    this.choicePanel.show("CHOOSE A POWER", cards, (index) => {
      const chosen = powers[index];
      if (chosen) this.onPowerChosen(chosen);
    });
  }

  private onPowerChosen(power: Power): void {
    this.run.choosePower(power);
    this.applyBonusesToFleet();
    this.showEscortChoice();
  }

  private showHangar(): void {
    this.isChoicePhase = true;
    this.preChoiceZoom = this.cameras.main.zoom;
    this.cameras.main.setZoom(1.0);
    const options = this.run.hangar();
    const cards: ChoiceCard[] = options.map((o) => ({
      icon: o.icon,
      name: o.name,
      description: o.description,
    }));
    this.choicePanel.show("HANGAR", cards, (index) => {
      const chosen = options[index];
      if (chosen) this.onHangarChosen(chosen);
    });
  }

  private onHangarChosen(option: HangarOption): void {
    this.run.chooseHangar(option);
    this.applyBonusesToFleet();
    this.showEscortChoice();
  }

  /**
   * Second, parallel choice each wave: the escort track. Shown after the power
   * draft / Hangar so every wave presents two independent decisions.
   */
  private showEscortChoice(): void {
    this.isChoicePhase = true;
    const options = this.run.draftEscort();
    const cards: ChoiceCard[] = options.map((o) => ({
      icon: o.icon,
      name: o.name,
      description: o.description,
    }));
    this.choicePanel.show("REINFORCE WING", cards, (index) => {
      const chosen = options[index];
      if (chosen) this.onEscortChosen(chosen);
    });
  }

  private onEscortChosen(option: EscortOption): void {
    this.run.chooseEscort(option);
    this.reconcileEscorts();
    this.endChoicePhase();
  }

  private endChoicePhase(): void {
    this.isChoicePhase = false;
    this.cameras.main.setZoom(this.preChoiceZoom);
    this.startNextWave();
  }

  /**
   * Materialises any escorts the run has earned but not yet spawned. Escorts are
   * the faction's basic starter ship — weak bodies that do NOT inherit the
   * flagship's drafted bonuses (their strength comes from support investment,
   * modelled in the balance sim, not from copying the flagship).
   */
  private reconcileEscorts(): void {
    const anchor = this.ships.get(this.playerShipIds[0] ?? "");
    if (!anchor) return;
    while (
      this.run.pendingEscorts() > 0 &&
      this.playerShipIds.length < MAX_FLEET
    ) {
      const offset = this.playerShipIds.length * 80;
      this.spawnPlayerShip(
        FACTION_STARTER_SHIPS[this.playerFaction],
        anchor.x + offset,
        anchor.y + 50,
        true,
      );
      this.run.markEscortSpawned();
    }
  }

  /** Re-applies hull/shield bonuses to the flagship fleet (escorts stay basic). */
  private applyBonusesToFleet(): void {
    const { maxHull, maxShields } = this.run.bonuses;
    for (const id of this.playerShipIds) {
      if (this.escortShipIds.has(id)) continue;
      const ship = this.ships.get(id);
      if (!ship) continue;
      ship.maxHull = ship.combatStats.maxHull + maxHull;
      ship.maxShields = ship.combatStats.maxShields + maxShields;
      ship.hull = Math.min(ship.hull, ship.maxHull);
      this.healthBars.get(id)?.update(ship.hull, ship.shields);
    }
  }

  private gameOver(): void {
    this.isPaused = true;

    // Kill any in-progress wave announcement tween so it doesn't bleed through the overlay
    this.tweens.killTweensOf(this.messageText);
    this.messageText.setAlpha(0);

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRect(0, 0, this.scale.width, this.scale.height);
    bg.setScrollFactor(0);
    bg.setDepth(2000);

    this.add
      .text(centerX, centerY - 80, "GAME OVER", {
        font: "bold 48px Arial",
        color: "#ff4444",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001);

    this.add
      .text(centerX, centerY - 20, `Wave Reached: ${this.wave}`, {
        font: "24px Arial",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001);

    this.add
      .text(centerX, centerY + 20, `Final Score: ${this.score}`, {
        font: "24px Arial",
        color: "#ffdd44",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001);

    // Buttons
    const retryBtn = this.add
      .text(centerX - 100, centerY + 80, "RETRY", {
        font: "bold 24px Arial",
        color: "#44ff44",
        backgroundColor: "#224422",
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001)
      .setInteractive({ useHandCursor: true });

    retryBtn.on("pointerdown", () => {
      this.scene.restart();
    });

    const menuBtn = this.add
      .text(centerX + 100, centerY + 80, "MENU", {
        font: "bold 24px Arial",
        color: "#ffffff",
        backgroundColor: "#444444",
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001)
      .setInteractive({ useHandCursor: true });

    menuBtn.on("pointerdown", () => {
      this.scene.start("MainMenuScene");
    });
  }

  private updateHUD(): void {
    this.scoreText.setText(`SCORE: ${this.score}`);
  }

  // ==========================================
  // SHIP MANAGEMENT
  // ==========================================

  private spawnPlayerShip(
    defId: string,
    x: number,
    y: number,
    isEscort = false,
  ): void {
    const id = `player_${this.playerShipIds.length}`;
    if (isEscort) this.escortShipIds.add(id);
    const ship = this.createShip(
      id,
      defId,
      this.playerFaction,
      "player",
      x,
      y,
      0,
    );
    this.ships.set(id, ship);
    this.playerShipIds.push(id);
    this.createShipSprite(ship);
    this.createHealthBar(ship);
  }

  private spawnEnemyShip(
    defId: string,
    faction: FactionId,
    x: number,
    y: number,
  ): void {
    const id = `enemy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const ship = this.createShip(id, defId, faction, "ai", x, y, 180);
    this.ships.set(id, ship);
    this.enemyShipIds.push(id);
    this.createShipSprite(ship);
    this.createHealthBar(ship);
  }

  private createShip(
    id: string,
    defId: string,
    faction: FactionId,
    owner: "player" | "ai",
    x: number,
    y: number,
    angle: number,
  ): SurvivalShip {
    const combatStats = getModeCombatStats(defId, "survival");

    // Escorts are weak basic bodies: they never inherit the flagship's drafted
    // bonuses. Only the flagship (a non-escort player ship) gets them.
    const isFlagship = owner === "player" && !this.escortShipIds.has(id);
    const hullBonus = isFlagship ? this.run.bonuses.maxHull : 0;
    const shieldBonus = isFlagship ? this.run.bonuses.maxShields : 0;

    return {
      id,
      definitionId: defId,
      faction,
      owner,
      x,
      y,
      angle,
      hull: combatStats.hull + hullBonus,
      maxHull: combatStats.maxHull + hullBonus,
      shields: combatStats.shields + shieldBonus,
      maxShields: combatStats.maxShields + shieldBonus,
      combatStats,
      currentManeuverDir: "straight",
      currentSpeed: 2,
      targetX: x,
      targetY: y,
      targetAngle: angle,
      weaponCooldown: 0,
    };
  }

  private createShipSprite(
    ship: SurvivalShip,
    isElite = false,
    isBoss = false,
  ): void {
    const container = this.add.container(
      ship.x,
      ship.y,
    ) as unknown as ShipSprite;
    container.shipId = ship.id;

    const color = FACTION_COLORS[ship.faction] ?? 0xffffff;
    let size: number = SHIP_SIZES.small;

    // Boss ships are larger
    if (isBoss) {
      size = SHIP_SIZES.large;
    } else if (isElite) {
      size = SHIP_SIZES.medium;
    }

    const body = this.add.graphics();
    body.fillStyle(color, 1);
    body.fillTriangle(0, -size / 2, -size / 3, size / 2, size / 3, size / 2);

    // Elite ships have golden outline
    if (isElite) {
      body.lineStyle(3, 0xffdd00, 1);
    } else if (isBoss) {
      // Boss ships have red outline
      body.lineStyle(4, 0xff4444, 1);
    } else {
      body.lineStyle(2, 0xffffff, 0.8);
    }
    body.strokeTriangle(0, -size / 2, -size / 3, size / 2, size / 3, size / 2);

    // Add glow for elite/boss
    if (isElite || isBoss) {
      const glowColor = isBoss ? 0xff4444 : 0xffdd00;
      const glow = this.add.graphics();
      glow.fillStyle(glowColor, 0.2);
      glow.fillCircle(0, 0, size * 0.8);
      container.add(glow);
    }

    container.add(body);

    container.setAngle(ship.angle);
    container.setDepth(isBoss ? 15 : 10);
    container.setSize(size * 2, size * 2);
    container.setInteractive();
    ShipStatCard.attachHoverCard(this, container, ship.definitionId);

    this.shipSprites.set(ship.id, container);
  }

  private createHealthBar(ship: SurvivalShip): void {
    const healthBar = new HealthBar({
      scene: this,
      x: ship.x,
      y: ship.y - 40,
      faction: ship.faction,
      maxHull: ship.maxHull,
      maxShields: ship.maxShields,
      currentHull: ship.hull,
      currentShields: ship.shields,
    });
    this.healthBars.set(ship.id, healthBar);
  }

  // ==========================================
  // COMBAT
  // ==========================================

  private processManeuvers(): void {
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
    }
  }

  private interpolatePositions(delta: number): void {
    const t = Math.min(1, delta / 280);

    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;

      ship.x = Phaser.Math.Linear(ship.x, ship.targetX, t * 3);
      ship.y = Phaser.Math.Linear(ship.y, ship.targetY, t * 3);

      let angleDiff = ship.targetAngle - ship.angle;
      if (angleDiff > 180) angleDiff -= 360;
      if (angleDiff < -180) angleDiff += 360;
      ship.angle += angleDiff * t * 3;
      ship.angle = ((ship.angle % 360) + 360) % 360;

      // Wrap around
      ship.x =
        ((ship.x % BATTLEFIELD_SIZE) + BATTLEFIELD_SIZE) % BATTLEFIELD_SIZE;
      ship.y =
        ((ship.y % BATTLEFIELD_SIZE) + BATTLEFIELD_SIZE) % BATTLEFIELD_SIZE;

      const sprite = this.shipSprites.get(ship.id);
      if (sprite) {
        sprite.setPosition(ship.x, ship.y);
        sprite.setAngle(ship.angle);
      }
      this.telemetry?.sample(ship.id, ship.x, ship.y, ship.angle);
    }
  }

  private processCombat(delta: number): void {
    const { fireRate, shieldRegen } = this.run.bonuses;
    const playerCooldownMod = Math.max(0.5, 1 - fireRate);
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;

      if (ship.owner === "player" && shieldRegen > 0) {
        ship.shields = Math.min(
          ship.maxShields,
          ship.shields + (shieldRegen * delta) / 1000,
        );
      }
      ship.weaponCooldown = Math.max(0, ship.weaponCooldown - delta);

      if (ship.weaponCooldown <= 0) {
        // Primary weapon always autofires once in range/arc — flagship, escorts, and AI alike.
        const target = this.findTarget(ship);
        if (target) {
          this.fireAt(ship, target);
          const mod = ship.owner === "player" ? playerCooldownMod : 1;
          ship.weaponCooldown = ship.combatStats.weaponCooldown * mod;
        }
      }
    }
  }

  private findTarget(ship: SurvivalShip): SurvivalShip | null {
    let best: SurvivalShip | null = null;
    let bestDist = Infinity;

    const maxRange =
      ship.combatStats.weaponRange +
      (ship.owner === "player" ? this.run.bonuses.range * RANGE_PER_POINT : 0);
    const maxArcRad = (ship.combatStats.firingArc / 2) * Phaser.Math.DEG_TO_RAD;

    for (const other of this.ships.values()) {
      if (other.faction === ship.faction || other.hull <= 0) continue;

      const dist = Phaser.Math.Distance.Between(
        ship.x,
        ship.y,
        other.x,
        other.y,
      );
      const angleToTarget = Phaser.Math.Angle.Between(
        ship.x,
        ship.y,
        other.x,
        other.y,
      );
      const shipFacing = (ship.angle - 90) * Phaser.Math.DEG_TO_RAD;
      let angleDiff = Math.abs(angleToTarget - shipFacing);
      if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

      if (dist < maxRange && angleDiff < maxArcRad && dist < bestDist) {
        best = other;
        bestDist = dist;
      }
    }

    return best;
  }

  private fireAt(attacker: SurvivalShip, target: SurvivalShip): void {
    const bonuses = this.run.bonuses;
    const targetAgility =
      target.combatStats.agilityDice +
      (target.owner === "player" ? bonuses.evasion : 0);
    const hitChance = calculateHitChance(
      attacker.combatStats.attackDice,
      targetAgility,
    );

    const hit = Math.random() < hitChance;

    if (hit) {
      let damage =
        attacker.combatStats.attackDice +
        (attacker.owner === "player" ? bonuses.damage : 0);
      if (attacker.owner === "player" && Math.random() < bonuses.critChance) {
        damage *= 2;
      }

      if (target.shields > 0) {
        const shieldDmg = Math.min(target.shields, damage);
        target.shields -= shieldDmg;
        damage -= shieldDmg;
      }
      if (damage > 0) {
        if (target.capitalSystems) {
          const result = applyCapitalSystemDamage(
            target.capitalSystems,
            damage,
          );
          target.capitalSystems = result.systems;
          target.hull = sumSystemsHull(result.systems);
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
        }
      }

      this.effectsManager.fireLaser(
        attacker.x,
        attacker.y,
        target.x,
        target.y,
        attacker.faction,
        true,
      );

      const healthBar = this.healthBars.get(target.id);
      healthBar?.update(target.hull, target.shields);

      if (target.hull <= 0) {
        this.destroyShip(target.id, attacker.owner === "player");
      }
    } else {
      this.effectsManager.fireLaser(
        attacker.x,
        attacker.y,
        target.x,
        target.y,
        attacker.faction,
        false,
      );
    }
  }

  private destroyShip(shipId: string, wasPlayerKill: boolean): void {
    const ship = this.ships.get(shipId);
    if (!ship) return;

    if (wasPlayerKill) {
      this.score += 100;
      this.updateHUD();
    }

    const sprite = this.shipSprites.get(shipId);
    if (sprite) {
      this.effectsManager.createExplosion(sprite.x, sprite.y, "medium");
      sprite.destroy();
      this.shipSprites.delete(shipId);
    }

    const healthBar = this.healthBars.get(shipId);
    if (healthBar) {
      healthBar.destroy();
      this.healthBars.delete(shipId);
    }

    this.playerShipIds = this.playerShipIds.filter((id) => id !== shipId);
    this.enemyShipIds = this.enemyShipIds.filter((id) => id !== shipId);
  }

  private updateAI(): void {
    for (const shipId of this.enemyShipIds) {
      const ship = this.ships.get(shipId);
      if (!ship || ship.hull <= 0) continue;

      const target = this.findClosestEnemy(ship);
      if (!target) continue;

      const angleDiff = headingDiffToTarget(
        ship.x,
        ship.y,
        ship.angle,
        target.x,
        target.y,
      );

      const dial = getShipDial(ship.definitionId);

      if (Math.abs(angleDiff) < 20) {
        const straight = dial.find((m) => m.direction === "straight");
        if (straight) {
          ship.currentManeuverDir = "straight";
          ship.currentSpeed = straight.speed;
        }
      } else if (angleDiff > 0) {
        const turn = dial.find(
          (m) => m.direction === "bank_right" || m.direction === "turn_right",
        );
        if (turn) {
          ship.currentManeuverDir = turn.direction;
          ship.currentSpeed = turn.speed;
        }
      } else {
        const turn = dial.find(
          (m) => m.direction === "bank_left" || m.direction === "turn_left",
        );
        if (turn) {
          ship.currentManeuverDir = turn.direction;
          ship.currentSpeed = turn.speed;
        }
      }
    }

    // Escorts (all player ships past the flagship) keep simple seek-AI.
    for (const shipId of this.playerShipIds.slice(1)) {
      const ship = this.ships.get(shipId);
      if (!ship || ship.hull <= 0) continue;

      const target = this.findClosestEnemy(ship);
      if (!target) continue;

      const angleDiff = headingDiffToTarget(
        ship.x,
        ship.y,
        ship.angle,
        target.x,
        target.y,
      );

      const dial = getShipDial(ship.definitionId);

      if (Math.abs(angleDiff) < 25) {
        ship.currentManeuverDir = "straight";
        ship.currentSpeed = 2 + Math.min(3, Math.floor(this.run.bonuses.speed));
      } else if (angleDiff > 0) {
        const turn = dial.find((m) => m.direction === "bank_right");
        if (turn) {
          ship.currentManeuverDir = "bank_right";
          ship.currentSpeed = turn.speed;
        }
      } else {
        const turn = dial.find((m) => m.direction === "bank_left");
        if (turn) {
          ship.currentManeuverDir = "bank_left";
          ship.currentSpeed = turn.speed;
        }
      }
    }

    // The flagship (first player ship) responds to real keyboard input.
    const flagship = this.ships.get(this.playerShipIds[0] ?? "");
    if (flagship && flagship.hull > 0) {
      this.applyPlayerControl(flagship);
    }
  }

  /**
   * Picks the flagship's next maneuver from its dial based on held keys.
   * UP/DOWN ramp speed through the dial's available speeds; LEFT/RIGHT bank
   * at the current speed (falling back to any available speed for that
   * direction); no input holds a straight maneuver.
   */
  private applyPlayerControl(ship: SurvivalShip): void {
    const dial = getShipDial(ship.definitionId);
    const speeds = [...new Set(dial.map((m) => m.speed))].sort((a, b) => a - b);

    let desiredSpeed = ship.currentSpeed;
    if (InputManager.isHeld("THRUST_UP")) {
      desiredSpeed = speeds.find((s) => s > desiredSpeed) ?? desiredSpeed;
    } else if (InputManager.isHeld("THRUST_DOWN")) {
      desiredSpeed =
        [...speeds].reverse().find((s) => s < desiredSpeed) ?? desiredSpeed;
    }

    let direction: ManeuverDirection = "straight";
    if (InputManager.isHeld("STEER_LEFT")) direction = "bank_left";
    else if (InputManager.isHeld("STEER_RIGHT")) direction = "bank_right";

    const chosen =
      dial.find((m) => m.direction === direction && m.speed === desiredSpeed) ??
      dial.find((m) => m.direction === direction) ??
      dial.find((m) => m.direction === "straight") ??
      dial[0];

    if (chosen) {
      ship.currentManeuverDir = chosen.direction;
      ship.currentSpeed = chosen.speed;
    }
  }

  private findClosestEnemy(ship: SurvivalShip): SurvivalShip | null {
    return battleFindClosestEnemy(ship, this.ships);
  }

  private updateSprites(): void {
    for (const [id, ship] of this.ships) {
      const healthBar = this.healthBars.get(id);
      if (healthBar) {
        healthBar.setPosition(ship.x, ship.y - 40);
      }
    }
  }
}
