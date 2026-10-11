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
import { addShipVisual } from "../rendering/ShipVisual";
import {
  INITIAL_BANK_STATE,
  updateBankState,
  bankSquashFor,
  type BankState,
} from "../rendering/ShipBanking";
import type { FactionId } from "../config";
import { BATTLEFIELD_SIZE, CYCLE_DURATION_MS, SHIP_SIZES } from "../config";
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
  beltDamageForFrame,
  beltRetreatPoint,
  tightenBelt,
  type BeltConfig,
} from "../systems/arena/ArenaBoundary";
import { HealthBar } from "../ui/HealthBar";
import { BattleHud, cameraViewFrom } from "../ui/hud";
import { HOLO_PALETTE } from "../ui/theme/HoloTheme";
import { SurvivalModeHud } from "../ui/modeHud/SurvivalModeHud";
import {
  showResultOverlay,
  type ResultOverlay,
} from "../ui/modeHud/HoloResultOverlay";
import {
  attackIntervalMs,
  HitImmunityLedger,
} from "../arcade/systems/CombatTempo";
import {
  nearestHostile,
  nearestTargetInArc,
} from "../arcade/systems/ArcTargeting";
import { squadHudSnapshot } from "../arcade/systems/FlagshipHudSnapshot";
import {
  bossDurability,
  bossMultiplier,
  eliteMaxHull,
  realTimeBeltDamage,
  realTimeRunBonuses,
} from "../arcade/systems/SurvivalDurability";
import { EffectsManager } from "../rendering/EffectsManager";
import { ParallaxBackground } from "../rendering/ParallaxBackground";
import { audioManager } from "../audio/AudioManager";
import { syncListenerToCamera } from "../audio/CameraListener";
import { addPaintedSpaceBackground } from "../ui/TexturedPanel";
import {
  createPerformanceState,
  updateFPS,
  evaluateQuality,
  type PerformanceState,
} from "../systems/PerformanceSystem";
import type { ManeuverDefinition } from "../core/types";
import {
  createCycleFlight,
  tickCycleFlight,
  type CycleFlightState,
} from "../arcade/systems/CycleFlight";
import { PlayerFlightPilot } from "../arcade/systems/PlayerFlightPilot";
import type {
  FlightControlResult,
  FlightEvent,
} from "../arcade/systems/PilotFlightTypes";
import {
  SURVIVAL_ESCORT_TIER,
  survivalEnemyTier,
} from "../arcade/systems/SurvivalSteering";
import { SquadBattleAi } from "../arcade/systems/SquadBattleAi";
import type { BotPilot } from "../arcade/ai/BotPilot";
import { playFlightEventFx } from "../arcade/ArcadeFX";
import {
  equipFlight,
  equipQuickBuild,
  regenerateShields,
  stressModifiersOf,
} from "../arcade/systems/QuickBuildEquip";
import {
  absorbDamage,
  combatantOf,
  resolveDiceAttack,
} from "../arcade/systems/DiceAttack";
import {
  flagshipLoadout,
  joiningSquadLoadouts,
  planWaveRoster,
  type WaveSlot,
} from "../arcade/systems/SurvivalLoadouts";
import {
  deathBlastDamage,
  deathBlastTargets,
  hasWingman,
  rewardKill,
} from "../arcade/PilotAbilityCombat";
import { applyInstantStress } from "../arcade/ArcadeStress";
import {
  NEUTRAL_MODIFIERS,
  type CombatModifiers,
} from "../core/CombatModifiers";
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

/** Extra attack dice an elite wave ship rolls. */
const ELITE_ATTACK_BONUS = 1;

/** Horizontal gap (px) between elites entering side by side. */
const ELITE_SPACING_PX = 120;

/** Entry row (px from the top) for elites and the boss. */
const ELITE_ENTRY_Y = 160;
const BOSS_ENTRY_Y = 150;

/** Wave ships enter facing down the arena. */
const ENEMY_ENTRY_ANGLE = 180;

/** Damage multiplier of a crit drafted by the player fleet. */
const CRIT_DAMAGE_MULTIPLIER = 2;

/** Floor on the fire-rate bonus's cooldown multiplier (at most 2x faster). */
const MIN_PLAYER_COOLDOWN_MOD = 0.5;

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
  /** Cycle-engine motion and pilot stress; x/y/angle mirror its pose. */
  flight: CycleFlightState;
  dial: readonly ManeuverDefinition[];
  weaponCooldown: number;
  /** Quick build flown (upgrades + pilot), or null for the bare hull. */
  loadoutId: string | null;
  /** Real-time effects of the quick build. */
  modifiers: CombatModifiers;
  /** Scene time (ms) until which a kill-frenzy ability is active. */
  frenzyUntilMs: number;
  /** Present only for boss-tier ships — Survival's closest analog to a capital. */
  capitalSystems?: CapitalSystemsState | null;
  /** Its AI pilot (wave enemies, escorts), or null when the player flies it. */
  bot: BotPilot | null;
}

/** A pose on the battlefield. */
interface Pose {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

/** Everything needed to build one ship record. */
interface ShipSpawn {
  readonly id: string;
  readonly definitionId: string;
  readonly faction: FactionId;
  readonly owner: "player" | "ai";
  readonly pose: Pose;
  readonly loadoutId: string | null;
}

/** A player ship about to spawn at a point. */
interface PlayerSpawn {
  readonly definitionId: string;
  readonly x: number;
  readonly y: number;
  readonly loadoutId: string | null;
}

/** A wave ship about to spawn at a point. */
interface EnemySpawn {
  readonly slot: WaveSlot;
  readonly faction: FactionId;
  readonly x: number;
  readonly y: number;
}

/** Living ships per side this frame (wingman checks). */
type LivingBySide = ReadonlyMap<SurvivalShip["owner"], readonly SurvivalShip[]>;

interface ShipSprite extends Phaser.GameObjects.Container {
  shipId: string;
  /** Ship art image, when loaded — squashed/stretched by the banking effect on hard turns. */
  image?: Phaser.GameObjects.Image | null;
  /** Image's base scale (from setDisplaySize) that banking must multiply, not overwrite. */
  imageBaseScaleX?: number;
  imageBaseScaleY?: number;
  bankState: BankState;
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

  // UI — holographic battle HUD (flight, radar, weapons) + Survival readouts
  private battleHud: BattleHud | null = null;
  private modeHud!: SurvivalModeHud;
  private gameOverOverlay: ResultOverlay | null = null;

  /** X-Wing round tempo: a struck target ignores its attacker for a cycle. */
  private readonly hitLedger = new HitImmunityLedger();

  /** The human pilot's flight input (InputManager-driven) — flies the flagship. */
  private readonly pilot = new PlayerFlightPilot(InputManager);
  /** Bots, squad orders and marks of every AI-flown ship (enemies, escorts). */
  private readonly squadAi = new SquadBattleAi({
    worldSize: BATTLEFIELD_SIZE,
    safePointFor: (x, y) =>
      beltRetreatPoint(
        { x, y },
        { x: BATTLEFIELD_SIZE / 2, y: BATTLEFIELD_SIZE / 2 },
        this.beltConfig,
      ),
  });
  /** Ship the pilot last flew; a new flagship (old one lost) starts with fresh input memory. */
  private pilotedShipId: string | null = null;
  private cameraShakeEnabled = true;

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
  /** The flagship's quick build picked on the setup screen (null = default). */
  private starterLoadoutId: string | null = null;

  constructor() {
    super({ key: "SurvivalScene" });
  }

  init(data: {
    factionId?: FactionId;
    shipId?: string;
    loadoutId?: string | null;
  }): void {
    if (data?.factionId) this.playerFaction = data.factionId;
    this.starterShipId = data?.shipId ?? null;
    this.starterLoadoutId = data?.loadoutId ?? null;
  }

  create(): void {
    // Phaser never calls shutdown() on its own; without this, every restart
    // stacks another set of input subscriptions.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    // No setBounds — camera is driven manually for seamless toroid wrapping (see updateCameraFollow).
    this.cameras.main.setBackgroundColor(0x050510);
    addPaintedSpaceBackground(this, "starfield_deep", 0);

    audioManager.initialize();
    audioManager.playFactionMusic(this.playerFaction, "combat");

    this.effectsManager = new EffectsManager(this);
    const savedSettings = this.registry.get("settings") as
      { cameraShake: boolean; showDamageNumbers: boolean } | undefined;
    if (savedSettings) {
      this.cameraShakeEnabled = savedSettings.cameraShake;
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

    this.choicePanel = new SurvivalChoicePanel(this, this.playerFaction);
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
    this.pilot.detach();
    this.battleHud?.destroy();
    this.battleHud = null;
    this.gameOverOverlay = null;
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
    this.pilot.reset();
    this.pilotedShipId = null;
    this.squadAi.reset();
    this.hitLedger.clear();
    this.gameOverOverlay = null;

    this.ships.clear();
    this.shipSprites.forEach((s) => s.destroy());
    this.shipSprites.clear();
    this.healthBars.forEach((h) => h.destroy());
    this.healthBars.clear();
    this.playerShipIds = [];
    this.enemyShipIds = [];
    this.escortShipIds.clear();

    // Spawn initial player ship based on chosen faction (+ optional flagship choice)
    const definitionId =
      this.starterShipId ?? FACTION_STARTER_SHIPS[this.playerFaction];
    const loadoutId = flagshipLoadout(definitionId, this.starterLoadoutId);
    this.spawnPlayerShip({
      definitionId,
      x: BATTLEFIELD_SIZE / 2,
      y: BATTLEFIELD_SIZE / 2 + 100,
      loadoutId,
    });
  }

  /** Fresh, unpredictable seed for a run's deterministic draft sequence. */
  private rollSeed(): number {
    return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  }

  update(time: number, delta: number): void {
    InputManager.update();
    // Mix every positional sound relative to what the player is
    // looking at, so a distant firefight sounds distant.
    syncListenerToCamera(this.cameras.main);
    this.modeHud.sync(this.cameras.main);
    if (this.isPaused || this.isChoicePhase) return;
    this.performanceState = updateFPS(this.performanceState, delta);
    this.performanceState = evaluateQuality(this.performanceState, time);
    this.effectsManager.setQualitySettings(
      this.performanceState.effectSettings,
    );

    this.background.update();

    this.updateAI(time, delta);
    this.flyShips(delta);
    this.processCombat(delta);
    this.applyBeltDamage(delta);
    this.updateSprites();
    this.updateCameraFollow();
    this.updateHud();
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

  /** Holographic battle HUD (flagship ring, radar, weapons) + Survival readouts. */
  private createHUD(): void {
    this.modeHud = new SurvivalModeHud(this, this.playerFaction);
    this.battleHud = new BattleHud(this, { worldSize: BATTLEFIELD_SIZE });
  }

  /**
   * Refreshes the battle HUD from this frame's state: the flagship as the
   * player (its status ring replaces its health bar), wing mates as allies,
   * wave ships as enemies, its primary's cooldown and the score readout.
   */
  private updateHud(): void {
    this.modeHud.setScore(
      this.score,
      `Wing ${this.playerShipIds.length}/${MAX_FLEET}`,
    );
    const flagship = this.ships.get(this.playerShipIds[0] ?? "") ?? null;
    if (flagship) this.retireHealthBar(flagship.id);
    this.battleHud?.update(
      squadHudSnapshot({
        flagship,
        ships: this.ships.values(),
        targetId: flagship ? this.hudTargetOf(flagship) : null,
        markedId: this.squadAi.playerMarkOf(this.time.now),
        cooldownRemainingMs: flagship?.weaponCooldown ?? 0,
        attackIntervalMs: flagship ? this.attackIntervalOf(flagship) : 0,
        camera: cameraViewFrom(this.cameras.main),
      }),
    );
  }

  /**
   * @param ship - The flagship.
   * @returns Id of what it is shooting at, else the foe it is closing on.
   */
  private hudTargetOf(ship: SurvivalShip): string | null {
    return (this.findTarget(ship) ?? this.findClosestEnemy(ship))?.id ?? null;
  }

  /**
   * Drops a ship's floating health bar (the flagship's status ring shows it).
   *
   * @param shipId - The ship.
   */
  private retireHealthBar(shipId: string): void {
    this.healthBars.get(shipId)?.destroy();
    this.healthBars.delete(shipId);
  }

  /**
   * Shows or hides both HUD layers (hidden under choice and game-over panels).
   *
   * @param visible - Visibility.
   */
  private setHudVisible(visible: boolean): void {
    this.battleHud?.setVisible(visible);
    this.modeHud.setVisible(visible);
  }

  private setupInput(): void {
    setupSceneInput(this);
    this.pilot.attach();
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
    this.modeHud.showMessage(title, subtitle);
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
    this.modeHud.setWave(this.wave, this.getWaveType());
    this.isWaveActive = true;

    if (this.run.isMilestone) {
      this.showMessage(`WAVE ${this.wave}`, "BOSS INCOMING!");
    } else {
      this.showMessage(`WAVE ${this.wave}`, this.getWaveType());
    }

    this.squadAi.resetEnemySquad();
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
   * The belt is tuned in miniature points, scaled to real-time hit points.
   */
  private applyBeltDamage(deltaMs: number): void {
    const cx = BATTLEFIELD_SIZE / 2;
    const cy = BATTLEFIELD_SIZE / 2;
    for (const ship of [...this.ships.values()]) {
      if (ship.hull <= 0) continue;
      const dist = Math.hypot(ship.x - cx, ship.y - cy);
      const damage = realTimeBeltDamage(
        beltDamageForFrame(dist, this.beltConfig, deltaMs),
      );
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

  /**
   * Spawns an elite wave ship: its equipped build with +50% hull and +1 attack
   * (the multiplier applies to the already-scaled hull — no double scaling).
   *
   * @param spawn - The wave ship and where it enters.
   */
  private spawnEliteShip(spawn: EnemySpawn): void {
    const ship = this.createEnemy(spawn, "elite");
    ship.maxHull = eliteMaxHull(ship.maxHull);
    ship.hull = ship.maxHull;
    ship.combatStats = {
      ...ship.combatStats,
      attackDice: ship.combatStats.attackDice + ELITE_ATTACK_BONUS,
    };
    this.addEnemy(ship, true);
  }

  /**
   * Spawns a milestone boss: its equipped (already scaled) build multiplied
   * by the wave's boss multiplier, with capital-style engines/turrets/bridge
   * subsystems splitting its final hull.
   *
   * @param spawn - The wave ship and where it enters.
   */
  private spawnBossShip(spawn: EnemySpawn): void {
    const multiplier = bossMultiplier(this.wave);
    const ship = this.createEnemy(spawn, "boss");
    const caps = bossDurability(ship, this.wave);
    ship.maxHull = caps.maxHull;
    ship.hull = ship.maxHull;
    ship.maxShields = caps.maxShields;
    ship.shields = ship.maxShields;
    ship.combatStats = {
      ...ship.combatStats,
      attackDice: ship.combatStats.attackDice + Math.floor(multiplier / 2),
    };
    ship.capitalSystems = createCapitalSystems(ship.maxHull);
    this.addEnemy(ship, false, true);
  }

  /**
   * Spawns the wave: regulars along an entry arc, elites and the milestone
   * boss up front, each flying the wave's quick-build assignment.
   */
  private spawnWaveEnemies(): void {
    const faction = this.rotatingEnemyFaction();
    const { enemyCount, eliteCount } = this.run.waveSize(
      this.playerShipIds.length,
    );
    const slots = planWaveRoster(getShipsByFaction(faction), {
      enemyCount,
      eliteCount,
      isMilestone: this.run.isMilestone,
    });
    const centerX = BATTLEFIELD_SIZE / 2;
    let eliteIndex = 0;
    slots.forEach((slot, index) => {
      if (slot.tier === "regular") {
        const at = this.spawnSlot(index, enemyCount, centerX);
        this.spawnEnemyShip({ slot, faction, ...at });
      } else if (slot.tier === "elite") {
        const x = centerX + (eliteIndex++ - 1) * ELITE_SPACING_PX;
        this.spawnEliteShip({ slot, faction, x, y: ELITE_ENTRY_Y });
      } else {
        this.spawnBossShip({ slot, faction, x: centerX, y: BOSS_ENTRY_Y });
      }
    });
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
    this.enterChoicePhase();
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
    this.enterChoicePhase();
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

  /**
   * Freezes the battle for a between-wave choice: camera zoom 1.0 (choice
   * cards are scrollFactor-0 buttons, mis-hit-tested under zoom) and the
   * battle HUD hidden under the choice panel.
   */
  private enterChoicePhase(): void {
    this.isChoicePhase = true;
    this.preChoiceZoom = this.cameras.main.zoom;
    this.cameras.main.setZoom(1.0);
    this.setHudVisible(false);
  }

  private endChoicePhase(): void {
    this.isChoicePhase = false;
    this.pilot.reset();
    this.cameras.main.setZoom(this.preChoiceZoom);
    this.setHudVisible(true);
    this.startNextWave();
  }

  /**
   * Materialises any escorts the run has earned but not yet spawned. Escorts are
   * the faction's basic starter ship — weak bodies that do NOT inherit the
   * flagship's drafted bonuses (their strength comes from support investment,
   * modelled in the balance sim, not from copying the flagship). They do fly
   * quick builds, never repeating an ace already in the squad.
   */
  private reconcileEscorts(): void {
    const anchor = this.ships.get(this.playerShipIds[0] ?? "");
    if (!anchor) return;
    const count = Math.min(
      this.run.pendingEscorts(),
      MAX_FLEET - this.playerShipIds.length,
    );
    if (count <= 0) return;
    const definitionId = FACTION_STARTER_SHIPS[this.playerFaction];
    const loadouts = joiningSquadLoadouts(
      [...this.ships.values()].filter((ship) => ship.owner === "player"),
      new Array<string>(count).fill(definitionId),
    );
    for (const loadoutId of loadouts) {
      const offset = this.playerShipIds.length * 80;
      this.spawnPlayerShip(
        { definitionId, x: anchor.x + offset, y: anchor.y + 50, loadoutId },
        true,
      );
      this.run.markEscortSpawned();
    }
  }

  /**
   * Re-applies hull/shield bonuses to the flagship fleet (escorts stay basic).
   * combatStats holds the equipped baseline, so quick-build bonuses persist;
   * the drafted bonuses are miniature points, scaled to real-time HP.
   */
  private applyBonusesToFleet(): void {
    const { maxHull, maxShields } = realTimeRunBonuses(this.run.bonuses);
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

  /**
   * Run over: freezes the battle, hides the HUD and shows the holographic
   * result overlay. Zoom resets to 1.0 first — its buttons are
   * scrollFactor(0) and Phaser mis-hit-tests them under zoom.
   */
  private gameOver(): void {
    if (this.gameOverOverlay) return;
    this.isPaused = true;
    audioManager.playFactionStinger(this.playerFaction, "defeat");
    this.setHudVisible(false);
    this.cameras.main.setZoom(1.0);
    this.gameOverOverlay = showResultOverlay(this, {
      header: "Survival",
      title: "GAME OVER",
      accent: HOLO_PALETTE.danger,
      lines: [
        { text: `Wave reached: ${this.wave}`, role: "heading" },
        {
          text: `Final score: ${this.score.toLocaleString("en-US")}`,
          role: "heading",
          color: HOLO_PALETTE.warning,
        },
      ],
      actions: [
        {
          label: "Retry",
          variant: "primary",
          onClick: () => this.scene.restart(),
        },
        {
          label: "Menu",
          variant: "secondary",
          onClick: () => this.scene.start("MainMenuScene"),
        },
      ],
    });
  }

  // ==========================================
  // SHIP MANAGEMENT
  // ==========================================

  /**
   * Spawns a player ship (the flagship, or an escort) flying its quick build.
   *
   * @param spawn - Ship, entry point and quick build.
   * @param isEscort - True for an escort (no drafted bonuses).
   */
  private spawnPlayerShip(spawn: PlayerSpawn, isEscort = false): void {
    const id = `player_${this.playerShipIds.length}`;
    if (isEscort) this.escortShipIds.add(id);
    const ship = this.createShip({
      id,
      definitionId: spawn.definitionId,
      faction: this.playerFaction,
      owner: "player",
      pose: { x: spawn.x, y: spawn.y, angle: 0 },
      loadoutId: spawn.loadoutId,
    });
    if (isEscort) ship.bot = this.squadAi.createPilot(SURVIVAL_ESCORT_TIER);
    this.ships.set(id, ship);
    this.playerShipIds.push(id);
    this.createShipSprite(ship);
    this.createHealthBar(ship);
  }

  /**
   * Spawns a regular wave ship flying its quick build.
   *
   * @param spawn - The wave ship and where it enters.
   */
  private spawnEnemyShip(spawn: EnemySpawn): void {
    this.addEnemy(this.createEnemy(spawn, "enemy"));
  }

  /**
   * Builds (but does not add) a wave ship record with its quick build and
   * its BotPilot (tier from the wave and its rank — see SurvivalSteering).
   *
   * @param spawn - The wave ship and where it enters.
   * @param idPrefix - Id prefix naming its tier.
   * @returns The equipped ship record.
   */
  private createEnemy(spawn: EnemySpawn, idPrefix: string): SurvivalShip {
    const suffix = Math.random().toString(36).substring(2, 11);
    const ship = this.createShip({
      id: `${idPrefix}_${Date.now()}_${suffix}`,
      definitionId: spawn.slot.definitionId,
      faction: spawn.faction,
      owner: "ai",
      pose: { x: spawn.x, y: spawn.y, angle: ENEMY_ENTRY_ANGLE },
      loadoutId: spawn.slot.loadoutId,
    });
    ship.bot = this.squadAi.createPilot(
      survivalEnemyTier(this.wave, spawn.slot.tier),
    );
    return ship;
  }

  /**
   * Registers a wave ship and gives it a sprite and health bar.
   *
   * @param ship - The built wave ship.
   * @param isElite - Draw the elite glow/outline.
   * @param isBoss - Draw the boss glow/outline at boss size.
   */
  private addEnemy(ship: SurvivalShip, isElite = false, isBoss = false): void {
    this.ships.set(ship.id, ship);
    this.enemyShipIds.push(ship.id);
    this.createShipSprite(ship, isElite, isBoss);
    this.createHealthBar(ship);
  }

  /**
   * Builds a ship record flying its quick build. Its combatStats become the
   * equipped baseline (bare stats + upgrades) so drafted run bonuses, which
   * only the flagship receives, stack on top and can be re-applied later.
   *
   * @param spawn - Identity, side, pose and quick build.
   * @returns The equipped ship record.
   */
  private createShip(spawn: ShipSpawn): SurvivalShip {
    const { id, definitionId, pose } = spawn;
    const combatStats = getModeCombatStats(definitionId, "survival");
    const ship: SurvivalShip = {
      id,
      definitionId,
      faction: spawn.faction,
      owner: spawn.owner,
      ...pose,
      hull: combatStats.hull,
      maxHull: combatStats.maxHull,
      shields: combatStats.shields,
      maxShields: combatStats.maxShields,
      combatStats,
      flight: createCycleFlight(definitionId, pose),
      dial: getShipDial(definitionId),
      weaponCooldown: 0,
      loadoutId: spawn.loadoutId,
      modifiers: NEUTRAL_MODIFIERS,
      frenzyUntilMs: 0,
      bot: null,
    };
    ship.modifiers = equipQuickBuild(ship, spawn.loadoutId);
    ship.flight = equipFlight(ship.flight, ship.modifiers);
    const { hull, maxHull, shields, maxShields } = ship;
    ship.combatStats = { ...combatStats, hull, maxHull, shields, maxShields };

    const isFlagship = spawn.owner === "player" && !this.escortShipIds.has(id);
    if (isFlagship) {
      const bonuses = realTimeRunBonuses(this.run.bonuses);
      ship.hull += bonuses.maxHull;
      ship.maxHull += bonuses.maxHull;
      ship.shields += bonuses.maxShields;
      ship.maxShields += bonuses.maxShields;
    }
    return ship;
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

    let size: number = SHIP_SIZES.small;

    // Boss ships are larger
    if (isBoss) {
      size = SHIP_SIZES.large;
    } else if (isElite) {
      size = SHIP_SIZES.medium;
    }

    const shipDef = getShipDefinition(ship.definitionId);

    // Glow for elite/boss sits behind the ship visual.
    if (isElite || isBoss) {
      const glowColor = isBoss ? 0xff4444 : 0xffdd00;
      const glow = this.add.graphics();
      glow.fillStyle(glowColor, 0.2);
      glow.fillCircle(0, 0, size * 0.8);
      container.add(glow);
    }

    const visual = addShipVisual(this, container, {
      definitionId: ship.definitionId,
      faction: ship.faction,
      fallbackSizeName: shipDef?.baseStats.size ?? "small",
      size,
      isPlayer: ship.owner === "player",
    });
    container.image = visual.image;
    container.imageBaseScaleX = visual.image?.scaleX ?? 1;
    container.imageBaseScaleY = visual.image?.scaleY ?? 1;
    container.bankState = { ...INITIAL_BANK_STATE, lastAngle: ship.angle };

    // Elite ships have a golden outline ring; boss ships have a red one, drawn on top.
    if (isElite || isBoss) {
      const outline = this.add.graphics();
      outline.lineStyle(isBoss ? 4 : 3, isBoss ? 0xff4444 : 0xffdd00, 1);
      outline.strokeCircle(0, 0, size * 1.1);
      container.add(outline);
    }

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

  /**
   * Flies every ship one frame on the X-Wing cycle engine (template arcs,
   * cycle-boundary commits, stress) and syncs sprites to the new poses. A
   * boss whose engines are offline holds position.
   *
   * @param deltaMs - Frame length (ms).
   */
  private flyShips(deltaMs: number): void {
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;
      if (ship.capitalSystems && isEnginesOffline(ship.capitalSystems)) {
        continue;
      }
      const tick = tickCycleFlight(ship.flight, {
        deltaMs,
        worldSize: BATTLEFIELD_SIZE,
        dial: ship.dial,
        cycleMs: CYCLE_DURATION_MS,
        modifiers: stressModifiersOf(ship.modifiers),
      });
      this.setFlight(ship, tick.state);
      ship.shields = regenerateShields(
        ship.shields,
        ship.maxShields,
        ship.modifiers,
        deltaMs,
      );
      if (tick.completed) this.notifyCycleCommitted(ship, tick.state);
      this.syncShipSprite(ship, deltaMs);
      this.telemetry?.sample(ship.id, ship.x, ship.y, ship.angle);
    }
  }

  /**
   * Tells whoever flies the ship (its bot, or the player's pilot) that a
   * cycle committed.
   *
   * @param ship - The ship whose cycle committed.
   * @param flight - Its flight state after the commit.
   */
  private notifyCycleCommitted(
    ship: SurvivalShip,
    flight: CycleFlightState,
  ): void {
    const started = flight.motion.control.currentManeuver ?? "straight";
    if (ship.bot) ship.bot.onCycleCommitted(started);
    else if (ship.id === this.pilotedShipId) {
      this.pilot.onCycleCommitted(started);
    }
  }

  /**
   * Moves a ship's sprite to its pose and squashes its art while it banks.
   *
   * @param ship - The ship.
   * @param deltaMs - Frame length (ms).
   */
  private syncShipSprite(ship: SurvivalShip, deltaMs: number): void {
    const sprite = this.shipSprites.get(ship.id);
    if (!sprite) return;
    sprite.setPosition(ship.x, ship.y).setAngle(ship.angle);
    if (!sprite.image) return;
    sprite.bankState = updateBankState(
      sprite.bankState,
      ship.angle,
      deltaMs / 1000,
    );
    const { scaleX, scaleY } = bankSquashFor(sprite.bankState);
    sprite.image.setScale(
      (sprite.imageBaseScaleX ?? 1) * scaleX,
      (sprite.imageBaseScaleY ?? 1) * scaleY,
    );
  }

  /**
   * Stores a ship's new flight state and mirrors its pose onto the record
   * (combat, AI, belt and camera read x/y/angle).
   *
   * @param ship - The ship.
   * @param flight - Its new flight state.
   */
  private setFlight(ship: SurvivalShip, flight: CycleFlightState): void {
    ship.flight = flight;
    ship.x = flight.motion.x;
    ship.y = flight.motion.y;
    ship.angle = flight.motion.angle;
  }

  /**
   * Visual feedback for flight events, drawn from the pose they started at.
   * Only the flagship shakes/zooms the camera.
   *
   * @param ship - The ship that acted.
   * @param events - What happened this frame.
   * @param origin - Pose before the actions.
   */
  private playFlightEvents(
    ship: SurvivalShip,
    events: readonly FlightEvent[],
    origin: Pose,
  ): void {
    const isFlagship = ship.id === this.pilotedShipId;
    for (const event of events) {
      playFlightEventFx(this, {
        event,
        origin,
        definitionId: ship.definitionId,
        faction: ship.faction,
        sprite: this.shipSprites.get(ship.id),
        cameraShake: isFlagship && this.cameraShakeEnabled,
        zoomPulse: isFlagship,
      });
    }
  }

  /**
   * One frame of weapons: the run's shield regen for the player fleet,
   * cooldowns, and autofire at the nearest target in range and arc — at
   * most one attack per maneuver cycle (X-Wing round tempo).
   *
   * @param delta - Frame length (ms).
   */
  private processCombat(delta: number): void {
    const regen = realTimeRunBonuses(this.run.bonuses).shieldRegenPerSecond;
    let sides: LivingBySide | null = null;
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;

      if (ship.owner === "player" && regen > 0) {
        ship.shields = Math.min(
          ship.maxShields,
          ship.shields + (regen * delta) / 1000,
        );
      }
      ship.weaponCooldown = Math.max(0, ship.weaponCooldown - delta);

      if (ship.weaponCooldown <= 0) {
        // Primary weapon always autofires once in range/arc — flagship, escorts, and AI alike.
        const target = this.findTarget(ship);
        if (target) {
          sides ??= this.livingBySide();
          this.fireAt(ship, target, sides);
          ship.weaponCooldown = this.attackIntervalOf(ship);
        }
      }
    }
  }

  /**
   * Time between a ship's attacks: its weapon cooldown (the run's fire-rate
   * bonus applies to the player fleet), never faster than once per cycle.
   *
   * @param ship - The ship.
   * @returns Attack interval (ms).
   */
  private attackIntervalOf(ship: SurvivalShip): number {
    const fireRate = ship.owner === "player" ? this.run.bonuses.fireRate : 0;
    const cooldownMod = Math.max(MIN_PLAYER_COOLDOWN_MOD, 1 - fireRate);
    return attackIntervalMs(ship.combatStats.weaponCooldown * cooldownMod);
  }

  /**
   * @returns Living ships grouped by side, for this frame's wingman checks.
   */
  private livingBySide(): LivingBySide {
    const player: SurvivalShip[] = [];
    const ai: SurvivalShip[] = [];
    for (const ship of this.ships.values()) {
      if (ship.hull > 0) (ship.owner === "player" ? player : ai).push(ship);
    }
    return new Map([
      ["player", player],
      ["ai", ai],
    ]);
  }

  /**
   * The foe a ship fires at: its pilot's chosen target (a bot's target; the
   * player's mark for the flagship) when valid, else the nearest foe in
   * weapon range and forward arc — never one still immune to this ship's
   * hits (X-Wing round: one hit per attacker per cycle).
   *
   * @param ship - The firing ship.
   * @returns Its target, or null when none can be fired at.
   */
  private findTarget(ship: SurvivalShip): SurvivalShip | null {
    const rangeBonus =
      ship.owner === "player" ? this.run.bonuses.range * RANGE_PER_POINT : 0;
    const now = this.time.now;
    return nearestTargetInArc(ship, this.ships.values(), {
      rangePx: ship.combatStats.weaponRange + rangeBonus,
      arcDeg: ship.combatStats.firingArc,
      isHostile: (other) => other.owner !== ship.owner,
      isEligible: (other) => !this.hitLedger.isImmune(ship.id, other.id, now),
      preferredId: this.wantedTargetOf(ship, now),
    });
  }

  /**
   * @param ship - A ship.
   * @param nowMs - Scene time (ms).
   * @returns The enemy its pilot wants to shoot: its bot's target, or the
   *   player's mark for the player-flown flagship.
   */
  private wantedTargetOf(ship: SurvivalShip, nowMs: number): string | null {
    if (ship.bot) return ship.bot.targetId;
    return ship.owner === "player" ? this.squadAi.playerMarkOf(nowMs) : null;
  }

  /**
   * One shot: the mode's dice odds and damage (run bonuses included)
   * resolved through both ships' quick builds; a hit stresses the target's
   * pilot and a kill fires the pilot-ability kill effects.
   *
   * @param attacker - The firing ship.
   * @param target - The ship fired at.
   * @param sides - Living ships per side this frame (wingman checks).
   */
  private fireAt(
    attacker: SurvivalShip,
    target: SurvivalShip,
    sides: LivingBySide,
  ): void {
    const result = resolveDiceAttack({
      attacker: combatantOf(attacker),
      target: combatantOf(target),
      hitChance: this.hitChanceOf(attacker, target),
      baseDamage: this.baseDamageOf(attacker),
      attackerHasWingman: hasWingman(attacker, sides.get(attacker.owner) ?? []),
      targetHasWingman: hasWingman(target, sides.get(target.owner) ?? []),
      nowMs: this.time.now,
      roll: Math.random(),
      targetMarked: this.squadAi.isMarkedBy(
        attacker.owner,
        target.id,
        this.time.now,
      ),
    });
    this.effectsManager.fireLaser(
      attacker.x,
      attacker.y,
      target.x,
      target.y,
      attacker.faction,
      result.hit,
    );
    if (!result.hit) return;
    if (result.stressOnTarget > 0) {
      this.setFlight(target, {
        ...target.flight,
        stress: applyInstantStress(target.flight.stress, result.stressOnTarget),
      });
    }
    this.dealDamage(target, result.damage);
    if (result.damage > 0) {
      this.hitLedger.recordHit(attacker.id, target.id, this.time.now);
    }
    if (target.hull > 0) return;
    this.resolveAbilityKill(attacker, target);
    this.destroyShip(target.id, attacker.owner === "player");
  }

  /**
   * @param attacker - The firing ship.
   * @param target - The ship fired at.
   * @returns The mode's dice hit chance, with the run's evasion for the player fleet.
   */
  private hitChanceOf(attacker: SurvivalShip, target: SurvivalShip): number {
    const evasion = target.owner === "player" ? this.run.bonuses.evasion : 0;
    return calculateHitChance(
      attacker.combatStats.attackDice,
      target.combatStats.agilityDice + evasion,
    );
  }

  /**
   * @param attacker - The firing ship.
   * @returns The mode's damage before equipment: attack dice, plus the run's
   *   damage bonus and crit roll for the player fleet.
   */
  private baseDamageOf(attacker: SurvivalShip): number {
    if (attacker.owner !== "player") return attacker.combatStats.attackDice;
    const { damage, critChance } = this.run.bonuses;
    const base = attacker.combatStats.attackDice + damage;
    return Math.random() < critChance ? base * CRIT_DAMAGE_MULTIPLIER : base;
  }

  /**
   * Damage taken shields first, then hull — a boss's hull is its subsystems.
   *
   * @param target - The ship hit.
   * @param damage - Damage to take.
   */
  private dealDamage(target: SurvivalShip, damage: number): void {
    const after = absorbDamage(target, damage);
    const hullDamage = damage - (target.shields - after.shields);
    if (after.shields < target.shields) {
      audioManager.playSoundAt("shield_hit", target.x, target.y, 0.4);
    }
    target.shields = after.shields;
    if (hullDamage > 0) {
      audioManager.playSoundAt("hull_hit", target.x, target.y, 0.4);
      if (target.capitalSystems) {
        this.damageSystems(target, target.capitalSystems, hullDamage);
      } else {
        target.hull = after.hull;
      }
    }
    this.healthBars.get(target.id)?.update(target.hull, target.shields);
  }

  /**
   * Hull damage to a boss lands on a subsystem; its hull is their sum.
   *
   * @param target - The boss hit.
   * @param systems - Its subsystems.
   * @param damage - Hull damage to take.
   */
  private damageSystems(
    target: SurvivalShip,
    systems: CapitalSystemsState,
    damage: number,
  ): void {
    const result = applyCapitalSystemDamage(systems, damage);
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
  }

  /**
   * Pilot-ability effects of a kill: the killer's reward (shields, frenzy)
   * and the victim's death blast on enemies nearby. Ships the blast destroys
   * count as kills for the victim's side (no chained blasts).
   *
   * @param killer - The ship that made the kill.
   * @param victim - The ship destroyed.
   */
  private resolveAbilityKill(killer: SurvivalShip, victim: SurvivalShip): void {
    if (killer.hull > 0) {
      Object.assign(killer, rewardKill(combatantOf(killer), this.time.now));
      this.healthBars.get(killer.id)?.update(killer.hull, killer.shields);
    }
    const blastDamage = deathBlastDamage(combatantOf(victim));
    if (blastDamage <= 0) return;
    const enemies = [...this.ships.values()].filter(
      (other) => other.owner !== victim.owner && other.hull > 0,
    );
    for (const caught of deathBlastTargets(combatantOf(victim), enemies)) {
      this.dealDamage(caught, blastDamage);
      if (caught.hull <= 0) {
        this.destroyShip(caught.id, victim.owner === "player");
      }
    }
  }

  private destroyShip(shipId: string, wasPlayerKill: boolean): void {
    const ship = this.ships.get(shipId);
    if (!ship) return;

    if (wasPlayerKill) this.score += 100;
    this.hitLedger.forget(shipId);
    this.squadAi.forget(shipId);

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

  /**
   * Queues every ship's next maneuver: the flagship's from player input
   * (and the player's mark, R), wave enemies' and escorts' from their
   * BotPilots under their squads' orders.
   *
   * @param time - Scene time (ms).
   * @param delta - Frame length (ms).
   */
  private updateAI(time: number, delta: number): void {
    const [flagshipId, ...escortIds] = this.playerShipIds;
    this.squadAi.command(this.ships.values(), time);
    this.flyFlagship(flagshipId, time, delta);
    this.applyMarkRequest(flagshipId);
    for (const id of [...this.enemyShipIds, ...escortIds]) {
      this.flyBot(id, time, delta);
    }
  }

  /**
   * The player pressed MARK (R / R3): mark the flagship's HUD target for the
   * squad. The press is consumed every frame, so it never fires late.
   *
   * @param flagshipId - The flagship's id, if the fleet has one.
   */
  private applyMarkRequest(flagshipId: string | undefined): void {
    if (!this.pilot.takeMarkRequest()) return;
    const flagship = this.ships.get(flagshipId ?? "");
    if (!flagship || flagship.hull <= 0) return;
    const targetId = this.hudTargetOf(flagship);
    if (targetId) this.squadAi.markTarget(targetId, this.time.now);
  }

  /**
   * Runs one frame of the player's flight input on the flagship through the
   * shared pilot controls (tap = drift, hold = bank, Q/E = hard turn, K-turn,
   * Segnor, Tallon, boost, barrel roll). When the flagship is lost the next
   * fleet ship takes over with fresh input memory.
   *
   * @param shipId - The flagship's id, if the fleet has one.
   * @param time - Scene time (ms).
   * @param delta - Frame length (ms).
   */
  private flyFlagship(
    shipId: string | undefined,
    time: number,
    delta: number,
  ): void {
    const ship = this.ships.get(shipId ?? "");
    if (!ship || ship.hull <= 0) return;
    if (ship.id !== this.pilotedShipId) {
      this.pilot.reset();
      this.pilotedShipId = ship.id;
      ship.bot = null;
    }
    const origin = { x: ship.x, y: ship.y, angle: ship.angle };
    const result = this.pilot.fly({
      flight: ship.flight,
      ship: ship.flight.motion,
      dial: ship.dial,
      nowMs: time,
      deltaMs: delta,
      worldSize: BATTLEFIELD_SIZE,
    });
    this.applyControls(ship, result, origin);
  }

  /**
   * One frame of an AI ship (wave enemy or escort): its BotPilot presses
   * the same controls the player has. A boss with its engines offline
   * holds position.
   *
   * @param shipId - The AI ship's id.
   * @param time - Scene time (ms).
   * @param delta - Frame length (ms).
   */
  private flyBot(shipId: string, time: number, delta: number): void {
    const ship = this.ships.get(shipId);
    if (!ship || ship.hull <= 0) return;
    if (ship.capitalSystems && isEnginesOffline(ship.capitalSystems)) return;
    const origin = { x: ship.x, y: ship.y, angle: ship.angle };
    const result = this.squadAi.fly(ship, time, delta);
    if (result) this.applyControls(ship, result, origin);
  }

  /**
   * Applies a pilot's controls (player or bot) and plays their effects.
   *
   * @param ship - The ship flown.
   * @param result - What its pilot's controls did this frame.
   * @param origin - Pose before the controls.
   */
  private applyControls(
    ship: SurvivalShip,
    result: FlightControlResult,
    origin: Pose,
  ): void {
    this.setFlight(ship, { motion: result.motion, stress: result.stress });
    this.playFlightEvents(ship, result.events, origin);
  }

  /**
   * @param ship - A ship.
   * @returns The nearest living ship of the other side, or null.
   */
  private findClosestEnemy(ship: SurvivalShip): SurvivalShip | null {
    return nearestHostile(ship, this.ships.values(), (other) => {
      return other.owner !== ship.owner;
    });
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
