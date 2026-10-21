/**
 * Dogfight Scene - 1v1 Quick Duels
 *
 * Intense 1v1 battles with:
 * - Best-of-3 or Best-of-5 format
 * - Small squads (50 points, typically 1-2 ships)
 * - 3 minute round time limit
 * - Closer spawn distance for faster engagement
 * - Tighter camera zoom
 */

import Phaser from "phaser";
import { ShipStatCard } from "../ui/ShipStatCard";
import { addShipVisual } from "../rendering/ShipVisual";
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
import { HealthBar } from "../ui/HealthBar";
import { ShipRepairFeedback, overlaySide } from "../ui/hud/overlay";
import { EffectsManager } from "../rendering/EffectsManager";
import { installBattleSpace } from "../rendering/spaceMap/installBattleSpace";
import { audioManager } from "../audio/AudioManager";
import { hullFractionOf } from "../audio/musicContexts";
import { syncListenerToCamera } from "../audio/CameraListener";
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
import { difficultyToTier, type BotContact } from "../arcade/ai";
import { DuelBotCrew } from "../arcade/systems/DuelBotCrew";
import type { FlightEvent } from "../arcade/systems/PilotFlightTypes";
import { playFlightEventFx } from "../arcade/ArcadeFX";
import {
  assignQuickBuilds,
  equipFlight,
  equipQuickBuild,
  stressModifiersOf,
} from "../arcade/systems/QuickBuildEquip";
import {
  selectionFor,
  type QuickBuildSelection,
} from "../arcade/systems/QuickBuildChoice";
import { pickQuickBuild } from "./duel/duelSetupModel";
import { openDuelTabById, stepDuelTab } from "./duel/duelSetupChrome";
import { bindTabKeys } from "../ui/menu/DetailTabs";
import { SetupKeyNav } from "../ui/menu/SetupKeyNav";
import { consumeSceneData } from "./battleUi/consumeSceneData";
import { remember, remembered } from "./duel/duelMemory";

/** Values the remembered Dogfight setup may hold. */
const DUEL_DIFFICULTIES = ["easy", "normal", "hard", "brutal"] as const;
const DUEL_FORMATS = ["best_of_3", "best_of_5"] as const;
import { SettingsDefaultPick } from "../ui/menu/setupDefaults";
import { defaultDifficulty } from "../systems/SettingsStorage";
import { dogfightBriefing, showSortieBriefing } from "../ui/briefing";
import { bindMenuBack } from "../ui/menu/menuTransitions";
import { FACTION_NAMES_SHORT } from "../data/survival/factionNames";
import { DOGFIGHT_DEFAULT_PAIRING } from "../data/DogfightDefaults";
import {
  absorbDamage,
  combatantOf,
  resolveDiceAttack,
  type DiceAttackResult,
} from "../arcade/systems/DiceAttack";
import {
  deathBlastDamage,
  deathBlastTargets,
  hasWingman,
  rewardKill,
} from "../arcade/PilotAbilityCombat";
import { HitImmunityLedger } from "../arcade/systems/CombatTempo";
import {
  primaryCooldownAfterShot,
  primaryShotTarget,
} from "../arcade/systems/DuelPrimaryFire";
import { DuelHud } from "./duel/DuelHud";
import type {
  BattleWeapons,
  BattleWeaponsLink,
  WeaponHit,
} from "./battleUi/BattleWeapons";
import { createSceneWeapons, weaponBodyOf } from "./battleUi/sceneWeapons";
import {
  armorReductionOf,
  damageMitigationOf,
  shotAurasOf,
} from "../arcade/systems/DamageRules";
import type { ActiveAura } from "../systems/SupportAura";
import { applyAllyAuraRepairs } from "../systems/aura/AllyAuraRepair";
import { buildDuelHudSnapshot, playerTargetId } from "./duel/duelHudSnapshot";
import { showResultsPanel, type ResultsActions } from "../ui/results/ResultsPanel";
import { resultRows } from "../ui/results/resultsModel";
import {
  renderDogfightSetup,
  type DogfightSetupActions,
} from "./duel/DogfightSetupView";
import { cameraViewFrom } from "../ui/hud/hudMath";
import {
  HOLO_PALETTE,
  SIDE_COLORS,
  factionAccent,
} from "../ui/theme/HoloTheme";
import { applyInstantStress } from "../arcade/ArcadeStress";
import {
  NEUTRAL_MODIFIERS,
  type CombatModifiers,
} from "../core/CombatModifiers";
import { ShipTelemetry } from "../debug/ShipTelemetry";
import { bindAutoPause, pauseBattleIfRunning } from "./battleUi/AutoPause";
import { BattlePauseMenu } from "./battleUi/BattlePauseMenu";
import { InputManager } from "../input/InputManager";
import { setupSceneInput, teardownSceneInput } from "../input/setupSceneInput";
import {
  trackDeath,
  trackModeEnd,
  trackModeStart,
} from "../telemetry/telemetry";
import { matchStats } from "../telemetry/matchTelemetry";
import { dealerOf } from "../telemetry/matchStatTypes";
import { random, setDefaultRng, createRng } from "../utils/random";
import {
  createSideScore,
  creditKill,
  resolveByPoints,
  type SideScore,
} from "../systems/arena/BattleScore";
import type { OnlineDogfightInit } from "../net/lobby/matchSetup";
import { getOnlineSession } from "../net/lobby/createOnlineSession";
import {
  startOnlineBattle,
  type OnlineBattleDebug,
  type OnlineBattleLink,
} from "../net/battle/OnlineBattleLink";
import type { LockstepSimulation } from "../net/lockstep/types";
import { captureGraph, restoreGraph } from "../net/lockstep/StateGraph";
import { StateHasher } from "../net/lockstep/StateHasher";
import { TICK_MS, type TickInput } from "../net/protocol";
import {
  DogfightOnline,
  type DuelRoundResult,
  type DuelTimerKind,
} from "./duel/online/DogfightOnline";
import { ROUND_BANNER_MS } from "./duel/DuelBanner";
import { ONLINE_GRAPH_OPTIONS } from "./online/onlineGraph";
import { OnlineNoticeView } from "./online/OnlineNoticeView";
import {
  confirmLeaveOnlineBattle,
  ONLINE_LOBBY_SCENE,
} from "./online/onlineExit";
import { onlineResultsActions } from "./online/onlineResultsActions";
import { addOrdnance, addShip } from "./online/battleHash";

interface DogfightShip {
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
}

/** A pose on the battlefield. */
interface Pose {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

interface ShipSprite extends Phaser.GameObjects.Container {
  shipId: string;
}

type MatchFormat = "best_of_3" | "best_of_5";

/** The human's side key (SquadMark / DuelBotCrew); the AI flies as "ai". */
const PLAYER_SIDE = "player";

/** Round time limit (s). */
const ROUND_TIME_S = 180;
const MS_PER_S = 1000;
/** Pause between a round's result banner and the next round / match end (ms). */
const ROUND_RESULT_PAUSE_MS = 2000;
/** Round result banners. */
const RESULT_BANNERS = {
  player_win: { text: "VICTORY!", color: HOLO_PALETTE.success },
  enemy_win: { text: "DEFEAT", color: HOLO_PALETTE.danger },
  draw: { text: "DRAW", color: HOLO_PALETTE.warning },
} as const;

export class DogfightScene extends Phaser.Scene {
  private ships: Map<string, DogfightShip> = new Map();
  private shipSprites: Map<string, ShipSprite> = new Map();
  private healthBars: Map<string, HealthBar> = new Map();
  /** Repair mechanic + overlay shimmer + repair drones (built in create). */
  private repairFeedback: ShipRepairFeedback | null = null;

  private playerShipIds: string[] = [];
  private enemyShipIds: string[] = [];
  /** Round tempo: a struck ship ignores the same attacker until the next cycle. */
  private readonly hitLedger = new HitImmunityLedger();
  /** Secondary weapons (missiles, torpedoes, turrets, bombs, mines, cloak). */
  private weapons: BattleWeapons | null = null;
  /** Faction auras resolved this frame (buffs every shot and stress tick). */
  private auras: ReadonlyMap<string, ActiveAura> = new Map();

  // Match state
  private matchFormat: MatchFormat = "best_of_3";
  private playerWins = 0;
  private enemyWins = 0;
  private currentRound = 0;
  private roundTimeRemaining = ROUND_TIME_S;
  private isRoundActive = false;
  private roundResult: "none" | "player_win" | "enemy_win" | "draw" = "none";
  /** Destroyed squad-point cost per side this round; decides a timed-out round. */
  private playerSideScore: SideScore = createSideScore();
  private enemySideScore: SideScore = createSideScore();

  // Settings
  private playerFaction: FactionId = DOGFIGHT_DEFAULT_PAIRING.player.faction;
  private enemyFaction: FactionId = DOGFIGHT_DEFAULT_PAIRING.enemy.faction;
  private playerShipId = DOGFIGHT_DEFAULT_PAIRING.player.shipId;
  private enemyShipId = DOGFIGHT_DEFAULT_PAIRING.enemy.shipId;
  private difficulty: "easy" | "normal" | "hard" | "brutal" = "normal";
  /** Preselects Settings › Default Difficulty (kept across rematches). */
  private readonly difficultyDefault = new SettingsDefaultPick(
    (level) => level,
  );
  /**
   * The player's quick-build pick from the setup screen. Null (online, or
   * never touched) means the default assignQuickBuilds would give; a pick
   * made for another ship is ignored (see selectionFor).
   */
  private playerBuilds: QuickBuildSelection | null = null;
  /** Ship page each side's list was paged to on the setup (null = follow the selected ship). */
  private shipPages: Record<"player" | "enemy", number | null> = {
    player: null,
    enemy: null,
  };

  // Game state
  private isPaused = false;
  private isSetupPhase = true;
  /** REMATCH / pause RESTART: skip the setup screen and fly the same match again. */
  private rematchRequested = false;
  /** Arrow / D-pad navigation of the setup screen (null outside setup). */
  private setupNav: SetupKeyNav | null = null;
  private matchComplete = false;

  // Timing
  private lastSecondTime = 0;

  // Camera follow (manual — toroid wrap makes Phaser's startFollow jump at the seam)
  private cameraVirtualX = BATTLEFIELD_SIZE / 2;
  private cameraVirtualY = BATTLEFIELD_SIZE / 2;

  // Effects
  private effectsManager!: EffectsManager;
  private performanceState: PerformanceState = createPerformanceState();
  private telemetry: ShipTelemetry | null = null;
  private cameraShakeEnabled = true;

  /** The human pilot's flight input (InputManager-driven). */
  private readonly pilot = new PlayerFlightPilot(InputManager);
  /**
   * The round's AI: a BotPilot for the AI opponent (tier from the
   * difficulty — the bots the skill gates measure) and the squad marks
   * (the player's R mark). Null outside a round.
   */
  private crew: DuelBotCrew | null = null;

  // UI
  /** Holographic battle HUD + duel scoreboard; null outside a battle. */
  private hud: DuelHud | null = null;
  /** Setup-screen objects, tracked individually — see track()'s doc comment for why. */
  private setupObjects: Phaser.GameObjects.GameObject[] = [];
  private pauseMenu!: BattlePauseMenu;
  /** InputManager.on() subscription ids, unsubscribed in shutdown() to avoid duplicate callbacks after scene.restart(). */
  private inputSubscriptionIds: number[] = [];

  // Online duel (input lockstep through the relay): every client simulates
  // both seats from the same seed and inputs; only presentation reads the
  // local seat. Null offline.
  private online: DogfightOnline | null = null;
  private net: OnlineBattleLink | null = null;
  private notices: OnlineNoticeView | null = null;
  private leaveDialogOpen = false;
  /** Simulation time (ms): scene time offline, tick × TICK_MS online. */
  private simNowMs = 0;
  /** This scene as the lockstep session's simulation. */
  private readonly lockstep: LockstepSimulation = {
    step: (tick, inputs) => this.stepOnline(tick, inputs),
    hash: (tick) => this.hashOnline(tick),
    snapshot: () => captureGraph(this.simGraph(), ONLINE_GRAPH_OPTIONS),
    restore: (_tick, data) => this.restoreOnline(data),
  };

  constructor() {
    super({ key: "DogfightScene" });
  }

  /**
   * LobbyScene starts an online duel with an OnlineDogfightInit (canonical
   * seats, local seat, seed); any other start is a local match.
   *
   * @param data - Scene data.
   */
  init(data: Partial<OnlineDogfightInit> & { rematch?: boolean } = {}): void {
    this.online = null;
    this.rematchRequested = data.rematch === true;
    if (!data.online || !data.seats || data.seed === undefined) {
      consumeSceneData(this);
      return;
    }
    this.online = new DogfightOnline(data as OnlineDogfightInit);
    const [first, second] = data.seats;
    if (!first || !second) return;
    this.playerFaction = first.faction;
    this.playerShipId = first.shipId;
    this.enemyFaction = second.faction;
    this.enemyShipId = second.shipId;
    this.playerBuilds = null;
    this.difficulty = "normal";
    this.matchFormat = "best_of_3";
  }

  create(): void {
    // Phaser never calls shutdown() on its own; without this, every restart
    // stacks another set of input subscriptions.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    // No setBounds — camera is driven manually for seamless toroid wrapping (see updateCameraFollow).
    this.cameras.main.setBackgroundColor(0x050510);

    audioManager.initialize();

    this.effectsManager = new EffectsManager(this);
    this.repairFeedback = new ShipRepairFeedback({
      scene: this,
      shipOf: (id) => this.ships.get(id),
      overlayOf: (id) => this.healthBars.get(id),
      particleScale: () => this.performanceState.effectSettings.particleCount,
    });
    const savedSettings = this.registry.get("settings") as
      { cameraShake: boolean; showDamageNumbers: boolean } | undefined;
    if (savedSettings) {
      this.cameraShakeEnabled = savedSettings.cameraShake;
      this.effectsManager.setUserSettings({
        cameraShake: savedSettings.cameraShake,
        showDamageNumbers: savedSettings.showDamageNumbers,
      });
    }
    installBattleSpace(this);

    this.resetMatchState();
    this.weapons = createSceneWeapons(
      this,
      this.weaponsLink(),
      this.hitLedger,
      this.online === null,
    );

    if (this.online) {
      // Both players picked their ships in the lobby: no setup screen.
      this.startOnline(this.online);
    } else {
      const fromSettings = this.difficultyDefault.next(defaultDifficulty());
      this.difficulty =
        remembered("dogfight", "difficulty", DUEL_DIFFICULTIES) ??
        fromSettings ??
        this.difficulty;
      this.matchFormat =
        remembered("dogfight", "format", DUEL_FORMATS) ?? this.matchFormat;
      this.showSetupScreen();
      this.setupNav = new SetupKeyNav(this, {
        isActive: () => this.isSetupPhase,
      });
      this.setupNav.refresh();
      // The one back affordance (ESC / gamepad B / right-click), setup only.
      bindMenuBack(this, () => this.scene.start("MainMenuScene"), {
        isActive: () => this.isSetupPhase,
      });
      bindTabKeys(this, {
        step: (direction) => {
          stepDuelTab(direction);
          this.showSetupScreen();
        },
        isActive: () => this.isSetupPhase,
      });
      if (this.rematchRequested) this.startMatch();
    }

    if (ShipTelemetry.isEnabled()) {
      this.telemetry = new ShipTelemetry();
      this.telemetry.start();
      (
        window as unknown as { __shipTelemetry: ShipTelemetry }
      ).__shipTelemetry = this.telemetry;
    }

    // Zoom is applied once the round actually starts (see startNextRound) —
    // Phaser's hit-testing for scrollFactor(0) UI does not correctly ignore
    // camera zoom, so any non-1.0 zoom while the setup screen's buttons are
    // shown makes every button unclickable (verified live: resetting zoom to
    // 1.0 was the only change that made a real mouse click register).
    this.cameras.main.centerOn(BATTLEFIELD_SIZE / 2, BATTLEFIELD_SIZE / 2);
  }

  /** Unregisters input and the online link, and resets the shared RNG so a fixed battle seed never leaks into whatever plays next. */
  shutdown(): void {
    this.inputSubscriptionIds.forEach((id) => InputManager.off(id));
    this.inputSubscriptionIds = [];
    teardownSceneInput();
    this.pilot.detach();
    this.hud?.destroy();
    this.hud = null;
    this.weapons?.destroy();
    this.weapons = null;
    this.hitLedger.clear();
    if (!this.online) return;
    this.net?.dispose();
    this.net = null;
    this.notices?.destroy();
    this.notices = null;
    this.online.dispose();
    setDefaultRng(createRng());
    // Phaser keeps the last start data: a later local duel must not replay this match.
    this.sys.settings.data = {};
  }

  /** @returns The online link's diagnostics (e2e), or null offline. */
  get onlineDebug(): OnlineBattleDebug | null {
    return this.net?.debug ?? null;
  }

  /**
   * Builds the online duel and joins the relay's lockstep session: the
   * match RNG, the link, round 1; the relay starts the clock once both
   * clients report loaded.
   *
   * @param online - The online seats.
   */
  private startOnline(online: DogfightOnline): void {
    setDefaultRng(online.rng);
    this.notices = new OnlineNoticeView(this);
    this.net = startOnlineBattle(getOnlineSession(this.registry), {
      intents: InputManager,
      onNotice: (notice) => this.notices?.show(notice),
      onMatchEnd: () => {
        if (!this.matchComplete) this.endMatch();
      },
    });
    if (!this.net) {
      this.scene.start(ONLINE_LOBBY_SCENE);
      return;
    }
    this.startMatch();
    this.net.markLoaded();
  }

  /**
   * One lockstep tick: every seat's input, the round flow on the sim clock,
   * then the same simulation the local duel runs per frame.
   *
   * @param tick - The tick.
   * @param inputs - Every seat's input.
   */
  private stepOnline(tick: number, inputs: readonly TickInput[]): void {
    const online = this.online;
    if (!online) return;
    online.nowMs = tick * TICK_MS;
    this.simNowMs = online.nowMs;
    online.feed(inputs);
    for (const kind of online.takeDue()) this.runRoundEvent(kind);
    if (this.matchComplete) return;
    this.simulate(TICK_MS, online.nowMs);
  }

  /** @param kind - A round-flow event that fell due. */
  private runRoundEvent(kind: DuelTimerKind): void {
    if (kind === "round_live") this.isRoundActive = true;
    else if (kind === "next_round") this.startNextRound();
    else this.endMatch();
  }

  /**
   * After a round-flow delay: on the sim clock online, scene time offline.
   *
   * @param delayMs - Delay (ms).
   * @param kind - What happens then.
   */
  private after(delayMs: number, kind: DuelTimerKind): void {
    if (this.online) this.online.schedule(delayMs, kind);
    else this.time.delayedCall(delayMs, () => this.runRoundEvent(kind));
  }

  /** @returns Fingerprint of the duel (ships, ordnance, round, RNG). */
  private hashOnline(tick: number): number {
    const h = new StateHasher()
      .addInt(tick)
      .addInt(this.currentRound)
      .addInt(this.playerWins)
      .addInt(this.enemyWins)
      .addInt(this.roundTimeRemaining)
      .addBool(this.isRoundActive)
      .addString(this.roundResult)
      .addInt(this.online?.rng.getState() ?? 0);
    for (const ship of this.ships.values()) {
      addShip(h, ship, [
        ship.flight.motion.control,
        ship.flight.stress,
        { cooldown: ship.weaponCooldown, frenzy: ship.frenzyUntilMs },
      ]);
    }
    const runtime = this.weapons?.runtime;
    if (runtime)
      addOrdnance(
        h,
        runtime.shotsInFlight,
        runtime.devicesOnField,
        runtime.idCounters,
      );
    return h.digest();
  }

  /** @returns Every simulation object of the duel (snapshot root). */
  private simGraph() {
    const online = this.online;
    return {
      ships: this.ships,
      crew: this.crew,
      weapons: this.weapons?.simulation ?? null,
      ledger: this.hitLedger,
      repair: this.repairFeedback?.mechanic ?? null,
      auras: this.auras,
      seats: online?.seats ?? [],
      pilots: online?.pilots ?? [],
      rng: online?.rng ?? null,
      clock: { nowMs: online?.nowMs ?? 0, timers: online?.timers ?? [] },
      duel: {
        playerWins: this.playerWins,
        enemyWins: this.enemyWins,
        currentRound: this.currentRound,
        roundTimeRemaining: this.roundTimeRemaining,
        isRoundActive: this.isRoundActive,
        roundResult: this.roundResult,
        playerSideScore: this.playerSideScore,
        enemySideScore: this.enemySideScore,
        lastSecondTime: this.lastSecondTime,
        matchComplete: this.matchComplete,
        playerShipIds: this.playerShipIds,
        enemyShipIds: this.enemyShipIds,
      },
    };
  }

  /** @param data - The authority's snapshot: jump to it and redraw. */
  private restoreOnline(data: string): void {
    const live = this.simGraph();
    const r = restoreGraph(live, data, ONLINE_GRAPH_OPTIONS)
      .root as typeof live;
    this.crew = r.crew;
    this.auras = r.auras;
    if (this.online) {
      this.online.nowMs = r.clock.nowMs;
      this.online.timers = r.clock.timers;
    }
    Object.assign(this, r.duel);
    this.syncPresentation();
  }

  /** Sprites, overlays and the scoreboard for the ships a snapshot left. */
  private syncPresentation(): void {
    for (const [id, sprite] of this.shipSprites) {
      if (this.ships.has(id)) continue;
      sprite.destroy();
      this.shipSprites.delete(id);
      this.healthBars.get(id)?.destroy();
      this.healthBars.delete(id);
    }
    for (const ship of this.ships.values()) {
      if (!this.shipSprites.has(ship.id)) this.createShipSprite(ship);
      if (!this.isLocalShip(ship) && !this.healthBars.has(ship.id))
        this.createHealthBar(ship);
      this.shipSprites.get(ship.id)?.setPosition(ship.x, ship.y);
      this.healthBars.get(ship.id)?.update(ship.hull, ship.shields);
    }
    this.hud?.setRound(this.currentRound);
    this.updateTimerDisplay();
    this.updateScoreDisplay();
  }

  /** PAUSE online: the shared battle never pauses — offer to leave instead. */
  private askLeaveOnline(): void {
    if (!this.net || this.leaveDialogOpen || this.matchComplete) return;
    const zoom = this.cameras.main.zoom;
    confirmLeaveOnlineBattle(this, this.net, {
      onOpen: () => {
        this.leaveDialogOpen = true;
        this.cameras.main.setZoom(1);
      },
      onClose: () => {
        this.leaveDialogOpen = false;
        this.cameras.main.setZoom(zoom);
      },
    });
  }

  /** @param ship - A ship. @returns Whether this client flies it (camera, HUD, own colours). */
  private isLocalShip(ship: DogfightShip): boolean {
    return this.online
      ? ship.id === this.online.localShipId
      : ship.owner === PLAYER_SIDE;
  }

  /** @returns The ship this client flies. */
  private localShipId(): string {
    return this.online?.localShipId ?? this.playerShipIds[0] ?? "";
  }

  /** @returns The side this client flies (HUD allies, marks). */
  private localSide(): string {
    return this.online?.localSide ?? PLAYER_SIDE;
  }

  /** @returns The faction this client flies (accent, music). */
  private localFaction(): FactionId {
    const seat = this.online?.seat(this.online.localSeat);
    return seat?.faction ?? this.playerFaction;
  }

  /** @param ship - A ship. @returns Whether it flies on this client's side (telemetry). */
  private isFriendly(ship: DogfightShip): boolean {
    return ship.owner === this.localSide();
  }

  /**
   * @param shipId - A ship.
   * @returns Whether a human flies it now (online: its seat, unless the
   *   relay handed the seat to the AI; offline: the player's ship).
   */
  private isHumanFlown(shipId: string): boolean {
    if (this.online) return this.online.isHumanFlown(shipId);
    return shipId === this.playerShipIds[0];
  }

  /** @param shipId - A ship. @returns The human pilot controls flying it, or null. */
  private humanPilotOf(shipId: string): PlayerFlightPilot | null {
    if (this.online) return this.online.pilotFor(shipId);
    return shipId === this.playerShipIds[0] ? this.pilot : null;
  }

  /**
   * Starts a match from scratch. Phaser reuses this scene object on restart
   * (REMATCH / RESTART), so everything the previous run left behind is
   * cleared here; its game objects were already destroyed with the scene.
   */
  private resetMatchState(): void {
    this.playerWins = 0;
    this.enemyWins = 0;
    this.currentRound = 0;
    this.isRoundActive = false;
    this.matchComplete = false;
    this.isSetupPhase = true;
    this.isPaused = false;
    this.ships.clear();
    this.shipSprites.clear();
    this.healthBars.clear();
    this.playerShipIds = [];
    this.enemyShipIds = [];
    this.setupObjects = [];
    this.hud = null;
    this.hitLedger.clear();
  }

  private resetRoundState(): void {
    this.ships.clear();
    this.shipSprites.forEach((s) => s.destroy());
    this.shipSprites.clear();
    this.healthBars.forEach((h) => h.destroy());
    this.healthBars.clear();
    this.playerShipIds = [];
    this.enemyShipIds = [];
    this.roundTimeRemaining = ROUND_TIME_S;
    this.roundResult = "none";
    this.playerSideScore = createSideScore();
    this.enemySideScore = createSideScore();
    this.isPaused = false;
    this.pilot.reset();
    this.online?.resetPilots();
    this.hitLedger.clear();
    this.weapons?.runtime.clear();
    this.crew = null;
  }

  /**
   * The round's crew: a bot for the AI opponent at the difficulty's tier
   * (easy = novice, normal = average, hard = expert, brutal = expert with
   * faster reactions). Online both ships get a bot that flies only while
   * the relay hands that seat to the AI (its player dropped or left).
   *
   * @returns The crew for the ships just spawned.
   */
  private createCrew(): DuelBotCrew {
    const aiSkill = difficultyToTier(this.difficulty, "dogfight");
    return new DuelBotCrew({
      roster: [...this.ships.values()].map((ship) => ({
        shipId: ship.id,
        side: ship.owner,
        skill: this.online || ship.owner === "ai" ? aiSkill : null,
      })),
      playerSide: PLAYER_SIDE,
      random: () => random.next(),
      worldSize: BATTLEFIELD_SIZE,
    });
  }

  private showSetupScreen(): void {
    // Destroy any previous setup-screen objects. Buttons are NOT reparented
    // into a shared container (see track()'s doc comment) — track and
    // destroy them individually instead.
    this.setupObjects.forEach((o) => o.destroy());
    this.setupObjects = [];
    this.playerBuilds = selectionFor([this.playerShipId], this.playerBuilds);
    renderDogfightSetup(
      this,
      {
        matchFormat: this.matchFormat,
        playerFaction: this.playerFaction,
        enemyFaction: this.enemyFaction,
        playerShipId: this.playerShipId,
        enemyShipId: this.enemyShipId,
        difficulty: this.difficulty,
        playerLoadoutId: this.playerBuilds.loadoutIds[0] ?? null,
        enemyLoadoutId: this.quickBuildFor(this.enemyShipId, "ai"),
        shipPages: this.shipPages,
      },
      this.setupActions(),
      (obj) => this.track(obj),
    );
    this.setupNav?.refresh();
  }

  /**
   * What the setup screen's controls do: update a choice and re-render.
   *
   * @returns The setup actions.
   */
  private setupActions(): DogfightSetupActions {
    const choose = (apply: () => void): void => {
      apply();
      this.showSetupScreen();
    };
    return {
      selectFormat: (format) => choose(() => (this.matchFormat = format)),
      selectShip: (owner, shipId) =>
        choose(() => {
          this.shipPages = { ...this.shipPages, [owner]: null };
          if (owner === "player") this.playerShipId = shipId;
          else this.enemyShipId = shipId;
        }),
      selectFaction: (owner, faction) =>
        choose(() => {
          this.shipPages = { ...this.shipPages, [owner]: null };
          const firstShip = getShipsByFaction(faction)[0]?.id ?? "";
          if (owner === "player") {
            this.playerFaction = faction;
            this.playerShipId = firstShip;
          } else {
            this.enemyFaction = faction;
            this.enemyShipId = firstShip;
          }
        }),
      selectDifficulty: (difficulty) =>
        choose(() => (this.difficulty = difficulty)),
      selectBuild: (loadoutId) =>
        choose(() => {
          if (this.playerBuilds)
            this.playerBuilds = pickQuickBuild(this.playerBuilds, 0, loadoutId);
        }),
      selectTab: (tab) => choose(() => openDuelTabById(tab)),
      pageShips: (owner, page) =>
        choose(() => {
          this.shipPages = { ...this.shipPages, [owner]: page };
        }),
      start: () => this.briefSortie(),
      back: () => this.scene.start("MainMenuScene"),
    };
  }

  /**
   * The pre-sortie briefing (≤ 3 s, skippable); the match starts when it
   * closes. (Online matches skip the setup screen, so they skip this too.)
   */
  private briefSortie(): void {
    const nameOf = (id: string): string => getShipDefinition(id)?.name ?? id;
    showSortieBriefing(this, {
      briefing: dogfightBriefing({
        playerShip: nameOf(this.playerShipId),
        enemyShip: nameOf(this.enemyShipId),
        enemyFaction: FACTION_NAMES_SHORT[this.enemyFaction],
        difficulty: this.difficulty,
        roundsToWin: this.winsNeeded(),
      }),
      accent: factionAccent(this.playerFaction),
      onLaunch: () => this.startMatch(),
    });
  }

  /**
   * The quick build a ship spawns with: the player's pick for their ship
   * (default when untouched or picked for another ship), the default
   * otherwise.
   *
   * @param defId - Ship definition id.
   * @param owner - Who flies it.
   * @returns The loadout id, or null for the bare hull.
   */
  private quickBuildFor(defId: string, owner: "player" | "ai"): string | null {
    const chosen =
      owner === "player"
        ? (selectionFor([defId], this.playerBuilds).loadoutIds[0] ?? null)
        : null;
    return assignQuickBuilds([defId], [chosen])[0] ?? null;
  }

  /**
   * Registers a setup-screen object for fixed-position rendering and later
   * cleanup. Objects are kept as direct scene children (never reparented
   * into a shared container) — reparenting an already-interactive Container
   * into another Container was found to silently break real pointer-click
   * hit-testing (verified live: emitting "pointerdown" directly on the
   * button still worked, but an actual mouse click at the same screen
   * coordinates did not) even though the identical pattern works fine for
   * top-level containers (compare MainMenuScene's menu buttons).
   * The scroll factor is pushed down to container children too: Phaser
   * hit-tests each interactive object with its OWN scroll factor, so a
   * button whose hit rectangle is a child (the quick-build chooser's
   * arrows) ignored real clicks while the camera is scrolled
   * to the battlefield centre.
   */
  private track(obj: Phaser.GameObjects.GameObject): void {
    const withTransform = obj as unknown as {
      setScrollFactor?: (x: number) => unknown;
      setDepth?: (d: number) => unknown;
      list?: Phaser.GameObjects.GameObject[];
    };
    withTransform.setScrollFactor?.(0);
    withTransform.list?.forEach((child) =>
      (
        child as unknown as { setScrollFactor?: (x: number) => unknown }
      ).setScrollFactor?.(0),
    );
    withTransform.setDepth?.(2000);
    this.setupObjects.push(obj);
  }

  private startMatch(): void {
    this.setupNav?.destroy();
    this.setupNav = null;
    this.setupObjects.forEach((o) => o.destroy());
    this.setupObjects = [];
    this.isSetupPhase = false;
    remember("dogfight", {
      difficulty: this.difficulty,
      format: this.matchFormat,
    });
    const online = this.online !== null;
    trackModeStart("dogfight", { difficulty: this.difficulty, online });
    matchStats.start(
      "dogfight",
      { difficulty: this.difficulty, online },
      this.events,
    );

    audioManager.playBattleMusic("dogfight", this.localFaction());

    this.hud = new DuelHud(this, {
      accent: factionAccent(this.localFaction()),
      scoreColors: [SIDE_COLORS.player, SIDE_COLORS.enemy],
    });
    this.setupInput();
    this.startNextRound();
  }

  private startNextRound(): void {
    this.resetRoundState();
    this.currentRound++;

    this.hud?.setRound(this.currentRound);
    this.hud?.setClock(this.roundTimeRemaining * MS_PER_S);
    this.updateScoreDisplay();

    // Spawn ships closer together for faster engagement
    const centerX = BATTLEFIELD_SIZE / 2;
    const centerY = BATTLEFIELD_SIZE / 2;
    const spawnDistance = 200; // Closer than skirmish

    this.spawnShip(
      this.playerShipId,
      this.playerFaction,
      "player",
      centerX,
      centerY + spawnDistance,
      0,
    );
    this.spawnShip(
      this.enemyShipId,
      this.enemyFaction,
      "ai",
      centerX,
      centerY - spawnDistance,
      180,
    );
    this.crew = this.createCrew();

    this.showRoundStart();

    // Tighter zoom for dogfight — applied here, not at setup-screen time (see create()).
    this.cameras.main.setZoom(1.1);
    const playerSprite = this.shipSprites.get(this.localShipId());
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

  /** The ROUND N banner; weapons go live once it has faded (online: on the sim clock). */
  private showRoundStart(): void {
    if (this.online) {
      this.hud?.showRoundBanner(this.currentRound, () => undefined);
      this.after(ROUND_BANNER_MS, "round_live");
      return;
    }
    this.hud?.showRoundBanner(this.currentRound, () => {
      this.isRoundActive = true;
    });
  }

  update(time: number, delta: number): void {
    InputManager.update();
    // Mix every positional sound relative to what the player is
    // looking at, so a distant firefight sounds distant.
    syncListenerToCamera(this.cameras.main);
    if (this.online) {
      this.updateOnline(delta, time);
      return;
    }
    if (this.isSetupPhase || this.isPaused || this.matchComplete) return;
    this.updatePresentationQuality(time, delta);
    this.simulate(delta, time);
    this.updateSprites();
    this.updateCameraFollow();
    this.updateHud();
  }

  /**
   * Online frame: the lockstep session runs every due tick (stepOnline),
   * then the frame draws the result from the local seat's point of view.
   *
   * @param delta - Frame length (ms).
   * @param time - Scene time (ms).
   */
  private updateOnline(delta: number, time: number): void {
    this.notices?.update();
    if (this.isSetupPhase || this.matchComplete || !this.net) return;
    this.net.frame(delta, this.lockstep);
    if (this.matchComplete) return;
    this.updatePresentationQuality(time, delta);
    this.updateSprites();
    this.updateCameraFollow();
    this.updateHud();
  }

  /** Adaptive effect quality and the parallax background (presentation). */
  private updatePresentationQuality(time: number, delta: number): void {
    this.performanceState = updateFPS(this.performanceState, delta);
    this.performanceState = evaluateQuality(this.performanceState, time);
    this.effectsManager.setQualitySettings(
      this.performanceState.effectSettings,
    );
  }

  /**
   * The duel's simulation for one step: round clock, every pilot (human
   * and bot), flight, weapons once the round is live, round end. Offline it
   * runs per frame on scene time; online per lockstep tick on the sim clock.
   *
   * @param deltaMs - Step length (ms).
   * @param nowMs - Simulation time (ms).
   */
  private simulate(deltaMs: number, nowMs: number): void {
    this.simNowMs = nowMs;
    if (this.isRoundActive && this.tickRoundClock(nowMs)) return;
    this.updateAI(deltaMs);
    this.flyShips(deltaMs);
    // Ships close in during the ROUND banner; weapons go live with the round.
    if (this.isRoundActive) {
      this.applySeatWeaponKeys(nowMs);
      // Secondaries first: a held or chosen launch is this cycle's attack.
      this.weapons?.update(deltaMs, nowMs);
      this.processCombat(deltaMs);
    }
    this.checkRoundEnd();
  }

  /**
   * The round clock, one second at a time; a timed-out round goes to the
   * side that destroyed more squad points.
   *
   * @param nowMs - Simulation time (ms).
   * @returns True when the round just ended on time.
   */
  private tickRoundClock(nowMs: number): boolean {
    if (nowMs - this.lastSecondTime < MS_PER_S) return false;
    this.roundTimeRemaining--;
    this.updateTimerDisplay();
    this.lastSecondTime = nowMs;
    if (this.roundTimeRemaining > 0) return false;
    const outcome = resolveByPoints(this.playerSideScore, this.enemySideScore);
    this.endRound(
      outcome === "side1"
        ? "player_win"
        : outcome === "side2"
          ? "enemy_win"
          : "draw",
    );
    return true;
  }

  /** Online: every human seat's weapon keys this tick (offline BattleWeapons reads InputManager). */
  private applySeatWeaponKeys(nowMs: number): void {
    const online = this.online;
    if (!online) return;
    online.seats.forEach((seat, index) => {
      const shipId = online.shipIdOf(index);
      const ship = this.ships.get(shipId);
      if (!ship || ship.hull <= 0 || seat.aiControl) return;
      this.weapons?.pilotKeys(
        shipId,
        (intent) => seat.pressed(intent),
        nowMs,
        index === online.localSeat,
      );
    });
  }

  /** Feeds the holographic HUD this frame's ships, camera and the player's mark. */
  private updateHud(): void {
    const playerId = this.localShipId();
    const side = this.localSide();
    audioManager.reportPlayerHull(hullFractionOf(this.ships.get(playerId)));
    this.hud?.update(
      buildDuelHudSnapshot({
        ships: this.ships.values(),
        playerId,
        isAlly: (ship) => ship.owner === side,
        camera: cameraViewFrom(this.cameras.main),
        worldSize: BATTLEFIELD_SIZE,
        markedId: this.crew?.markedTargetOf(side, this.simNowMs) ?? null,
        secondaryWeapons: this.weapons?.hudSlots() ?? [],
      }),
    );
  }

  /**
   * R / gamepad R3: a pilot marks their HUD's current target for their side.
   *
   * @param shipId - The marking pilot's ship.
   * @param side - Its side.
   */
  private markHudTarget(shipId: string, side: string): void {
    const targetId = playerTargetId({
      ships: this.ships.values(),
      playerId: shipId,
      isAlly: (ship) => ship.owner === side,
      worldSize: BATTLEFIELD_SIZE,
    });
    if (targetId) this.crew?.markTarget(side, targetId, this.simNowMs);
    if (targetId && side === this.localSide())
      matchStats.record({ kind: "mark" });
  }

  /** Every human pilot's MARK_TARGET since the last step. */
  private takeMarkRequests(): void {
    const online = this.online;
    if (!online) {
      if (this.pilot.takeMarkRequest())
        this.markHudTarget(this.playerShipIds[0] ?? "", PLAYER_SIDE);
      return;
    }
    online.pilots.forEach((pilot, seat) => {
      const shipId = online.shipIdOf(seat);
      const ship = this.ships.get(shipId);
      if (pilot.takeMarkRequest() && ship && this.isHumanFlown(shipId))
        this.markHudTarget(shipId, ship.owner);
    });
  }

  /**
   * Manually follows the player ship with toroid-aware shortest-path lerp
   * (mirrors ArcadeBattleScene.updateCameraFollow) so the camera doesn't stay
   * pinned to the battlefield center while the ship flies away.
   */
  private updateCameraFollow(): void {
    const ship = this.ships.get(this.localShipId());
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

  private updateTimerDisplay(): void {
    this.hud?.setClock(this.roundTimeRemaining * MS_PER_S);
  }

  /** Best-of score (this client's side first); highlighted once either side is one round from the match. */
  private updateScoreDisplay(): void {
    const remaining =
      this.winsNeeded() - Math.max(this.playerWins, this.enemyWins);
    const flipped = (this.online?.localSeat ?? 0) !== 0;
    this.hud?.setScore(
      flipped ? this.enemyWins : this.playerWins,
      flipped ? this.playerWins : this.enemyWins,
      remaining === 1,
    );
  }

  /** @returns Round wins that take the match. */
  private winsNeeded(): number {
    return this.matchFormat === "best_of_3" ? 2 : 3;
  }

  private setupInput(): void {
    setupSceneInput(this);
    if (!this.online) this.pilot.attach();
    this.createPauseMenu();
    this.inputSubscriptionIds.push(
      InputManager.on("PAUSE", () =>
        this.online ? this.askLeaveOnline() : this.togglePause(),
      ),
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
        this.cameras.main.setZoom(Phaser.Math.Clamp(zoom, 0.8, 2));
      },
    );
  }

  /** Leaving the page (tab switch, minimise) pauses an offline battle; resuming is manual. */
  pauseIfRunning(): void {
    pauseBattleIfRunning({ paused: this.isPaused, online: this.online !== null }, () => this.togglePause());
  }

  private createPauseMenu(): void {
    bindAutoPause(this, () => this.pauseIfRunning());
    this.pauseMenu = new BattlePauseMenu({
      scene: this,
      legend: "duel",
      online: this.online !== null,
      onResume: () => {
        this.isPaused = false;
      },
      onRestart: () => {
        this.scene.restart({ rematch: true });
      },
      onQuit: () => {
        this.scene.start("MainMenuScene");
      },
      ensurePaused: () => {
        if (!this.isPaused && this.online === null) this.togglePause();
      },
    });
  }

  /**
   * ESC previously just flipped `isPaused` with no visual feedback and no
   * way back to the menu — the freeze looked like a bug. Now it shows a
   * real pause overlay (RESUME/RESTART/SETTINGS/QUIT), resetting zoom to 1.0
   * first for the same hit-testing reason as the setup/end-match screens.
   */
  private togglePause(): void {
    if (this.isSetupPhase || this.matchComplete) return;
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.cameras.main.setZoom(1.0);
      this.pauseMenu.show();
    } else {
      this.pauseMenu.hide();
    }
  }

  private spawnShip(
    defId: string,
    faction: FactionId,
    owner: "player" | "ai",
    x: number,
    y: number,
    angle: number,
  ): void {
    const id = `${owner}_0`;
    const combatStats = getModeCombatStats(defId, "continuous");
    const loadoutId = this.quickBuildFor(defId, owner);

    const ship: DogfightShip = {
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
      combatStats,
      flight: createCycleFlight(defId, { x, y, angle }),
      dial: getShipDial(defId),
      weaponCooldown: 0,
      loadoutId,
      modifiers: NEUTRAL_MODIFIERS,
      frenzyUntilMs: 0,
    };
    ship.modifiers = equipQuickBuild(ship, loadoutId);
    ship.flight = equipFlight(ship.flight, ship.modifiers);
    this.weapons?.equip(id, {
      definitionId: defId,
      loadoutId,
      modifiers: ship.modifiers,
    });

    this.ships.set(id, ship);
    matchStats.record({
      kind: "deploy",
      friendly: this.isFriendly(ship),
      shipId: id,
    });

    if (owner === "player") {
      this.playerShipIds.push(id);
    } else {
      this.enemyShipIds.push(id);
    }

    this.createShipSprite(ship);
    // The player's durability lives on the HUD status ring.
    if (!this.isLocalShip(ship)) this.createHealthBar(ship);
  }

  private createShipSprite(ship: DogfightShip): void {
    const container = this.add.container(
      ship.x,
      ship.y,
    ) as unknown as ShipSprite;
    container.shipId = ship.id;

    const shipDef = getShipDefinition(ship.definitionId);
    const sizeName = shipDef?.baseStats.size ?? "medium";
    const size = SHIP_SIZES[sizeName] ?? SHIP_SIZES.medium;

    addShipVisual(this, container, {
      definitionId: ship.definitionId,
      faction: ship.faction,
      fallbackSizeName: sizeName,
      size,
      isPlayer: this.isLocalShip(ship),
    });

    container.setAngle(ship.angle);
    container.setDepth(10);
    container.setSize(size * 2, size * 2);
    container.setInteractive();
    ShipStatCard.attachHoverCard(this, container, ship.definitionId);

    this.shipSprites.set(ship.id, container);
  }

  private createHealthBar(ship: DogfightShip): void {
    const isPlayers = this.isFriendly(ship);
    const healthBar = new HealthBar({
      scene: this,
      x: ship.x,
      y: ship.y - 50,
      faction: ship.faction,
      maxHull: ship.maxHull,
      maxShields: ship.maxShields,
      currentHull: ship.hull,
      currentShields: ship.shields,
      side: overlaySide(isPlayers, isPlayers),
      definitionId: ship.definitionId,
    });
    this.healthBars.set(ship.id, healthBar);
  }

  /**
   * Flies every ship one frame on the tabletop cycle engine (template arcs,
   * cycle-boundary commits, stress) and syncs sprites to the new poses.
   *
   * @param deltaMs - Frame length (ms).
   */
  private flyShips(deltaMs: number): void {
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;
      const tick = tickCycleFlight(ship.flight, {
        deltaMs,
        worldSize: BATTLEFIELD_SIZE,
        dial: ship.dial,
        cycleMs: CYCLE_DURATION_MS,
        modifiers: stressModifiersOf(ship.modifiers, this.auras.get(ship.id)),
      });
      this.setFlight(ship, tick.state);
      this.repairFeedback?.selfRepair(ship, deltaMs);
      if (tick.completed) this.onCycleCommitted(ship, tick.state);
      if (tick.completed && this.isLocalShip(ship))
        matchStats.record({
          kind: "cycle",
          dial: ship.dial,
          direction: tick.completed.direction,
          speed: tick.completed.speed,
        });
      this.shipSprites
        .get(ship.id)
        ?.setPosition(ship.x, ship.y)
        .setAngle(ship.angle);
      this.telemetry?.sample(ship.id, ship.x, ship.y, ship.angle);
    }
    // Faction auras (support ships, hero pilots): repairs now, buffs at
    // every shot and stress tick — the same in every battle mode.
    this.auras = applyAllyAuraRepairs(
      [...this.ships.values()].filter((ship) => ship.hull > 0),
      this.repairFeedback,
      deltaMs,
    );
  }

  /**
   * A ship's maneuver cycle committed: its pilot (human or bot) learns which
   * maneuver the new cycle started.
   *
   * @param ship - The ship.
   * @param flight - Its flight state after the commit.
   */
  private onCycleCommitted(ship: DogfightShip, flight: CycleFlightState): void {
    this.crew?.onCycleCommitted(ship);
    const { control } = flight.motion;
    this.humanPilotOf(ship.id)?.onCycleCommitted(
      control.currentManeuver ?? "straight",
    );
  }

  /**
   * Stores a ship's new flight state and mirrors its pose onto the record
   * (combat, AI and camera read x/y/angle).
   *
   * @param ship - The ship.
   * @param flight - Its new flight state.
   */
  private setFlight(ship: DogfightShip, flight: CycleFlightState): void {
    ship.flight = flight;
    ship.x = flight.motion.x;
    ship.y = flight.motion.y;
    ship.angle = flight.motion.angle;
  }

  /**
   * Visual feedback for flight events, drawn from the pose they started at.
   *
   * @param ship - The ship that acted.
   * @param events - What happened this frame.
   * @param origin - Pose before the actions.
   */
  private playFlightEvents(
    ship: DogfightShip,
    events: readonly FlightEvent[],
    origin: Pose,
  ): void {
    const isPlayer = this.isLocalShip(ship);
    for (const event of events) {
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
  }

  /**
   * Autofires every ready primary weapon on the round tempo: at most one
   * attack per maneuver cycle, never at a target still immune to that
   * attacker (the cooldown is kept for the next frame instead).
   *
   * @param delta - Frame length (ms).
   */
  private processCombat(delta: number): void {
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;
      ship.weaponCooldown = Math.max(0, ship.weaponCooldown - delta);
      if (ship.weaponCooldown > 0) continue;
      const target = primaryShotTarget({
        gunner: ship,
        candidates: this.ships.values(),
        isEnemy: (other) => other.owner !== ship.owner,
        ledger: this.hitLedger,
        nowMs: this.simNowMs,
        preferredId: this.isHumanFlown(ship.id)
          ? null
          : (this.crew?.targetOf(ship.id) ?? null),
        worldSize: BATTLEFIELD_SIZE,
      });
      if (!target) continue;
      this.fireAt(ship, target);
      ship.weaponCooldown = primaryCooldownAfterShot(ship);
    }
  }

  /**
   * Fires the primary weapon: the same dice odds for every pilot (an AI's
   * skill is in its flying), the squad-mark bonus when the shooter's squad
   * marked the target, DiceAttack applies equipment and abilities, and a hit
   * makes the target immune to this attacker until the next cycle.
   *
   * @param attacker - The firing ship.
   * @param target - The ship fired at.
   */
  private fireAt(attacker: DogfightShip, target: DogfightShip): void {
    const result = resolveDiceAttack({
      attacker: combatantOf(attacker),
      target: combatantOf(target),
      hitChance: calculateHitChance(
        attacker.combatStats.attackDice,
        target.combatStats.agilityDice,
      ),
      baseDamage: attacker.combatStats.attackDice,
      attackerHasWingman: this.fliesWithWingman(attacker),
      targetHasWingman: this.fliesWithWingman(target),
      nowMs: this.simNowMs,
      roll: random.next(),
      targetMarked:
        this.crew?.isMarkedShot(attacker.id, target.id, this.simNowMs) ?? false,
      ...shotAurasOf(this.auras, attacker.id, target.id),
      targetArmor: armorReductionOf(target.definitionId),
    });
    this.weapons?.onAttack(attacker.id);
    const cloak = this.weapons?.incomingDamageFactor(target.id) ?? 1;
    if (result.hit)
      this.applyHit(attacker, target, {
        ...result,
        damage: Math.max(1, Math.round(result.damage * cloak)),
      });
    matchStats.record({
      kind: "shot",
      friendly: this.isFriendly(attacker),
      weapon: "primary",
      hit: result.hit,
    });
    this.effectsManager.fireLaser(
      attacker.x,
      attacker.y,
      target.x,
      target.y,
      attacker.faction,
      result.hit,
    );
  }

  /**
   * Lands a hit: stress on the target's pilot, damage shields first then
   * hull, hit immunity for this attacker, and the kill on the last point.
   *
   * @param attacker - The firing ship.
   * @param target - The ship hit.
   * @param result - The resolved shot.
   */
  private applyHit(
    attacker: DogfightShip,
    target: DogfightShip,
    result: DiceAttackResult,
  ): void {
    this.setFlight(target, {
      ...target.flight,
      stress: applyInstantStress(target.flight.stress, result.stressOnTarget),
    });
    const after = absorbDamage(target, result.damage);
    matchStats.record({
      kind: "damage",
      toFriendly: this.isFriendly(target),
      hull: target.hull - after.hull,
      shield: target.shields - after.shields,
      ...dealerOf(attacker),
    });
    if (after.shields < target.shields) {
      audioManager.playSoundAt("shield_hit", target.x, target.y, 0.4);
    }
    if (after.hull < target.hull) {
      audioManager.playSoundAt("hull_hit", target.x, target.y, 0.4);
    }
    const wasAlive = target.hull > 0;
    Object.assign(target, after);
    this.hitLedger.recordHit(attacker.id, target.id, this.simNowMs);
    this.healthBars.get(target.id)?.update(target.hull, target.shields);
    if (wasAlive && target.hull <= 0) this.onShipDestroyed(attacker, target);
  }

  /** @returns What the secondary weapons read from (and ask of) this scene. */
  private weaponsLink(): BattleWeaponsLink {
    return {
      bodies: () =>
        [...this.ships.values()].map((ship) =>
          weaponBodyOf(
            ship,
            ship.owner,
            damageMitigationOf(
              ship.modifiers,
              this.fliesWithWingman(ship),
              this.auras.get(ship.id),
            ),
          ),
        ),
      wantedTargetOf: (shipId: string) =>
        this.isHumanFlown(shipId)
          ? playerTargetId({
              ships: this.ships.values(),
              playerId: shipId,
              isAlly: (ship) => ship.owner === this.ships.get(shipId)?.owner,
              worldSize: BATTLEFIELD_SIZE,
            })
          : (this.crew?.targetOf(shipId) ?? null),
      playerShipId: () => this.localShipId() || null,
      playerSide: () => this.localSide(),
      sideOf: (shipId: string) => this.ships.get(shipId)?.owner ?? null,
      isBotControlled: (shipId: string) => !this.isHumanFlown(shipId),
      applyHit: (hit: WeaponHit) => this.applyWeaponHit(hit),
      spriteOf: (shipId: string) => this.shipSprites.get(shipId),
    };
  }

  /**
   * A secondary weapon's hit (missile, torpedo, turret, bomb, mine): the
   * same shields-then-hull path as a laser; a blast can catch the
   * dropper's own side (friendly fire).
   *
   * @param hit - The hit from the weapons runtime.
   */
  private applyWeaponHit(hit: WeaponHit): void {
    const target = this.ships.get(hit.targetId);
    if (!target || target.hull <= 0) return;
    const attacker = this.ships.get(hit.attackerId) ?? target;
    matchStats.record({
      kind: "hit",
      friendly: attacker.owner === "player",
      weapon: "ordnance",
    });
    this.applyHit(attacker, target, {
      hit: true,
      damage: hit.damage,
      stressOnTarget: hit.stress,
    });
  }

  /** The secondary-weapons glue (e2e). */
  get secondaryWeapons(): BattleWeapons | null {
    return this.weapons;
  }

  /**
   * A ship was destroyed: its cost goes to the other side's round score, it
   * leaves the immunity ledger, and pilot-ability kill effects resolve.
   *
   * @param killer - The ship credited with the kill.
   * @param victim - The ship destroyed.
   */
  private onShipDestroyed(killer: DogfightShip, victim: DogfightShip): void {
    this.hitLedger.forget(victim.id);
    this.crew?.forget(victim.id);
    matchStats.record({
      kind: "kill",
      victimFriendly: this.isFriendly(victim),
      victimIsPlayer: this.isLocalShip(victim),
    });
    if (this.isLocalShip(victim))
      trackDeath("dogfight", killer.definitionId, { round: this.currentRound });
    if (victim.owner === "player") {
      this.enemySideScore = creditKill(
        this.enemySideScore,
        victim.definitionId,
      );
    } else {
      this.playerSideScore = creditKill(
        this.playerSideScore,
        victim.definitionId,
      );
    }
    this.resolveAbilityKill(killer, victim);
  }

  /**
   * @param ship - The ship asking.
   * @returns Whether another living ship of its side flies within wingman range.
   */
  private fliesWithWingman(ship: DogfightShip): boolean {
    const allies = [...this.ships.values()].filter(
      (other) => other.faction === ship.faction && other.hull > 0,
    );
    return hasWingman(ship, allies);
  }

  /**
   * Pilot-ability effects of a kill: the killer's reward (shields, frenzy)
   * and the victim's death blast on enemies nearby.
   *
   * @param killer - The ship that made the kill.
   * @param victim - The ship destroyed.
   */
  private resolveAbilityKill(killer: DogfightShip, victim: DogfightShip): void {
    if (killer.hull > 0) {
      Object.assign(killer, rewardKill(combatantOf(killer), this.simNowMs));
    }
    const enemies = [...this.ships.values()].filter(
      (other) => other.faction !== victim.faction && other.hull > 0,
    );
    const blastDamage = deathBlastDamage(combatantOf(victim));
    for (const caught of deathBlastTargets(combatantOf(victim), enemies)) {
      Object.assign(caught, absorbDamage(caught, blastDamage));
      this.healthBars.get(caught.id)?.update(caught.hull, caught.shields);
      if (caught.hull > 0) continue;
      this.hitLedger.forget(caught.id);
      this.crew?.forget(caught.id);
    }
  }

  /**
   * Queues every ship's next maneuver: the player's from input (and their
   * R mark), every AI ship's from its BotPilot — the same controls, through
   * the same pilot hands. Online every seat's human flies from its lockstep
   * input; a seat the relay hands to the AI is flown by its bot.
   *
   * @param delta - Step length (ms).
   */
  private updateAI(delta: number): void {
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0 || !this.isHumanFlown(ship.id)) continue;
      const pilot = this.humanPilotOf(ship.id);
      if (pilot) this.flyPlayer(ship, pilot, delta);
    }
    this.takeMarkRequests();
    const crew = this.crew;
    if (!crew) return;
    const contacts = crew.contactsOf(this.ships.values());
    crew.command(contacts, this.simNowMs);
    for (const ship of this.ships.values()) {
      if (ship.hull > 0 && !this.isHumanFlown(ship.id))
        this.flyBot(ship, contacts, delta);
    }
  }

  /**
   * One frame of a ship's bot, applied exactly like the player's input.
   *
   * @param ship - A ship (no-op unless a bot flies it).
   * @param contacts - Every ship as the AI sees it.
   * @param delta - Frame length (ms).
   */
  private flyBot(
    ship: DogfightShip,
    contacts: readonly BotContact[],
    delta: number,
  ): void {
    const origin = { x: ship.x, y: ship.y, angle: ship.angle };
    const result = this.crew?.fly(ship, contacts, this.simNowMs, delta);
    if (!result) return;
    this.setFlight(ship, { motion: result.motion, stress: result.stress });
    this.playFlightEvents(ship, result.events, origin);
  }

  /**
   * Runs one step of a human pilot's flight input through the shared pilot
   * controls (tap = drift, hold = bank, Q/E = hard turn, Snap turn, Hook,
   * Knife, boost, barrel roll).
   *
   * @param ship - The human's ship.
   * @param pilot - Its pilot controls (InputManager offline, a seat online).
   * @param delta - Step length (ms).
   */
  private flyPlayer(
    ship: DogfightShip,
    pilot: PlayerFlightPilot,
    delta: number,
  ): void {
    const origin = { x: ship.x, y: ship.y, angle: ship.angle };
    const result = pilot.fly({
      flight: ship.flight,
      ship: ship.flight.motion,
      dial: ship.dial,
      nowMs: this.simNowMs,
      deltaMs: delta,
      worldSize: BATTLEFIELD_SIZE,
    });
    this.setFlight(ship, { motion: result.motion, stress: result.stress });
    this.playFlightEvents(ship, result.events, origin);
    if (!this.isLocalShip(ship)) return;
    this.weapons?.showRefusals(result.refusals, ship);
    matchStats.record({ kind: "flight", events: result.events });
    matchStats.record({
      kind: "stress",
      ms: delta,
      stressed: result.stress.isStressed,
    });
  }

  private updateSprites(): void {
    const markedId =
      this.crew?.markedTargetOf(this.localSide(), this.simNowMs) ?? null;
    for (const [id, ship] of this.ships) {
      const healthBar = this.healthBars.get(id);
      if (healthBar) {
        healthBar.setPosition(ship.x, ship.y - 50);
        healthBar.setTargeted(id === markedId);
      }
    }
  }

  private checkRoundEnd(): void {
    if (!this.isRoundActive) return;

    const playerAlive = this.playerShipIds.some((id) => {
      const ship = this.ships.get(id);
      return ship && ship.hull > 0;
    });

    const enemyAlive = this.enemyShipIds.some((id) => {
      const ship = this.ships.get(id);
      return ship && ship.hull > 0;
    });

    if (!enemyAlive) {
      this.endRound("player_win");
    } else if (!playerAlive) {
      this.endRound("enemy_win");
    }
  }

  /** @param result - The round's result from the "player" side (seat 0 online). */
  private endRound(result: DuelRoundResult): void {
    this.isRoundActive = false;
    this.roundResult = result;
    if (result === "player_win") this.playerWins++;
    else if (result === "enemy_win") this.enemyWins++;
    const banner = RESULT_BANNERS[this.online?.localResult(result) ?? result];
    this.showRoundResult(banner.text, banner.color);
    this.updateScoreDisplay();

    const winsNeeded = this.winsNeeded();
    const decided =
      this.playerWins >= winsNeeded || this.enemyWins >= winsNeeded;
    this.after(ROUND_RESULT_PAUSE_MS, decided ? "end_match" : "next_round");
  }

  /**
   * @param message - Banner text.
   * @param color - Banner colour.
   */
  private showRoundResult(message: string, color: number): void {
    this.hud?.showResultBanner(message, color);
  }

  private endMatch(): void {
    this.matchComplete = true;
    // Same scrollFactor(0)-vs-zoom hit-test issue as the setup screen — the
    // player may have zoomed with the mouse wheel during the match, which
    // would make REMATCH/MENU unclickable below if left as-is.
    this.cameras.main.setZoom(1.0);
    // Hide the in-battle HUD under the end screen.
    this.hud?.setVisible(false);

    const seat0Result: DuelRoundResult =
      this.playerWins > this.enemyWins ? "player_win" : "enemy_win";
    this.net?.reportMatchOver(this.online?.winnerTeam(seat0Result) ?? null);
    const playerWon =
      (this.online?.localResult(seat0Result) ?? seat0Result) === "player_win";
    const flipped = (this.online?.localSeat ?? 0) !== 0;
    const [mine, theirs] = flipped
      ? [this.enemyWins, this.playerWins]
      : [this.playerWins, this.enemyWins];
    trackModeEnd("dogfight", playerWon ? "victory" : "defeat", {
      rounds: this.currentRound,
    });
    matchStats.finish(playerWon ? "victory" : "defeat", {
      rounds: this.currentRound,
    });
    audioManager.playFactionStinger(
      this.localFaction(),
      playerWon ? "victory" : "defeat",
    );
    const sweep = (playerWon ? theirs : mine) === 0;
    showResultsPanel({
      scene: this,
      tone: playerWon ? "victory" : "defeat",
      banner: playerWon ? "MATCH WON" : "MATCH LOST",
      subtitle: `Final score  ${mine}  \u2013  ${theirs}`,
      rows: resultRows(matchStats.lastSummary),
      notes: sweep ? ["Sweep!"] : [],
      actions: this.endScreenActions(),
    });
  }

  /** @returns The results actions: a local duel replays or returns to setup; an online one votes the relay rematch. */
  private endScreenActions(): ResultsActions {
    if (!this.online)
      return {
        onRematch: () => this.scene.restart({ rematch: true }),
        onSetup: () => this.scene.restart(),
        setupLabel: "Back to setup",
        onMenu: () => this.scene.start("MainMenuScene"),
      };
    return onlineResultsActions(this, this.net?.match.matchId ?? "");
  }
}
