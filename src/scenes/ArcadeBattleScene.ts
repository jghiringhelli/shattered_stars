/**
 * Arcade Battle Scene
 * Real-time dogfighting with direct ship control
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
import { showConfirmDialog } from "../ui/ConfirmDialog";
import type { ShipState } from "../core/types";
import {
  createControlState,
  updateCooldowns,
  processCommand,
  canFire,
  type ShipControlState,
} from "../core/ArcadeControls";
import {
  createProjectile,
  updateProjectile,
  isProjectileAlive,
  checkProjectileHit,
  withOnHit,
  projectileRawDamage,
  type Projectile,
} from "../core/Projectile";
import { consumeOrdnanceCharge } from "../arcade/ArcadeOrdnance";
import {
  type GestureState,
  INITIAL_GESTURE_STATE,
} from "../arcade/ArcadeInputGestures";
import { playFlightEventFx } from "../arcade/ArcadeFX";
import {
  drawEnergyBolt,
  drawEnergyOrb,
  CANNON_BOLT_LENGTH_PX,
  CANNON_BOLT_WIDTH_PX,
} from "../rendering/BoltRenderer";
import { InputManager } from "../input/InputManager";
import { setupSceneInput, teardownSceneInput } from "../input/setupSceneInput";
import { trackModeEnd, trackModeStart } from "../telemetry/telemetry";
import type { ActionIntent } from "../input/InputTypes";
import {
  buildOrdnanceSlots,
  tickOrdnanceCooldowns,
  canFireOrdnance,
  type ArcadeOrdnanceSlot,
} from "../arcade/ArcadeOrdnance";
import {
  buildTurretSlot,
  tickTurretCooldown,
  canFireTurret,
  consumeTurretShot,
  type ArcadeTurretSlot,
} from "../arcade/ArcadeTurret";
import {
  loadoutUpgradeIds,
  resolveLoadoutModifiers,
  applyControlModifiers,
  applyOrdnanceModifiers,
  applyTurretModifiers,
} from "../arcade/ArcadeUpgradeEffects";
import {
  NEUTRAL_MODIFIERS,
  MIN_DAMAGE_TAKEN_MULTIPLIER,
  laserDamageWithModifiers,
  type CombatModifiers,
} from "../core/CombatModifiers";
import {
  getShipDefinition,
  getShipDial,
  getMovementProfile,
} from "../data/ShipDefinitions";
import { distance } from "../systems/MovementSystem";
import type { ShipRole } from "../core/types";
import type { ManeuverDefinition } from "../core/types";
import {
  type StressState,
  INITIAL_STRESS,
  applyInstantStress,
  accrueCycleStress,
} from "../arcade/ArcadeStress";
import {
  deathBlastDamage,
  deathBlastTargets,
  hasWingman,
  laserHitBonus,
  rewardKill,
} from "../arcade/PilotAbilityCombat";
import { incomingDamageMultiplier } from "../arcade/ShotConditions";
import {
  BATTLEFIELD_SIZE,
  CYCLE_DURATION_MS,
  SHIP_SIZES,
  type FactionId,
  type ShipSize,
} from "../config";
import { HealthBar } from "../ui/HealthBar";
import { ShipRepairFeedback, overlaySide } from "../ui/hud/overlay";
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
  canEmergencyRepair,
  POWER_REDIRECT_TURRET_MULTIPLIER,
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
import { torusDelta } from "../core/Torus";
import {
  createSideScore,
  creditKill,
  resolveByPoints,
  type SideScore,
} from "../systems/arena/BattleScore";
import {
  createMatchTimer,
  tickMatchTimer,
  type MatchTimerState,
} from "../systems/arena/MatchTimer";
import {
  createPerformanceState,
  updateFPS,
  evaluateQuality,
  type PerformanceState,
} from "../systems/PerformanceSystem";
import { renderBattleStarfield } from "../rendering/Starfield";
import { applyLoadoutEffects } from "../systems/BattleHelpers";
import { stepMotion } from "../arcade/systems/ShipMotion";
import {
  applyPilotFlightInput,
  onPilotCycleCommitted,
  INITIAL_PILOT_CONTROL,
  type FlightControlResult,
  type FlightEdge,
  type FlightEvent,
  type PilotControlState,
} from "../arcade/systems/PilotFlightControls";

/** Edge intents that drive flight controls, consumed once per frame. */
const FLIGHT_EDGES: readonly FlightEdge[] = [
  "THRUST_UP",
  "THRUST_DOWN",
  "KTURN",
  "SHARP_TURN_LEFT",
  "SHARP_TURN_RIGHT",
  "SEGNOR_LEFT",
  "SEGNOR_RIGHT",
  "TALLON_LEFT",
  "TALLON_RIGHT",
  "BOOST",
];
import { uniquePilotOf } from "../data/squadRules";
import { audioManager } from "../audio/AudioManager";
import { syncListenerToCamera } from "../audio/CameraListener";
import { addPaintedSpaceBackground } from "../ui/TexturedPanel";
import { ShipTelemetry } from "../debug/ShipTelemetry";
import {
  resolveSupportAuras,
  type AuraShip,
  type ActiveAura,
} from "../systems/SupportAura";
import {
  attackIntervalMs,
  HitImmunityLedger,
} from "../arcade/systems/CombatTempo";
import {
  DEFAULT_SQUAD_DURABILITY,
  EMERGENCY_HULL_REPAIR,
  EMERGENCY_SHIELD_REPAIR,
  ENGINE_REPAIR_PER_SECOND,
  MAIN_BEAM_HIT_DAMAGE,
  PLAYER_HULL_FLOOR,
  PLAYER_SHIELD_FLOOR,
  POWER_SHIELD_REGEN_PER_SECOND,
  WINGMAN_HULL_FLOOR,
  realTimeDurability,
  regenerateScaledShields,
} from "./arcadeBattle/arcadeDurability";
import {
  ArcadeBattleHud,
  type ArcadeHudReadout,
} from "./arcadeBattle/ArcadeBattleHud";
import { TARGET_ARC_HALF_DEG } from "./arcadeBattle/arcadeHudModel";
import { nearestInArc } from "./arcadeBattle/arcTargeting";
import {
  createEndOverlay,
  createPauseOverlay,
} from "./arcadeBattle/ArcadeOverlays";
import { spawnDeflectFlash } from "./arcadeBattle/hitFx";
import {
  LASER_BOLT_SPEED_PX_PER_S,
  type FiringBody,
} from "./arcadeBattle/aiFiringSolution";
import { ordnanceInReach, pickAiShot } from "./arcadeBattle/aiShotSelection";
import {
  ArcadeBotFleet,
  DEFAULT_SKIRMISH_DIFFICULTY,
} from "./arcadeBattle/ArcadeBotFleet";
import { toBotContact } from "./arcadeBattle/arcadeBotContact";
import { projectileLeverBonus } from "./arcadeBattle/projectileLevers";
import { selectHudTargetId } from "./arcadeBattle/arcadeHudModel";
import { createSeededRng } from "../utils/random";
import {
  createScenarioController,
  type ScenarioController,
  type ScenarioSceneLink,
} from "./scenario/ScenarioController";
import type { ScenarioReadout } from "./scenario/scenarioReadout";
import type { ScreenRect } from "../ui/hud/screenRect";

interface ArcadeShip extends ShipState {
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
  /** Upgrade ids equipped by this ship's loadout. */
  upgradeIds: ReadonlyArray<string>;
  /** Real-time effects of those upgrades, folded into one sheet. */
  modifiers: CombatModifiers;
  /** True when a named (unique) pilot flies this ship — projects a hero aura. */
  isUniquePilot: boolean;
  /** Scene time (ms) until which a kill-frenzy pilot ability is active. */
  frenzyUntilMs: number;
}

interface ShipSprite extends Phaser.GameObjects.Container {
  shipId: string;
  hull: Phaser.GameObjects.Graphics;
  thruster: Phaser.GameObjects.Graphics;
  healthBar?: HealthBar;
  /** Faction-colored identification ring — alpha is modulated when pilot is stressed. */
  ring?: Phaser.GameObjects.Graphics;
  /** Ship art image, when loaded — squashed/stretched by the banking effect on hard turns. */
  image?: Phaser.GameObjects.Image | null;
  /** Image's base scale (from setDisplaySize) that banking must multiply, not overwrite. */
  imageBaseScaleX?: number;
  imageBaseScaleY?: number;
  bankState: BankState;
}

/** Seconds a cloak lasts before upgrades (Phantom Strike extends it). */
const BASE_CLOAK_SECONDS = 8;
/** Hit-test radius of a ship for projectiles (px, before the bolt radius). */
const SHIP_HIT_RADIUS_PX = 15;
/** Score for each enemy the player's side destroys. */
const KILL_SCORE = 100;
/** Seeds drawn for a battle whose config names none: [0, 2^31). */
const RANDOM_BATTLE_SEED_RANGE = 2 ** 31;

/**
 * @param definitionId - Ship definition id.
 * @returns Its size class (small for unknown ids).
 */
function shipSizeOf(definitionId: string): ShipSize {
  return getShipDefinition(definitionId)?.baseStats.size ?? "small";
}

/**
 * @param ship - A ship record.
 * @returns Its position, heading and dial speed (for firing solutions).
 */
function firingBodyOf(ship: ArcadeShip): FiringBody {
  return { x: ship.x, y: ship.y, angle: ship.angle, speed: ship.control.speed };
}

export class ArcadeBattleScene extends Phaser.Scene {
  private ships: Map<string, ArcadeShip> = new Map();
  private shipSprites: Map<string, ShipSprite> = new Map();
  private telemetry: ShipTelemetry | null = null;
  private projectiles: Projectile[] = [];
  private projectileSprites: Map<string, Phaser.GameObjects.Graphics> =
    new Map();
  private healthBars: Map<string, HealthBar> = new Map();
  /** Repair mechanic + overlay shimmer + repair drones (built in create). */
  private repairFeedback: ShipRepairFeedback | null = null;
  private capitalIndicators: Map<string, CapitalSystemsIndicator> = new Map();
  /** Holographic HUD; created in create(), destroyed on shutdown. */
  private hud: ArcadeBattleHud | null = null;
  /**
   * X-Wing round tempo: a ship struck by an attacker ignores that attacker's
   * lasers, turret and ordnance until the next maneuver cycle.
   */
  private readonly hitLedger = new HitImmunityLedger();
  /** Simulated battle time (ms), advanced by the fixed-step logic tick. */
  private battleClockMs = 0;
  private cameraShakeEnabled = true;
  private damageNumbersEnabled = true;
  private userWantsCameraShake = true;
  private userWantsDamageNumbers = true;

  /** Per-tick support-aura buffs keyed by ship id (recomputed in updateAuras). */
  private activeAuras: ReadonlyMap<string, ActiveAura> = new Map();
  /** Tracks whether the player's ship was under a support aura last tick (rising-edge SFX cue). */
  private playerWasAuraCovered = false;

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
    "MARK_TARGET",
  ]);
  private prevThrustUpHeld = false;
  private prevThrustDownHeld = false;
  private inputSubscriptionIds: number[] = [];

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

  /** Competitive time limit (ms); when it runs out, destroyed point cost decides the match. */
  private static readonly MATCH_DURATION_MS = 180_000;
  private matchTimer: MatchTimerState = createMatchTimer(
    ArcadeBattleScene.MATCH_DURATION_MS,
  );
  /** Point cost of enemy ships the player's side has destroyed. */
  private playerSideScore: SideScore = createSideScore();
  /** Point cost of the player's ships the enemy side has destroyed. */
  private enemySideScore: SideScore = createSideScore();

  private framesAlive = 0;

  /** Gesture state machine — tracks tap timing, hold duration, chord detection. */
  private gestureState: GestureState = INITIAL_GESTURE_STATE;
  /** Player flight-input memory (gestures, tap vs hold steering). */
  private pilotControl: PilotControlState = INITIAL_PILOT_CONTROL;
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

  /** -1 = primary laser; 0/1/2 = ordnance slot index */
  private selectedWeaponSlot = -1;

  /** The AI: a bot pilot per AI ship, a squad command per faction, the marks. */
  private botFleet: ArcadeBotFleet | null = null;

  /** X-Wing 2.0 scenario (battleConfig.scenario), or null for a plain Skirmish. */
  private scenario: ScenarioController | null = null;

  constructor() {
    super({ key: "ArcadeBattleScene" });
  }

  /** Tier of every AI-flown ship's bot pilot, by ship id (e2e / telemetry). */
  get aiPilotTiers(): Record<string, string> {
    const tiers: Record<string, string> = {};
    for (const ship of this.ships.values()) {
      const tier = this.botFleet?.tierOf(ship.id);
      if (tier) tiers[ship.id] = tier;
    }
    return tiers;
  }

  /**
   * @param shipId - An AI ship.
   * @returns The enemy it is after (its pilot's target, else its squad focus).
   */
  aiTargetOf(shipId: string): string | null {
    const ship = this.ships.get(shipId);
    if (!ship || !this.botFleet) return null;
    return this.botFleet.targetIdFor(ship.id, ship.faction);
  }

  /** The target the player's side has marked right now, or null. */
  get playerMarkedTargetId(): string | null {
    return (
      this.botFleet?.markedTargetOf(this.playerFaction, this.battleClockMs) ??
      null
    );
  }

  /** What the holographic HUD showed on its last update (e2e / screenshots). */
  get hudReadout(): ArcadeHudReadout | null {
    return this.hud?.readout ?? null;
  }

  /** Screen rects of the fixed HUD widgets (e2e overlap checks). */
  get hudLayout(): Record<string, ScreenRect> {
    return this.hud?.layoutRects() ?? {};
  }

  /** The flee countdown text (e2e wiring check). */
  get fleeWarningText(): Phaser.GameObjects.Text | null {
    return this.hud?.fleeWarningText ?? null;
  }

  /** The running scenario's state and scoreboard (e2e), or null in a plain Skirmish. */
  get scenarioReadout(): ScenarioReadout | null {
    return this.scenario?.readout ?? null;
  }

  /** @returns What the scenario controller reads from (and reports to) this scene. */
  private scenarioLink(): ScenarioSceneLink {
    return {
      worldSize: BATTLEFIELD_SIZE,
      ships: () => this.ships.values(),
      playerShipId: () => this.playerShipId,
      playerMarkedTargetId: () => this.playerMarkedTargetId,
      radarRect: () => this.hud?.layoutRects()["radar"],
      onEnd: () => {
        this.gameEnded = true;
        this.showEndScreen(this.scenario?.playerWon ?? false);
      },
    };
  }

  shutdown(): void {
    this.inputSubscriptionIds.forEach((id) => InputManager.off(id));
    this.inputSubscriptionIds = [];
    this.pendingEdgeIntents.clear();
    this.hitLedger.clear();
    this.hud?.destroy();
    this.hud = null;
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
    // Phaser never calls shutdown() on its own; without this, every restart
    // stacks another set of input subscriptions.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    const savedSettings = this.registry.get("settings") as
      | {
          cameraShake: boolean;
          showDamageNumbers: boolean;
        }
      | undefined;
    this.userWantsCameraShake = savedSettings?.cameraShake ?? true;
    this.userWantsDamageNumbers = savedSettings?.showDamageNumbers ?? true;
    this.cameraShakeEnabled = this.userWantsCameraShake;
    this.damageNumbersEnabled = this.userWantsDamageNumbers;
    this.resetBattleState();
    trackModeStart("skirmish");

    // No setBounds — we manage the camera manually for seamless toroid wrapping.
    this.cameras.main.setBackgroundColor(0x050510);
    this.cameras.main.setZoom(1.0);
    addPaintedSpaceBackground(this, "galaxy_spiral", 0);

    this.createStarfield();
    this.setupInput();
    this.scenario = createScenarioController(
      this,
      this.registry.get("battleConfig"),
      this.scenarioLink(),
    );
    this.spawnShips();
    this.createHealthBars();
    this.repairFeedback = new ShipRepairFeedback({
      scene: this,
      shipOf: (id) => this.ships.get(id),
      overlayOf: (id) => this.healthBars.get(id),
      particleScale: () => this.perfState.effectSettings.particleCount,
    });
    this.hud = new ArcadeBattleHud(this, {
      worldSize: BATTLEFIELD_SIZE,
      sizeOf: (definitionId) => shipSizeOf(definitionId),
    });
    audioManager.playFactionMusic(this.playerFaction, "combat");

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
      this.cameras.main.centerOn(this.cameraVirtualX, this.cameraVirtualY);
    }
  }

  /**
   * Forget everything from a previous battle. Phaser reuses the scene
   * instance on restart / RETRY, so field initialisers do not run again.
   */
  private resetBattleState(): void {
    this.ships.clear();
    this.shipSprites.clear();
    this.projectiles = [];
    this.projectileSprites.clear();
    this.healthBars.clear();
    this.capitalIndicators.clear();
    this.hitLedger.clear();
    this.battleClockMs = 0;
    this.accumulator = 0;
    this.framesAlive = 0;
    this.score = 0;
    this.isPaused = false;
    this.pauseOverlay = null;
    this.selectedWeaponSlot = -1;
    this.activeAuras = new Map();
    this.playerWasAuraCovered = false;
    this.pilotControl = INITIAL_PILOT_CONTROL;
    this.prevThrustUpHeld = false;
    this.prevThrustDownHeld = false;
    this.botFleet = null;
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
        side: overlaySide(
          id === this.playerShipId,
          ship.faction === this.playerFaction,
        ),
        definitionId: ship.definitionId,
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

  update(time: number): void {
    InputManager.update();
    // Mix every positional sound relative to what the player is
    // looking at, so a distant firefight sounds distant.
    syncListenerToCamera(this.cameras.main);
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
    this.updateSprites(deltaMs);
    this.updateHUD();
    this.scenario?.render(this.cameras.main, this.time.now);
    this.updateCameraFollow();
  }

  private tickLogic(dt: number): void {
    this.framesAlive++;
    this.battleClockMs += dt;
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
    this.updateAI(dt);
    this.updateShips(dt);
    this.updateAuras(dt);
    this.updateProjectiles(dt);
    this.updateTurrets();
    this.checkCollisions();
    if (this.scenario?.tick(dt, this.battleClockMs)) return;
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
    const zoom = this.cameras.main.zoom;
    this.cameras.main.setZoom(zoom + (targetZoom - zoom) * 0.03);
    this.cameras.main.centerOn(this.cameraVirtualX, this.cameraVirtualY);
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
        if (this.isPaused) this.resumeBattle();
        else this.pauseBattle();
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

  /**
   * Pause the battle and show the pause menu. The camera goes to zoom 1:
   * Phaser mis-hit-tests scrollFactor(0) buttons under any other zoom.
   */
  private pauseBattle(): void {
    if (this.isPaused || this.gameEnded) return;
    this.isPaused = true;
    this.cameras.main.setZoom(1.0);
    this.hud?.setVisible(false);
    this.scenario?.setHudVisible(false);
    this.pauseOverlay = createPauseOverlay(this, {
      onResume: () => this.resumeBattle(),
      onSettings: () =>
        this.scene.launch("SettingsScene", {
          returnScene: "ArcadeBattleScene",
        }),
      onQuit: () =>
        showConfirmDialog({
          scene: this,
          message: "Quit to menu? Battle progress will be lost.",
          onConfirm: () => this.scene.start("MainMenuScene"),
        }),
    });
  }

  /** Close the pause menu and resume the battle. */
  private resumeBattle(): void {
    this.isPaused = false;
    this.pauseOverlay?.destroy();
    this.pauseOverlay = null;
    this.hud?.setVisible(true);
    this.scenario?.setHudVisible(true);
  }

  private handleInput(deltaMs: number): void {
    const ship = this.ships.get(this.playerShipId!);
    if (!ship || ship.hull <= 0) return;

    this.applyFlightInput(ship, deltaMs);

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
      ship.cloakTimer = BASE_CLOAK_SECONDS + ship.modifiers.cloakDurationBonus;
    }

    if (this.consumeEdge("MARK_TARGET")) this.markHudTarget(ship);

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
   * Runs one frame of the player's flight controls through the shared
   * PilotFlightControls (the same code every cycle-engine scene uses) and
   * plays the effects for whatever happened.
   *
   * @param ship - The player ship.
   * @param deltaMs - Frame length (ms).
   */
  private applyFlightInput(ship: ArcadeShip, deltaMs: number): void {
    const edges = new Set<FlightEdge>(
      FLIGHT_EDGES.filter((edge) => this.consumeEdge(edge)),
    );
    const result = applyPilotFlightInput(
      this.pilotControl,
      { ship, motion: ship, stress: ship.stress, dial: ship.shipDial },
      {
        left: InputManager.isHeld("STEER_LEFT"),
        right: InputManager.isHeld("STEER_RIGHT"),
        up: InputManager.isHeld("THRUST_UP"),
        down: InputManager.isHeld("THRUST_DOWN"),
        edges,
        nowMs: this.time.now,
        deltaMs,
        allowChordBarrelRoll: this.allowChordBarrelRoll,
      },
      BATTLEFIELD_SIZE,
    );
    this.pilotControl = result.pilot;
    this.applyFlightResult(ship, result);
  }

  /**
   * Store a frame of flight (pose, maneuver state, stress) on a ship and play
   * the effects of whatever happened — the player's and the AI's alike.
   *
   * @param ship - The ship flown.
   * @param result - The flight controls' result for this frame.
   */
  private applyFlightResult(
    ship: ArcadeShip,
    result: FlightControlResult,
  ): void {
    const origin = { x: ship.x, y: ship.y, angle: ship.angle };
    ship.x = result.motion.x;
    ship.y = result.motion.y;
    ship.angle = result.motion.angle;
    ship.control = result.motion.control;
    ship.stress = result.stress;
    this.scenario?.onFlightEvents(ship.id, result.events, origin);
    for (const event of result.events)
      this.playFlightEvent(ship, event, origin);
  }

  /**
   * Visual feedback for a flight event, drawn at the pose it started from.
   * Camera shake and zoom pulse are for the player's own ship only.
   *
   * @param ship - The ship that acted.
   * @param event - What happened.
   * @param origin - Pose before the action (boost trails start here).
   */
  private playFlightEvent(
    ship: ArcadeShip,
    event: FlightEvent,
    origin: { x: number; y: number; angle: number },
  ): void {
    const isPlayer = ship.id === this.playerShipId;
    playFlightEventFx(this, {
      event,
      origin,
      definitionId: ship.definitionId,
      faction: ship.faction,
      sprite: this.shipSprites.get(ship.id),
      cameraShake: isPlayer && this.cameraShakeEnabled,
      zoomPulse: isPlayer,
    });
  }

  /**
   * MARK_TARGET (R): the player's side marks the player's HUD target — the
   * wingmen focus it and every hit on it by the side gets the mark bonus.
   *
   * @param player - The player's ship.
   */
  private markHudTarget(player: ArcadeShip): void {
    const targetId = selectHudTargetId(
      player,
      [...this.ships.values()],
      BATTLEFIELD_SIZE,
    );
    if (!targetId || !this.botFleet) return;
    this.botFleet.markTarget(this.playerFaction, targetId, this.battleClockMs);
    this.scenario?.onPlayerMark(targetId);
    const target = this.ships.get(targetId);
    if (target) {
      this.showFloatingText(target.x, target.y - 45, "MARKED", "#ff3344");
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
    const proj = withOnHit(
      createProjectile(
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
      ),
      { stressOnHit: slot.stressOnHit, bonusDamageVsUnshielded: 0 },
    );
    this.projectiles.push(proj);
    consumeOrdnanceCharge(slot);
    const sprite = this.add.graphics();
    drawEnergyOrb(sprite, {
      color: ship.faction === this.playerFaction ? 0xffcc00 : 0xaaff00,
      radius: 4,
    });
    sprite.setPosition(proj.x, proj.y);
    sprite.setDepth(5);
    this.projectileSprites.set(proj.id, sprite);
  }

  private updateShips(deltaMs: number): void {
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;

      // Update cooldowns
      ship.control = updateCooldowns(ship.control, deltaMs);
      const wasReady = ship.ordnanceSlots.map(canFireOrdnance);
      tickOrdnanceCooldowns(ship.ordnanceSlots, deltaMs);
      if (ship.id === this.playerShipId) {
        const becameReady = ship.ordnanceSlots.some(
          (slot, i) => !wasReady[i] && canFireOrdnance(slot),
        );
        if (becameReady) audioManager.playSound("powerup", 0.3);
      }
      if (ship.turretSlot) tickTurretCooldown(ship.turretSlot, deltaMs);

      // Dead in the water: a disabled engines system halts all movement.
      const enginesOffline =
        ship.capitalSystems != null && isEnginesOffline(ship.capitalSystems);

      if (!enginesOffline) {
        // Discrete maneuver cycle, always executing (shared with the flight
        // telemetry battery, so tests fly exactly what the scene flies).
        const { state, completed } = stepMotion(
          ship,
          ship,
          deltaMs,
          BATTLEFIELD_SIZE,
        );
        ship.x = state.x;
        ship.y = state.y;
        ship.angle = state.angle;
        ship.control = state.control;

        if (completed && ship.id === this.playerShipId) {
          this.pilotControl = onPilotCycleCommitted(
            this.pilotControl,
            state.control.currentManeuver ?? "straight",
          );
        } else if (completed) {
          this.botFleet?.onCycleCommitted(
            ship.id,
            state.control.currentManeuver ?? "straight",
          );
        }

        if (completed) {
          ship.stress = accrueCycleStress({
            stress: ship.stress,
            direction: completed.direction,
            speed: completed.speed,
            dial: ship.shipDial,
            reliefTiers:
              (this.activeAuras.get(ship.id)?.stressReliefTiers ?? 0) +
              ship.modifiers.stressReliefTiers,
            rateMultiplier: ship.modifiers.stressRateMultiplier,
            cycleMs: CYCLE_DURATION_MS,
          });
        }
      }

      this.repairFeedback?.selfRepair(ship, deltaMs);

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
        isUnique: ship.isUniquePilot,
        equippedUpgrades: ship.upgradeIds,
        hull: ship.hull,
        shields: ship.shields,
        maxShields: ship.maxShields,
        systemsOnline: ship.capitalSystems
          ? !isBridgeOffline(ship.capitalSystems)
          : true,
      });
    }

    const { buffs, coveredShipIds } = resolveSupportAuras(snapshot);
    this.activeAuras = buffs;

    const playerCovered = this.playerShipId
      ? coveredShipIds.has(this.playerShipId)
      : false;
    if (playerCovered && !this.playerWasAuraCovered) {
      audioManager.playSound("powerup", 0.35);
    }
    this.playerWasAuraCovered = playerCovered;

    for (const [id, aura] of buffs) {
      const ship = this.ships.get(id);
      if (!ship) continue;
      // Capital hull is the sum of its systems; repair crews own that pool.
      const rates = ship.capitalSystems
        ? { ...aura, hullRepairPerSecond: 0 }
        : aura;
      this.repairFeedback?.auraRepair(ship, rates, deltaMs);
    }
  }

  /**
   * Extra laser damage the attacker's pilot ability earns on this hit.
   *
   * @param proj - The bolt that hit.
   * @param attacker - Who fired it (undefined once destroyed).
   * @param target - The ship hit.
   * @returns Extra damage (0 for ordnance, or when no condition holds).
   */
  private abilityHitBonus(
    proj: Projectile,
    attacker: ArcadeShip | undefined,
    target: ArcadeShip,
  ): number {
    if (!proj.isLaser || !attacker || attacker.hull <= 0) return 0;
    return laserHitBonus({
      attacker,
      target,
      attackerHasWingman: this.fliesWithWingman(attacker),
      nowMs: this.time.now,
    });
  }

  /**
   * @param ship - The ship asking.
   * @returns Whether another ship of its side flies within wingman range.
   */
  private fliesWithWingman(ship: ArcadeShip): boolean {
    return hasWingman(
      ship,
      this.frameCache?.aliveByFaction.get(ship.faction) ?? [],
    );
  }

  /**
   * Pilot-ability effects of a kill: the killer's reward (shields, frenzy)
   * and the victim's death blast on nearby enemies.
   *
   * @param attacker - Who made the kill (undefined once destroyed).
   * @param victim - The ship just destroyed.
   */
  private resolveAbilityKill(
    attacker: ArcadeShip | undefined,
    victim: ArcadeShip,
  ): void {
    if (attacker && attacker.hull > 0) {
      Object.assign(attacker, rewardKill(attacker, this.time.now));
    }
    const enemies = this.frameCache?.aliveEnemiesOf(victim.faction) ?? [];
    const blast = deathBlastDamage(victim);
    for (const target of deathBlastTargets(victim, enemies)) {
      const ship = this.ships.get(target.id);
      if (ship) this.applyBlastDamage(ship, blast);
    }
  }

  /**
   * Blast damage: shields first, then hull (capital hulls through their
   * subsystems). A ship destroyed by the blast counts as a kill for the
   * victim's side.
   *
   * @param target - Ship caught in the blast.
   * @param damage - Blast damage (already at ordnance scale).
   */
  private applyBlastDamage(target: ArcadeShip, damage: number): void {
    if (target.hull <= 0) return;
    const absorbed = Math.min(target.shields, damage);
    target.shields -= absorbed;
    const toHull = damage - absorbed;
    if (target.capitalSystems) {
      target.capitalSystems = applyCapitalSystemDamage(
        target.capitalSystems,
        toHull,
      ).systems;
      target.hull = sumSystemsHull(target.capitalSystems);
    } else {
      target.hull = Math.max(0, target.hull - toHull);
    }
    this.damageThisFrame = true;
    if (this.damageNumbersEnabled) {
      this.showFloatingText(target.x, target.y - 20, `-${damage}`, "#ff8800");
    }
    if (target.hull <= 0) this.recordDestruction(target);
  }

  /**
   * Bookkeeping for a destroyed ship: its point cost goes to the other side's
   * score and it drops out of the hit-immunity ledger.
   *
   * @param target - The ship just destroyed.
   */
  private recordDestruction(target: ArcadeShip): void {
    if (target.faction === this.playerFaction) {
      this.enemySideScore = creditKill(
        this.enemySideScore,
        target.definitionId,
      );
    } else {
      this.playerSideScore = creditKill(
        this.playerSideScore,
        target.definitionId,
      );
    }
    this.hitLedger.forget(target.id);
    this.botFleet?.forget(target.id);
  }

  /**
   * The damage levers on a projectile hit (ShotLevers): the mark bonus when
   * the attacker's side marked the target, the rear-arc bonus when it came
   * from the target's tail. The hit-chance levers do not apply to real
   * projectiles — whether a shot lands is the pilot's aim.
   *
   * @param proj - The projectile that struck.
   * @param ship - The ship struck.
   * @returns Extra damage (0 when neither lever holds).
   */
  private leverHitBonus(proj: Projectile, ship: ArcadeShip): number {
    const marked =
      this.botFleet?.isMarkedBy(
        proj.ownerFaction,
        ship.id,
        this.battleClockMs,
      ) ?? false;
    return projectileLeverBonus({
      projectile: proj,
      target: ship,
      marked,
      worldSize: BATTLEFIELD_SIZE,
      baseDamage: proj.damage,
    });
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

  /**
   * The AI's turn this tick: every faction's squad command re-plans and
   * updates its mark, then every AI ship's bot pilot flies one frame through
   * the player's controls and the ship fires at what its pilot is after.
   *
   * @param deltaMs - Tick length (ms).
   */
  private updateAI(deltaMs: number): void {
    const fleet = this.botFleet;
    if (!fleet || !this.frameCache) return;
    fleet.command(
      this.battleClockMs,
      [...this.ships.values()].map(toBotContact),
    );
    for (const ship of this.ships.values()) {
      if (ship.owner === "player" || ship.hull <= 0) continue;
      this.flyAiShip(fleet, ship, deltaMs);
      this.fireAiWeapons(fleet, ship);
    }
  }

  /**
   * One frame of an AI ship's bot pilot: the same flight controls, stress
   * and effects the player's ship flies with.
   *
   * @param fleet - The battle's AI.
   * @param ship - The AI ship.
   * @param deltaMs - Tick length (ms).
   */
  private flyAiShip(
    fleet: ArcadeBotFleet,
    ship: ArcadeShip,
    deltaMs: number,
  ): void {
    const result = fleet.fly({
      self: toBotContact(ship),
      flight: { motion: ship, stress: ship.stress },
      dial: ship.shipDial,
      nowMs: this.battleClockMs,
      deltaMs,
    });
    this.applyFlightResult(ship, result);
  }

  /**
   * An AI ship's weapons: one laser attack per cycle, spent on a firing
   * solution — its pilot's target first, else the nearest other enemy it
   * has a solution on — and ordnance at its pilot's target when it is
   * inside the launch cone and reach (homing ordnance locks that target).
   *
   * @param fleet - The battle's AI.
   * @param ship - The AI ship.
   */
  private fireAiWeapons(fleet: ArcadeBotFleet, ship: ArcadeShip): void {
    const targetId = fleet.targetIdFor(ship.id, ship.faction);
    const enemies = this.attackableEnemiesOf(ship);
    if (canFire(ship.control)) {
      const shot = pickAiShot(
        firingBodyOf(ship),
        enemies.map((enemy) => ({ ...firingBodyOf(enemy), id: enemy.id })),
        targetId,
        { boltSpeed: LASER_BOLT_SPEED_PX_PER_S, worldSize: BATTLEFIELD_SIZE },
      );
      if (shot) {
        ship.control = processCommand(ship, ship.control, "fire");
        this.fireWeapon(ship, shot.aim);
      }
    }
    const target = enemies.find((enemy) => enemy.id === targetId);
    if (!target || !ordnanceInReach(ship, target, BATTLEFIELD_SIZE)) return;
    const slotIndex = ship.ordnanceSlots.findIndex(canFireOrdnance);
    if (slotIndex >= 0) this.fireOrdnance(ship, slotIndex, target);
  }

  /**
   * @param ship - The attacking ship.
   * @returns Living enemies of the ship that are not immune to it this cycle.
   */
  private attackableEnemiesOf(ship: ArcadeShip): ArcadeShip[] {
    const enemies: ArcadeShip[] = [];
    for (const view of this.frameCache?.aliveEnemiesOf(ship.faction) ?? []) {
      const enemy = this.ships.get(view.id);
      if (enemy && enemy.hull > 0 && !this.isImmuneTo(ship, enemy))
        enemies.push(enemy);
    }
    return enemies;
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

  /**
   * Fires the primary laser from the ship's nose.
   *
   * @param ship - The firing ship.
   * @param aimAngle - Bolt heading (°); the nose by default, an AI's
   *   lead-intercept bearing when it has a firing solution.
   */
  private fireWeapon(ship: ArcadeShip, aimAngle: number = ship.angle): void {
    // Firing breaks cloak
    ship.isCloaked = false;
    ship.cloakTimer = 0;
    // Forward laser damage capped at 2 — secondary weapons handle higher burst.
    // Stressed pilots shoot less accurately: 25% damage penalty.
    const baseAttack =
      getShipDefinition(ship.definitionId)?.baseStats.attack ?? 2;
    const stressMult = ship.stress.isStressed ? 0.75 : 1;
    const auraBonus = this.activeAuras.get(ship.id)?.damageBonus ?? 0;
    const baseDamage =
      Math.max(1, Math.round(Math.min(baseAttack, 2) * stressMult)) + auraBonus;
    const damage = laserDamageWithModifiers(
      baseDamage,
      ship.modifiers,
      ship.stress.isStressed,
    );
    // Spawn projectile from ship nose
    const rad = (ship.angle - 90) * (Math.PI / 180);
    const spawnDist = 20;
    const proj = {
      ...withOnHit(
        createProjectile(
          ship.x + Math.cos(rad) * spawnDist,
          ship.y + Math.sin(rad) * spawnDist,
          aimAngle,
          ship.id,
          ship.faction,
          damage,
        ),
        {
          stressOnHit: ship.modifiers.stressOnHit,
          bonusDamageVsUnshielded: ship.modifiers.bonusDamageVsUnshielded,
        },
      ),
      isLaser: true,
    };

    this.projectiles.push(proj);

    // Create sprite — a rounded, rimmed bolt aligned with travel direction
    const sprite = this.add.graphics();
    drawEnergyBolt(sprite, {
      color: ship.faction === this.playerFaction ? 0xff8800 : 0x00ff88,
      length: CANNON_BOLT_LENGTH_PX,
      width: CANNON_BOLT_WIDTH_PX,
    });
    sprite.setPosition(proj.x, proj.y);
    sprite.setAngle(proj.angle);
    sprite.setDepth(5);
    this.projectileSprites.set(proj.id, sprite);
  }

  /**
   * Fires an ordnance slot for the given ship. Homing ordnance locks the
   * given target, else the nearest enemy in the forward arc; bombs fly
   * straight (no target).
   *
   * @param ship - The firing ship.
   * @param slotIndex - Index into ship.ordnanceSlots (0/1/2).
   * @param lockTarget - The ship a homing weapon locks (AI: its pilot's target).
   */
  private fireOrdnance(
    ship: ArcadeShip,
    slotIndex: number,
    lockTarget?: ArcadeShip,
  ): void {
    const slot = ship.ordnanceSlots[slotIndex];
    if (!slot || !canFireOrdnance(slot)) return;

    const bestTarget = slot.isHoming
      ? (lockTarget ?? this.lockTargetFor(ship))
      : null;

    consumeOrdnanceCharge(slot);

    const rad = (ship.angle - 90) * (Math.PI / 180);
    const proj = withOnHit(
      createProjectile(
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
      ),
      { stressOnHit: slot.stressOnHit, bonusDamageVsUnshielded: 0 },
    );
    this.projectiles.push(proj);

    const sprite = this.add.graphics();
    const isPlayerFaction = ship.faction === this.playerFaction;
    const missileColor = isPlayerFaction ? 0xff6600 : 0xff2200;
    const bombColor = isPlayerFaction ? 0xffcc00 : 0xaaff00;
    drawEnergyOrb(sprite, {
      color: slot.isHoming ? missileColor : bombColor,
      radius: slot.ordnanceClass === "torpedo" ? 5 : 4,
    });
    sprite.setPosition(proj.x, proj.y);
    sprite.setDepth(5);
    this.projectileSprites.set(proj.id, sprite);
  }

  /**
   * The nearest visible enemy in this ship's forward arc — what a homing
   * missile fired now locks, and what the HUD marks as the player's target.
   *
   * @param ship - The firing ship.
   * @returns The target, or null when no enemy is in the arc.
   */
  private lockTargetFor(ship: ArcadeShip): ArcadeShip | null {
    const enemies = [...this.ships.values()].filter(
      (other) =>
        other.faction !== ship.faction && other.hull > 0 && !other.isCloaked,
    );
    return nearestInArc(
      ship,
      ship.angle,
      enemies,
      TARGET_ARC_HALF_DEG,
      BATTLEFIELD_SIZE,
    );
  }

  /**
   * @param attacker - The ship about to attack.
   * @param target - Its target.
   * @returns True while the target ignores this attacker (struck this cycle).
   */
  private isImmuneTo(attacker: ArcadeShip, target: ArcadeShip): boolean {
    return this.hitLedger.isImmune(attacker.id, target.id, this.battleClockMs);
  }

  private checkCollisions(): void {
    if (!this.frameCache) return;
    const spent = new Set<string>();
    for (const proj of this.projectiles) {
      const struck = this.frameCache.aliveShips.find(
        (view) =>
          view.id !== proj.ownerId &&
          (this.ships.get(view.id)?.hull ?? 0) > 0 &&
          checkProjectileHit(
            proj,
            view.x,
            view.y,
            SHIP_HIT_RADIUS_PX,
            view.faction,
            BATTLEFIELD_SIZE,
          ),
      );
      if (!struck) continue;
      spent.add(proj.id);
      this.resolveProjectileHit(proj, this.ships.get(struck.id)!);
    }
    this.projectiles = this.projectiles.filter((p) => !spent.has(p.id));
    for (const id of spent) {
      this.projectileSprites.get(id)?.destroy();
      this.projectileSprites.delete(id);
    }
  }

  /**
   * One bolt / shot / ordnance striking a ship, under the X-Wing round
   * tempo: while the target is immune to this attacker (struck by it earlier
   * this cycle) the bolt is spent harmlessly with a deflect flash; otherwise
   * it deals damage and starts the target's immunity to that attacker.
   *
   * @param proj - The projectile that struck.
   * @param ship - The living ship it struck.
   */
  private resolveProjectileHit(proj: Projectile, ship: ArcadeShip): void {
    const now = this.battleClockMs;
    if (this.hitLedger.isImmune(proj.ownerId, ship.id, now)) {
      spawnDeflectFlash(this, proj.x, proj.y);
      return;
    }
    this.hitLedger.recordHit(proj.ownerId, ship.id, now);
    const attacker = this.ships.get(proj.ownerId);
    const damage = this.projectileHitDamage(proj, attacker, ship);
    ship.stress = applyInstantStress(ship.stress, proj.stressOnHit ?? 0);
    ship.isCloaked = false;
    ship.cloakTimer = 0;
    this.applyHitDamage(ship, damage);
    if (this.damageNumbersEnabled) {
      this.showFloatingText(ship.x, ship.y - 20, `-${damage}`, "#ff4444");
    }
    if (ship.hull <= 0) {
      if (proj.ownerFaction === this.playerFaction) {
        this.score += KILL_SCORE;
        this.showFloatingText(ship.x, ship.y - 40, "KILL!", "#ffff00");
      }
      this.resolveAbilityKill(attacker, ship);
      this.recordDestruction(ship);
    }
    if (this.cameraShakeEnabled) this.cameras.main.shake(50, 0.005);
  }

  /**
   * Damage a projectile deals: raw damage + pilot bonus + lever bonus (mark,
   * rear arc), halved against a cloaked ship, minus armour, scaled by
   * mitigation and concentrate fire.
   *
   * @param proj - The projectile.
   * @param attacker - Who fired it (undefined once destroyed).
   * @param ship - The ship struck.
   * @returns Damage, at least 1.
   */
  private projectileHitDamage(
    proj: Projectile,
    attacker: ArcadeShip | undefined,
    ship: ArcadeShip,
  ): number {
    const hitDamage =
      projectileRawDamage(proj, ship.shields) +
      this.abilityHitBonus(proj, attacker, ship) +
      this.leverHitBonus(proj, ship);
    const rawDamage = ship.isCloaked
      ? Math.max(1, Math.floor(hitDamage / 2))
      : hitDamage;
    const armor = getShipDefinition(ship.definitionId)?.baseStats.armor ?? 0;
    const armoredDamage = Math.max(1, rawDamage - armor);
    const mitigation = Math.max(
      MIN_DAMAGE_TAKEN_MULTIPLIER,
      (this.activeAuras.get(ship.id)?.damageTakenMultiplier ?? 1) *
        incomingDamageMultiplier(ship.modifiers, this.fliesWithWingman(ship)),
    );
    const attackerOrders = attacker?.commanderOrders;
    const concentrateMultiplier = attackerOrders
      ? concentrateFireMultiplier(
          attackerOrders.concentrateFire,
          ship.id,
          this.time.now,
        )
      : 1;
    return Math.max(
      1,
      Math.round(armoredDamage * mitigation * concentrateMultiplier),
    );
  }

  /**
   * Apply hit damage: shields absorb the whole hit while up, then hull
   * (capital hulls through their subsystems).
   *
   * @param ship - The ship struck.
   * @param damage - Damage to apply.
   */
  private applyHitDamage(ship: ArcadeShip, damage: number): void {
    if (ship.shields > 0) {
      ship.shields = Math.max(0, ship.shields - damage);
      audioManager.playSoundAt("shield_hit", ship.x, ship.y, 0.4);
      return;
    }
    this.damageThisFrame = true;
    audioManager.playSoundAt("hull_hit", ship.x, ship.y, 0.4);
    if (!ship.capitalSystems) {
      ship.hull = Math.max(0, ship.hull - damage);
      return;
    }
    const result = applyCapitalSystemDamage(ship.capitalSystems, damage);
    ship.capitalSystems = result.systems;
    ship.hull = sumSystemsHull(result.systems);
    if (result.justDisabled && result.hitSystemId) {
      this.showFloatingText(
        ship.x,
        ship.y - 45,
        `${SYSTEM_LABELS[result.hitSystemId]} DISABLED!`,
        "#ff8800",
      );
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
    this.scenario?.deploy([...this.ships.values()], this.playerFaction);

    for (const ship of this.ships.values()) {
      this.createShipSprite(ship);
    }
    this.botFleet = this.createBotFleet();
    this.scenario?.attachFleet(this.botFleet);
  }

  /**
   * The battle's AI: difficulty and seed from the battle config (Squad
   * Builder sets `aiDifficulty`; online rooms set `seed`), and a bot pilot
   * for every AI-flown ship.
   *
   * @returns The fleet, every AI ship enlisted.
   */
  private createBotFleet(): ArcadeBotFleet {
    const config = this.registry.get("battleConfig") as
      { aiDifficulty?: string; seed?: number } | undefined;
    const seed =
      config?.seed ?? Math.floor(Math.random() * RANDOM_BATTLE_SEED_RANGE);
    const fleet = new ArcadeBotFleet({
      difficulty: config?.aiDifficulty ?? DEFAULT_SKIRMISH_DIFFICULTY,
      playerFaction: this.playerFaction,
      random: createSeededRng(seed).next,
      worldSize: BATTLEFIELD_SIZE,
    });
    for (const ship of this.ships.values()) {
      if (ship.owner === "ai") fleet.enlist(ship.id, ship.faction);
    }
    return fleet;
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
    playerShip.hull = playerShip.maxHull = Math.max(
      PLAYER_HULL_FLOOR,
      playerShip.maxHull,
    );
    playerShip.shields = playerShip.maxShields = Math.max(
      PLAYER_SHIELD_FLOOR,
      playerShip.maxShields,
    );
    this.equipLoadout(playerShip, playerSlot.loadoutChoices?.["0"]);
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
      this.equipLoadout(ally, playerSlot.loadoutChoices?.[String(i + 1)]);
      // Arcade wingman hull floor — glass-cannon light fighters (hull 2) get
      // one-shot by any decent burst. Bumps floor so wingmen survive a hit.
      ally.hull = ally.maxHull = Math.max(WINGMAN_HULL_FLOOR, ally.maxHull);
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
        this.equipLoadout(enemy, slot.loadoutChoices?.[String(shipIdx)]);
        this.ships.set(enemy.id, enemy);
        enemyIndex++;
      });
    }
  }

  /**
   * Equips a loadout on a freshly created ship: stat bonuses, the real-time
   * modifier sheet (upgrades + the pilot's ability), upgraded maneuver recharge times, and the
   * ordnance/turret weapons with their reload modifiers baked in.
   *
   * @param ship - The ship to equip (mutated in place, before first update).
   * @param loadoutId - Chosen loadout id, or undefined for the bare ship.
   */
  private equipLoadout(ship: ArcadeShip, loadoutId: string | undefined): void {
    applyLoadoutEffects(ship, loadoutId);
    const upgradeIds = loadoutUpgradeIds(ship.definitionId, loadoutId);
    const modifiers = resolveLoadoutModifiers(ship.definitionId, loadoutId);
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
    // One attack per maneuver cycle: no weapon may reload faster than that.
    ship.turretSlot = turret && {
      ...turret,
      cooldownMax: attackIntervalMs(turret.cooldownMax),
    };
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
    playerShip.hull = playerShip.maxHull = DEFAULT_SQUAD_DURABILITY.player.hull;
    playerShip.shields = playerShip.maxShields =
      DEFAULT_SQUAD_DURABILITY.player.shields;
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
      ally.hull = ally.maxHull = DEFAULT_SQUAD_DURABILITY.wingman.hull;
      ally.shields = ally.maxShields = DEFAULT_SQUAD_DURABILITY.wingman.shields;
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
    const durability = realTimeDurability(def?.baseStats);
    const baseShip: ShipState = {
      id,
      definitionId: defId,
      faction,
      owner,
      x,
      y,
      angle,
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

    const ship: ArcadeShip = {
      ...baseShip,
      control: createControlState(
        baseShip,
        SHIP_SIZES[def?.baseStats.size ?? "small"] ?? 32,
        getMovementProfile(defId),
        def?.baseStats.speed ?? { min: 1, max: 5 },
      ),
      ordnanceSlots: [],
      turretSlot: null,
      crewMode: "pilot",
      role: def?.role ?? "heavy_fighter",
      stress: INITIAL_STRESS,
      shipDial: getShipDial(defId),
      cloakTimer: 0,
      capitalSystems:
        def?.role === "capital" ? createCapitalSystems(baseShip.hull) : null,
      commanderOrders: def?.role === "capital" ? createCommanderOrders() : null,
      upgradeIds: [],
      modifiers: NEUTRAL_MODIFIERS,
      isUniquePilot: false,
      frenzyUntilMs: 0,
    };

    return ship;
  }

  private createShipSprite(ship: ArcadeShip): void {
    const container = this.add.container(
      ship.x,
      ship.y,
    ) as unknown as ShipSprite;
    container.shipId = ship.id;

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
    const visual = addShipVisual(this, container, {
      definitionId: ship.definitionId,
      faction: ship.faction as FactionId,
      fallbackSizeName: shipDef?.baseStats.size ?? "small",
      size,
      isPlayer: ship.owner === "player",
    });
    if (visual.ring) container.ring = visual.ring; // stored for per-frame stress pulse
    container.hull = visual.hull;
    container.image = visual.image;
    container.imageBaseScaleX = visual.image?.scaleX ?? 1;
    container.imageBaseScaleY = visual.image?.scaleY ?? 1;
    container.bankState = { ...INITIAL_BANK_STATE, lastAngle: ship.angle };
    container.setAngle(ship.angle);
    container.setDepth(10);
    container.setSize(size * 2, size * 2);
    container.setInteractive();
    ShipStatCard.attachHoverCard(this, container, ship.definitionId);

    this.shipSprites.set(ship.id, container);
  }

  private updateSprites(deltaMs: number): void {
    const markedId = this.playerMarkedTargetId;
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
        this.repairFeedback?.forget(id);

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

      // Bank into hard turns: squash the ship art horizontally and stretch
      // it vertically in proportion to turn rate, purely a visual "juice"
      // effect layered on top of the container's heading rotation.
      if (sprite.image) {
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

      // Cloaked ships: nearly invisible to enemies, dimmed for the owning player
      const isPlayer = ship.id === this.playerShipId;
      sprite.setAlpha(ship.isCloaked ? (isPlayer ? 0.45 : 0.12) : 1.0);

      // Update health bar position and values
      const healthBar = this.healthBars.get(id);
      if (healthBar) {
        healthBar.setPosition(ship.x, ship.y - 30);
        healthBar.update(ship.hull, ship.shields);
        healthBar.setTargeted(id === markedId);
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
  }

  /** Feed this frame's battle state to the holographic HUD. */
  private updateHUD(): void {
    if (!this.hud) return;
    const player = this.playerShipId
      ? (this.ships.get(this.playerShipId) ?? null)
      : null;
    this.hud.update({
      player,
      crewMode: player?.crewMode ?? "pilot",
      commanderOrders: player?.commanderOrders ?? null,
      ships: [...this.ships.values()],
      playerFaction: this.playerFaction,
      selectedWeaponSlot: this.selectedWeaponSlot,
      camera: this.cameras.main,
      score: this.score,
      remainingMs: this.scenario?.remainingMs ?? this.matchTimer.remainingMs,
      nowMs: this.time.now,
      markedId: this.playerMarkedTargetId,
    });
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
   * Auto-rotates and fires turrets for all ships equipped with one: an AI
   * ship's turret takes its pilot's target when in range, else (and on the
   * player's ship) the nearest enemy in range. Ships where the player is in
   * gunner mode are skipped — controlled via handleGunnerInput instead.
   */
  private updateTurrets(): void {
    if (!this.frameCache) return;
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0 || !ship.turretSlot) continue;
      if (ship.id === this.playerShipId && ship.crewMode === "gunner") continue;

      const target = this.turretTargetOf(ship, ship.turretSlot.range);
      if (!target) continue;

      const dx = target.x - ship.x;
      const dy = target.y - ship.y;
      ship.turretSlot.turretFacing =
        ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360;

      if (canFireTurret(ship.turretSlot)) this.fireTurretShot(ship);
    }
  }

  /**
   * @param ship - A ship with a turret.
   * @param range - The turret's range (px).
   * @returns Its AI pilot's target when alive and in range, else the
   *   nearest living enemy in range, else null.
   */
  private turretTargetOf(ship: ArcadeShip, range: number): ArcadeShip | null {
    const inRange = (other: ArcadeShip | undefined): other is ArcadeShip =>
      !!other &&
      other.hull > 0 &&
      distance(ship.x, ship.y, other.x, other.y) < range;
    const pilotTargetId =
      ship.owner === "ai"
        ? this.botFleet?.targetIdFor(ship.id, ship.faction)
        : null;
    const pilotTarget = pilotTargetId
      ? this.ships.get(pilotTargetId)
      : undefined;
    if (inRange(pilotTarget)) return pilotTarget;
    let nearest: ArcadeShip | null = null;
    let nearestDist = range;
    for (const view of this.frameCache?.aliveEnemiesOf(ship.faction) ?? []) {
      const dist = distance(ship.x, ship.y, view.x, view.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = this.ships.get(view.id) ?? null;
      }
    }
    return nearest;
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
    const proj = withOnHit(
      createProjectile(
        ship.x + Math.cos(rad) * 20,
        ship.y + Math.sin(rad) * 20,
        ship.turretSlot.turretFacing,
        ship.id,
        ship.faction,
        damage,
      ),
      { stressOnHit: ship.turretSlot.stressOnHit, bonusDamageVsUnshielded: 0 },
    );
    this.projectiles.push(proj);

    const sprite = this.add.graphics();
    drawEnergyOrb(sprite, {
      color: ship.faction === this.playerFaction ? 0x00ffff : 0xff00ff,
      radius: 3,
    });
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

    const beforeRepair = { hull: ship.hull, shields: ship.shields };
    if (
      this.consumeEdge("COMMANDER_ORDER_4") &&
      canEmergencyRepair(orders.lastEmergencyRepairAt, now) &&
      ship.capitalSystems
    ) {
      ship.shields = Math.min(
        ship.maxShields,
        ship.shields + EMERGENCY_SHIELD_REPAIR,
      );
      const worst = mostDamagedSystem(ship.capitalSystems);
      ship.capitalSystems = repairCapitalSystem(
        ship.capitalSystems,
        worst,
        EMERGENCY_HULL_REPAIR,
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
          (ENGINE_REPAIR_PER_SECOND * deltaMs) / 1000,
        );
        ship.hull = sumSystemsHull(ship.capitalSystems);
      }
      if (isPowerFocused(orders.powerRedirect, "shields", now)) {
        ship.shields = regenerateScaledShields(
          ship.shields,
          ship.maxShields,
          POWER_SHIELD_REGEN_PER_SECOND,
          deltaMs,
        );
      }
    }
    this.repairFeedback?.reportRepair(ship, beforeRepair, {
      kind: "damage_control",
      sourceShipId: null,
    });
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
      MAIN_BEAM_HIT_DAMAGE,
    );
    this.projectiles.push(proj);

    const sprite = this.add.graphics();
    drawEnergyOrb(sprite, { color: 0x99ddff, radius: 7 });
    sprite.setPosition(proj.x, proj.y);
    sprite.setDepth(5);
    this.projectileSprites.set(proj.id, sprite);

    this.showFloatingText(ship.x, ship.y - 45, "MAIN BEAM FIRED!", "#ffffff");
  }

  private updateFleeDetector(deltaMs: number): void {
    if (!this.frameCache || this.gameEnded) return;
    const player = this.playerShipId ? this.ships.get(this.playerShipId) : null;
    if (!player || player.hull <= 0) {
      // No player alive → flee doesn't apply; regular victory check handles it
      this.hud?.hideFleeWarning();
      return;
    }

    const nearest = this.nearestEnemyOffset(player);
    this.fleeState = updateFleeState(this.fleeState, {
      deltaMs,
      damageThisFrame: this.damageThisFrame,
      playerNearestEnemyDist: nearest?.distance ?? Infinity,
    });

    if (this.fleeState.isWarning && !this.fleeState.hasFled) {
      this.hud?.showFleeWarning(
        fleeSecondsRemaining(this.fleeState),
        nearest ? Math.atan2(nearest.dy, nearest.dx) : null,
      );
    } else {
      this.hud?.hideFleeWarning();
    }

    if (this.fleeState.hasFled) {
      this.gameEnded = true;
      this.showEndScreen(false);
    }
  }

  /**
   * Torus-shortest offset from the player to the nearest living enemy.
   *
   * @param player - The player's ship.
   * @returns Offset and distance, or null when no enemy is alive.
   */
  private nearestEnemyOffset(
    player: ArcadeShip,
  ): { dx: number; dy: number; distance: number } | null {
    let best: { dx: number; dy: number; distance: number } | null = null;
    for (const s of this.frameCache?.aliveShips ?? []) {
      if (s.faction === this.playerFaction) continue;
      const { dx, dy } = torusDelta(
        player.x,
        player.y,
        s.x,
        s.y,
        BATTLEFIELD_SIZE,
      );
      const distance = Math.hypot(dx, dy);
      if (!best || distance < best.distance) best = { dx, dy, distance };
    }
    return best;
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
    if (this.matchTimer.expired) {
      this.gameEnded = true;
      const outcome = resolveByPoints(
        this.playerSideScore,
        this.enemySideScore,
      );
      this.showEndScreen(outcome === "side1");
    }
  }

  /** Award global progression XP for this battle (score is exactly KILL_SCORE per kill). */
  private awardProgressionXp(victory: boolean): void {
    try {
      const kills = Math.max(0, Math.floor(this.score / KILL_SCORE));
      const active = PlayerProfileManager.getActive();
      PlayerProfileManager.awardBattleResult(active.id, {
        kills,
        won: victory,
      });
    } catch (e) {
      console.error("Failed to award progression XP:", e);
    }
  }

  /**
   * Show the victory / defeat screen. The battle HUD is hidden and the
   * camera returns to zoom 1 so the overlay buttons hit-test correctly.
   *
   * @param victory - Whether the player's side won.
   */
  private showEndScreen(victory: boolean): void {
    trackModeEnd("skirmish", victory ? "victory" : "defeat", {
      score: this.score,
    });
    this.cameras.main.setZoom(1.0);
    audioManager.playFactionStinger(
      this.playerFaction,
      victory ? "victory" : "defeat",
    );
    this.awardProgressionXp(victory);
    this.hud?.hideFleeWarning();
    this.hud?.setVisible(false);
    const onRetry = (): void => {
      this.scene.start("ArcadeBattleScene");
    };
    const onMenu = (): void => {
      this.scene.start("MainMenuScene");
    };
    if (this.scenario?.showResult({ onRetry, onMenu })) return;
    createEndOverlay(this, {
      victory,
      score: this.score,
      pointsDestroyed: this.playerSideScore.destroyedPoints,
      pointsLost: this.enemySideScore.destroyedPoints,
      onRetry,
      onMenu,
    });
  }
}
