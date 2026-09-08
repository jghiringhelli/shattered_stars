/**
 * Arcade Battle Scene
 * Real-time dogfighting with direct ship control
 */

import Phaser from "phaser";
import { ShipStatCard } from "../ui/ShipStatCard";
import type { ShipState } from "../core/types";
import {
  createControlState,
  updateManeuver,
  updateCooldowns,
  advanceCycle,
  processCommand,
  canFire,
  canKTurn,
  canBarrelRoll,
  canBoost,
  useBoost,
  type ShipControlState,
  type FlightCommand,
} from "../core/ArcadeControls";
import {
  createProjectile,
  updateProjectile,
  isProjectileAlive,
  checkProjectileHit,
  type Projectile,
} from "../core/Projectile";
import { consumeOrdnanceCharge } from "../arcade/ArcadeOrdnance";
import {
  type GestureState,
  type GestureAction,
  INITIAL_GESTURE_STATE,
  BOOST_DISTANCE_PX,
  updateGestures,
} from "../arcade/ArcadeInputGestures";
import {
  spawnBoostTrail,
  playBarrelRollLean,
  spawnKturnAfterimage,
} from "../arcade/ArcadeFX";
import { InputManager } from "../input/InputManager";
import { setupSceneInput, teardownSceneInput } from "../input/setupSceneInput";
import type { ActionIntent } from "../input/InputTypes";
import {
  extractOrdnanceSlots,
  tickOrdnanceCooldowns,
  canFireOrdnance,
  type ArcadeOrdnanceSlot,
} from "../arcade/ArcadeOrdnance";
import {
  extractTurretSlot,
  tickTurretCooldown,
  canFireTurret,
  consumeTurretShot,
  type ArcadeTurretSlot,
} from "../arcade/ArcadeTurret";
import {
  getShipDefinition,
  getShipDial,
  getMovementProfile,
} from "../data/ShipDefinitions";
import { distance } from "../systems/MovementSystem";
import type { ShipRole } from "../core/types";
import {
  type AIShipView,
  type AIDecision,
  selectAITarget,
  computeAIDecision,
} from "../systems/ArcadeAI";
import type { ManeuverDefinition, ManeuverDifficulty } from "../core/types";
import {
  type StressState,
  INITIAL_STRESS,
  lookupDialDifficulty,
  updateStress,
  applyKturnStress,
  applyBoostStress,
  stressLevelColor,
  difficultyColor,
  findBestTurnSpeed,
} from "../arcade/ArcadeStress";
import {
  BATTLEFIELD_SIZE,
  CYCLE_DURATION_MS,
  FACTION_COLORS,
  SHIP_SIZES,
  type FactionId,
} from "../config";
import { HealthBar } from "../ui/HealthBar";
import { CapitalSystemsIndicator } from "../ui/CapitalSystemsIndicator";
import {
  createCapitalSystems,
  applyCapitalSystemDamage,
  repairCapitalSystem,
  mostDamagedSystem,
  isEnginesOffline,
  isBridgeOffline,
  turretDamageMultiplier,
  sumSystemsHull,
  SYSTEM_LABELS,
  type CapitalSystemsState,
} from "../systems/CapitalSystems";
import {
  type CrewRole,
  type CommanderOrders,
  getAvailableCrewRoles,
  nextCrewRole,
  createCommanderOrders,
  issueConcentrateFire,
  concentrateFireMultiplier,
  nextPowerFocus,
  redirectPower,
  isPowerFocused,
  canRedirectPower,
  startCharging,
  tickMainBeam,
  isMainBeamReady,
  resetMainBeam,
  canFireMainBeam,
  canEmergencyRepair,
  MAIN_BEAM_DAMAGE,
  MAIN_BEAM_COOLDOWN_MS,
  POWER_REDIRECT_COOLDOWN_MS,
  POWER_REDIRECT_TURRET_MULTIPLIER,
  POWER_REDIRECT_ENGINE_REPAIR_PER_SEC,
  POWER_REDIRECT_SHIELD_REGEN_PER_SEC,
  EMERGENCY_REPAIR_COOLDOWN_MS,
  EMERGENCY_REPAIR_SHIELD_AMOUNT,
  EMERGENCY_REPAIR_HULL_AMOUNT,
} from "../systems/ShipCrew";
import {
  buildFrameCache,
  type FrameCache,
} from "../arcade/systems/ArcadeFrameCache";
import { checkVictoryCondition } from "../arcade/systems/ArcadeVictorySystem";
import { PlayerProfileManager } from "../systems/PlayerProfile";
import {
  createFleeState,
  updateFleeState,
  fleeSecondsRemaining,
  type FleeState,
} from "../arcade/systems/FleeDetector";
import { torusDistance, torusDelta } from "../core/Torus";
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
  createPerformanceState,
  updateFPS,
  evaluateQuality,
  type PerformanceState,
} from "../systems/PerformanceSystem";
import { Minimap, type MinimapShip } from "../ui/Minimap";
import { renderBattleStarfield } from "../rendering/Starfield";
import { applyLoadoutEffects } from "../systems/BattleHelpers";
import { audioManager } from "../audio/AudioManager";
import { getHandlingProfile } from "../systems/FlightControlSystem";
import { ShipTelemetry } from "../debug/ShipTelemetry";
import {
  resolveSupportAuras,
  type AuraShip,
  type ActiveAura,
} from "../systems/SupportAura";

interface ArcadeShip extends ShipState {
  control: ShipControlState;
  /** ID of the ship this AI has locked as its current target. */
  targetId: string | null;
  /** Milliseconds remaining before the AI re-evaluates its target. */
  aiDecisionTimer: number;
  /** Secondary weapon slots (1/2/3 keys). */
  ordnanceSlots: ArcadeOrdnanceSlot[];
  /** Turret slot if the ship has a turret upgrade equipped. */
  turretSlot: ArcadeTurretSlot | null;
  /** 'pilot' flies the ship; 'gunner' controls the turret; 'commander' issues ship orders (capital only). */
  crewMode: CrewRole;
  /**
   * Maximum angular velocity in degrees/second derived from the ship's
   * size × role handling profile (same data that drives the turn-based game).
   * Tiny interceptors spin fast; large bombers arc wide; capitals barely turn.
   */
  maxAngularVelocity: number;
  /** Ship role cached from ShipDefinition — used by ArcadeAI for escort prioritisation. */
  role: ShipRole;
  /** Current pilot stress state — built from this ship's maneuver dial. */
  stress: StressState;
  /** Maneuver dial for this ship; drives stress classification each frame. */
  shipDial: readonly ManeuverDefinition[];
  /** Seconds remaining while cloak is active (0 = not cloaked). */
  cloakTimer: number;
  /** ID of the formation leader this wingman follows (null = independent). */
  wingLeaderId: string | null;
  /** Index into WING_SLOTS (0 = port, 1 = starboard). */
  wingSlotIndex: number;
  /** Subsystem damage state (engines/turrets/bridge) — only set for capital-role ships. */
  capitalSystems: CapitalSystemsState | null;
  /** Commander order state (concentrate fire/power redirect/main beam/repair) — only set for capital-role ships. */
  commanderOrders: CommanderOrders | null;
}

interface ShipSprite extends Phaser.GameObjects.Container {
  shipId: string;
  hull: Phaser.GameObjects.Graphics;
  thruster: Phaser.GameObjects.Graphics;
  healthBar?: HealthBar;
  /** Faction-colored identification ring — alpha is modulated when pilot is stressed. */
  ring?: Phaser.GameObjects.Graphics;
}

/** Maneuver difficulty ordered from most to least stressful. */
const DIFFICULTY_ORDER: readonly ManeuverDifficulty[] = [
  "red",
  "white",
  "green",
];

/**
 * Ease a maneuver difficulty toward "green" by a number of tiers.
 * @param difficulty - The base maneuver difficulty.
 * @param tiers - How many tiers to relax (0 = unchanged).
 * @returns The eased difficulty.
 */
function easeDifficulty(
  difficulty: ManeuverDifficulty,
  tiers: number,
): ManeuverDifficulty {
  if (tiers <= 0) return difficulty;
  const index = DIFFICULTY_ORDER.indexOf(difficulty);
  const eased = Math.min(
    DIFFICULTY_ORDER.length - 1,
    index + Math.floor(tiers),
  );
  return DIFFICULTY_ORDER[eased]!;
}

export class ArcadeBattleScene extends Phaser.Scene {
  private ships: Map<string, ArcadeShip> = new Map();
  private shipSprites: Map<string, ShipSprite> = new Map();
  private telemetry: ShipTelemetry | null = null;
  private projectiles: Projectile[] = [];
  private projectileSprites: Map<string, Phaser.GameObjects.Graphics> =
    new Map();
  private healthBars: Map<string, HealthBar> = new Map();
  private capitalIndicators: Map<string, CapitalSystemsIndicator> = new Map();
  private minimap: Minimap | undefined;
  private cameraShakeEnabled = true;
  private damageNumbersEnabled = true;
  private userWantsCameraShake = true;
  private userWantsDamageNumbers = true;

  /** Per-tick support-aura buffs keyed by ship id (recomputed in updateAuras). */
  private activeAuras: ReadonlyMap<string, ActiveAura> = new Map();

  private playerShipId: string | null = null;

  /** Test/telemetry contract shared with Continuous + TurnBased scenes. */
  get playerShipIds(): string[] {
    return this.playerShipId ? [this.playerShipId] : [];
  }
  get enemyShipIds(): string[] {
    const out: string[] = [];
    for (const s of this.ships.values()) {
      if (s.owner === "ai" && s.faction !== this.playerFaction) out.push(s.id);
    }
    return out;
  }
  /**
   * Edge-triggered intents (KTURN, SHARP_TURN_*, SEGNOR_*, TALLON_*,
   * CREW_CYCLE, CLOAK, WEAPON_CYCLE, FIRE_SECONDARY, COMMANDER_ORDER_*, plus
   * a manual rising-edge for THRUST_UP/DOWN) queued here by an onAny()
   * subscriber and drained via consumeEdge() — mirrors the old
   * Phaser.Input.Keyboard.JustDown() checks without depending on Phaser's
   * own consuming JustDown (see KeyboardAdapter's shared-key bugfix notes).
   */
  private pendingEdgeIntents: Set<ActionIntent> = new Set();
  private readonly trackedEdgeIntents: ReadonlySet<ActionIntent> = new Set([
    "KTURN",
    "BOOST",
    "SHARP_TURN_LEFT",
    "SHARP_TURN_RIGHT",
    "SEGNOR_LEFT",
    "SEGNOR_RIGHT",
    "TALLON_LEFT",
    "TALLON_RIGHT",
    "CREW_CYCLE",
    "CLOAK",
    "WEAPON_CYCLE",
    "FIRE_SECONDARY",
    "COMMANDER_ORDER_1",
    "COMMANDER_ORDER_2",
    "COMMANDER_ORDER_3",
    "COMMANDER_ORDER_4",
  ]);
  private prevThrustUpHeld = false;
  private prevThrustDownHeld = false;
  private inputSubscriptionIds: number[] = [];

  // HUD
  private speedText!: Phaser.GameObjects.Text;
  private hullText!: Phaser.GameObjects.Text;
  private shieldText!: Phaser.GameObjects.Text;
  private cooldownText!: Phaser.GameObjects.Text;
  private instructionsText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;

  /** Right-side panel showing all-team status. Rebuilt each frame via updateTeamHUD(). */
  private teamHudGraphics!: Phaser.GameObjects.Graphics;
  private teamHudTexts: Phaser.GameObjects.Text[] = [];

  private playerFaction: FactionId = "free_confederation";
  private score = 0;
  private lastTime = 0;
  private accumulator = 0;
  private static readonly FIXED_DT = 1000 / 60;
  private frameCache: FrameCache | null = null;
  private perfState: PerformanceState = createPerformanceState();
  private gameEnded = false;
  private isPaused = false;
  private pauseOverlay: Phaser.GameObjects.Container | null = null;

  private fleeState: FleeState = createFleeState();
  private damageThisFrame = false;
  private fleeWarningText: Phaser.GameObjects.Text | null = null;
  private fleeArrow: Phaser.GameObjects.Graphics | null = null;

  /** Competitive time limit (ms); when it runs out, destroyed point cost decides the match. */
  private static readonly MATCH_DURATION_MS = 180_000;
  private matchTimer: MatchTimerState = createMatchTimer(
    ArcadeBattleScene.MATCH_DURATION_MS,
  );
  private matchTimerText: Phaser.GameObjects.Text | null = null;
  /** Point cost of enemy ships the player's side has destroyed. */
  private playerSideScore: SideScore = createSideScore();
  /** Point cost of the player's ships the enemy side has destroyed. */
  private enemySideScore: SideScore = createSideScore();

  private framesAlive = 0;

  /** Gesture state machine — tracks tap timing, hold duration, chord detection. */
  private gestureState: GestureState = INITIAL_GESTURE_STATE;
  /**
   * When true, pressing left+right simultaneously triggers a barrel roll.
   * Read from settings on create(); exposed as a toggle for accessibility / mobile.
   */
  private allowChordBarrelRoll = true;

  /**
   * Virtual camera position in world-space.
   * Updated each frame with toroid-aware shortest-path lerp so the camera
   * never jumps across the map when a ship wraps around an edge.
   */
  private cameraVirtualX = BATTLEFIELD_SIZE / 2;
  private cameraVirtualY = BATTLEFIELD_SIZE / 2;

  // Maneuver indicator HUD elements
  private maneuverText!: Phaser.GameObjects.Text;
  private turnGauge!: Phaser.GameObjects.Graphics;

  // Stress HUD
  private stressBarGraphics!: Phaser.GameObjects.Graphics;
  private stressLevelText!: Phaser.GameObjects.Text;

  // Ordnance HUD (up to 3 slots)
  private ordnanceHudTexts: Phaser.GameObjects.Text[] = [];
  /** -1 = primary laser; 0/1/2 = ordnance slot index */
  private selectedWeaponSlot = -1;
  private crewModeText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "ArcadeBattleScene" });
  }

  shutdown(): void {
    this.inputSubscriptionIds.forEach((id) => InputManager.off(id));
    this.inputSubscriptionIds = [];
    this.pendingEdgeIntents.clear();
    teardownSceneInput();
  }

  preload(): void {
    const battleConfig = this.registry.get("battleConfig") as
      | {
          factions: Array<{
            factionId: FactionId;
            controller: "player" | "ai";
            ships: string[];
          }>;
        }
      | undefined;

    // Optional ship PNGs — missing files fall back to faction+size placeholders in createShipSprite().
    this.load.on("loaderror", (_file: Phaser.Loader.File) => {
      /* expected for ungenerated sprites */
    });

    const loadIfMissing = (id: string): void => {
      const key = `ship_${id}`;
      if (this.textures.exists(key)) return;
      const def = getShipDefinition(id);
      if (def) this.load.image(key, `assets/ships/${def.faction}/${id}.png`);
    };

    if (battleConfig?.factions?.length) {
      for (const slot of battleConfig.factions) {
        for (const shipId of slot.ships) loadIfMissing(shipId);
      }
    } else {
      loadIfMissing("confed_sparrow");
      loadIfMissing("confed_wasp");
      loadIfMissing("terran_gladius");
      loadIfMissing("terran_viper");
    }
  }

  create(): void {
    const savedSettings = this.registry.get("settings") as
      | {
          cameraShake: boolean;
          showDamageNumbers: boolean;
          showMinimap: boolean;
        }
      | undefined;
    this.userWantsCameraShake = savedSettings?.cameraShake ?? true;
    this.userWantsDamageNumbers = savedSettings?.showDamageNumbers ?? true;
    this.cameraShakeEnabled = this.userWantsCameraShake;
    this.damageNumbersEnabled = this.userWantsDamageNumbers;
    const showMinimap = savedSettings?.showMinimap ?? true;

    // No setBounds — we manage the camera manually for seamless toroid wrapping.
    this.cameras.main.setBackgroundColor(0x050510);
    this.cameras.main.setZoom(1.0);

    this.createStarfield();
    this.setupInput();
    this.createHUD();
    this.spawnShips();
    this.createHealthBars();
    if (showMinimap) this.createMinimap();

    if (ShipTelemetry.isEnabled()) {
      this.telemetry = new ShipTelemetry();
      this.telemetry.start();
      (
        window as unknown as { __shipTelemetry: ShipTelemetry }
      ).__shipTelemetry = this.telemetry;
    }

    this.lastTime = this.time.now;

    this.gameEnded = false;
    this.fleeState = createFleeState();
    this.matchTimer = createMatchTimer(ArcadeBattleScene.MATCH_DURATION_MS);
    this.playerSideScore = createSideScore();
    this.enemySideScore = createSideScore();

    // Initialise virtual camera to player spawn position (no startFollow — we drive it manually).
    const playerSprite = this.shipSprites.get(this.playerShipId!);
    if (playerSprite) {
      this.cameraVirtualX = playerSprite.x;
      this.cameraVirtualY = playerSprite.y;
      const zoom = this.cameras.main.zoom;
      this.cameras.main.setScroll(
        this.cameraVirtualX - this.scale.width / (2 * zoom),
        this.cameraVirtualY - this.scale.height / (2 * zoom),
      );
    }
  }

  private createHealthBars(): void {
    for (const [id, ship] of this.ships) {
      const healthBar = new HealthBar({
        scene: this,
        x: ship.x,
        y: ship.y - 30,
        faction: ship.faction as FactionId,
        maxHull: ship.maxHull,
        maxShields: ship.maxShields,
        currentHull: ship.hull,
        currentShields: ship.shields,
      });
      this.healthBars.set(id, healthBar);

      if (ship.capitalSystems) {
        const indicator = new CapitalSystemsIndicator(
          this,
          ship.x,
          ship.y - 42,
        );
        indicator.update(ship.capitalSystems);
        this.capitalIndicators.set(id, indicator);
      }
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

  update(time: number): void {
    InputManager.update();
    const deltaMs = time - this.lastTime;
    this.lastTime = time;

    if (deltaMs <= 0) return;
    if (this.isPaused || this.gameEnded) return;

    // THRUST_UP/DOWN are HELD intents (continuous, for other scenes'
    // free-flying) — this scene wants a single discrete speed step per
    // press, so it does its own rising-edge detection on top of isHeld(),
    // queued the same way as the other edge-triggered actions.
    const thrustUpHeld = InputManager.isHeld("THRUST_UP");
    if (thrustUpHeld && !this.prevThrustUpHeld)
      this.pendingEdgeIntents.add("THRUST_UP");
    this.prevThrustUpHeld = thrustUpHeld;

    const thrustDownHeld = InputManager.isHeld("THRUST_DOWN");
    if (thrustDownHeld && !this.prevThrustDownHeld)
      this.pendingEdgeIntents.add("THRUST_DOWN");
    this.prevThrustDownHeld = thrustDownHeld;

    // Clamp to prevent spiral-of-death on tab-switch or long pause
    this.accumulator += Math.min(deltaMs, 250);

    while (this.accumulator >= ArcadeBattleScene.FIXED_DT) {
      this.tickLogic(ArcadeBattleScene.FIXED_DT);
      this.accumulator -= ArcadeBattleScene.FIXED_DT;
    }

    // Render-only updates: every real frame (not fixed-step)
    this.updateSprites();
    this.updateHUD();
    this.updateCameraFollow();
  }

  private tickLogic(dt: number): void {
    this.framesAlive++;
    this.perfState = updateFPS(this.perfState, dt);
    if (this.framesAlive % 30 === 0) {
      this.perfState = evaluateQuality(this.perfState, this.lastTime);
      this.cameraShakeEnabled =
        this.userWantsCameraShake && this.perfState.effectSettings.screenShake;
      this.damageNumbersEnabled =
        this.userWantsDamageNumbers &&
        this.perfState.effectSettings.damageIndicators;
    }
    this.frameCache = buildFrameCache(this.ships.values());
    this.damageThisFrame = false;
    this.handleInput(dt);
    this.updateShips(dt);
    this.updateAuras(dt);
    this.updateProjectiles(dt);
    this.updateAI(dt);
    this.updateTurrets();
    this.checkCollisions();
    this.updateFleeDetector(dt);
    this.checkVictory();
    this.updateMatchTimer(dt);
  }

  /**
   * Manually follows the player with toroid-aware shortest-path lerp.
   * Removes the camera jump when a ship wraps around the map edge.
   * Also adjusts zoom slightly at high speed for spatial awareness.
   *
   * @remarks Called every frame; replaces Phaser's built-in startFollow.
   */
  private updateCameraFollow(): void {
    const ship = this.ships.get(this.playerShipId!);
    if (!ship) return;

    // Shortest-path delta — pick the direction that doesn't cross the whole map.
    let dx = ship.x - this.cameraVirtualX;
    let dy = ship.y - this.cameraVirtualY;
    if (dx > BATTLEFIELD_SIZE / 2) dx -= BATTLEFIELD_SIZE;
    if (dx < -BATTLEFIELD_SIZE / 2) dx += BATTLEFIELD_SIZE;
    if (dy > BATTLEFIELD_SIZE / 2) dy -= BATTLEFIELD_SIZE;
    if (dy < -BATTLEFIELD_SIZE / 2) dy += BATTLEFIELD_SIZE;

    const lerp = 0.09;
    this.cameraVirtualX += dx * lerp;
    this.cameraVirtualY += dy * lerp;
    // Keep virtual position inside map range to avoid drift.
    this.cameraVirtualX =
      ((this.cameraVirtualX % BATTLEFIELD_SIZE) + BATTLEFIELD_SIZE) %
      BATTLEFIELD_SIZE;
    this.cameraVirtualY =
      ((this.cameraVirtualY % BATTLEFIELD_SIZE) + BATTLEFIELD_SIZE) %
      BATTLEFIELD_SIZE;

    // Speed-based zoom: zoom out slightly at high speed for spatial awareness.
    const speedRatio = (ship.control.speed - 1) / 4;
    const targetZoom = Phaser.Math.Linear(1.0, 0.75, speedRatio);
    const currentZoom = this.cameras.main.zoom;
    this.cameras.main.setZoom(currentZoom + (targetZoom - currentZoom) * 0.03);

    const zoom = this.cameras.main.zoom;
    this.cameras.main.setScroll(
      this.cameraVirtualX - this.scale.width / (2 * zoom),
      this.cameraVirtualY - this.scale.height / (2 * zoom),
    );
  }

  private createStarfield(): void {
    renderBattleStarfield(this, BATTLEFIELD_SIZE);
  }

  private setupInput(): void {
    setupSceneInput(this);
    this.inputSubscriptionIds.push(
      InputManager.onAny((event) => {
        if (this.trackedEdgeIntents.has(event.intent)) {
          this.pendingEdgeIntents.add(event.intent);
        }
      }),
    );
    this.inputSubscriptionIds.push(
      InputManager.on("PAUSE", () => {
        if (this.gameEnded) return;
        if (this.isPaused) {
          this.isPaused = false;
          this.pauseOverlay?.destroy();
          this.pauseOverlay = null;
        } else {
          this.isPaused = true;
          this.showPauseOverlay();
        }
      }),
    );

    // Prevent Tab from moving browser focus away from the canvas
    this.input.keyboard!.on("keydown-TAB", (e: KeyboardEvent) =>
      e.preventDefault(),
    );
  }

  /** Drains a queued edge-triggered intent, returning whether it fired since the last check. */
  private consumeEdge(intent: ActionIntent): boolean {
    const had = this.pendingEdgeIntents.has(intent);
    this.pendingEdgeIntents.delete(intent);
    return had;
  }

  private showPauseOverlay(): void {
    // Same scrollFactor(0)-vs-zoom hit-test issue seen elsewhere in this
    // codebase: a GameObject with scrollFactor(0) is not correctly hit-tested
    // by Phaser's pointer input when the camera zoom != 1.0.
    this.cameras.main.setZoom(1.0);

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    this.pauseOverlay = this.add
      .container(0, 0)
      .setDepth(3000)
      .setScrollFactor(0);

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.7);
    dim.fillRect(0, 0, this.scale.width, this.scale.height);
    this.pauseOverlay.add(dim);

    // Two-column panel: buttons left, controls right
    const panelW = 520;
    const panelH = 360;
    const panel = this.add.graphics();
    panel.fillStyle(0x0a1a2e, 0.98);
    panel.lineStyle(2, 0x2244aa, 1);
    panel.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 12);
    panel.strokeRoundedRect(
      cx - panelW / 2,
      cy - panelH / 2,
      panelW,
      panelH,
      12,
    );
    // Vertical divider between columns
    panel.lineStyle(1, 0x1a3366, 0.8);
    panel.lineBetween(
      cx + 10,
      cy - panelH / 2 + 16,
      cx + 10,
      cy + panelH / 2 - 16,
    );
    this.pauseOverlay.add(panel);

    // — Left column: menu buttons —
    const lx = cx - panelW / 4 - 10;

    this.pauseOverlay.add(
      this.add
        .text(lx, cy - panelH / 2 + 28, "PAUSED", {
          font: "bold 30px Arial",
          color: "#ffffff",
        })
        .setOrigin(0.5),
    );

    const resumeBtn = this.add
      .text(lx, cy - 20, "RESUME", {
        font: "bold 20px Arial",
        color: "#44ff88",
        backgroundColor: "#1a3322",
        padding: { x: 22, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0);
    resumeBtn.on("pointerover", () => resumeBtn.setColor("#ffffff"));
    resumeBtn.on("pointerout", () => resumeBtn.setColor("#44ff88"));
    resumeBtn.on("pointerdown", () => {
      this.isPaused = false;
      this.pauseOverlay?.destroy();
      this.pauseOverlay = null;
    });
    this.pauseOverlay.add(resumeBtn);

    const settingsBtn = this.add
      .text(lx, cy + 38, "SETTINGS", {
        font: "bold 17px Arial",
        color: "#88aaff",
        backgroundColor: "#112244",
        padding: { x: 22, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0);
    settingsBtn.on("pointerover", () => settingsBtn.setColor("#ffffff"));
    settingsBtn.on("pointerout", () => settingsBtn.setColor("#88aaff"));
    settingsBtn.on("pointerdown", () => {
      this.scene.launch("SettingsScene", { returnScene: "ArcadeBattleScene" });
    });
    this.pauseOverlay.add(settingsBtn);

    const quitBtn = this.add
      .text(lx, cy + 90, "QUIT TO MENU", {
        font: "bold 17px Arial",
        color: "#ff5555",
        backgroundColor: "#331111",
        padding: { x: 18, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0);
    quitBtn.on("pointerover", () => quitBtn.setColor("#ffffff"));
    quitBtn.on("pointerout", () => quitBtn.setColor("#ff5555"));
    quitBtn.on("pointerdown", () => this.scene.start("MainMenuScene"));
    this.pauseOverlay.add(quitBtn);

    // — Right column: controls reference —
    const rx = cx + panelW / 4 + 20;
    this.pauseOverlay.add(
      this.add
        .text(rx, cy - panelH / 2 + 28, "CONTROLS", {
          font: "bold 14px monospace",
          color: "#6688bb",
        })
        .setOrigin(0.5),
    );

    const controls: [string, string][] = [
      ["↑ / ↓", "Speed up / down"],
      ["← / →  (tap)", "Bank (short = safe)"],
      ["← / →  (hold)", "Turn (red if held)"],
      ["Q / E", "Sharp turn (auto-speed)"],
      ["Shift+Q/E", "Segnor loop (270° reverse)"],
      ["T / Shift+T", "Tallon roll (L / R)"],
      ["↑↑  double", "Boost dash (3s CD)"],
      ["↓↓  double", "K-Turn (alt to Z)"],
      ["← + →  chord", "Barrel roll"],
      ["Z", "K-Turn (flip)"],
      ["(auto)", "Selected weapon fires on its own"],
      ["SHIFT+SPACE", "Deploy bomb backward"],
      ["TAB", "Cycle weapon"],
      ["G", "Cycle crew role (pilot/gunner/commander)"],
      ["1-4", "Commander orders (capital only)"],
      ["ESC", "Pause / resume"],
    ];

    let ry = cy - panelH / 2 + 52;
    for (const [key, desc] of controls) {
      this.pauseOverlay.add(
        this.add
          .text(rx - 80, ry, key, {
            font: "bold 12px monospace",
            color: "#ffcc44",
          })
          .setOrigin(0, 0),
      );
      this.pauseOverlay.add(
        this.add
          .text(rx - 20, ry, desc, {
            font: "12px monospace",
            color: "#aaaaaa",
          })
          .setOrigin(0, 0),
      );
      ry += 22;
    }
  }

  private handleInput(deltaMs: number): void {
    const ship = this.ships.get(this.playerShipId!);
    if (!ship || ship.hull <= 0) return;

    // Speed control (discrete steps, X-Wing style)
    if (this.consumeEdge("THRUST_UP"))
      ship.control = processCommand(ship, ship.control, "thrust_increase");
    if (this.consumeEdge("THRUST_DOWN"))
      ship.control = processCommand(ship, ship.control, "thrust_decrease");

    // Gesture state machine: hold-duration banking vs turning, double-taps, chords
    const { state: newGestureState, actions } = updateGestures({
      state: this.gestureState,
      leftDown: InputManager.isHeld("STEER_LEFT"),
      rightDown: InputManager.isHeld("STEER_RIGHT"),
      upDown: InputManager.isHeld("THRUST_UP"),
      downDown: InputManager.isHeld("THRUST_DOWN"),
      nowMs: this.time.now,
      deltaMs,
      allowChordBarrelRoll: this.allowChordBarrelRoll,
    });
    this.gestureState = newGestureState;

    // Queue next maneuver from held direction keys (bank by default; turn after hold)
    this.queueDirectionFromKeys(ship);

    // K-turn: explicit Z key/gamepad/touch or double-tap DOWN
    const kturnRequested =
      this.consumeEdge("KTURN") || actions.includes("kturn_gesture");
    if (kturnRequested && !ship.stress.isStressed) {
      const def = getShipDefinition(ship.definitionId);
      const size = SHIP_SIZES[def?.baseStats.size ?? "small"] ?? 18;
      const color = FACTION_COLORS[ship.faction as FactionId] ?? 0xffffff;
      spawnKturnAfterimage(this, ship.x, ship.y, ship.angle, size, color);
      ship.control = processCommand(ship, ship.control, "kturn");
      ship.stress = applyKturnStress(ship.stress);
    }

    // Discrete sharp turns: Q = left, E = right.
    if (this.consumeEdge("SHARP_TURN_LEFT"))
      this.executeDiscreteTurn(ship, "turn_left");
    if (this.consumeEdge("SHARP_TURN_RIGHT"))
      this.executeDiscreteTurn(ship, "turn_right");

    // Segnor loop: Shift+Q = left, Shift+E = right
    if (this.consumeEdge("SEGNOR_LEFT")) {
      ship.control = processCommand(ship, ship.control, "segnor_left");
      ship.stress = applyKturnStress(ship.stress);
    }
    if (this.consumeEdge("SEGNOR_RIGHT")) {
      ship.control = processCommand(ship, ship.control, "segnor_right");
      ship.stress = applyKturnStress(ship.stress);
    }

    // Tallon roll: T = left, Shift+T = right
    if (this.consumeEdge("TALLON_LEFT")) {
      ship.control = processCommand(ship, ship.control, "tallon_left");
      ship.stress = applyKturnStress(ship.stress);
    }
    if (this.consumeEdge("TALLON_RIGHT")) {
      ship.control = processCommand(ship, ship.control, "tallon_right");
      ship.stress = applyKturnStress(ship.stress);
    }

    // Special maneuvers and actions from gesture events. BOOST also arrives
    // as a discrete intent (touch double-tap-up) alongside the keyboard-native
    // hold-duration gesture, so merge both into one action list.
    const boostFromIntent = this.consumeEdge("BOOST");
    const gestureActions =
      boostFromIntent && !actions.includes("boost")
        ? [...actions, "boost" as GestureAction]
        : actions;
    this.processGestureActions(ship, gestureActions);

    // Crew role cycle: pilot -> gunner (large/huge with a turret) -> commander (capital only)
    if (this.consumeEdge("CREW_CYCLE")) {
      const def = getShipDefinition(ship.definitionId);
      const sz = def?.baseStats.size;
      const hasTurret = !!ship.turretSlot && (sz === "large" || sz === "huge");
      const isCapital = def?.role === "capital";
      const roles = getAvailableCrewRoles(hasTurret, isCapital);
      ship.crewMode = nextCrewRole(ship.crewMode, roles);
    }

    // Cloak toggle (C key) — 8-second invisibility; breaks on firing
    if (this.consumeEdge("CLOAK") && !ship.isCloaked) {
      ship.isCloaked = true;
      ship.cloakTimer = 8;
    }

    if (ship.crewMode === "gunner") {
      this.handleGunnerInput(ship, deltaMs / 1000);
      return;
    }

    if (ship.crewMode === "commander") {
      this.handleCommanderInput(ship, deltaMs);
      return;
    }

    if (this.consumeEdge("WEAPON_CYCLE")) this.selectNextWeapon(ship);

    // SHIFT+SPACE deploys a bomb; the selected weapon (laser or ordnance)
    // always autofires on its own cooldown/charges — no button needed.
    if (this.framesAlive > 5) {
      if (this.consumeEdge("FIRE_SECONDARY")) {
        this.deployBomb(ship);
      }
      this.fireSelectedWeapon(ship);
    }
  }

  /**
   * Queues bank or turn for the next cycle based on held direction keys.
   * Hard-turn action from gesture state upgrades bank → turn.
   */
  private queueDirectionFromKeys(ship: ArcadeShip): void {
    const left = InputManager.isHeld("STEER_LEFT");
    const right = InputManager.isHeld("STEER_RIGHT");
    const { actions } = updateGestures({
      state: this.gestureState,
      leftDown: left,
      rightDown: right,
      upDown: false,
      downDown: false,
      nowMs: this.time.now,
      deltaMs: 0,
      allowChordBarrelRoll: false,
    });
    const hardLeft = actions.includes("hard_turn_left");
    const hardRight = actions.includes("hard_turn_right");

    if (left && !right) {
      ship.control = processCommand(
        ship,
        ship.control,
        hardLeft ? "turn_left" : "bank_left",
      );
    } else if (right && !left) {
      ship.control = processCommand(
        ship,
        ship.control,
        hardRight ? "turn_right" : "bank_right",
      );
    } else if (!left && !right) {
      // No direction held — default straight next cycle
      if (
        !ship.control.nextManeuver ||
        ship.control.nextManeuver === "bank_left" ||
        ship.control.nextManeuver === "bank_right" ||
        ship.control.nextManeuver === "turn_left" ||
        ship.control.nextManeuver === "turn_right"
      ) {
        ship.control = { ...ship.control, nextManeuver: null };
      }
    }
  }

  /**
   * Handles boost dash and barrel roll actions produced by the gesture system.
   * FX are spawned before position/state mutation so they appear at the origin.
   *
   * @param ship    - Player ship.
   * @param actions - Actions fired by updateGestures() this frame.
   */
  private processGestureActions(
    ship: ArcadeShip,
    actions: readonly GestureAction[],
  ): void {
    const def = getShipDefinition(ship.definitionId);
    const size = SHIP_SIZES[def?.baseStats.size ?? "small"] ?? 18;
    const color = FACTION_COLORS[ship.faction as FactionId] ?? 0xffffff;

    for (const action of actions) {
      if (action === "boost" && canBoost(ship.control)) {
        // FX at departure point before the position jump
        spawnBoostTrail(
          this,
          ship.x,
          ship.y,
          ship.angle,
          size,
          color,
          BOOST_DISTANCE_PX,
        );
        const rad = (ship.angle - 90) * (Math.PI / 180);
        ship.x =
          (((ship.x + Math.cos(rad) * BOOST_DISTANCE_PX) % BATTLEFIELD_SIZE) +
            BATTLEFIELD_SIZE) %
          BATTLEFIELD_SIZE;
        ship.y =
          (((ship.y + Math.sin(rad) * BOOST_DISTANCE_PX) % BATTLEFIELD_SIZE) +
            BATTLEFIELD_SIZE) %
          BATTLEFIELD_SIZE;
        ship.control = useBoost(ship.control);
        ship.stress = applyBoostStress(ship.stress);
        if (this.cameraShakeEnabled) this.cameras.main.shake(80, 0.008);
        // Brief zoom-out pulse for speed sensation
        const targetZoom = this.cameras.main.zoom * 0.88;
        this.tweens.add({
          targets: this.cameras.main,
          zoom: targetZoom,
          duration: 120,
          ease: "Power2.easeIn",
          yoyo: true,
          onComplete: () => {
            /* zoom restores via updateCameraFollow */
          },
        });
      } else if (action === "barrel_roll_left" && canBarrelRoll(ship.control)) {
        ship.control = processCommand(ship, ship.control, "barrel_roll_left");
        const sprite = this.shipSprites.get(ship.id);
        if (sprite) playBarrelRollLean(this, sprite);
      } else if (
        action === "barrel_roll_right" &&
        canBarrelRoll(ship.control)
      ) {
        ship.control = processCommand(ship, ship.control, "barrel_roll_right");
        const sprite = this.shipSprites.get(ship.id);
        if (sprite) playBarrelRollLean(this, sprite);
      } else if (action === "hard_turn_left") {
        this.executeDiscreteTurn(ship, "turn_left");
      } else if (action === "hard_turn_right") {
        this.executeDiscreteTurn(ship, "turn_right");
      } else if (action === "tallon_roll_left") {
        if (canKTurn(ship.control)) {
          spawnKturnAfterimage(this, ship.x, ship.y, ship.angle, size, color);
          ship.control = processCommand(ship, ship.control, "tallon_left");
          ship.stress = applyKturnStress(ship.stress);
        }
      } else if (action === "tallon_roll_right") {
        if (canKTurn(ship.control)) {
          spawnKturnAfterimage(this, ship.x, ship.y, ship.angle, size, color);
          ship.control = processCommand(ship, ship.control, "tallon_right");
          ship.stress = applyKturnStress(ship.stress);
        }
      } else if (action === "segnor_loop_left") {
        if (canKTurn(ship.control)) {
          spawnKturnAfterimage(this, ship.x, ship.y, ship.angle, size, color);
          ship.control = processCommand(ship, ship.control, "segnor_left");
          ship.stress = applyKturnStress(ship.stress);
        }
      } else if (action === "segnor_loop_right") {
        if (canKTurn(ship.control)) {
          spawnKturnAfterimage(this, ship.x, ship.y, ship.angle, size, color);
          ship.control = processCommand(ship, ship.control, "segnor_right");
          ship.stress = applyKturnStress(ship.stress);
        }
      }
    }
  }

  /**
   * Deploys the first ready bomb-class ordnance slot backward from the ship.
   * Maps to SHIFT+SPACE — drop a bomb behind you as you fly over an enemy.
   *
   * @param ship - The deploying ship.
   */
  private deployBomb(ship: ArcadeShip): void {
    const slotIdx = ship.ordnanceSlots.findIndex(
      (s) =>
        s.ordnanceClass === "bomb" && s.charges > 0 && s.cooldownRemaining <= 0,
    );
    if (slotIdx === -1) return;
    const slot = ship.ordnanceSlots[slotIdx]!;
    const deployAngle = (ship.angle + 180) % 360;
    const rad = (deployAngle - 90) * (Math.PI / 180);
    const proj = createProjectile(
      ship.x + Math.cos(rad) * 20,
      ship.y + Math.sin(rad) * 20,
      deployAngle,
      ship.id,
      ship.faction,
      slot.damage,
      false,
      null,
      0,
      0,
    );
    this.projectiles.push(proj);
    consumeOrdnanceCharge(slot);
    const sprite = this.add.graphics();
    sprite.fillStyle(
      ship.faction === this.playerFaction ? 0xffcc00 : 0xaaff00,
      1,
    );
    sprite.fillCircle(0, 0, 4);
    sprite.setPosition(proj.x, proj.y);
    sprite.setDepth(5);
    this.projectileSprites.set(proj.id, sprite);
  }

  private updateShips(deltaMs: number): void {
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;

      // Update cooldowns
      ship.control = updateCooldowns(ship.control, deltaMs);
      tickOrdnanceCooldowns(ship.ordnanceSlots, deltaMs);
      if (ship.turretSlot) tickTurretCooldown(ship.turretSlot, deltaMs);

      // Dead in the water: a disabled engines system halts all movement.
      const enginesOffline =
        ship.capitalSystems != null && isEnginesOffline(ship.capitalSystems);

      if (!enginesOffline) {
        // Update maneuver — discrete cycle, always executing
        const { control, position, cycleComplete } = updateManeuver(
          ship.control,
          deltaMs,
        );
        ship.control = control;

        if (position) {
          ship.x = position.x;
          ship.y = position.y;
          ship.angle = position.angle;
        }

        if (cycleComplete) {
          // Classify completed maneuver for stress, then start next cycle
          const dir = ship.control.currentManeuver ?? "straight";
          const dialDir = dir.includes("turn")
            ? "turn_left"
            : dir.includes("bank")
              ? "bank_left"
              : "straight";
          const difficulty = lookupDialDifficulty(
            dialDir,
            ship.control.speed,
            ship.shipDial,
          );
          const relief = this.activeAuras.get(ship.id)?.stressReliefTiers ?? 0;
          const eased = easeDifficulty(difficulty, relief);
          ship.stress = updateStress(ship.stress, eased, CYCLE_DURATION_MS);
          ship.control = advanceCycle(ship, ship.control);
        }
      }

      // Wrap around battlefield
      ship.x =
        ((ship.x % BATTLEFIELD_SIZE) + BATTLEFIELD_SIZE) % BATTLEFIELD_SIZE;
      ship.y =
        ((ship.y % BATTLEFIELD_SIZE) + BATTLEFIELD_SIZE) % BATTLEFIELD_SIZE;

      this.tickCloak(ship, deltaMs);
      this.telemetry?.sample(ship.id, ship.x, ship.y, ship.angle);
    }
  }

  /**
   * Recomputes each faction's support aura for this tick and applies the slow
   * shield-regen effect. Damage, mitigation and stress-relief effects are read
   * at their own consumption points from {@link activeAuras}. Uses the shared
   * pure {@link resolveSupportAuras} resolver so gameplay matches telemetry.
   *
   * @param deltaMs - Elapsed simulation time for this tick, in milliseconds.
   */
  private updateAuras(deltaMs: number): void {
    const snapshot: AuraShip[] = [];
    for (const ship of this.ships.values()) {
      const size =
        getShipDefinition(ship.definitionId)?.baseStats.size ?? "small";
      snapshot.push({
        id: ship.id,
        x: ship.x,
        y: ship.y,
        faction: ship.faction,
        role: ship.role,
        size,
        isUnique: false,
        equippedUpgrades: [],
        hull: ship.hull,
        shields: ship.shields,
        maxShields: ship.maxShields,
        systemsOnline: ship.capitalSystems
          ? !isBridgeOffline(ship.capitalSystems)
          : true,
      });
    }

    const { buffs } = resolveSupportAuras(snapshot);
    this.activeAuras = buffs;

    for (const [id, aura] of buffs) {
      if (aura.shieldRegenPerSecond <= 0) continue;
      const ship = this.ships.get(id);
      if (!ship || ship.shields >= ship.maxShields) continue;
      const gain = (aura.shieldRegenPerSecond * deltaMs) / 1000;
      ship.shields = Math.min(ship.maxShields, ship.shields + gain);
    }
  }

  private tickCloak(ship: ArcadeShip, deltaMs: number): void {
    if (!ship.isCloaked) return;
    ship.cloakTimer -= deltaMs / 1000;
    if (ship.cloakTimer <= 0) {
      ship.isCloaked = false;
      ship.cloakTimer = 0;
    }
  }

  private updateProjectiles(deltaMs: number): void {
    const alive: Projectile[] = [];

    for (const proj of this.projectiles) {
      let targetX: number | undefined;
      let targetY: number | undefined;
      if (proj.isHoming && proj.homingTargetId) {
        const homingTarget = this.ships.get(proj.homingTargetId);
        if (homingTarget && homingTarget.hull > 0) {
          targetX = homingTarget.x;
          targetY = homingTarget.y;
        }
      }
      const updated = updateProjectile(proj, deltaMs, targetX, targetY);

      if (
        isProjectileAlive(updated) &&
        updated.x >= 0 &&
        updated.x <= BATTLEFIELD_SIZE &&
        updated.y >= 0 &&
        updated.y <= BATTLEFIELD_SIZE
      ) {
        alive.push(updated);
      } else {
        // Remove sprite
        const sprite = this.projectileSprites.get(proj.id);
        sprite?.destroy();
        this.projectileSprites.delete(proj.id);
      }
    }

    this.projectiles = alive;
  }

  private updateAI(deltaMs: number): void {
    if (!this.frameCache) return;
    const aiViews = new Map<string, AIShipView>();
    for (const ship of this.ships.values()) {
      aiViews.set(ship.id, this.toAIView(ship));
    }

    for (const ship of this.ships.values()) {
      if (ship.owner === "player" || ship.hull <= 0) continue;

      ship.aiDecisionTimer -= deltaMs;

      const allyList = this.frameCache.aliveByFaction.get(ship.faction) ?? [];
      const enemyList = this.frameCache.aliveEnemiesOf(ship.faction);
      const allyViews = allyList.map((s) => aiViews.get(s.id)!);
      const enemyViews = enemyList.map((s) => aiViews.get(s.id)!);

      const currentTarget = ship.targetId
        ? this.ships.get(ship.targetId)
        : null;
      if (
        !currentTarget ||
        currentTarget.hull <= 0 ||
        ship.aiDecisionTimer <= 0
      ) {
        const newTarget = selectAITarget(
          aiViews.get(ship.id)!,
          allyViews,
          enemyViews,
          BATTLEFIELD_SIZE,
        );
        ship.targetId = newTarget?.id ?? null;
        ship.aiDecisionTimer = 300 + Math.random() * 200;
      }

      const target = ship.targetId ? this.ships.get(ship.targetId) : null;
      if (!target) continue;

      const decision = computeAIDecision(
        aiViews.get(ship.id)!,
        aiViews.get(target.id)!,
        allyViews,
        enemyViews,
        deltaMs,
        BATTLEFIELD_SIZE,
      );

      this.applyAIDecision(ship, target, decision, deltaMs);
    }
  }

  /** Converts an ArcadeShip to the read-only view expected by ArcadeAI. */
  private toAIView(ship: ArcadeShip): AIShipView {
    return {
      id: ship.id,
      x: ship.x,
      y: ship.y,
      angle: ship.angle,
      faction: ship.faction,
      role: ship.role,
      hull: ship.hull,
      stress: ship.stress,
      control: ship.control,
      shipDial: ship.shipDial,
      maxAngularVelocity: ship.maxAngularVelocity,
      wingLeaderId: ship.wingLeaderId,
      wingSlotIndex: ship.wingSlotIndex,
    };
  }

  /**
   * Applies an AIDecision to the AI ship — turns, stress, actions, FX.
   *
   * @param ship     - Mutated AI ship.
   * @param target   - Current target (for firing checks).
   * @param decision - Output from computeAIDecision.
   * @param deltaMs  - Frame time.
   */
  private applyAIDecision(
    ship: ArcadeShip,
    target: ArcadeShip,
    decision: AIDecision,
    deltaMs: number,
  ): void {
    // K-turn takes priority over regular steering
    if (decision.doKturn && canKTurn(ship.control)) {
      const def = getShipDefinition(ship.definitionId);
      const size = SHIP_SIZES[def?.baseStats.size ?? "small"] ?? 18;
      const color = FACTION_COLORS[ship.faction as FactionId] ?? 0xffffff;
      spawnKturnAfterimage(this, ship.x, ship.y, ship.angle, size, color);
      ship.control = processCommand(ship, ship.control, "kturn");
      ship.stress = applyKturnStress(ship.stress);
      return;
    }

    // Boost dash
    if (decision.doBoost && canBoost(ship.control)) {
      const def = getShipDefinition(ship.definitionId);
      const size = SHIP_SIZES[def?.baseStats.size ?? "small"] ?? 18;
      const color = FACTION_COLORS[ship.faction as FactionId] ?? 0xffffff;
      spawnBoostTrail(
        this,
        ship.x,
        ship.y,
        ship.angle,
        size,
        color,
        BOOST_DISTANCE_PX,
      );
      const rad = (ship.angle - 90) * (Math.PI / 180);
      ship.x =
        (((ship.x + Math.cos(rad) * BOOST_DISTANCE_PX) % BATTLEFIELD_SIZE) +
          BATTLEFIELD_SIZE) %
        BATTLEFIELD_SIZE;
      ship.y =
        (((ship.y + Math.sin(rad) * BOOST_DISTANCE_PX) % BATTLEFIELD_SIZE) +
          BATTLEFIELD_SIZE) %
        BATTLEFIELD_SIZE;
      ship.control = useBoost(ship.control);
      ship.stress = applyBoostStress(ship.stress);
    }

    // Evasive barrel roll
    if (decision.doBarrelRoll && canBarrelRoll(ship.control)) {
      const sprite = this.shipSprites.get(ship.id);
      if (sprite) playBarrelRollLean(this, sprite, 500);
      const cmd =
        decision.barrelRollDir === "left"
          ? "barrel_roll_left"
          : "barrel_roll_right";
      ship.control = processCommand(ship, ship.control, cmd);
    }

    // Apply steering — convert desired turn delta into a queued maneuver direction.
    // AI stress is applied at cycle end via updateShips(); skip redundant per-frame update.
    const maxTurn = ship.maxAngularVelocity * (deltaMs / 1000);
    const turn = decision.turnDelta;
    const ratio = maxTurn > 0 ? Math.abs(turn) / maxTurn : 0;
    if (ratio >= 0.65) {
      const dir: FlightCommand = turn < 0 ? "turn_left" : "turn_right";
      ship.control = processCommand(ship, ship.control, dir);
    } else if (ratio >= 0.1) {
      let dir: FlightCommand = turn < 0 ? "bank_left" : "bank_right";
      // Stressed AI falls back from turn → bank (already bank here, but guard for completeness)
      ship.control = processCommand(ship, ship.control, dir);
    } else {
      // Straight — clear any queued direction so default 'straight' applies
      if (
        ship.control.nextManeuver === "turn_left" ||
        ship.control.nextManeuver === "turn_right" ||
        ship.control.nextManeuver === "bank_left" ||
        ship.control.nextManeuver === "bank_right"
      ) {
        ship.control = { ...ship.control, nextManeuver: null };
      }
    }
    // Stressed AI: downgrade queued turn → bank
    if (ship.stress.isStressed) {
      if (ship.control.nextManeuver === "turn_left")
        ship.control = { ...ship.control, nextManeuver: "bank_left" };
      if (ship.control.nextManeuver === "turn_right")
        ship.control = { ...ship.control, nextManeuver: "bank_right" };
    }

    // Adjust speed toward desired (one step at a time)
    if (decision.desiredSpeed > ship.control.speed) {
      ship.control = processCommand(ship, ship.control, "thrust_increase");
    } else if (decision.desiredSpeed < ship.control.speed) {
      ship.control = processCommand(ship, ship.control, "thrust_decrease");
    }

    // Primary fire
    if (decision.firePrimary && canFire(ship.control)) {
      ship.control = processCommand(ship, ship.control, "fire");
      this.fireWeapon(ship);
    }

    // Ordnance — try first ready slot when decision flags it
    if (decision.firingOrdnanceSlot >= 0) {
      for (let i = 0; i < ship.ordnanceSlots.length; i++) {
        if (canFireOrdnance(ship.ordnanceSlots[i]!)) {
          this.fireOrdnance(ship, i);
          break;
        }
      }
    }
  }

  /**
   * Advances weapon selection: laser → slot 0 → slot 1 → … → laser.
   * No-op when the ship has no ordnance.
   *
   * @param ship - The player ship.
   */
  private selectNextWeapon(ship: ArcadeShip): void {
    if (ship.ordnanceSlots.length === 0) return;
    this.selectedWeaponSlot =
      this.selectedWeaponSlot >= ship.ordnanceSlots.length - 1
        ? -1
        : this.selectedWeaponSlot + 1;
  }

  /**
   * Fires the currently selected weapon.
   * If the selected ordnance cannot fire (cooldown / no charges), cycles
   * forward through remaining slots; falls back to the primary laser if
   * nothing is ready.
   *
   * @param ship - The player ship.
   */
  private fireSelectedWeapon(ship: ArcadeShip): void {
    if (this.selectedWeaponSlot < 0) {
      // Cloaked ships hold laser fire — autofiring the laser would decloak
      // them the instant cloak activates, since firing always breaks cloak.
      if (canFire(ship.control) && !ship.isCloaked) {
        ship.control = processCommand(ship, ship.control, "fire");
        this.fireWeapon(ship);
      }
      return;
    }

    const slot = ship.ordnanceSlots[this.selectedWeaponSlot];
    if (slot && canFireOrdnance(slot)) {
      this.fireOrdnance(ship, this.selectedWeaponSlot);
      return;
    }

    // Selected ordnance can't fire — check remaining slots in forward order
    const count = ship.ordnanceSlots.length;
    for (let offset = 1; offset <= count; offset++) {
      const idx = (this.selectedWeaponSlot + offset) % count;
      if (canFireOrdnance(ship.ordnanceSlots[idx]!)) {
        this.selectedWeaponSlot = idx;
        this.fireOrdnance(ship, idx);
        return;
      }
    }

    // Nothing ready — fall back to laser (still holds fire while cloaked)
    this.selectedWeaponSlot = -1;
    if (canFire(ship.control) && !ship.isCloaked) {
      ship.control = processCommand(ship, ship.control, "fire");
      this.fireWeapon(ship);
    }
  }

  private fireWeapon(ship: ArcadeShip): void {
    // Firing breaks cloak
    ship.isCloaked = false;
    ship.cloakTimer = 0;
    // Forward laser damage capped at 2 — secondary weapons handle higher burst.
    // Stressed pilots shoot less accurately: 25% damage penalty.
    const baseAttack =
      getShipDefinition(ship.definitionId)?.baseStats.attack ?? 2;
    const stressMult = ship.stress.isStressed ? 0.75 : 1;
    const auraBonus = this.activeAuras.get(ship.id)?.damageBonus ?? 0;
    const damage =
      Math.max(1, Math.round(Math.min(baseAttack, 2) * stressMult)) + auraBonus;
    // Spawn projectile from ship nose
    const rad = (ship.angle - 90) * (Math.PI / 180);
    const spawnDist = 20;
    const proj = createProjectile(
      ship.x + Math.cos(rad) * spawnDist,
      ship.y + Math.sin(rad) * spawnDist,
      ship.angle,
      ship.id,
      ship.faction,
      damage,
    );

    this.projectiles.push(proj);

    // Create sprite — a prominent elongated bolt aligned with travel direction
    const sprite = this.add.graphics();
    const boltColor = ship.faction === this.playerFaction ? 0xff8800 : 0x00ff88;
    sprite.fillStyle(boltColor, 1);
    sprite.fillRect(-5, -17, 10, 34); // 10×34 bolt, centered
    sprite.setPosition(proj.x, proj.y);
    sprite.setAngle(proj.angle);
    sprite.setDepth(5);
    this.projectileSprites.set(proj.id, sprite);
  }

  /**
   * Fires an ordnance slot for the given ship.
   * Finds the nearest enemy in the front 120° arc as the homing target.
   * Bombs fly straight (no target).
   *
   * @param ship - The firing ship.
   * @param slotIndex - Index into ship.ordnanceSlots (0/1/2).
   */
  private fireOrdnance(ship: ArcadeShip, slotIndex: number): void {
    const slot = ship.ordnanceSlots[slotIndex];
    if (!slot || !canFireOrdnance(slot)) return;

    let bestTarget: ArcadeShip | null = null;
    if (slot.isHoming) {
      let bestDist = Infinity;
      for (const other of this.ships.values()) {
        if (other.faction === ship.faction || other.hull <= 0) continue;
        const dx = other.x - ship.x;
        const dy = other.y - ship.y;
        const angleToTarget =
          ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360;
        let angleDiff = Math.abs(angleToTarget - ship.angle);
        if (angleDiff > 180) angleDiff = 360 - angleDiff;
        if (angleDiff > 60) continue; // outside 120° front arc
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) {
          bestDist = dist;
          bestTarget = other;
        }
      }
    }

    consumeOrdnanceCharge(slot);

    const rad = (ship.angle - 90) * (Math.PI / 180);
    const proj = createProjectile(
      ship.x + Math.cos(rad) * 20,
      ship.y + Math.sin(rad) * 20,
      ship.angle,
      ship.id,
      ship.faction,
      slot.damage,
      slot.isHoming,
      bestTarget?.id ?? null,
      slot.homingTurnRate,
      slot.homingTurnBudget,
    );
    this.projectiles.push(proj);

    const sprite = this.add.graphics();
    const isPlayerFaction = ship.faction === this.playerFaction;
    const missileColor = isPlayerFaction ? 0xff6600 : 0xff2200;
    const bombColor = isPlayerFaction ? 0xffcc00 : 0xaaff00;
    sprite.fillStyle(slot.isHoming ? missileColor : bombColor, 1);
    sprite.fillCircle(0, 0, slot.ordnanceClass === "torpedo" ? 5 : 4);
    sprite.setPosition(proj.x, proj.y);
    sprite.setDepth(5);
    this.projectileSprites.set(proj.id, sprite);
  }

  private checkCollisions(): void {
    if (!this.frameCache) return;
    const hitProjectiles = new Set<string>();

    for (const proj of this.projectiles) {
      for (const view of this.frameCache.aliveShips) {
        if (view.id === proj.ownerId) continue;

        if (
          checkProjectileHit(
            proj,
            view.x,
            view.y,
            15,
            view.faction,
            BATTLEFIELD_SIZE,
          )
        ) {
          hitProjectiles.add(proj.id);
          const ship = this.ships.get(view.id)!;

          const wasAlive = ship.hull > 0;
          const rawDamage = ship.isCloaked
            ? Math.max(1, Math.floor(proj.damage / 2))
            : proj.damage;
          const armor =
            getShipDefinition(ship.definitionId)?.baseStats.armor ?? 0;
          const armoredDamage = Math.max(1, rawDamage - armor);
          const mitigation =
            this.activeAuras.get(ship.id)?.damageTakenMultiplier ?? 1;
          const attackerOrders = this.ships.get(proj.ownerId)?.commanderOrders;
          const concentrateMultiplier = attackerOrders
            ? concentrateFireMultiplier(
                attackerOrders.concentrateFire,
                ship.id,
                this.time.now,
              )
            : 1;
          const damage =
            mitigation < 1
              ? Math.max(
                  1,
                  Math.round(
                    armoredDamage * mitigation * concentrateMultiplier,
                  ),
                )
              : Math.round(armoredDamage * concentrateMultiplier);
          ship.isCloaked = false;
          ship.cloakTimer = 0;

          if (ship.shields > 0) {
            ship.shields = Math.max(0, ship.shields - damage);
          } else if (ship.capitalSystems) {
            const result = applyCapitalSystemDamage(
              ship.capitalSystems,
              damage,
            );
            ship.capitalSystems = result.systems;
            ship.hull = sumSystemsHull(result.systems);
            this.damageThisFrame = true;
            if (result.justDisabled && result.hitSystemId) {
              this.showFloatingText(
                ship.x,
                ship.y - 45,
                `${SYSTEM_LABELS[result.hitSystemId]} DISABLED!`,
                "#ff8800",
              );
            }
          } else {
            ship.hull = Math.max(0, ship.hull - damage);
            this.damageThisFrame = true;
          }

          if (this.damageNumbersEnabled) {
            this.showFloatingText(ship.x, ship.y - 20, `-${damage}`, "#ff4444");
          }

          if (
            proj.ownerFaction === this.playerFaction &&
            ship.hull <= 0 &&
            wasAlive
          ) {
            this.score += 100;
            this.showFloatingText(ship.x, ship.y - 40, "KILL!", "#ffff00");
            this.scoreText.setText(`SCORE: ${this.score}`);
          }

          if (ship.hull <= 0 && wasAlive) {
            if (ship.faction === this.playerFaction) {
              this.enemySideScore = creditKill(
                this.enemySideScore,
                ship.definitionId,
              );
            } else {
              this.playerSideScore = creditKill(
                this.playerSideScore,
                ship.definitionId,
              );
            }
          }

          if (this.cameraShakeEnabled) this.cameras.main.shake(50, 0.005);
          break;
        }
      }
    }

    this.projectiles = this.projectiles.filter(
      (p) => !hitProjectiles.has(p.id),
    );
    for (const id of hitProjectiles) {
      const sprite = this.projectileSprites.get(id);
      sprite?.destroy();
      this.projectileSprites.delete(id);
    }
  }

  private spawnShips(): void {
    const battleConfig = this.registry.get("battleConfig") as
      | {
          factions: Array<{
            factionId: FactionId;
            controller: "player" | "ai";
            ships: string[];
            loadoutChoices?: Record<string, string>;
          }>;
        }
      | undefined;

    if (battleConfig?.factions?.length) {
      this.spawnFromConfig(battleConfig.factions);
    } else {
      this.spawnDefaultShips();
    }

    for (const ship of this.ships.values()) {
      this.createShipSprite(ship);
    }
  }

  private spawnFromConfig(
    factions: Array<{
      factionId: FactionId;
      controller: "player" | "ai";
      ships: string[];
      loadoutChoices?: Record<string, string>;
    }>,
  ): void {
    const playerSlot =
      factions.find((f) => f.controller === "player") ?? factions[0]!;
    const enemySlots = factions.filter((f) => f !== playerSlot);
    this.playerFaction = playerSlot.factionId;

    // Spawn player-controlled ship (first in player slot)
    const playerShipId = playerSlot.ships[0] ?? "confed_sparrow";
    const playerShip = this.createShip(
      "player_0",
      playerShipId,
      playerSlot.factionId,
      "player",
      BATTLEFIELD_SIZE / 2,
      BATTLEFIELD_SIZE / 2 + 50,
      0,
    );
    playerShip.hull = playerShip.maxHull = Math.max(6, playerShip.maxHull);
    playerShip.shields = playerShip.maxShields = Math.max(
      3,
      playerShip.maxShields,
    );
    applyLoadoutEffects(playerShip, playerSlot.loadoutChoices?.["0"]);
    playerShip.ordnanceSlots = extractOrdnanceSlots(
      playerShip.definitionId,
      playerSlot.loadoutChoices?.["0"] ?? null,
    );
    playerShip.turretSlot = extractTurretSlot(
      playerShip.definitionId,
      playerSlot.loadoutChoices?.["0"] ?? null,
    );
    this.ships.set(playerShip.id, playerShip);
    this.playerShipId = playerShip.id;

    // Remaining player-slot ships are AI allies in wing formation
    const wingOffsets = [
      { x: -280, y: 350 },
      { x: 280, y: 350 },
      { x: 0, y: 550 },
    ];
    playerSlot.ships.slice(1).forEach((shipId, i) => {
      const offset = wingOffsets[i] ?? { x: (i - 1) * 160, y: 400 };
      const ally = this.createShip(
        `ally_${i}`,
        shipId,
        playerSlot.factionId,
        "ai",
        BATTLEFIELD_SIZE / 2 + offset.x,
        BATTLEFIELD_SIZE / 2 + offset.y,
        0,
      );
      applyLoadoutEffects(ally, playerSlot.loadoutChoices?.[String(i + 1)]);
      ally.ordnanceSlots = extractOrdnanceSlots(
        ally.definitionId,
        playerSlot.loadoutChoices?.[String(i + 1)] ?? null,
      );
      ally.turretSlot = extractTurretSlot(
        ally.definitionId,
        playerSlot.loadoutChoices?.[String(i + 1)] ?? null,
      );
      // Arcade wingman hull floor — glass-cannon light fighters (hull 2) get
      // one-shot by any decent burst. Bumps floor so wingmen survive a hit.
      ally.hull = ally.maxHull = Math.max(4, ally.maxHull);
      // First two allies form up on the player; remaining fly independently.
      if (i < 2) {
        ally.wingLeaderId = playerShip.id;
        ally.wingSlotIndex = i;
      }
      this.ships.set(ally.id, ally);
    });

    // All enemy slots spawn spread around the far side
    const totalEnemies = enemySlots.reduce((sum, s) => sum + s.ships.length, 0);
    let enemyIndex = 0;
    for (const slot of enemySlots) {
      slot.ships.forEach((shipId, shipIdx) => {
        const angle = (enemyIndex / Math.max(totalEnemies, 1)) * Math.PI * 2;
        const radius = 1200;
        const enemy = this.createShip(
          `enemy_${enemyIndex}`,
          shipId,
          slot.factionId,
          "ai",
          BATTLEFIELD_SIZE / 2 + Math.cos(angle) * radius,
          BATTLEFIELD_SIZE / 2 + Math.sin(angle) * radius - 1000,
          180,
        );
        applyLoadoutEffects(enemy, slot.loadoutChoices?.[String(shipIdx)]);
        enemy.ordnanceSlots = extractOrdnanceSlots(
          enemy.definitionId,
          slot.loadoutChoices?.[String(shipIdx)] ?? null,
        );
        enemy.turretSlot = extractTurretSlot(
          enemy.definitionId,
          slot.loadoutChoices?.[String(shipIdx)] ?? null,
        );
        this.ships.set(enemy.id, enemy);
        enemyIndex++;
      });
    }
  }

  private spawnDefaultShips(): void {
    const playerShip = this.createShip(
      "player_0",
      "confed_sparrow",
      "free_confederation",
      "player",
      BATTLEFIELD_SIZE / 2,
      BATTLEFIELD_SIZE / 2 + 50,
      0,
    );
    playerShip.hull = playerShip.maxHull = 8;
    playerShip.shields = playerShip.maxShields = 4;
    this.ships.set(playerShip.id, playerShip);
    this.playerShipId = playerShip.id;

    const wingOffsets = [
      { x: -280, y: 350 },
      { x: 280, y: 350 },
    ];
    for (let i = 0; i < wingOffsets.length; i++) {
      const offset = wingOffsets[i]!;
      const ally = this.createShip(
        `ally_${i}`,
        "confed_wasp",
        "free_confederation",
        "ai",
        BATTLEFIELD_SIZE / 2 + offset.x,
        BATTLEFIELD_SIZE / 2 + offset.y,
        0,
      );
      ally.hull = ally.maxHull = 5;
      ally.shields = ally.maxShields = 3;
      this.ships.set(ally.id, ally);
    }

    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const radius = 1200;
      const enemy = this.createShip(
        `enemy_${i}`,
        i === 0 ? "terran_gladius" : "terran_viper",
        "terran_hegemony",
        "ai",
        BATTLEFIELD_SIZE / 2 + Math.cos(angle) * radius,
        BATTLEFIELD_SIZE / 2 + Math.sin(angle) * radius - 1000,
        180,
      );
      this.ships.set(enemy.id, enemy);
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
  ): ArcadeShip {
    const def = getShipDefinition(defId);
    const baseShip: ShipState = {
      id,
      definitionId: defId,
      faction,
      owner,
      x,
      y,
      angle,
      hull: def?.baseStats.hull ?? 4,
      maxHull: def?.baseStats.hull ?? 4,
      shields: def?.baseStats.shields ?? 2,
      maxShields: def?.baseStats.shields ?? 2,
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

    /**
     * Base turn rate for a medium/heavy_fighter reference ship (°/s).
     * Each ship's actual cap scales by its size × role handling multiplier.
     * Tiny interceptors reach ~162°/s; huge capitals barely reach ~7°/s.
     */
    const BASE_ARCADE_TURN_RATE = 90;
    const handling = getHandlingProfile(
      def?.baseStats.size ?? "small",
      def?.role ?? "heavy_fighter",
    );

    const ship: ArcadeShip = {
      ...baseShip,
      control: createControlState(
        baseShip,
        SHIP_SIZES[def?.baseStats.size ?? "small"] ?? 32,
        getMovementProfile(defId),
        def?.baseStats.speed ?? { min: 1, max: 5 },
      ),
      targetId: null,
      aiDecisionTimer: 0, // fire immediately on first update
      ordnanceSlots: [],
      turretSlot: null,
      crewMode: "pilot",
      role: def?.role ?? "heavy_fighter",
      maxAngularVelocity: BASE_ARCADE_TURN_RATE * handling.turnRate,
      stress: INITIAL_STRESS,
      shipDial: getShipDial(defId),
      cloakTimer: 0,
      wingLeaderId: null,
      wingSlotIndex: 0,
      capitalSystems:
        def?.role === "capital" ? createCapitalSystems(baseShip.hull) : null,
      commanderOrders: def?.role === "capital" ? createCommanderOrders() : null,
    };

    return ship;
  }

  private createShipSprite(ship: ArcadeShip): void {
    const container = this.add.container(
      ship.x,
      ship.y,
    ) as unknown as ShipSprite;
    container.shipId = ship.id;

    const color = FACTION_COLORS[ship.faction as FactionId] ?? 0xffffff;
    const shipDef = getShipDefinition(ship.definitionId);
    const baseSize = SHIP_SIZES[shipDef?.baseStats.size ?? "small"];
    const size = ship.owner === "player" ? baseSize * 1.2 : baseSize;

    // Thruster glow
    const thruster = this.add.graphics();
    thruster.fillStyle(0xff4400, 0.6);
    thruster.fillTriangle(-6, size / 2, 6, size / 2, 0, size / 2 + 12);
    container.add(thruster);
    container.thruster = thruster;

    // Ship body — use individual PNG if loaded; fall back to faction/size placeholder from BootScene
    const spriteKey = `ship_${ship.definitionId}`;
    const fallbackKey = `ship_${ship.faction}_${shipDef?.baseStats.size ?? "small"}`;
    const textureKey = this.textures.exists(spriteKey)
      ? spriteKey
      : this.textures.exists(fallbackKey)
        ? fallbackKey
        : null;
    let body: Phaser.GameObjects.Graphics;
    if (textureKey) {
      const img = this.add.image(0, 0, textureKey);
      img.setDisplaySize(size * 1.8, size * 1.8);
      // ADD blend mode renders dark backgrounds as transparent
      img.setBlendMode(Phaser.BlendModes.ADD);
      container.add(img);

      // Faction-colored identification ring — thick for player, thinner for AI
      const ring = this.add.graphics();
      const ringAlpha = ship.owner === "player" ? 1.0 : 0.75;
      const ringThick = ship.owner === "player" ? 3 : 2;
      ring.lineStyle(ringThick + 2, 0x000000, 0.6);
      ring.strokeCircle(0, 0, size * 1.05);
      ring.lineStyle(ringThick, color, ringAlpha);
      ring.strokeCircle(0, 0, size * 1.05);
      if (ship.owner === "player") {
        ring.lineStyle(1, 0xffffff, 0.35);
        ring.strokeCircle(0, 0, size * 1.25);
      }
      container.add(ring);
      container.ring = ring; // stored for per-frame stress pulse

      body = this.add.graphics(); // invisible placeholder for hull ref
    } else {
      body = this.add.graphics();
      body.fillStyle(color, 1);
      body.beginPath();
      body.moveTo(0, -size / 2);
      body.lineTo(-size / 3, size / 2);
      body.lineTo(0, size / 3);
      body.lineTo(size / 3, size / 2);
      body.closePath();
      body.fillPath();

      // Faction-colored ring on fallback triangles too
      body.lineStyle(3, color, 0.9);
      body.strokeCircle(0, 0, size * 0.9);
      if (ship.owner === "player") {
        body.lineStyle(1, 0xffffff, 0.5);
        body.strokeCircle(0, 0, size * 1.1);
      }
      container.add(body);
    }

    container.hull = body;
    container.setAngle(ship.angle);
    container.setDepth(10);
    container.setSize(size * 2, size * 2);
    container.setInteractive();
    ShipStatCard.attachHoverCard(this, container, ship.definitionId);

    this.shipSprites.set(ship.id, container);
  }

  private updateSprites(): void {
    for (const [id, sprite] of this.shipSprites) {
      const ship = this.ships.get(id);

      if (!ship || ship.hull <= 0) {
        // Simple explosion effect using graphics
        this.createExplosion(sprite.x, sprite.y);

        sprite.destroy();
        this.shipSprites.delete(id);

        // Clean up health bar
        const healthBar = this.healthBars.get(id);
        if (healthBar) {
          healthBar.destroy();
          this.healthBars.delete(id);
        }

        // Clean up capital systems indicator
        const indicator = this.capitalIndicators.get(id);
        if (indicator) {
          indicator.destroy();
          this.capitalIndicators.delete(id);
        }
        continue;
      }

      // Smooth movement
      sprite.x = ship.x;
      sprite.y = ship.y;
      sprite.angle = ship.angle;

      // Cloaked ships: nearly invisible to enemies, dimmed for the owning player
      const isPlayer = ship.id === this.playerShipId;
      sprite.setAlpha(ship.isCloaked ? (isPlayer ? 0.45 : 0.12) : 1.0);

      // Update health bar position and values
      const healthBar = this.healthBars.get(id);
      if (healthBar) {
        healthBar.setPosition(ship.x, ship.y - 30);
        healthBar.update(ship.hull, ship.shields);
      }

      // Update capital systems indicator position and state
      if (ship.capitalSystems) {
        const indicator = this.capitalIndicators.get(id);
        if (indicator) {
          indicator.setPosition(ship.x, ship.y - 42);
          indicator.update(ship.capitalSystems);
        }
      }

      // Thruster intensity based on speed
      const intensity = ship.control.speed / 5;
      sprite.thruster.setScale(1, 0.5 + intensity * 0.8);
      sprite.thruster.setAlpha(0.4 + intensity * 0.4);

      // Stress ring pulse: alpha oscillates when pilot is stressed
      if (sprite.ring) {
        sprite.ring.setAlpha(
          ship.stress.isStressed
            ? 0.35 + 0.65 * Math.abs(Math.sin(this.time.now * 0.005))
            : 1.0,
        );
      }
    }

    // Update projectile positions and orientations
    for (const proj of this.projectiles) {
      const sprite = this.projectileSprites.get(proj.id);
      if (sprite) {
        sprite.setPosition(proj.x, proj.y);
        sprite.setAngle(proj.angle);
      }
    }

    // Update minimap with all ship positions
    this.updateMinimap();
  }

  private updateMinimap(): void {
    const minimapShips: MinimapShip[] = [];

    for (const ship of this.ships.values()) {
      minimapShips.push({
        id: ship.id,
        x: ship.x,
        y: ship.y,
        faction: ship.faction as FactionId,
        isPlayer: ship.id === this.playerShipId,
        isAlive: ship.hull > 0,
      });
    }

    this.minimap?.updateShips(minimapShips);
    this.minimap?.updateViewRect();
  }

  private createHUD(): void {
    const style = { font: "bold 16px monospace", color: "#ffffff" };

    this.speedText = this.add
      .text(10, 10, "SPEED: 3", style)
      .setScrollFactor(0)
      .setDepth(1000);

    this.hullText = this.add
      .text(10, 35, "HULL: 4/4", style)
      .setScrollFactor(0)
      .setDepth(1000);

    this.shieldText = this.add
      .text(10, 60, "SHIELDS: 2/2", { ...style, color: "#00bfff" })
      .setScrollFactor(0)
      .setDepth(1000);

    this.cooldownText = this.add
      .text(10, 90, "", { font: "14px monospace", color: "#ff8888" })
      .setScrollFactor(0)
      .setDepth(1000);

    this.scoreText = this.add
      .text(this.scale.width - 10, 10, "SCORE: 0", style)
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    this.matchTimerText = this.add
      .text(
        this.scale.width / 2,
        10,
        formatMatchClock(ArcadeBattleScene.MATCH_DURATION_MS),
        {
          font: "bold 24px Arial",
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: 3,
        },
      )
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    this.fleeWarningText = this.add
      .text(this.scale.width / 2, 80, "", {
        font: "bold 22px Arial",
        color: "#ff4444",
        stroke: "#000000",
        strokeThickness: 3,
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1500)
      .setVisible(false);

    this.fleeArrow = this.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(1500)
      .setVisible(false);
    this.fleeArrow.fillStyle(0xff4444, 1);
    this.fleeArrow.lineStyle(2, 0x000000, 1);
    this.fleeArrow.beginPath();
    this.fleeArrow.moveTo(20, 0);
    this.fleeArrow.lineTo(-12, -11);
    this.fleeArrow.lineTo(-12, 11);
    this.fleeArrow.closePath();
    this.fleeArrow.fillPath();
    this.fleeArrow.strokePath();
    this.fleeArrow.setPosition(this.scale.width / 2, 132);

    this.instructionsText = this.add
      .text(10, this.scale.height - 20, "", {
        font: "12px monospace",
        color: "#555555",
      })
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(1000)
      .setVisible(false); // replaced by corner controls reminder

    this.maneuverText = this.add
      .text(10, 118, "STRAIGHT", {
        font: "bold 13px monospace",
        color: "#44ff44",
      })
      .setScrollFactor(0)
      .setDepth(1000);

    this.turnGauge = this.add.graphics().setScrollFactor(0).setDepth(1000);

    this.crewModeText = this.add
      .text(this.scale.width / 2, 55, "◎ GUNNER MODE", {
        font: "bold 16px monospace",
        color: "#ffaa00",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(1000)
      .setVisible(false);

    // Team status panel — redrawn each frame by updateTeamHUD()
    this.teamHudGraphics = this.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(1000);

    // Stress bar: label + 100px bar drawn each frame by updateHUD()
    this.stressBarGraphics = this.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(1000);
    this.stressLevelText = this.add
      .text(10, 165, "", { font: "bold 13px monospace", color: "#ff4444" })
      .setScrollFactor(0)
      .setDepth(1000);

    // Controls reminder — bottom-right corner, semi-transparent
    const controlsLines = [
      "↑↓  Speed",
      "←→  Turn",
      "Q/E Sharp Turn",
      "Z    K-Turn",
      "TAB  Weapon",
      "SPC  Fire",
      "G    Crew Role",
      "1-4  Commander Orders",
      "ESC  Pause",
    ];
    const cx = this.scale.width - 10;
    let cy = this.scale.height - 10 - controlsLines.length * 17;
    const cBg = this.add.graphics().setScrollFactor(0).setDepth(999);
    cBg.fillStyle(0x000000, 0.45);
    cBg.fillRoundedRect(
      cx - 108,
      cy - 6,
      112,
      controlsLines.length * 17 + 10,
      5,
    );
    for (const line of controlsLines) {
      this.add
        .text(cx, cy, line, { font: "12px monospace", color: "#999999" })
        .setOrigin(1, 0)
        .setScrollFactor(0)
        .setDepth(1000);
      cy += 17;
    }
  }

  private updateHUD(): void {
    const ship = this.ships.get(this.playerShipId!);
    if (!ship) return;

    this.speedText.setText(`SPEED: ${ship.control.speed}`);
    this.hullText.setText(`HULL: ${ship.hull}/${ship.maxHull}`);
    this.shieldText.setText(`SHIELDS: ${ship.shields}/${ship.maxShields}`);
    this.scoreText.setText(`SCORE: ${this.score}`);

    // Cooldowns
    const cooldowns: string[] = [];
    if (!canKTurn(ship.control)) {
      cooldowns.push(
        `K-TURN: ${Math.ceil(ship.control.kturnCooldown / 1000)}s`,
      );
    }
    if (!canBarrelRoll(ship.control)) {
      cooldowns.push(
        `ROLL: ${(ship.control.barrelRollCooldown / 1000).toFixed(1)}s`,
      );
    }
    if (!canBoost(ship.control)) {
      cooldowns.push(
        `BOOST: ${(ship.control.boostCooldown / 1000).toFixed(1)}s`,
      );
    }
    if (ship.crewMode === "commander" && ship.commanderOrders) {
      cooldowns.push(...this.commanderOrderStatus(ship.commanderOrders));
    }
    this.cooldownText.setText(cooldowns.join(" | "));

    // Hull color
    const hullPct = ship.hull / ship.maxHull;
    this.hullText.setColor(
      hullPct > 0.5 ? "#44ff44" : hullPct > 0.25 ? "#ffff44" : "#ff4444",
    );

    this.updateTurnIndicator();
    this.updateWeaponSelectorHUD(ship);
    this.crewModeText.setVisible(
      ship.crewMode === "gunner" || ship.crewMode === "commander",
    );
    if (ship.crewMode === "gunner") {
      this.crewModeText.setText("◎ GUNNER MODE").setColor("#ffaa00");
    } else if (ship.crewMode === "commander") {
      this.crewModeText.setText("★ COMMANDER MODE").setColor("#00ccff");
    }
    this.updateStressHUD(ship);
    this.updateTeamHUD();
  }

  /**
   * Lazy-initialises ordnance slot labels on first call, then updates
   * charge counts and cooldown countdowns each frame.
   *
   * @param ship - The player ship whose ordnance slots are displayed.
   */
  /**
   * Draws the weapon selector strip bottom-right.
   * Laser is always listed first; ordnance slots follow.
   * The selected entry shows a ► cursor and bright colour.
   * Lazy-initialises Text nodes on first call when ordnance exists.
   *
   * @param ship - The player ship.
   */
  private updateWeaponSelectorHUD(ship: ArcadeShip): void {
    if (ship.ordnanceSlots.length === 0) return;

    // One text per entry: index 0 = laser, 1..n = ordnance slots
    const totalEntries = 1 + ship.ordnanceSlots.length;
    if (this.ordnanceHudTexts.length === 0) {
      for (let i = 0; i < totalEntries; i++) {
        const t = this.add
          .text(
            this.scale.width - 10,
            this.scale.height - 40 - (totalEntries - 1 - i) * 26,
            "",
            { font: "13px monospace", color: "#ffffff" },
          )
          .setOrigin(1, 1)
          .setScrollFactor(0)
          .setDepth(1000);
        this.ordnanceHudTexts.push(t);
      }
    }

    // Laser row
    const laserSelected = this.selectedWeaponSlot < 0;
    this.ordnanceHudTexts[0]
      ?.setText(`${laserSelected ? "►" : " "} LASER`)
      .setColor(laserSelected ? "#ffff44" : "#666644");

    // Ordnance rows
    for (let i = 0; i < ship.ordnanceSlots.length; i++) {
      const slot = ship.ordnanceSlots[i]!;
      const t = this.ordnanceHudTexts[i + 1];
      if (!t) continue;
      const selected = this.selectedWeaponSlot === i;
      const ready = canFireOrdnance(slot);
      const cdSec =
        slot.cooldownRemaining > 0
          ? ` ${Math.ceil(slot.cooldownRemaining / 1000)}s`
          : "";
      const pips =
        "■".repeat(slot.charges) + "□".repeat(slot.maxCharges - slot.charges);
      t.setText(
        `${selected ? "►" : " "} ${slot.name} ${pips}${cdSec}`,
      ).setColor(selected ? "#ffaa00" : ready ? "#886600" : "#443300");
    }
  }

  /**
   * Redraws the right-side team status panel each frame.
   * Groups ships by faction and renders a compact health row per team.
   *
   * @remarks No external dependencies — reads this.ships directly.
   */
  private updateTeamHUD(): void {
    // Destroy previous text nodes and redraw on graphics
    for (const t of this.teamHudTexts) t.destroy();
    this.teamHudTexts = [];
    this.teamHudGraphics.clear();

    // Group ships by faction
    const factions = new Map<string, ArcadeShip[]>();
    for (const ship of this.ships.values()) {
      const list = factions.get(ship.faction) ?? [];
      list.push(ship);
      factions.set(ship.faction, list);
    }

    const panelW = 160;
    const panelX = this.scale.width - panelW - 4;
    const rowH = 42;
    let panelY = 4;
    const totalH = factions.size * (rowH + 4);

    this.teamHudGraphics.fillStyle(0x000000, 0.55);
    this.teamHudGraphics.fillRoundedRect(
      panelX - 4,
      panelY - 2,
      panelW + 8,
      totalH,
      6,
    );

    for (const [faction, ships] of factions) {
      const isPlayer = faction === this.playerFaction;
      const labelColor = isPlayer ? "#44aaff" : "#ff6644";
      const label = faction.replace(/_/g, " ").toUpperCase().slice(0, 16);

      const factionTitle = this.add
        .text(panelX, panelY + 2, label, {
          font: "bold 10px monospace",
          color: labelColor,
        })
        .setScrollFactor(0)
        .setDepth(1001);
      this.teamHudTexts.push(factionTitle);

      // Ship health pips row
      const dotSize = 8;
      const dotGap = 11;
      let dotX = panelX;
      const dotY = panelY + 18;

      for (const ship of ships) {
        const hullPct = ship.hull / Math.max(ship.maxHull, 1);
        const shieldPct = ship.shields / Math.max(ship.maxShields, 1);
        const alive = ship.hull > 0;

        // Hull pip
        const hullColor = !alive
          ? 0x333333
          : hullPct > 0.5
            ? 0x44ff44
            : hullPct > 0.25
              ? 0xffff00
              : 0xff4444;
        this.teamHudGraphics.fillStyle(hullColor, alive ? 1 : 0.3);
        this.teamHudGraphics.fillCircle(
          dotX + dotSize / 2,
          dotY + dotSize / 2,
          dotSize / 2,
        );

        // Shield ring overlay
        if (alive && ship.maxShields > 0 && shieldPct > 0) {
          this.teamHudGraphics.lineStyle(1.5, 0x00aaff, shieldPct);
          this.teamHudGraphics.strokeCircle(
            dotX + dotSize / 2,
            dotY + dotSize / 2,
            dotSize / 2 + 1,
          );
        }

        dotX += dotGap;
        if (dotX + dotSize > panelX + panelW) {
          dotX = panelX;
          // second row would overflow panel but acceptable for large squads
        }
      }

      panelY += rowH + 4;
    }
  }

  /**
   * Updates the maneuver label and gauge.
   * Label text reflects current deflection; color reflects the difficulty
   * of that maneuver on THIS ship's dial (green/white/red = easy/neutral/stressful).
   */
  private updateTurnIndicator(): void {
    const ship = this.ships.get(this.playerShipId!);
    if (!ship) return;

    const current = ship.control.currentManeuver ?? "straight";
    const queued = ship.control.nextManeuver;
    const display = queued ?? current;

    let label: string;
    if (display === "straight") {
      label = "STRAIGHT";
    } else if (display === "bank_left") {
      label = "◄ BANK";
    } else if (display === "bank_right") {
      label = "BANK ►";
    } else if (display === "turn_left") {
      label = "◄ TURN";
    } else if (display === "turn_right") {
      label = "TURN ►";
    } else if (display === "kturn") {
      label = "↺ K-TURN";
    } else if (display === "tallon_left" || display === "tallon_right") {
      label = display === "tallon_left" ? "↺ TALLON ◄" : "► TALLON ↻";
    } else {
      label = display === "segnor_left" ? "↺ SEGNOR ◄" : "► SEGNOR ↻";
    }

    // Queued indicator: prefix shows it hasn't executed yet
    if (queued) label = `▸ ${label}`;

    // Color from dial difficulty
    const dialDir = display.includes("turn")
      ? "turn_left"
      : display.includes("bank")
        ? "bank_left"
        : "straight";
    const diff = lookupDialDifficulty(
      dialDir,
      ship.control.speed,
      ship.shipDial,
    );
    const color = difficultyColor(diff);
    this.maneuverText.setText(label).setColor(color);

    // Cycle progress bar (replaces angular velocity gauge)
    this.turnGauge.clear();
    const gx = 10,
      gy = 136,
      gw = 120,
      gh = 5;
    this.turnGauge.fillStyle(0x333333, 0.8);
    this.turnGauge.fillRect(gx, gy, gw, gh);
    const progress = ship.control.maneuverProgress;
    if (progress > 0) {
      const gaugeColor =
        diff === "green" ? 0x44ff44 : diff === "red" ? 0xff4444 : 0xffffff;
      this.turnGauge.fillStyle(gaugeColor, 0.9);
      this.turnGauge.fillRect(gx, gy, Math.round(progress * gw), gh);
    }
  }

  /**
   * Draws the stress bar below the turn gauge and updates the stressed label.
   * Bar color interpolates green → yellow → red with the stress level.
   *
   * @param ship - The player-controlled ship.
   */
  private updateStressHUD(ship: ArcadeShip): void {
    const BAR_X = 10;
    const BAR_Y = 150;
    const BAR_W = 120;
    const BAR_H = 5;
    const { level, isStressed } = ship.stress;

    this.stressBarGraphics.clear();
    // Track background
    this.stressBarGraphics.fillStyle(0x333333, 0.8);
    this.stressBarGraphics.fillRect(BAR_X, BAR_Y, BAR_W, BAR_H);
    // Filled portion
    if (level > 0.01) {
      const fillW = Math.round(level * BAR_W);
      // Parse color from stressLevelColor helper (returns CSS hex like #rrggbb)
      const cssColor = stressLevelColor(level);
      const hexInt = parseInt(cssColor.slice(1), 16);
      this.stressBarGraphics.fillStyle(hexInt, 1);
      this.stressBarGraphics.fillRect(BAR_X, BAR_Y, fillW, BAR_H);
    }
    // "STRESS" label: dim when low, bright when high
    const labelAlpha = 0.4 + level * 0.6;
    this.stressBarGraphics.fillStyle(0xffffff, labelAlpha * 0.25);
    // "STRESSED" flash text
    if (isStressed) {
      // Pulse by alternating visibility every ~30 frames
      const show = Math.floor(this.time.now / 350) % 2 === 0;
      this.stressLevelText.setText(show ? "STRESSED" : "").setVisible(true);
    } else {
      this.stressLevelText.setVisible(false);
    }
  }

  private showFloatingText(
    x: number,
    y: number,
    text: string,
    color: string,
  ): void {
    const t = this.add
      .text(x, y, text, {
        font: "bold 18px Arial",
        color,
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(50);

    this.tweens.add({
      targets: t,
      y: y - 60,
      alpha: 0,
      duration: 900,
      ease: "Power2",
      onComplete: () => t.destroy(),
    });
  }

  private createExplosion(x: number, y: number): void {
    // Create multiple expanding circles for explosion effect
    const colors = [0xff4400, 0xffaa00, 0xffff00];

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const speed = Phaser.Math.Between(50, 150);
      const color = Phaser.Math.RND.pick(colors);

      const particle = this.add.graphics();
      particle.fillStyle(color, 1);
      particle.fillCircle(0, 0, Phaser.Math.Between(3, 8));
      particle.setPosition(x, y);
      particle.setDepth(15);

      // Animate outward
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0.1,
        duration: 500,
        ease: "Power2",
        onComplete: () => particle.destroy(),
      });
    }

    // Central flash
    const flash = this.add.graphics();
    flash.fillStyle(0xffffff, 1);
    flash.fillCircle(0, 0, 20);
    flash.setPosition(x, y);
    flash.setDepth(16);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 3,
      duration: 300,
      ease: "Power2",
      onComplete: () => flash.destroy(),
    });
  }

  /**
   * Auto-rotates and fires turrets for all ships equipped with one.
   * Ships where the player is in gunner mode are skipped — controlled via
   * handleGunnerInput instead.
   */
  private updateTurrets(): void {
    if (!this.frameCache) return;
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0 || !ship.turretSlot) continue;
      if (ship.id === this.playerShipId && ship.crewMode === "gunner") continue;

      const enemies = this.frameCache.aliveEnemiesOf(ship.faction);
      let nearestEnemy: ArcadeShip | null = null;
      let nearestDist = ship.turretSlot.range;
      for (const view of enemies) {
        const dist = distance(ship.x, ship.y, view.x, view.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestEnemy = this.ships.get(view.id) ?? null;
        }
      }
      if (!nearestEnemy) continue;

      const dx = nearestEnemy.x - ship.x;
      const dy = nearestEnemy.y - ship.y;
      ship.turretSlot.turretFacing =
        ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360;

      if (canFireTurret(ship.turretSlot)) this.fireTurretShot(ship);
    }
  }

  /**
   * Spawns a turret projectile in the direction of the ship's turretFacing.
   *
   * @param ship - Ship firing its turret.
   */
  private fireTurretShot(ship: ArcadeShip): void {
    if (!ship.turretSlot || !canFireTurret(ship.turretSlot)) return;
    consumeTurretShot(ship.turretSlot);

    const rad = (ship.turretSlot.turretFacing - 90) * (Math.PI / 180);
    const auraBonus = this.activeAuras.get(ship.id)?.damageBonus ?? 0;
    const systemsMultiplier = ship.capitalSystems
      ? turretDamageMultiplier(ship.capitalSystems)
      : 1;
    const powerMultiplier =
      ship.commanderOrders &&
      isPowerFocused(
        ship.commanderOrders.powerRedirect,
        "turrets",
        this.time.now,
      )
        ? POWER_REDIRECT_TURRET_MULTIPLIER
        : 1;
    const damage = Math.max(
      1,
      Math.round(
        (ship.turretSlot.damage + auraBonus) *
          systemsMultiplier *
          powerMultiplier,
      ),
    );
    const proj = createProjectile(
      ship.x + Math.cos(rad) * 20,
      ship.y + Math.sin(rad) * 20,
      ship.turretSlot.turretFacing,
      ship.id,
      ship.faction,
      damage,
    );
    this.projectiles.push(proj);

    const sprite = this.add.graphics();
    sprite.fillStyle(
      ship.faction === this.playerFaction ? 0x00ffff : 0xff00ff,
      1,
    );
    sprite.fillCircle(0, 0, 3);
    sprite.setPosition(proj.x, proj.y);
    sprite.setDepth(5);
    this.projectileSprites.set(proj.id, sprite);
  }

  /**
   * Handles turret controls when the player is in gunner mode.
   * Left/right rotate the turret aim; it autofires like every other
   * weapon in this game once a target is in arc/range.
   *
   * @param ship - The player ship.
   * @param dt - Frame time in seconds.
   */
  private handleGunnerInput(ship: ArcadeShip, dt: number): void {
    if (!ship.turretSlot) return;
    const TURN_RATE = 180; // degrees per second
    if (InputManager.isHeld("STEER_LEFT")) {
      ship.turretSlot.turretFacing =
        (ship.turretSlot.turretFacing - TURN_RATE * dt + 360) % 360;
    } else if (InputManager.isHeld("STEER_RIGHT")) {
      ship.turretSlot.turretFacing =
        (ship.turretSlot.turretFacing + TURN_RATE * dt + 360) % 360;
    }
    if (this.framesAlive > 5) {
      this.fireTurretShot(ship);
    }
  }

  /**
   * Handles commander orders (capital ships only): concentrate fire [1],
   * redirect power [2], charge/fire the main beam [3], emergency repair [4].
   * The commander doesn't fly or gun — the ship's turret keeps auto-firing
   * and its last-set maneuver keeps running while orders are issued.
   *
   * @param ship - The player ship.
   * @param deltaMs - Frame time in milliseconds.
   */
  private handleCommanderInput(ship: ArcadeShip, deltaMs: number): void {
    const orders = ship.commanderOrders;
    if (!orders || !this.frameCache) return;
    const now = this.time.now;

    if (this.consumeEdge("COMMANDER_ORDER_1")) {
      const target = this.findNearestEnemy(ship);
      if (target) {
        orders.concentrateFire = issueConcentrateFire(target.id, now);
        this.showFloatingText(
          ship.x,
          ship.y - 45,
          "CONCENTRATE FIRE!",
          "#ffcc00",
        );
      }
    }

    if (
      this.consumeEdge("COMMANDER_ORDER_2") &&
      canRedirectPower(orders.lastPowerRedirectAt, now)
    ) {
      const focus = nextPowerFocus(orders.powerRedirect?.focus ?? null);
      orders.powerRedirect = redirectPower(focus, now);
      orders.lastPowerRedirectAt = now;
      this.showFloatingText(
        ship.x,
        ship.y - 45,
        `POWER TO ${focus.toUpperCase()}!`,
        "#00ccff",
      );
    }

    if (this.consumeEdge("COMMANDER_ORDER_3")) {
      orders.mainBeam = startCharging(orders.mainBeam);
    }
    if (orders.mainBeam.charging) {
      orders.mainBeam = tickMainBeam(orders.mainBeam, deltaMs);
      if (isMainBeamReady(orders.mainBeam)) {
        this.fireMainBeam(ship);
        orders.mainBeam = resetMainBeam();
        orders.lastMainBeamFiredAt = now;
      }
    }

    if (
      this.consumeEdge("COMMANDER_ORDER_4") &&
      canEmergencyRepair(orders.lastEmergencyRepairAt, now) &&
      ship.capitalSystems
    ) {
      ship.shields = Math.min(
        ship.maxShields,
        ship.shields + EMERGENCY_REPAIR_SHIELD_AMOUNT,
      );
      const worst = mostDamagedSystem(ship.capitalSystems);
      ship.capitalSystems = repairCapitalSystem(
        ship.capitalSystems,
        worst,
        EMERGENCY_REPAIR_HULL_AMOUNT,
      );
      ship.hull = sumSystemsHull(ship.capitalSystems);
      orders.lastEmergencyRepairAt = now;
      this.showFloatingText(
        ship.x,
        ship.y - 45,
        "REPAIR CREWS ACTIVE",
        "#44ff88",
      );
    }

    // Passive effects while power stays focused on a system
    if (ship.capitalSystems) {
      if (isPowerFocused(orders.powerRedirect, "engines", now)) {
        ship.capitalSystems = repairCapitalSystem(
          ship.capitalSystems,
          "engines",
          (POWER_REDIRECT_ENGINE_REPAIR_PER_SEC * deltaMs) / 1000,
        );
        ship.hull = sumSystemsHull(ship.capitalSystems);
      }
      if (isPowerFocused(orders.powerRedirect, "shields", now)) {
        ship.shields = Math.min(
          ship.maxShields,
          ship.shields + (POWER_REDIRECT_SHIELD_REGEN_PER_SEC * deltaMs) / 1000,
        );
      }
    }
  }

  /** Nearest living enemy within this ship's turret range (falls back to any range if unarmed). */
  private findNearestEnemy(ship: ArcadeShip): ArcadeShip | null {
    if (!this.frameCache) return null;
    const maxRange = ship.turretSlot?.range ?? Infinity;
    let nearest: ArcadeShip | null = null;
    let nearestDist = maxRange;
    for (const view of this.frameCache.aliveEnemiesOf(ship.faction)) {
      const dist = distance(ship.x, ship.y, view.x, view.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = this.ships.get(view.id) ?? null;
      }
    }
    return nearest;
  }

  /**
   * Fires the commander's charged main beam: one heavy hit along the ship's
   * forward facing.
   *
   * @param ship - The commanding player's ship.
   */
  private fireMainBeam(ship: ArcadeShip): void {
    const rad = (ship.angle - 90) * (Math.PI / 180);
    const proj = createProjectile(
      ship.x + Math.cos(rad) * 20,
      ship.y + Math.sin(rad) * 20,
      ship.angle,
      ship.id,
      ship.faction,
      MAIN_BEAM_DAMAGE,
    );
    this.projectiles.push(proj);

    const sprite = this.add.graphics();
    sprite.fillStyle(0xffffff, 1);
    sprite.fillCircle(0, 0, 7);
    sprite.setPosition(proj.x, proj.y);
    sprite.setDepth(5);
    this.projectileSprites.set(proj.id, sprite);

    this.showFloatingText(ship.x, ship.y - 45, "MAIN BEAM FIRED!", "#ffffff");
  }

  /** HUD strings for the commander's order cooldowns/charge state. */
  private commanderOrderStatus(orders: CommanderOrders): string[] {
    const now = this.time.now;
    const status: string[] = [];
    if (orders.mainBeam.charging) {
      const pct = Math.round((orders.mainBeam.chargeMs / 1000) * 100);
      status.push(`BEAM CHARGING: ${pct}%`);
    } else if (!canFireMainBeam(orders.lastMainBeamFiredAt, now)) {
      status.push(
        `BEAM: ${Math.ceil(
          (orders.lastMainBeamFiredAt + MAIN_BEAM_COOLDOWN_MS - now) / 1000,
        )}s`,
      );
    }
    if (!canRedirectPower(orders.lastPowerRedirectAt, now)) {
      status.push(
        `POWER: ${Math.ceil(
          (orders.lastPowerRedirectAt + POWER_REDIRECT_COOLDOWN_MS - now) /
            1000,
        )}s`,
      );
    }
    if (!canEmergencyRepair(orders.lastEmergencyRepairAt, now)) {
      status.push(
        `REPAIR: ${Math.ceil(
          (orders.lastEmergencyRepairAt + EMERGENCY_REPAIR_COOLDOWN_MS - now) /
            1000,
        )}s`,
      );
    }
    return status;
  }

  /**
   * Executes a discrete sharp turn (Q = left, E = right).
   * Looks up the ship's dial to find the nearest valid speed for a turn;
   * auto-adjusts speed if needed and skips red maneuvers when stressed.
   *
   * @param ship      - Player ship.
   * @param direction - 'turn_left' or 'turn_right'.
   */
  private executeDiscreteTurn(
    ship: ArcadeShip,
    direction: "turn_left" | "turn_right",
  ): void {
    if (ship.control.currentManeuver !== null) return;
    const best = findBestTurnSpeed(
      ship.shipDial,
      ship.control.speed,
      ship.control.minSpeed,
      ship.control.maxSpeed,
      ship.stress.isStressed,
    );
    if (best === null) return;
    if (best !== ship.control.speed)
      ship.control = { ...ship.control, speed: best };
    ship.control = processCommand(ship, ship.control, direction);
  }

  private updateFleeDetector(deltaMs: number): void {
    if (!this.frameCache || this.gameEnded) return;
    const player = this.playerShipId ? this.ships.get(this.playerShipId) : null;
    if (!player || player.hull <= 0) {
      // No player alive → flee doesn't apply; regular victory check handles it
      if (this.fleeWarningText) this.fleeWarningText.setVisible(false);
      this.fleeArrow?.setVisible(false);
      return;
    }

    let nearest = Infinity;
    let nearestX = 0;
    let nearestY = 0;
    for (const s of this.frameCache.aliveShips) {
      if (s.faction === this.playerFaction) continue;
      const d = torusDistance(player.x, player.y, s.x, s.y, BATTLEFIELD_SIZE);
      if (d < nearest) {
        nearest = d;
        nearestX = s.x;
        nearestY = s.y;
      }
    }

    this.fleeState = updateFleeState(this.fleeState, {
      deltaMs,
      damageThisFrame: this.damageThisFrame,
      playerNearestEnemyDist: nearest,
    });

    if (this.fleeWarningText) {
      if (this.fleeState.isWarning && !this.fleeState.hasFled) {
        const secs = fleeSecondsRemaining(this.fleeState);
        this.fleeWarningText
          .setText(`⚠ RETURN TO COMBAT — battle ends in ${secs.toFixed(1)}s`)
          .setVisible(true);
        if (this.fleeArrow && nearest < Infinity) {
          const { dx, dy } = torusDelta(
            player.x,
            player.y,
            nearestX,
            nearestY,
            BATTLEFIELD_SIZE,
          );
          this.fleeArrow.setRotation(Math.atan2(dy, dx)).setVisible(true);
        }
      } else {
        this.fleeWarningText.setVisible(false);
        this.fleeArrow?.setVisible(false);
      }
    }

    if (this.fleeState.hasFled) {
      this.gameEnded = true;
      this.showEndScreen(false);
    }
  }

  private checkVictory(): void {
    if (!this.frameCache) return;
    const result = checkVictoryCondition(this.frameCache, this.playerFaction);
    if (result.outcome === "victory") {
      this.gameEnded = true;
      this.showEndScreen(true);
    } else if (result.outcome === "defeat") {
      this.gameEnded = true;
      this.showEndScreen(false);
    }
  }

  /**
   * Advance the competitive match clock. When it expires, the destroyed
   * squad-point cost on each side decides the winner (miniatures-style margin
   * of victory), falling back to kills and then a draw.
   */
  private updateMatchTimer(deltaMs: number): void {
    if (this.gameEnded) return;
    this.matchTimer = tickMatchTimer(this.matchTimer, deltaMs);
    if (this.matchTimerText) {
      const remaining = this.matchTimer.remainingMs;
      this.matchTimerText.setText(formatMatchClock(remaining));
      this.matchTimerText.setColor(
        remaining <= 30_000
          ? "#ff4444"
          : remaining <= 60_000
            ? "#ffcc00"
            : "#ffffff",
      );
    }
    if (this.matchTimer.expired) {
      this.gameEnded = true;
      const outcome = resolveByPoints(
        this.playerSideScore,
        this.enemySideScore,
      );
      this.showEndScreen(outcome === "side1");
    }
  }

  /** Award global progression XP for this battle (score is exactly 100 per kill). */
  private awardProgressionXp(victory: boolean): void {
    try {
      const kills = Math.max(0, Math.floor(this.score / 100));
      const active = PlayerProfileManager.getActive();
      PlayerProfileManager.awardBattleResult(active.id, {
        kills,
        won: victory,
      });
    } catch (e) {
      console.error("Failed to award progression XP:", e);
    }
  }

  private showEndScreen(victory: boolean): void {
    // Same scrollFactor(0)-vs-zoom hit-test issue as the pause overlay — the
    // dynamic speed-based zoom can be far from 1.0 when the match ends.
    this.cameras.main.setZoom(1.0);
    this.awardProgressionXp(victory);
    // Hide player flight-stats HUD — irrelevant (and misleading) on the end screen
    this.hullText.setVisible(false);
    this.shieldText.setVisible(false);
    this.speedText.setVisible(false);
    this.cooldownText.setVisible(false);
    this.instructionsText.setVisible(false);
    this.maneuverText.setVisible(false);
    this.turnGauge.setVisible(false);
    this.crewModeText.setVisible(false);
    this.teamHudGraphics.setVisible(false);
    for (const t of this.teamHudTexts) t.setVisible(false);
    for (const t of this.ordnanceHudTexts) t.setVisible(false);
    this.fleeWarningText?.setVisible(false);
    this.fleeArrow?.setVisible(false);

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, this.scale.width, this.scale.height);
    overlay.setScrollFactor(0).setDepth(2000);

    const title = victory ? "VICTORY!" : "DEFEATED";
    const titleColor = victory ? "#44ff44" : "#ff4444";
    this.add
      .text(cx, cy - 70, title, {
        font: "bold 56px Arial",
        color: titleColor,
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001);

    this.add
      .text(cx, cy - 15, `Score: ${this.score}`, {
        font: "26px Arial",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001);

    // RETRY button
    const retryBtn = this.add
      .text(cx - 100, cy + 50, "RETRY", {
        font: "bold 24px Arial",
        color: "#44ff88",
        backgroundColor: "#224422",
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001)
      .setInteractive({ useHandCursor: true });
    retryBtn.on("pointerover", () => retryBtn.setStyle({ color: "#ffffff" }));
    retryBtn.on("pointerout", () => retryBtn.setStyle({ color: "#44ff88" }));
    retryBtn.on("pointerdown", () => this.scene.start("ArcadeBattleScene"));

    // MENU button
    const menuBtn = this.add
      .text(cx + 100, cy + 50, "MENU", {
        font: "bold 24px Arial",
        color: "#aaaaaa",
        backgroundColor: "#333333",
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001)
      .setInteractive({ useHandCursor: true });
    menuBtn.on("pointerover", () => menuBtn.setStyle({ color: "#ffffff" }));
    menuBtn.on("pointerout", () => menuBtn.setStyle({ color: "#aaaaaa" }));
    menuBtn.on("pointerdown", () => this.scene.start("MainMenuScene"));
  }
}
