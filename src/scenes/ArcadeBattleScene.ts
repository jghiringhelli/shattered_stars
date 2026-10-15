/**
 * Arcade Battle Scene
 * Real-time dogfighting with direct ship control
 */

import { imageBaseScale, recordBaseScale } from "../assets/baseScale";
import Phaser from "phaser";
import { ShipStatCard } from "../ui/ShipStatCard";
import { addShipVisual } from "../rendering/ShipVisual";
import {
  INITIAL_BANK_STATE,
  updateBankState,
  bankSquashFor,
  type BankState,
} from "../rendering/ShipBanking";
import { updateCooldowns } from "../core/ArcadeControls";
import {
  type GestureState,
  INITIAL_GESTURE_STATE,
} from "../arcade/ArcadeInputGestures";
import { playFlightEventFx } from "../arcade/ArcadeFX";
import {
  drawEnergyBolt,
  CANNON_BOLT_LENGTH_PX,
  CANNON_BOLT_WIDTH_PX,
} from "../rendering/BoltRenderer";
import { InputManager } from "../input/InputManager";
import { BattlePauseMenu } from "./battleUi/BattlePauseMenu";
import { setupSceneInput, teardownSceneInput } from "../input/setupSceneInput";
import { trackModeEnd, trackModeStart } from "../telemetry/telemetry";
import { matchStats } from "../telemetry/matchTelemetry";
import { dealerOf } from "../telemetry/matchStatTypes";
import { cycleEvent, stressEvent } from "../telemetry/matchEvents";
import type { ActionIntent } from "../input/InputTypes";
import { getShipDefinition } from "../data/ShipDefinitions";
import { calculateHitChance } from "../data/ModeBalancing";
import { applyInstantStress, accrueCycleStress } from "../arcade/ArcadeStress";
import {
  deathBlastDamage,
  deathBlastTargets,
  hasWingman,
  rewardKill,
} from "../arcade/PilotAbilityCombat";
import { absorbDamage, resolveDiceAttack } from "../arcade/systems/DiceAttack";
import {
  armorReductionOf,
  damageMitigationOf,
} from "../arcade/systems/DamageRules";
import { attackIntervalMs } from "../arcade/systems/CombatTempo";
import { nearestTargetInArc } from "../arcade/systems/ArcTargeting";
import { torusRangePx } from "../arcade/weapons/FiringGeometry";
import type {
  BattleWeapons,
  BattleWeaponsLink,
  WeaponHit,
} from "./battleUi/BattleWeapons";
import {
  createSceneWeapons,
  weaponBarSlots,
  weaponBodyOf,
} from "./battleUi/sceneWeapons";
import { primaryWeaponSlot } from "./battleUi/hudSnapshot";
import { assignQuickBuilds } from "../arcade/systems/QuickBuildEquip";
import {
  BATTLEFIELD_SIZE,
  CYCLE_DURATION_MS,
  RANGE_3,
  SHIP_SIZES,
  type FactionId,
  type ShipSize,
} from "../config";
import { HealthBar } from "../ui/HealthBar";
import { ShipRepairFeedback, overlaySide } from "../ui/hud/overlay";
import { CapitalSystemsIndicator } from "../ui/CapitalSystemsIndicator";
import {
  applyCapitalSystemDamage,
  repairCapitalSystem,
  mostDamagedSystem,
  isEnginesOffline,
  isBridgeOffline,
  turretDamageMultiplier,
  sumSystemsHull,
  SYSTEM_LABELS,
} from "../systems/CapitalSystems";
import {
  getAvailableCrewRoles,
  nextCrewRole,
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
import { installBattleSpace } from "../rendering/spaceMap/installBattleSpace";
import { stepMotion } from "../arcade/systems/ShipMotion";
import { planFixedSteps } from "../arcade/systems/FixedStepPlan";
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
  "BARREL_ROLL_LEFT",
  "BARREL_ROLL_RIGHT",
];
import { cooldownsOf } from "../input/flightCooldowns";
import { audioManager } from "../audio/AudioManager";
import { hullFractionOf } from "../audio/musicContexts";
import { syncListenerToCamera } from "../audio/CameraListener";
import { ShipTelemetry } from "../debug/ShipTelemetry";
import { type AuraShip, type ActiveAura } from "../systems/SupportAura";
import { auraFactsOf } from "../systems/aura/AuraShipFacts";
import { HitImmunityLedger } from "../arcade/systems/CombatTempo";
import {
  EMERGENCY_HULL_REPAIR,
  EMERGENCY_SHIELD_REPAIR,
  ENGINE_REPAIR_PER_SECOND,
  MAIN_BEAM_HIT_DAMAGE,
  POWER_SHIELD_REGEN_PER_SECOND,
  regenerateScaledShields,
} from "./arcadeBattle/arcadeDurability";
import {
  ArcadeBattleHud,
  type ArcadeHudReadout,
} from "./arcadeBattle/ArcadeBattleHud";
import { showResultsPanel, type ResultsActions } from "../ui/results/ResultsPanel";
import { resultRows } from "../ui/results/resultsModel";
import { spawnDeflectFlash } from "./arcadeBattle/hitFx";
import {
  ArcadeBotFleet,
  DEFAULT_SKIRMISH_DIFFICULTY,
} from "./arcadeBattle/ArcadeBotFleet";
import { toBotContact } from "./arcadeBattle/arcadeBotContact";
import { selectHudTargetId } from "./arcadeBattle/arcadeHudModel";
import {
  createRng,
  createSeededRng,
  random,
  setDefaultRng,
} from "../utils/random";
import type { WeaponSlotDescriptor } from "../ui/hud/types";
import {
  createScenarioController,
  type ScenarioController,
  type ScenarioSceneLink,
} from "./scenario/ScenarioController";
import type { ScenarioReadout } from "./scenario/scenarioReadout";
import type { ScreenRect } from "../ui/hud/screenRect";
import {
  spawnArcadeShip,
  type ArcadeShip,
} from "./arcadeBattle/arcadeShipFactory";
import {
  createReinforcementController,
  type ReinforcementController,
} from "./arcadeBattle/reinforcements/ReinforcementController";
import type { ReinforcementSceneLink } from "./arcadeBattle/reinforcements/reinforcementLink";
import type { ReinforcementReadout } from "./arcadeBattle/reinforcements/reinforcementReadout";
import { reinforcementShipIds } from "./arcadeBattle/reinforcements/reinforcementSetup";
import { parseReinforcementSetup } from "../arcade/reinforcements";
import {
  ArcadeOnline,
  readOnlineBattle,
  type PilotKeys,
} from "./arcadeBattle/online/ArcadeOnline";
import {
  planSquadDeployment,
  type SquadSlot,
} from "./arcadeBattle/squadDeployment";
import { resolveTeamAuras, teamKey, type TeamId } from "../arcade/teams";
import {
  hashArcade,
  readSimFields,
  REINFORCEMENT_SIM_FIELDS,
  SCENARIO_SIM_FIELDS,
  writeSimFields,
} from "./arcadeBattle/online/arcadeLockstep";
import { getOnlineSession } from "../net/lobby/createOnlineSession";
import {
  startOnlineBattle,
  type OnlineBattleDebug,
  type OnlineBattleLink,
} from "../net/battle/OnlineBattleLink";
import { PILOT_COMMANDS } from "../net/input/PilotInputCodec";
import type { LockstepSimulation } from "../net/lockstep/types";
import { captureGraph, restoreGraph } from "../net/lockstep/StateGraph";
import type { TickInput } from "../net/protocol";
import { ONLINE_GRAPH_OPTIONS } from "./online/onlineGraph";
import { OnlineNoticeView } from "./online/OnlineNoticeView";
import {
  confirmLeaveOnlineBattle,
  ONLINE_LOBBY_SCENE,
} from "./online/onlineExit";

interface ShipSprite extends Phaser.GameObjects.Container {
  shipId: string;
  hull: Phaser.GameObjects.Graphics;
  thruster: Phaser.GameObjects.Graphics;
  healthBar?: HealthBar;
  /** Faction-colored identification ring — alpha is modulated when pilot is stressed. */
  ring?: Phaser.GameObjects.Graphics;
  /** Ship art image, when loaded — squashed/stretched by the banking effect on hard turns. */
  image?: Phaser.GameObjects.Image | null;
  bankState: BankState;
}

/** Score for each enemy the player's side destroys. */
/** Gunner crew turret traverse (degrees per second). */
const GUNNER_TURN_DEG_PER_S = 180;
/** The capital main beam reaches twice X-Wing range 3. */
const MAIN_BEAM_RANGE_PX = 2 * RANGE_3;
const MAIN_BEAM_COLOR = 0x99ddff;
const PLAYER_LASER_COLOR = 0xff8800;
const ENEMY_LASER_COLOR = 0x00ff88;
/** Time a primary bolt takes to reach its target (ms, visual only). */
const LASER_BOLT_FLIGHT_MS = 110;
/** Bolt graphics point "up"; screen atan2 0 points right. */
const NORTH_UP_OFFSET_DEG = 90;
const KILL_SCORE = 100;
/** The battle a config without squads flies: a Confederation trio vs a Hegemony trio. */
const DEFAULT_SQUADS: readonly SquadSlot[] = [
  {
    factionId: "free_confederation",
    controller: "player",
    ships: ["confed_sparrow", "confed_wasp", "confed_wasp"],
  },
  {
    factionId: "terran_hegemony",
    controller: "ai",
    ships: ["terran_gladius", "terran_viper", "terran_viper"],
  },
];
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
 * @param slot - A side of the battle config.
 * @returns One quick build per ship: the Squad Builder's pick, else the
 *   ship's default build (unique pilots never fly twice).
 */
function quickBuildsOf(slot: {
  readonly ships: readonly string[];
  readonly loadoutChoices?: Record<string, string>;
}): (string | null)[] {
  return assignQuickBuilds(
    slot.ships,
    slot.ships.map((_, index) => slot.loadoutChoices?.[String(index)]),
  );
}

export class ArcadeBattleScene extends Phaser.Scene {
  private ships: Map<string, ArcadeShip> = new Map();
  private shipSprites: Map<string, ShipSprite> = new Map();
  private telemetry: ShipTelemetry | null = null;
  /** Secondary weapons (missiles, torpedoes, turrets, bombs, mines, cloak). */
  private weapons: BattleWeapons | null = null;
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
      if (s.owner === "ai" && s.team !== this.playerTeam) out.push(s.id);
    }
    return out;
  }
  /**
   * Edge-triggered intents (KTURN, SHARP_TURN_*, SEGNOR_*, TALLON_*,
   * CREW_CYCLE, COMMANDER_ORDER_*, MARK_TARGET (weapon keys go to the
   * shared BattleWeapons), plus
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
    "BARREL_ROLL_LEFT",
    "BARREL_ROLL_RIGHT",
    "CREW_CYCLE",
    "COMMANDER_ORDER_1",
    "COMMANDER_ORDER_2",
    "COMMANDER_ORDER_3",
    "COMMANDER_ORDER_4",
    "MARK_TARGET",
  ]);
  private prevThrustUpHeld = false;
  private prevThrustDownHeld = false;
  private inputSubscriptionIds: number[] = [];

  /** The home squad's faction (music and stingers only — never sides). */
  private playerFaction: FactionId = "free_confederation";
  /** The simulation's "player" team (offline: the player's; online: seat 0's). */
  private playerTeam: TeamId = 0;
  /** The home squad's battle-config index. */
  private playerSquad = 0;
  /** Every battle-config squad's team (index = squad). */
  private squadTeams: TeamId[] = [];
  private score = 0;
  private lastTime = 0;
  private accumulator = 0;
  private static readonly FIXED_DT = 1000 / 60;
  private frameCache: FrameCache | null = null;
  private perfState: PerformanceState = createPerformanceState();
  private gameEnded = false;
  private isPaused = false;
  private pauseMenu: BattlePauseMenu | null = null;

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
  /** Flight-input memory (gestures, tap vs hold steering) of each human-flown ship. */
  private pilotControls = new Map<string, PilotControlState>();
  /**
   * Opt-in accessibility alternative: left+right pressed together also
   * barrel-rolls. Off by default — ← ← / → → (a double-tap) is the roll.
   */
  private allowChordBarrelRoll = false;

  /**
   * Virtual camera position in world-space.
   * Updated each frame with toroid-aware shortest-path lerp so the camera
   * never jumps across the map when a ship wraps around an edge.
   */
  private cameraVirtualX = BATTLEFIELD_SIZE / 2;
  private cameraVirtualY = BATTLEFIELD_SIZE / 2;

  /** The AI: a bot pilot per AI ship, a squad command per team, the marks. */
  private botFleet: ArcadeBotFleet | null = null;

  /** X-Wing 2.0 scenario (battleConfig.scenario), or null for a plain Skirmish. */
  private scenario: ScenarioController | null = null;

  /** Reinforcement-pool battle (battleConfig.battle), or null for a classic one. */
  private reinforcements: ReinforcementController | null = null;

  /** Debug / measurement hooks: AI flies the player's ship; battle-time speed-up. */
  debugAutopilot = false;
  debugTimeScale = 1;

  // Online battle (input lockstep through the relay): every client simulates
  // every seat from the same seed and inputs in canonical seat order — seat
  // 0's team is the simulation's "player" side; only presentation (camera,
  // HUD, own colours) reads the local seat. Null offline.
  private online: ArcadeOnline | null = null;
  private net: OnlineBattleLink | null = null;
  private notices: OnlineNoticeView | null = null;
  private leaveDialogOpen = false;
  /** This scene as the lockstep session's simulation. */
  private readonly lockstep: LockstepSimulation = {
    step: (tick, inputs) => this.stepOnline(tick, inputs),
    hash: (tick) => this.hashOnline(tick),
    snapshot: () => captureGraph(this.simGraph(), ONLINE_GRAPH_OPTIONS),
    restore: (_tick, data) => this.restoreOnline(data),
  };

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
    return this.botFleet.targetIdFor(ship.id, teamKey(ship.team));
  }

  /** The target the player's side has marked right now, or null. */
  get playerMarkedTargetId(): string | null {
    return (
      this.botFleet?.markedTargetOf(
        teamKey(this.playerTeam),
        this.battleClockMs,
      ) ?? null
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

  /** The reinforcement battle's pools, picker and result (e2e), or null in a classic battle. */
  get reinforcementReadout(): ReinforcementReadout | null {
    return this.reinforcements?.readout ?? null;
  }

  /** @returns What the scenario controller reads from (and reports to) this scene. */
  private scenarioLink(): ScenarioSceneLink {
    return {
      worldSize: BATTLEFIELD_SIZE,
      ships: () => this.ships.values(),
      playerShipId: () => this.viewShipId(),
      playerMarkedTargetId: () => this.playerMarkedTargetId,
      radarRect: () => this.hud?.layoutRects()["radar"],
      reserves: () => this.reinforcements?.reserves() ?? null,
      viewSide: () =>
        this.viewTeam() === this.playerTeam ? "player" : "enemy",
      onEnd: (result) => {
        this.gameEnded = true;
        this.finishBattle(
          result.winner === "draw" ? null : result.winner === "player",
        );
      },
    };
  }

  /** @returns What the reinforcement controller reads from (and asks of) this scene. */
  private reinforcementLink(): ReinforcementSceneLink {
    const online = this.online;
    return {
      worldSize: BATTLEFIELD_SIZE,
      playerTeam: this.playerTeam,
      squadTeams: this.squadTeams,
      humanSquads: this.humanSquads(),
      primarySquad: this.playerSquad,
      localSquad: online ? online.localSquad : this.playerSquad,
      ships: this.ships,
      hasScenario: this.scenario !== null,
      adopt: (ship, pilotSquad) => this.adoptShip(ship, pilotSquad),
      onEnd: (victory) => {
        this.gameEnded = true;
        const winner = this.reinforcements?.result?.winner;
        this.finishBattle(winner === "draw" ? null : victory);
      },
      ...(online
        ? {
            requestPick: (index: number) =>
              this.net?.queueCommand({
                op: PILOT_COMMANDS.deployReserve,
                arg: index,
              }),
          }
        : {}),
    };
  }

  /** @returns Every human squad → the ship its human flies now. */
  private humanSquads(): Map<number, string> {
    const online = this.online;
    if (!online)
      return new Map(
        this.playerShipId ? [[this.playerSquad, this.playerShipId]] : [],
      );
    const squads = new Map<number, string>();
    online.seats.forEach((_, seat) => {
      const shipId = online.shipOf(seat);
      if (shipId) squads.set(online.squadOf(seat), shipId);
    });
    return squads;
  }

  /**
   * A reinforcement warped in: its record, sprite and overlay, an AI pilot
   * (squad membership comes with its team), and — when it is a human's
   * replacement — that human's controls (offline the player's view; online
   * the seat flying that squad).
   *
   * @param ship - The new ship.
   * @param pilotSquad - The human squad whose human flies it now, or null.
   */
  private adoptShip(ship: ArcadeShip, pilotSquad: number | null): void {
    this.ships.set(ship.id, ship);
    this.armShip(ship);
    if (pilotSquad !== null) this.seatHuman(ship.id, pilotSquad);
    if (ship.owner === "ai" || this.online)
      this.botFleet?.enlist(ship.id, teamKey(ship.team));
    this.createShipSprite(ship);
    this.createHealthBar(ship);
  }

  /**
   * @param shipId - A human's replacement ship.
   * @param squad - The human's squad.
   */
  private seatHuman(shipId: string, squad: number): void {
    this.pilotControls.delete(shipId);
    const online = this.online;
    if (!online) {
      this.playerShipId = shipId;
      return;
    }
    const seat = online.seatOfSquad(squad);
    if (seat >= 0) online.assignShip(seat, shipId);
    if (seat === 0) this.playerShipId = shipId;
  }

  shutdown(): void {
    this.inputSubscriptionIds.forEach((id) => InputManager.off(id));
    this.inputSubscriptionIds = [];
    this.pendingEdgeIntents.clear();
    this.hitLedger.clear();
    this.weapons?.destroy();
    this.weapons = null;
    this.hud?.destroy();
    this.hud = null;
    this.reinforcements?.destroy();
    this.reinforcements = null;
    teardownSceneInput();
    if (!this.online) return;
    this.net?.dispose();
    this.net = null;
    this.notices?.destroy();
    this.notices = null;
    this.online = null;
    setDefaultRng(createRng());
    // A later local battle must never replay this online match's config.
    this.registry.remove("battleConfig");
  }

  /** @returns The online link's diagnostics (e2e), or null offline. */
  get onlineDebug(): OnlineBattleDebug | null {
    return this.net?.debug ?? null;
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
      reinforcementShipIds(battleConfig).forEach(loadIfMissing);
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
    const onlineBattle = readOnlineBattle(this.registry.get("battleConfig"));
    this.online = onlineBattle ? new ArcadeOnline(onlineBattle) : null;
    if (this.online) setDefaultRng(this.online.combatRng);
    trackModeStart("skirmish", this.online ? { online: true } : undefined);
    matchStats.start(
      "skirmish",
      this.online ? { online: true } : {},
      this.events,
    );

    // No setBounds — we manage the camera manually for seamless toroid wrapping.
    this.cameras.main.setBackgroundColor(0x050510);
    this.cameras.main.setZoom(1.0);

    this.createStarfield();
    this.setupInput();
    this.scenario = createScenarioController(
      this,
      this.registry.get("battleConfig"),
      this.scenarioLink(),
    );
    this.weapons = createSceneWeapons(
      this,
      this.weaponsLink(),
      this.hitLedger,
      this.online === null,
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
    audioManager.playFactionMusic(this.viewFaction(), "combat");
    this.reinforcements = createReinforcementController(
      this,
      this.registry.get("battleConfig"),
      this.reinforcementLink(),
    );

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
    const playerSprite = this.shipSprites.get(this.viewShipId() ?? "");
    if (playerSprite) {
      this.cameraVirtualX = playerSprite.x;
      this.cameraVirtualY = playerSprite.y;
      this.cameras.main.centerOn(this.cameraVirtualX, this.cameraVirtualY);
    }
    if (this.online) this.joinOnlineBattle();
  }

  /**
   * The battle is built: join the relay's lockstep session (the match
   * starts once every seat has loaded).
   */
  private joinOnlineBattle(): void {
    this.notices = new OnlineNoticeView(this);
    this.net = startOnlineBattle(getOnlineSession(this.registry), {
      intents: InputManager,
      onNotice: (notice) => this.notices?.show(notice),
      onMatchEnd: () => {
        if (this.gameEnded) return;
        this.gameEnded = true;
        this.finishBattle(null);
      },
    });
    if (!this.net) {
      this.scene.start(ONLINE_LOBBY_SCENE);
      return;
    }
    this.net.markLoaded();
  }

  /**
   * Forget everything from a previous battle. Phaser reuses the scene
   * instance on restart / RETRY, so field initialisers do not run again.
   */
  private resetBattleState(): void {
    this.ships.clear();
    this.shipSprites.clear();
    this.healthBars.clear();
    this.capitalIndicators.clear();
    this.hitLedger.clear();
    this.battleClockMs = 0;
    this.accumulator = 0;
    this.framesAlive = 0;
    this.score = 0;
    this.isPaused = false;
    this.pauseMenu = null;
    this.activeAuras = new Map();
    this.playerWasAuraCovered = false;
    this.pilotControls = new Map();
    this.prevThrustUpHeld = false;
    this.prevThrustDownHeld = false;
    this.botFleet = null;
  }

  private createHealthBars(): void {
    for (const ship of this.ships.values()) this.createHealthBar(ship);
  }

  /** @param ship - A ship that needs its hull / shield overlay (and capital systems). */
  private createHealthBar(ship: ArcadeShip): void {
    const id = ship.id;
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
        id === this.viewShipId(),
        ship.team === this.viewTeam(),
      ),
      definitionId: ship.definitionId,
    });
    this.healthBars.set(id, healthBar);
    if (!ship.capitalSystems) return;
    const indicator = new CapitalSystemsIndicator(this, ship.x, ship.y - 42);
    indicator.update(ship.capitalSystems);
    this.capitalIndicators.set(id, indicator);
  }

  update(time: number): void {
    InputManager.update();
    // Mix every positional sound relative to what the player is
    // looking at, so a distant firefight sounds distant.
    syncListenerToCamera(this.cameras.main);
    const deltaMs = time - this.lastTime;
    this.lastTime = time;

    if (deltaMs <= 0) return;
    if (this.online) {
      this.updateOnline(deltaMs);
      return;
    }
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

    // Capped catch-up: an overloaded machine slows the sim down instead of spiralling (FixedStepPlan)
    const plan = planFixedSteps(
      this.accumulator,
      deltaMs,
      this.debugTimeScale,
      ArcadeBattleScene.FIXED_DT,
    );
    this.accumulator = plan.remainderMs;
    for (let tick = 0; tick < plan.ticks && !this.gameEnded; tick++) {
      this.tickLogic(ArcadeBattleScene.FIXED_DT);
    }

    // Render-only updates: every real frame (not fixed-step)
    this.renderFrame(deltaMs);
  }

  /** Render-only work of a frame: sprites, HUD, scenario glyphs, camera. */
  private renderFrame(deltaMs: number): void {
    this.updateSprites(deltaMs);
    this.updateHUD();
    this.scenario?.render(this.cameras.main, this.time.now);
    this.updateCameraFollow();
  }

  /**
   * Online frame: the lockstep session runs every due tick (stepOnline →
   * tickLogic at the fixed step), then the frame draws the battle from the
   * local seat's point of view. Nobody can pause a shared battle.
   *
   * @param deltaMs - Real time since the last frame (ms).
   */
  private updateOnline(deltaMs: number): void {
    this.notices?.update();
    if (this.gameEnded || !this.net) return;
    this.net.frame(deltaMs, this.lockstep);
    if (this.gameEnded) return;
    this.renderFrame(deltaMs);
  }

  /**
   * One lockstep tick: every seat's input, then the same fixed-step logic
   * a local battle runs.
   *
   * @param _tick - The tick (the battle clock advances with tickLogic).
   * @param inputs - Every seat's input.
   */
  private stepOnline(_tick: number, inputs: readonly TickInput[]): void {
    if (this.gameEnded || !this.online) return;
    this.online.feed(inputs);
    this.tickLogic(ArcadeBattleScene.FIXED_DT);
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
    if (!this.debugAutopilot) this.handleInput(dt);
    this.updateAI(dt);
    this.updateShips(dt);
    this.updateAuras(dt);
    // Secondaries first: a held or chosen launch is this cycle's attack.
    this.weapons?.update(dt, this.battleClockMs);
    this.firePrimaries(dt);
    const reinforced = this.reinforcements?.tick(dt, this.battleClockMs);
    if (this.scenario?.tick(dt, this.battleClockMs) || reinforced) return;
    // Fleeing is a single-player rule (only the player's ship can flee).
    if (!this.online) this.updateFleeDetector(dt);
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
    const ship = this.cameraFocusShip();
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
    const targetZoom = this.leaveDialogOpen
      ? 1
      : Phaser.Math.Linear(1.0, 0.75, speedRatio);
    const zoom = this.cameras.main.zoom;
    this.cameras.main.setZoom(
      this.leaveDialogOpen ? 1 : zoom + (targetZoom - zoom) * 0.03,
    );
    this.cameras.main.centerOn(this.cameraVirtualX, this.cameraVirtualY);
  }

  /**
   * What the camera follows: the local pilot's ship; while it is down, the
   * reinforcement picker's wingman (offline) or any living ship of the local
   * side (online).
   *
   * @returns The focus, or null to hold the camera.
   */
  private cameraFocusShip(): {
    readonly x: number;
    readonly y: number;
    readonly control: { readonly speed: number };
  } | null {
    if (!this.online)
      return (
        this.reinforcements?.cameraFocus() ??
        this.ships.get(this.playerShipId!) ??
        null
      );
    const own = this.ships.get(this.viewShipId() ?? "");
    if (own && own.hull > 0) return own;
    const team = this.viewTeam();
    return (
      [...this.ships.values()].find((s) => s.hull > 0 && s.team === team) ??
      null
    );
  }

  /** @returns The ship this client's pilot flies (presentation), or null. */
  private viewShipId(): string | null {
    if (!this.online) return this.playerShipId;
    return this.online.shipOf(this.online.localSeat);
  }

  /** @returns The faction this client flies (presentation: music, stingers). */
  private viewFaction(): FactionId {
    return (
      (this.online?.localFaction as FactionId | undefined) ?? this.playerFaction
    );
  }

  /** @returns The team this client flies for (presentation: allies, HUD, colours). */
  private viewTeam(): TeamId {
    return this.online?.localTeam ?? this.playerTeam;
  }

  /** @returns The mark of this client's team (HUD, overlays). */
  private viewMarkedTargetId(): string | null {
    return (
      this.botFleet?.markedTargetOf(
        teamKey(this.viewTeam()),
        this.battleClockMs,
      ) ?? null
    );
  }

  /**
   * @param shipId - A ship.
   * @returns Whether a human flies it now (online: its seat, unless the
   *   relay handed the seat to the AI; offline: the player's ship unless
   *   the autopilot flies it).
   */
  private isHumanFlown(shipId: string): boolean {
    if (this.online) return this.online.isHumanFlown(shipId);
    return shipId === this.playerShipId && !this.debugAutopilot;
  }

  private createStarfield(): void {
    installBattleSpace(this);
  }

  private setupInput(): void {
    setupSceneInput(this);
    this.createPauseMenu();
    this.inputSubscriptionIds.push(
      InputManager.onAny((event) => {
        if (this.trackedEdgeIntents.has(event.intent)) {
          this.pendingEdgeIntents.add(event.intent);
        }
      }),
    );
    this.inputSubscriptionIds.push(
      InputManager.on("PAUSE", () => {
        if (this.online) this.askLeaveOnline();
        else if (this.isPaused) this.resumeBattle();
        else this.pauseBattle();
      }),
    );

    // Prevent Tab from moving browser focus away from the canvas
    this.input.keyboard!.on("keydown-TAB", (e: KeyboardEvent) =>
      e.preventDefault(),
    );
  }

  /** PAUSE online: the shared battle never pauses — offer to leave instead. */
  private askLeaveOnline(): void {
    if (!this.net || this.leaveDialogOpen || this.gameEnded) return;
    confirmLeaveOnlineBattle(this, this.net, {
      onOpen: () => {
        this.leaveDialogOpen = true;
        this.cameras.main.setZoom(1);
      },
      onClose: () => {
        this.leaveDialogOpen = false;
      },
    });
  }

  /** Drains a queued edge-triggered intent, returning whether it fired since the last check. */
  private consumeEdge(intent: ActionIntent): boolean {
    const had = this.pendingEdgeIntents.has(intent);
    this.pendingEdgeIntents.delete(intent);
    return had;
  }

  /** The local pilot's keys offline: InputManager's held state and the queued presses. */
  private readonly localKeys: PilotKeys = {
    held: (intent) => InputManager.isHeld(intent),
    consume: (intent) => this.consumeEdge(intent),
    pressed: (intent) => this.pendingEdgeIntents.has(intent),
  };

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
    this.reinforcements?.setHudVisible(false);
    this.pauseMenu?.show();
  }

  /** Close the pause menu and resume the battle. */
  private resumeBattle(): void {
    this.isPaused = false;
    this.pauseMenu?.hide();
    this.hud?.setVisible(true);
    this.scenario?.setHudVisible(true);
    this.reinforcements?.setHudVisible(true);
  }

  /** The shared pause menu (hidden until ESC / Start); online it never freezes the battle. */
  private createPauseMenu(): void {
    this.pauseMenu = new BattlePauseMenu({
      scene: this,
      legend: "squad",
      online: this.online !== null,
      onResume: () => this.resumeBattle(),
      onRestart: () => this.scene.start("ArcadeBattleScene"),
      onQuit: () => this.scene.start("MainMenuScene"),
      ensurePaused: () => {
        if (!this.online) this.pauseBattle();
      },
    });
  }

  /**
   * Every human pilot's input this tick: offline the player's keys; online
   * each seat's lockstep input (and that seat's own reinforcement pick).
   *
   * @param deltaMs - Tick length (ms).
   */
  private handleInput(deltaMs: number): void {
    const online = this.online;
    if (!online) {
      const ship = this.ships.get(this.playerShipId!);
      if (ship && ship.hull > 0)
        this.handlePilotInput(ship, this.localKeys, deltaMs);
      return;
    }
    online.seats.forEach((seat, index) => {
      const pick = seat.takeCommand();
      if (pick?.op === PILOT_COMMANDS.deployReserve)
        this.reinforcements?.choose(pick.arg, online.squadOf(index));
    });
    online.seats.forEach((seat, index) => {
      const ship = this.ships.get(online.shipOf(index) ?? "");
      const keys = online.keysOf(index);
      if (!ship || ship.hull <= 0 || !keys || seat.aiControl) return;
      this.weapons?.pilotKeys(
        ship.id,
        keys.pressed,
        this.battleClockMs,
        index === online.localSeat,
      );
      this.handlePilotInput(ship, keys, deltaMs);
    });
  }

  /**
   * One pilot's controls for a tick: flight, crew role, squad mark, then
   * the crew station's own keys (gunner turret, commander orders).
   *
   * @param ship - The human's ship.
   * @param keys - Their keys this tick.
   * @param deltaMs - Tick length (ms).
   */
  private handlePilotInput(
    ship: ArcadeShip,
    keys: PilotKeys,
    deltaMs: number,
  ): void {
    this.applyFlightInput(ship, keys, deltaMs);

    // Crew role cycle: pilot -> gunner (large/huge with a turret) -> commander (capital only)
    if (keys.consume("CREW_CYCLE")) {
      const def = getShipDefinition(ship.definitionId);
      const sz = def?.baseStats.size;
      const hasTurret =
        !!this.weapons?.runtime.arsenalOf(ship.id)?.turret &&
        (sz === "large" || sz === "huge");
      const isCapital = def?.role === "capital";
      const roles = getAvailableCrewRoles(hasTurret, isCapital);
      ship.crewMode = nextCrewRole(ship.crewMode, roles);
    }

    if (keys.consume("MARK_TARGET")) this.markHudTarget(ship);

    // Weapons autofire; FIRE_SECONDARY / WEAPON_CYCLE / CLOAK are read by
    // the shared BattleWeapons. Crew modes only change what the player steers.
    if (ship.crewMode === "gunner") {
      this.handleGunnerInput(ship, keys, deltaMs / 1000);
      return;
    }
    this.weapons?.runtime.releaseTurret(ship.id);
    if (ship.crewMode === "commander")
      this.handleCommanderInput(ship, keys, deltaMs);
  }

  /**
   * Runs one frame of a pilot's flight controls through the shared
   * PilotFlightControls (the same code every cycle-engine scene uses) and
   * plays the effects for whatever happened.
   *
   * @param ship - The pilot's ship.
   * @param keys - Their keys this tick.
   * @param deltaMs - Frame length (ms).
   */
  private applyFlightInput(
    ship: ArcadeShip,
    keys: PilotKeys,
    deltaMs: number,
  ): void {
    const edges = new Set<FlightEdge>(
      FLIGHT_EDGES.filter((edge) => keys.consume(edge)),
    );
    const result = applyPilotFlightInput(
      this.pilotControls.get(ship.id) ?? INITIAL_PILOT_CONTROL,
      { ship, motion: ship, stress: ship.stress, dial: ship.shipDial },
      {
        left: keys.held("STEER_LEFT"),
        right: keys.held("STEER_RIGHT"),
        up: keys.held("THRUST_UP"),
        down: keys.held("THRUST_DOWN"),
        maneuver: keys.held("MANEUVER"),
        edges,
        nowMs: this.battleClockMs,
        deltaMs,
        allowChordBarrelRoll: this.allowChordBarrelRoll,
      },
      BATTLEFIELD_SIZE,
    );
    this.pilotControls.set(ship.id, result.pilot);
    this.applyFlightResult(ship, result);
    if (ship.id !== this.viewShipId()) return;
    InputManager.reportFlightCooldowns(cooldownsOf(result.motion.control));
    this.weapons?.showRefusals(result.refusals, ship);
    matchStats.record({ kind: "flight", events: result.events });
    matchStats.record(stressEvent(result.stress, deltaMs));
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
    const isPlayer = ship.id === this.viewShipId();
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
   * MARK_TARGET (R): a pilot's side marks their HUD target — the wingmen
   * focus it and every hit on it by the side gets the mark bonus.
   *
   * @param player - The marking pilot's ship.
   */
  private markHudTarget(player: ArcadeShip): void {
    const targetId = selectHudTargetId(
      player,
      [...this.ships.values()],
      BATTLEFIELD_SIZE,
    );
    if (!targetId || !this.botFleet) return;
    this.botFleet.markTarget(
      teamKey(player.team),
      targetId,
      this.battleClockMs,
    );
    if (player.team === this.playerTeam) this.scenario?.onPlayerMark(targetId);
    if (player.id !== this.viewShipId()) return;
    matchStats.record({ kind: "mark" });
    const target = this.ships.get(targetId);
    if (target) {
      this.showFloatingText(target.x, target.y - 45, "MARKED", "#ff3344");
    }
  }

  /**
   * @param shipId - A ship.
   * @returns Whether a human seat's pilot controls belong to it (offline:
   *   the player's ship).
   */
  private isPilotShip(shipId: string): boolean {
    if (this.online) return this.online.seatOfShip(shipId) >= 0;
    return shipId === this.playerShipId;
  }

  private updateShips(deltaMs: number): void {
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;

      ship.control = updateCooldowns(ship.control, deltaMs);

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

        if (completed && this.isPilotShip(ship.id)) {
          if (ship.id === this.viewShipId())
            matchStats.record(cycleEvent(ship.shipDial, completed));
          this.pilotControls.set(
            ship.id,
            onPilotCycleCommitted(
              this.pilotControls.get(ship.id) ?? INITIAL_PILOT_CONTROL,
              state.control.currentManeuver ?? "straight",
            ),
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

      ship.isCloaked = this.weapons?.runtime.isCloaked(ship.id) ?? false;
      this.telemetry?.sample(ship.id, ship.x, ship.y, ship.angle);
    }
  }

  /**
   * Recomputes every team's support auras for this tick and applies the slow
   * shield-regen effect. Damage, mitigation and stress-relief effects are read
   * at their own consumption points from {@link activeAuras}. Uses the shared
   * pure {@link resolveSupportAuras} resolver so gameplay matches telemetry.
   *
   * @param deltaMs - Elapsed simulation time for this tick, in milliseconds.
   */
  private updateAuras(deltaMs: number): void {
    const snapshot: (AuraShip & { team: TeamId })[] = [];
    for (const ship of this.ships.values()) {
      const size =
        getShipDefinition(ship.definitionId)?.baseStats.size ?? "small";
      snapshot.push({
        id: ship.id,
        x: ship.x,
        y: ship.y,
        faction: ship.faction,
        team: ship.team,
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
        ...auraFactsOf(ship.modifiers),
      });
    }

    const { buffs, coveredShipIds } = resolveTeamAuras(snapshot);
    this.activeAuras = buffs;

    const viewId = this.viewShipId();
    const playerCovered = viewId ? coveredShipIds.has(viewId) : false;
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
   * @param ship - The ship asking.
   * @returns Whether another ship of its side flies within wingman range.
   */
  private fliesWithWingman(ship: ArcadeShip): boolean {
    return hasWingman(ship, this.frameCache?.aliveByTeam.get(ship.team) ?? []);
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
      Object.assign(attacker, rewardKill(attacker, this.battleClockMs));
    }
    const enemies = this.frameCache?.aliveEnemiesOf(victim.team) ?? [];
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
    if (target.hull <= 0 || this.isArrivalShielded(target)) return;
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
    matchStats.record({
      kind: "kill",
      victimFriendly: target.team === this.viewTeam(),
      victimIsPlayer: target.id === this.viewShipId(),
    });
    if (target.team === this.playerTeam) {
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
    this.weapons?.forget(target.id);
  }

  /**
   * The AI's turn this tick: every team's squad command re-plans and
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
      if (ship.hull <= 0) continue;
      if (this.isHumanFlown(ship.id)) continue;
      this.flyAiShip(fleet, ship, deltaMs);
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
   * @param attacker - The ship about to attack.
   * @param target - Its target.
   * @returns True while the target ignores this attacker (struck this cycle).
   */
  private isImmuneTo(attacker: ArcadeShip, target: ArcadeShip): boolean {
    return (
      this.hitLedger.isImmune(attacker.id, target.id, this.battleClockMs) ||
      this.isArrivalShielded(target)
    );
  }

  /**
   * @param ship - A ship.
   * @returns True while a reinforcement that just warped in cannot be hit.
   */
  private isArrivalShielded(ship: ArcadeShip): boolean {
    return (
      this.reinforcements?.isShielded(ship.id, this.battleClockMs) ?? false
    );
  }

  /**
   * Apply hit damage: shields first, the rest spills onto the hull (capital
   * hulls through their subsystems) — the rule every battle mode shares.
   *
   * @param ship - The ship struck.
   * @param damage - Damage to apply.
   */
  private applyHitDamage(ship: ArcadeShip, damage: number): void {
    const after = absorbDamage(ship, damage);
    const toHull = damage - (ship.shields - after.shields);
    if (after.shields < ship.shields) {
      audioManager.playSoundAt("shield_hit", ship.x, ship.y, 0.4);
    }
    ship.shields = after.shields;
    if (toHull <= 0) return;
    this.damageThisFrame = true;
    audioManager.playSoundAt("hull_hit", ship.x, ship.y, 0.4);
    if (!ship.capitalSystems) {
      ship.hull = after.hull;
      return;
    }
    const result = applyCapitalSystemDamage(ship.capitalSystems, toHull);
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

  /** The secondary-weapons glue (e2e). */
  get secondaryWeapons(): BattleWeapons | null {
    return this.weapons;
  }

  /** @param ship - A ship whose secondaries the shared runtime arms. */
  private armShip(ship: ArcadeShip): void {
    this.weapons?.equip(ship.id, {
      definitionId: ship.definitionId,
      loadoutId: ship.loadoutId,
      modifiers: ship.modifiers,
    });
  }

  /** @returns What the secondary weapons read from (and ask of) this scene. */
  private weaponsLink(): BattleWeaponsLink {
    return {
      bodies: () =>
        [...this.ships.values()].map((ship) =>
          weaponBodyOf(
            ship,
            teamKey(ship.team),
            damageMitigationOf(
              ship.modifiers,
              this.fliesWithWingman(ship),
              this.activeAuras.get(ship.id),
            ),
          ),
        ),
      wantedTargetOf: (shipId: string) => this.preferredTargetOf(shipId),
      playerShipId: () => this.viewShipId(),
      playerSide: () => teamKey(this.viewTeam()),
      sideOf: (shipId: string) => {
        const ship = this.ships.get(shipId);
        return ship ? teamKey(ship.team) : null;
      },
      isBotControlled: (shipId: string) => !this.isHumanFlown(shipId),
      applyHit: (hit: WeaponHit) => this.applyWeaponHit(hit),
    };
  }

  /**
   * @param shipId - A ship.
   * @returns The enemy its pilot is after: the HUD target for the player,
   *   the bot's target (else its squad focus) for an AI ship.
   */
  private preferredTargetOf(shipId: string): string | null {
    const ship = this.ships.get(shipId);
    if (!ship) return null;
    if (this.isHumanFlown(ship.id)) {
      return selectHudTargetId(ship, this.ships.values(), BATTLEFIELD_SIZE);
    }
    return this.botFleet?.targetIdFor(ship.id, teamKey(ship.team)) ?? null;
  }

  /**
   * @param player - The player's ship.
   * @returns The weapon bar: primary laser, then the shared secondaries.
   */
  private weaponBar(player: ArcadeShip): WeaponSlotDescriptor[] {
    return weaponBarSlots(
      primaryWeaponSlot(
        player.weaponCooldown,
        attackIntervalMs(player.combatStats.weaponCooldown),
      ),
      this.weapons?.hudSlots() ?? [],
    );
  }

  /**
   * Every ship's primary weapon on the X-Wing round tempo, by the rule all
   * modes share: its pilot's target (else the nearest enemy) inside its
   * range and firing arc the short way across the map seam, at most one
   * attack per cycle, never at a target still immune to it. A cloaked ship
   * holds fire (firing would drop the cloak).
   *
   * @param deltaMs - Tick length (ms).
   */
  private firePrimaries(deltaMs: number): void {
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;
      ship.weaponCooldown = Math.max(0, ship.weaponCooldown - deltaMs);
      if (ship.weaponCooldown > 0 || ship.isCloaked) continue;
      const target = nearestTargetInArc(ship, this.ships.values(), {
        rangePx: ship.combatStats.weaponRange,
        arcDeg: ship.combatStats.firingArc,
        worldSize: BATTLEFIELD_SIZE,
        isHostile: (other) => other.team !== ship.team,
        isEligible: (other) => !this.isImmuneTo(ship, other),
        preferredId: this.preferredTargetOf(ship.id),
      });
      if (!target) continue;
      this.fireAt(ship, target);
      ship.weaponCooldown = attackIntervalMs(ship.combatStats.weaponCooldown);
    }
  }

  /**
   * One primary attack, resolved by the shared dice (DiceAttack): mode
   * odds, pilot abilities, squad mark, auras and armour.
   *
   * @param attacker - The firing ship.
   * @param target - The ship fired at.
   */
  private fireAt(attacker: ArcadeShip, target: ArcadeShip): void {
    const now = this.battleClockMs;
    const result = resolveDiceAttack({
      attacker,
      target,
      hitChance: calculateHitChance(
        attacker.combatStats.attackDice,
        target.combatStats.agilityDice,
      ),
      baseDamage: attacker.combatStats.attackDice,
      attackerHasWingman: this.fliesWithWingman(attacker),
      targetHasWingman: this.fliesWithWingman(target),
      nowMs: now,
      roll: random.next(),
      targetMarked:
        this.botFleet?.isMarkedBy(teamKey(attacker.team), target.id, now) ??
        false,
      ...this.aurasOf(attacker, target),
      targetArmor: armorReductionOf(target.definitionId),
    });
    this.weapons?.onAttack(attacker.id);
    const friendly = attacker.team === this.viewTeam();
    matchStats.record({
      kind: "shot",
      friendly,
      weapon: "primary",
      hit: result.hit,
    });
    this.drawBolt(
      attacker,
      target,
      friendly ? PLAYER_LASER_COLOR : ENEMY_LASER_COLOR,
    );
    if (!result.hit) return;
    matchStats.record({ kind: "hit", friendly, weapon: "primary" });
    const factor =
      (this.weapons?.incomingDamageFactor(target.id) ?? 1) *
      this.concentrateFactor(attacker, target);
    this.landHit(attacker, target, {
      damage: Math.max(1, Math.round(result.damage * factor)),
      stress: result.stressOnTarget,
    });
  }

  /**
   * @param attacker - The firing ship.
   * @param target - The ship fired at.
   * @returns The support auras covering each (omitted when none).
   */
  private aurasOf(
    attacker: ArcadeShip,
    target: ArcadeShip,
  ): { attackerAura?: ActiveAura; targetAura?: ActiveAura } {
    const attackerAura = this.activeAuras.get(attacker.id);
    const targetAura = this.activeAuras.get(target.id);
    return {
      ...(attackerAura ? { attackerAura } : {}),
      ...(targetAura ? { targetAura } : {}),
    };
  }

  /**
   * @param attacker - The firing ship (undefined once destroyed).
   * @param target - The ship hit.
   * @returns The capital commander's concentrate-fire multiplier.
   */
  private concentrateFactor(
    attacker: ArcadeShip | undefined,
    target: ArcadeShip,
  ): number {
    const orders = attacker?.commanderOrders;
    return orders
      ? concentrateFireMultiplier(
          orders.concentrateFire,
          target.id,
          this.battleClockMs,
        )
      : 1;
  }

  /**
   * A secondary weapon's hit (missile, torpedo, turret, bomb, mine) through
   * the same path as a laser; a capital's turrets hit harder with power
   * redirected to them and softer with their system damaged.
   *
   * @param hit - The hit from the weapons runtime.
   */
  private applyWeaponHit(hit: WeaponHit): void {
    const target = this.ships.get(hit.targetId);
    if (!target || target.hull <= 0) return;
    const attacker = this.ships.get(hit.attackerId);
    let damage = hit.damage * this.concentrateFactor(attacker, target);
    if (hit.weapon === "turret" && attacker)
      damage *= this.turretFactor(attacker);
    matchStats.record({
      kind: "hit",
      friendly: attacker?.team === this.viewTeam(),
      weapon: "ordnance",
    });
    this.landHit(attacker, target, {
      damage: Math.max(1, Math.round(damage)),
      stress: hit.stress,
    });
  }

  /**
   * @param ship - A ship firing its turret.
   * @returns Damage factor from its capital systems and power redirect.
   */
  private turretFactor(ship: ArcadeShip): number {
    const systems = ship.capitalSystems
      ? turretDamageMultiplier(ship.capitalSystems)
      : 1;
    const power =
      ship.commanderOrders &&
      isPowerFocused(
        ship.commanderOrders.powerRedirect,
        "turrets",
        this.battleClockMs,
      )
        ? POWER_REDIRECT_TURRET_MULTIPLIER
        : 1;
    return systems * power;
  }

  /**
   * A hit lands: the attacker's immunity tick, stress, damage (shields
   * first, the rest onto the hull), feedback, and the kill. A reinforcement
   * still under its arrival shield shrugs it off.
   *
   * @param attacker - The ship credited (undefined once destroyed).
   * @param target - The ship hit.
   * @param hit - Final damage and stress.
   */
  private landHit(
    attacker: ArcadeShip | undefined,
    target: ArcadeShip,
    hit: { readonly damage: number; readonly stress: number },
  ): void {
    if (target.hull <= 0) return;
    if (this.isArrivalShielded(target)) {
      spawnDeflectFlash(this, target.x, target.y);
      return;
    }
    if (attacker)
      this.hitLedger.recordHit(attacker.id, target.id, this.battleClockMs);
    target.stress = applyInstantStress(target.stress, hit.stress);
    const before = { hull: target.hull, shields: target.shields };
    this.applyHitDamage(target, hit.damage);
    matchStats.record({
      kind: "damage",
      toFriendly: target.team === this.viewTeam(),
      shield: before.shields - target.shields,
      hull: before.hull - target.hull,
      ...dealerOf(attacker),
    });
    if (this.damageNumbersEnabled) {
      this.showFloatingText(
        target.x,
        target.y - 20,
        `-${hit.damage}`,
        "#ff4444",
      );
    }
    const viewId = this.viewShipId();
    const involvesPlayer = target.id === viewId || attacker?.id === viewId;
    if (this.cameraShakeEnabled && involvesPlayer)
      this.cameras.main.shake(50, 0.005);
    if (target.hull > 0) return;
    const viewTeam = this.viewTeam();
    if (attacker?.team === viewTeam && target.team !== viewTeam) {
      this.score += KILL_SCORE;
      this.showFloatingText(target.x, target.y - 40, "KILL!", "#ffff00");
    }
    this.resolveAbilityKill(attacker, target);
    this.recordDestruction(target);
  }

  /**
   * A primary bolt streaking from the attacker to the target (the short
   * way across the map seam).
   *
   * @param from - The firing ship.
   * @param to - The ship fired at.
   * @param color - Bolt colour.
   */
  private drawBolt(
    from: { readonly x: number; readonly y: number },
    to: { readonly x: number; readonly y: number },
    color: number,
  ): void {
    const { dx, dy } = torusDelta(from.x, from.y, to.x, to.y, BATTLEFIELD_SIZE);
    const bolt = this.add.graphics().setDepth(5);
    drawEnergyBolt(bolt, {
      color,
      length: CANNON_BOLT_LENGTH_PX,
      width: CANNON_BOLT_WIDTH_PX,
    });
    bolt.setPosition(from.x, from.y);
    bolt.setAngle((Math.atan2(dy, dx) * 180) / Math.PI + NORTH_UP_OFFSET_DEG);
    this.tweens.add({
      targets: bolt,
      x: from.x + dx,
      y: from.y + dy,
      duration: LASER_BOLT_FLIGHT_MS,
      onComplete: () => bolt.destroy(),
    });
  }

  private spawnShips(): void {
    const battleConfig = this.registry.get("battleConfig") as
      { factions?: SquadSlot[] } | undefined;
    const squads = battleConfig?.factions?.length
      ? battleConfig.factions
      : DEFAULT_SQUADS;
    const plan = planSquadDeployment(squads, {
      worldSize: BATTLEFIELD_SIZE,
      buildsOf: quickBuildsOf,
      ...(this.online ? { homeSeat: 0 } : {}),
    });
    this.playerFaction = plan.playerFaction;
    this.playerTeam = plan.playerTeam;
    this.playerSquad = plan.playerSquad;
    this.squadTeams = [...plan.squadTeams];
    for (const spec of plan.specs) {
      const ship = spawnArcadeShip(spec);
      this.ships.set(ship.id, ship);
    }
    this.playerShipId = "player_0";
    for (const [seat, shipId] of plan.seatShips)
      this.online?.assignShip(seat, shipId);
    this.scenario?.deploy([...this.ships.values()], this.playerTeam);

    for (const ship of this.ships.values()) {
      this.armShip(ship);
      this.createShipSprite(ship);
    }
    this.botFleet = this.createBotFleet();
    this.scenario?.attachFleet(this.botFleet);
  }

  /**
   * The battle's AI: difficulty and seed from the battle config (Squad
   * Builder sets `aiDifficulty`; online rooms set `seed`), and a bot pilot
   * for every AI-flown ship. Squads are teams (side keys), never factions.
   * Online every human seat's ship has a bot too (it flies only while the
   * relay hands that seat to the AI), and every human-led team follows the
   * player's squad rules.
   *
   * @returns The fleet, every AI ship enlisted.
   */
  private createBotFleet(): ArcadeBotFleet {
    const config = this.registry.get("battleConfig") as
      { aiDifficulty?: string; seed?: number } | undefined;
    const seed =
      config?.seed ?? Math.floor(Math.random() * RANDOM_BATTLE_SEED_RANGE);
    const online = this.online;
    const fleet = new ArcadeBotFleet({
      difficulty: config?.aiDifficulty ?? DEFAULT_SKIRMISH_DIFFICULTY,
      playerSide: teamKey(this.playerTeam),
      random: online
        ? () => online.fleetRng.next()
        : createSeededRng(seed).next,
      worldSize: BATTLEFIELD_SIZE,
      squadFormat: parseReinforcementSetup(config) ? "reinforced" : "classic",
      ...(online ? { humanSides: online.humanSides, markAssist: true } : {}),
    });
    for (const ship of this.ships.values()) {
      if (ship.owner === "ai" || online)
        fleet.enlist(ship.id, teamKey(ship.team));
    }
    return fleet;
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
    if (visual.image) recordBaseScale(visual.image);
    container.bankState = { ...INITIAL_BANK_STATE, lastAngle: ship.angle };
    container.setAngle(ship.angle);
    container.setDepth(10);
    container.setSize(size * 2, size * 2);
    container.setInteractive();
    ShipStatCard.attachHoverCard(this, container, ship.definitionId);

    this.shipSprites.set(ship.id, container);
  }

  private updateSprites(deltaMs: number): void {
    const markedId = this.viewMarkedTargetId();
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
        const base = imageBaseScale(sprite.image);
        sprite.image.setScale(base.x * scaleX, base.y * scaleY);
      }

      // Cloaked ships: nearly invisible to enemies, dimmed for the owning player
      const isPlayer = ship.id === this.viewShipId();
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
  }

  /** Feed this frame's battle state to the holographic HUD. */
  private updateHUD(): void {
    if (!this.hud) return;
    const viewId = this.viewShipId();
    const player = viewId ? (this.ships.get(viewId) ?? null) : null;
    audioManager.reportPlayerHull(hullFractionOf(player));
    this.hud.update({
      player,
      crewMode: player?.crewMode ?? "pilot",
      commanderOrders: player?.commanderOrders ?? null,
      ships: [...this.ships.values()],
      playerTeam: this.viewTeam(),
      weapons: player ? this.weaponBar(player) : [],
      camera: this.cameras.main,
      score: this.score,
      remainingMs:
        this.scenario?.remainingMs ??
        this.reinforcements?.remainingMs ??
        this.matchTimer.remainingMs,
      nowMs: this.time.now,
      markedId: this.viewMarkedTargetId(),
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
   * Handles turret controls when the player is in gunner mode.
   * Left/right rotate the turret aim; it autofires like every other
   * weapon in this game once a target is in arc/range.
   *
   * @param ship - The pilot's ship.
   * @param keys - Their keys this tick.
   * @param dt - Frame time in seconds.
   */
  private handleGunnerInput(
    ship: ArcadeShip,
    keys: PilotKeys,
    dt: number,
  ): void {
    const turret = this.weapons?.runtime.arsenalOf(ship.id)?.turret;
    if (!turret) return;
    const turn = keys.held("STEER_LEFT")
      ? -GUNNER_TURN_DEG_PER_S * dt
      : keys.held("STEER_RIGHT")
        ? GUNNER_TURN_DEG_PER_S * dt
        : 0;
    this.weapons?.runtime.aimTurret(ship.id, turret.facingDeg + turn);
  }

  /**
   * Handles commander orders (capital ships only): concentrate fire [1],
   * redirect power [2], charge/fire the main beam [3], emergency repair [4].
   * The commander doesn't fly or gun — the ship's turret keeps auto-firing
   * and its last-set maneuver keeps running while orders are issued.
   *
   * @param ship - The pilot's ship.
   * @param keys - Their keys this tick.
   * @param deltaMs - Frame time in milliseconds.
   */
  private handleCommanderInput(
    ship: ArcadeShip,
    keys: PilotKeys,
    deltaMs: number,
  ): void {
    const orders = ship.commanderOrders;
    if (!orders || !this.frameCache) return;
    const now = this.battleClockMs;

    if (keys.consume("COMMANDER_ORDER_1")) {
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
      keys.consume("COMMANDER_ORDER_2") &&
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

    if (keys.consume("COMMANDER_ORDER_3")) {
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
      keys.consume("COMMANDER_ORDER_4") &&
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

  /** Nearest living enemy, the short way across the map seam. */
  private findNearestEnemy(ship: ArcadeShip): ArcadeShip | null {
    if (!this.frameCache) return null;
    let nearest: ArcadeShip | null = null;
    let nearestDist = Infinity;
    for (const view of this.frameCache.aliveEnemiesOf(ship.team)) {
      const dist = torusRangePx(ship, view, BATTLEFIELD_SIZE);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = this.ships.get(view.id) ?? null;
      }
    }
    return nearest;
  }

  /**
   * Fires the commander's charged main beam: one heavy hit on the nearest
   * enemy in its forward arc within twice range 3 (a miss when none is).
   *
   * @param ship - The commanding player's ship.
   */
  private fireMainBeam(ship: ArcadeShip): void {
    this.showFloatingText(ship.x, ship.y - 45, "MAIN BEAM FIRED!", "#ffffff");
    this.weapons?.onAttack(ship.id);
    const target = nearestTargetInArc(ship, this.ships.values(), {
      rangePx: MAIN_BEAM_RANGE_PX,
      arcDeg: ship.combatStats.firingArc,
      worldSize: BATTLEFIELD_SIZE,
      isHostile: (other) => other.team !== ship.team,
      isEligible: (other) => !this.isArrivalShielded(other),
    });
    if (!target) return;
    this.drawBolt(ship, target, MAIN_BEAM_COLOR);
    this.landHit(ship, target, { damage: MAIN_BEAM_HIT_DAMAGE, stress: 0 });
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
      if (s.team === this.playerTeam) continue;
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
    const result = checkVictoryCondition(this.frameCache, this.playerTeam);
    if (result.outcome === "victory") {
      this.gameEnded = true;
      this.finishBattle(true);
    } else if (result.outcome === "defeat") {
      this.gameEnded = true;
      this.finishBattle(false);
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
      this.finishBattle(outcome === "draw" ? null : outcome === "side1");
    }
  }

  /**
   * The battle is decided (from the "player" side — seat 0's online).
   * Online the result goes to the relay and the end screen shows it from
   * the local seat's side; a local battle shows it as is (a draw is no win).
   *
   * @param playerSideWon - Whether the "player" side won (null = draw).
   */
  private finishBattle(playerSideWon: boolean | null): void {
    const online = this.online;
    if (!online) {
      this.showEndScreen(playerSideWon ?? false);
      return;
    }
    this.net?.reportMatchOver(online.winnerTeam(playerSideWon));
    this.showEndScreen(
      playerSideWon !== null && online.localVictory(playerSideWon),
    );
  }

  /**
   * Show the victory / defeat screen. The battle HUD is hidden and the
   * camera returns to zoom 1 so the overlay buttons hit-test correctly.
   *
   * @param victory - Whether the player's side won.
   */
  private showEndScreen(victory: boolean): void {
    const reinforced = this.reinforcements?.telemetryDetails() ?? {};
    trackModeEnd("skirmish", victory ? "victory" : "defeat", {
      score: this.score,
      ...reinforced,
    });
    matchStats.finish(victory ? "victory" : "defeat", {
      score: this.score,
      ...reinforced,
    });
    this.reinforcements?.finish();
    this.cameras.main.setZoom(1.0);
    audioManager.playFactionStinger(
      this.viewFaction(),
      victory ? "victory" : "defeat",
    );
    this.hud?.hideFleeWarning();
    this.hud?.setVisible(false);
    const actions = this.endScreenActions();
    if (this.scenario?.showResult(actions)) return;
    const extras = this.reinforcements?.endOverlayExtras();
    showResultsPanel({
      scene: this,
      tone: victory ? "victory" : "defeat",
      ...(extras?.outcomeLabel ? { banner: extras.outcomeLabel } : {}),
      subtitle: `Score ${this.score}`,
      rows: resultRows(matchStats.lastSummary, {
        pointsDestroyed:
          extras?.pointsDestroyed ?? this.playerSideScore.destroyedPoints,
        pointsLost: extras?.pointsLost ?? this.enemySideScore.destroyedPoints,
      }),
      notes: extras?.details ?? [],
      actions,
    });
  }

  /** @returns REMATCH / SQUAD / MENU: a local battle replays; an online one returns to the room. */
  private endScreenActions(): ResultsActions {
    if (!this.online)
      return {
        onRematch: () => this.scene.start("ArcadeBattleScene"),
        onSetup: () => this.scene.start("SquadBuilderScene", this.setupData()),
        onMenu: () => this.scene.start("MainMenuScene"),
      };
    return {
      onRematch: () => this.scene.start(ONLINE_LOBBY_SCENE),
      rematchLabel: "Rematch (room)",
      onMenu: () => {
        getOnlineSession(this.registry).leaveRoom();
        this.scene.start("MainMenuScene");
      },
    };
  }

  /** @returns Squad Builder entry data that reopens this battle's builder. */
  private setupData(): { initialMode: string } {
    const config = this.registry.get("battleConfig") as
      { gameMode?: string } | undefined;
    return { initialMode: config?.gameMode ?? "arcade" };
  }

  /** @returns Fingerprint of the battle (ships, ordnance, clocks, RNGs, scores). */
  private hashOnline(tick: number): number {
    const runtime = this.weapons?.runtime;
    return hashArcade({
      tick,
      battleClockMs: this.battleClockMs,
      rngStates: [
        this.online?.combatRng.getState() ?? 0,
        this.online?.fleetRng.getState() ?? 0,
      ],
      ships: this.ships.values(),
      shots: runtime?.shotsInFlight ?? [],
      devices: runtime?.devicesOnField ?? [],
      idCounters: runtime?.idCounters ?? [],
      scalars: [
        this.matchTimer,
        this.playerSideScore,
        this.enemySideScore,
        {
          ended: this.gameEnded,
          remaining: this.reinforcements?.remainingMs ?? 0,
        },
      ],
    });
  }

  /** @returns Every simulation object of the battle (snapshot root). */
  private simGraph() {
    return {
      ships: this.ships,
      fleet: this.botFleet,
      weapons: this.weapons?.simulation ?? null,
      ledger: this.hitLedger,
      repair: this.repairFeedback?.mechanic ?? null,
      seats: this.online?.seats ?? [],
      rngs: [this.online?.combatRng ?? null, this.online?.fleetRng ?? null],
      online: this.online,
      pilotControls: this.pilotControls,
      reinforcements: readSimFields(
        this.reinforcements,
        REINFORCEMENT_SIM_FIELDS,
      ),
      scenario: readSimFields(this.scenario, SCENARIO_SIM_FIELDS),
      battle: {
        battleClockMs: this.battleClockMs,
        framesAlive: this.framesAlive,
        matchTimer: this.matchTimer,
        playerSideScore: this.playerSideScore,
        enemySideScore: this.enemySideScore,
        activeAuras: this.activeAuras,
        playerShipId: this.playerShipId,
        gameEnded: this.gameEnded,
      },
    };
  }

  /** @param data - The authority's snapshot: jump to it and redraw. */
  private restoreOnline(data: string): void {
    const live = this.simGraph();
    const r = restoreGraph(live, data, ONLINE_GRAPH_OPTIONS)
      .root as typeof live;
    this.botFleet = r.fleet;
    writeSimFields(this.reinforcements, r.reinforcements);
    writeSimFields(this.scenario, r.scenario);
    Object.assign(this, r.battle);
    this.frameCache = buildFrameCache(this.ships.values());
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0 || this.shipSprites.has(ship.id)) continue;
      this.createShipSprite(ship);
      this.createHealthBar(ship);
    }
  }
}
