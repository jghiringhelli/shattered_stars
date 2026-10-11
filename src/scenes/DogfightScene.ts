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
import type { ManeuverDefinition, ManeuverDirection } from "../core/types";
import {
  createCycleFlight,
  tickCycleFlight,
  type CycleFlightState,
} from "../arcade/systems/CycleFlight";
import { PlayerFlightPilot } from "../arcade/systems/PlayerFlightPilot";
import { difficultyToTier, type BotContact } from "../arcade/ai";
import { DuelBotCrew } from "../arcade/systems/DuelBotCrew";
import { shiftMotion } from "../arcade/systems/ShipMotion";
import type { FlightEvent } from "../arcade/systems/PilotFlightTypes";
import { playFlightEventFx } from "../arcade/ArcadeFX";
import {
  assignQuickBuilds,
  equipFlight,
  equipQuickBuild,
  regenerateShields,
  stressModifiersOf,
} from "../arcade/systems/QuickBuildEquip";
import {
  cycleQuickBuild,
  selectionFor,
  type QuickBuildSelection,
} from "../arcade/systems/QuickBuildChoice";
import { renderQuickBuildChooser } from "../ui/QuickBuildChooser";
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
import { buildDuelHudSnapshot, playerTargetId } from "./duel/duelHudSnapshot";
import { showDuelEndScreen } from "./duel/DuelEndScreen";
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
import { PauseMenu } from "../ui/PauseMenu";
import { networkService } from "../services/NetworkService";
import { InputManager } from "../input/InputManager";
import { setupSceneInput, teardownSceneInput } from "../input/setupSceneInput";
import {
  random,
  setDefaultRng,
  createSeededRng,
  createRng,
} from "../utils/random";
import {
  createSideScore,
  creditKill,
  resolveByPoints,
  type SideScore,
} from "../systems/arena/BattleScore";

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

/**
 * Shortest signed displacement between two coordinates on the torus.
 * @param delta - Raw difference (px).
 * @returns The equivalent difference in [-size/2, size/2).
 */
function torusDelta(delta: number): number {
  const half = BATTLEFIELD_SIZE / 2;
  return (
    ((((delta + half) % BATTLEFIELD_SIZE) + BATTLEFIELD_SIZE) %
      BATTLEFIELD_SIZE) -
    half
  );
}

interface ShipSprite extends Phaser.GameObjects.Container {
  shipId: string;
}

type MatchFormat = "best_of_3" | "best_of_5";

/** The human's side key (SquadMark / DuelBotCrew); the AI flies as "ai". */
const PLAYER_SIDE = "player";

/** The player's quick-build chooser box on the setup screen (left of the "Your ship" panel). */
const QUICK_BUILD_CHOOSER_X = 24;
const QUICK_BUILD_CHOOSER_Y = 226;
const QUICK_BUILD_CHOOSER_W = 290;
/** Round time limit (s). */
const ROUND_TIME_S = 180;
const MS_PER_S = 1000;
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

  private playerShipIds: string[] = [];
  private enemyShipIds: string[] = [];
  /** Round tempo: a struck ship ignores the same attacker until the next cycle. */
  private readonly hitLedger = new HitImmunityLedger();

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
  private playerFaction: FactionId = "free_confederation";
  private enemyFaction: FactionId = "terran_hegemony";
  private playerShipId = "confed_falcon";
  private enemyShipId = "terran_raptor";
  private difficulty: "easy" | "normal" | "hard" | "brutal" = "normal";
  /**
   * The player's quick-build pick from the setup screen. Null (online, or
   * never touched) means the default assignQuickBuilds would give; a pick
   * made for another ship is ignored (see selectionFor).
   */
  private playerBuilds: QuickBuildSelection | null = null;

  // Game state
  private isPaused = false;
  private isSetupPhase = true;
  private matchComplete = false;

  // Timing
  private lastSecondTime = 0;

  // Camera follow (manual — toroid wrap makes Phaser's startFollow jump at the seam)
  private cameraVirtualX = BATTLEFIELD_SIZE / 2;
  private cameraVirtualY = BATTLEFIELD_SIZE / 2;

  // Effects
  private effectsManager!: EffectsManager;
  private background!: ParallaxBackground;
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
  private pauseMenu!: PauseMenu;
  /** InputManager.on() subscription ids, unsubscribed in shutdown() to avoid duplicate callbacks after scene.restart(). */
  private inputSubscriptionIds: number[] = [];

  // Online multiplayer (networked 1v1 — see setupNetworking()/onRemoteAction()).
  // Each client is authoritative for its own ship's input and for combat
  // rolls it initiates as attacker; the opponent's ship is driven entirely
  // by network messages instead of local AI/RNG.
  private isOnlineMode = false;
  private onlineSeed = 0;
  private lastSentManeuver: { dir: ManeuverDirection; speed: number } | null =
    null;

  constructor() {
    super({ key: "DogfightScene" });
  }

  /**
   * Receives online-match config from LobbyScene's `scene.start("DogfightScene", data)`.
   * Absent/undefined `isOnlineMode` means a normal local match — every field
   * keeps its class-level default in that case.
   */
  init(
    data: {
      isOnlineMode?: boolean;
      seed?: number;
      localFactionId?: FactionId;
      localShipId?: string;
      opponentFactionId?: FactionId;
      opponentShipId?: string;
    } = {},
  ): void {
    if (!data.isOnlineMode) return;
    this.isOnlineMode = true;
    this.onlineSeed = data.seed ?? 0;
    this.playerFaction = data.localFactionId ?? this.playerFaction;
    this.playerShipId = data.localShipId ?? this.playerShipId;
    this.enemyFaction = data.opponentFactionId ?? this.enemyFaction;
    this.enemyShipId = data.opponentShipId ?? this.enemyShipId;
  }

  create(): void {
    // Phaser never calls shutdown() on its own; without this, every restart
    // stacks another set of input subscriptions.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    // No setBounds — camera is driven manually for seamless toroid wrapping (see updateCameraFollow).
    this.cameras.main.setBackgroundColor(0x050510);
    addPaintedSpaceBackground(this, "nebula_purple", 0);

    audioManager.initialize();

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

    this.resetMatchState();

    if (this.isOnlineMode) {
      // Both players already picked faction/ship in the lobby — skip the
      // local setup screen and seed the shared RNG for deterministic rolls.
      setDefaultRng(createSeededRng(this.onlineSeed));
      this.setupNetworking();
      this.startMatch();
    } else {
      this.showSetupScreen();
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

  /** Unregisters network listeners and resets the shared RNG so a fixed battle seed never leaks into whatever plays next. */
  shutdown(): void {
    this.inputSubscriptionIds.forEach((id) => InputManager.off(id));
    this.inputSubscriptionIds = [];
    teardownSceneInput();
    this.pilot.detach();
    this.hud?.destroy();
    this.hud = null;
    this.hitLedger.clear();
    if (this.isOnlineMode) {
      networkService.off("game_action", this.onRemoteAction, this);
      networkService.off(
        "player_disconnected",
        this.onOpponentDisconnected,
        this,
      );
      setDefaultRng(createRng());
    }
  }

  private setupNetworking(): void {
    networkService.on("game_action", this.onRemoteAction, this);
    networkService.on("player_disconnected", this.onOpponentDisconnected, this);
  }

  private onOpponentDisconnected(): void {
    if (this.matchComplete) return;
    this.matchComplete = true;
    this.showRoundResult("OPPONENT DISCONNECTED", HOLO_PALETTE.warning);
  }

  /**
   * Applies state received from the opponent's client. Maneuver messages
   * describe the SENDER's own ship and are always applied to the local
   * `enemyShipIds[0]` slot (which represents the opponent regardless of
   * which faction/ship they picked). `combat_result` carries the outcome
   * of a roll the opponent already computed as attacker — applied directly
   * instead of re-rolling locally, since two clients rolling independent
   * dice for the same shot could disagree and desync hull/shield state.
   */
  private onRemoteAction(payload: unknown): void {
    if (!this.isOnlineMode) return;
    const msg = payload as { type: string; data?: Record<string, unknown> };

    switch (msg.type) {
      case "maneuver": {
        const opponent = this.ships.get(this.enemyShipIds[0] ?? "");
        if (!opponent) return;
        this.applyRemoteManeuver(opponent, msg.data ?? {});
        break;
      }
      case "combat_result": {
        const localShip = this.ships.get(this.playerShipIds[0] ?? "");
        const hullAfter = msg.data?.hullAfter as number | undefined;
        const shieldsAfter = msg.data?.shieldsAfter as number | undefined;
        if (localShip && typeof hullAfter === "number") {
          localShip.hull = hullAfter;
          localShip.shields = shieldsAfter ?? localShip.shields;
          const healthBar = this.healthBars.get(localShip.id);
          healthBar?.update(localShip.hull, localShip.shields);
        }
        break;
      }
    }
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
    this.lastSentManeuver = null;
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
    this.hitLedger.clear();
    this.crew = null;
  }

  /**
   * The round's crew: a bot for the AI opponent at the difficulty's tier
   * (easy = novice, normal = average, hard = expert, brutal = expert with
   * faster reactions). Online the opponent is a remote human — no bot.
   *
   * @returns The crew for the ships just spawned.
   */
  private createCrew(): DuelBotCrew {
    const aiSkill = this.isOnlineMode
      ? null
      : difficultyToTier(this.difficulty);
    return new DuelBotCrew({
      roster: [...this.ships.values()].map((ship) => ({
        shipId: ship.id,
        side: ship.owner,
        skill: ship.owner === "ai" ? aiSkill : null,
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
    renderDogfightSetup(
      this,
      {
        matchFormat: this.matchFormat,
        playerFaction: this.playerFaction,
        enemyFaction: this.enemyFaction,
        playerShipId: this.playerShipId,
        enemyShipId: this.enemyShipId,
        difficulty: this.difficulty,
      },
      this.setupActions(),
      (obj) => this.track(obj),
    );
    this.renderPlayerQuickBuild();
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
          if (owner === "player") this.playerShipId = shipId;
          else this.enemyShipId = shipId;
        }),
      selectFaction: (owner, faction) =>
        choose(() => {
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
      start: () => this.startMatch(),
      back: () => this.scene.start("MainMenuScene"),
    };
  }

  /**
   * The player's quick-build chooser, left of the ship list: cycles the
   * selected ship's quick builds (pilot, ability summary, price). Defaults
   * to what assignQuickBuilds would give, so untouched it changes nothing.
   */
  private renderPlayerQuickBuild(): void {
    this.playerBuilds = selectionFor([this.playerShipId], this.playerBuilds);
    const chooser = renderQuickBuildChooser(this, {
      x: QUICK_BUILD_CHOOSER_X,
      y: QUICK_BUILD_CHOOSER_Y,
      width: QUICK_BUILD_CHOOSER_W,
      heading: "YOUR QUICK BUILD",
      shipId: this.playerShipId,
      loadoutId: this.playerBuilds.loadoutIds[0] ?? null,
      name: "dogfightQuickBuild",
      accentColor: 0x44ff44,
      onCycle: (step) => {
        if (!this.playerBuilds) return;
        this.playerBuilds = cycleQuickBuild(this.playerBuilds, 0, step);
        this.showSetupScreen();
      },
    });
    chooser.objects.forEach((obj) => this.track(obj));
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
    this.setupObjects.forEach((o) => o.destroy());
    this.setupObjects = [];
    this.isSetupPhase = false;

    audioManager.playFactionMusic(this.playerFaction, "combat");

    this.hud = new DuelHud(this, {
      accent: factionAccent(this.playerFaction),
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
    const playerSprite = this.shipSprites.get(this.playerShipIds[0] ?? "");
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

  /** The ROUND N banner; weapons go live once it has faded. */
  private showRoundStart(): void {
    this.hud?.showRoundBanner(this.currentRound, () => {
      this.isRoundActive = true;
    });
  }

  update(time: number, delta: number): void {
    InputManager.update();
    // Mix every positional sound relative to what the player is
    // looking at, so a distant firefight sounds distant.
    syncListenerToCamera(this.cameras.main);
    if (this.isSetupPhase || this.isPaused || this.matchComplete) return;
    this.performanceState = updateFPS(this.performanceState, delta);
    this.performanceState = evaluateQuality(this.performanceState, time);
    this.effectsManager.setQualitySettings(
      this.performanceState.effectSettings,
    );

    this.background.update();

    // Update timer
    if (this.isRoundActive) {
      if (time - this.lastSecondTime >= 1000) {
        this.roundTimeRemaining--;
        this.updateTimerDisplay();
        this.lastSecondTime = time;

        if (this.roundTimeRemaining <= 0) {
          const outcome = resolveByPoints(
            this.playerSideScore,
            this.enemySideScore,
          );
          this.endRound(
            outcome === "side1"
              ? "player_win"
              : outcome === "side2"
                ? "enemy_win"
                : "draw",
          );
          return;
        }
      }
    }

    this.updateAI(time, delta);
    this.flyShips(delta);
    // Ships close in during the ROUND banner; weapons go live with the round.
    if (this.isRoundActive) this.processCombat(delta);
    this.updateSprites();
    this.updateCameraFollow();
    this.updateHud();
    this.checkRoundEnd();
  }

  /** Feeds the holographic HUD this frame's ships, camera and the player's mark. */
  private updateHud(): void {
    const playerId = this.playerShipIds[0] ?? "";
    this.hud?.update(
      buildDuelHudSnapshot({
        ships: this.ships.values(),
        playerId,
        isAlly: (ship) => ship.owner === PLAYER_SIDE,
        camera: cameraViewFrom(this.cameras.main),
        worldSize: BATTLEFIELD_SIZE,
        markedId: this.crew?.markedTargetOf(PLAYER_SIDE, this.time.now) ?? null,
      }),
    );
  }

  /** R / gamepad R3: the player marks the HUD's current target for their side. */
  private markHudTarget(): void {
    const targetId = playerTargetId({
      ships: this.ships.values(),
      playerId: this.playerShipIds[0] ?? "",
      isAlly: (ship) => ship.owner === PLAYER_SIDE,
      worldSize: BATTLEFIELD_SIZE,
    });
    if (targetId) this.crew?.markTarget(PLAYER_SIDE, targetId, this.time.now);
  }

  /**
   * Manually follows the player ship with toroid-aware shortest-path lerp
   * (mirrors ArcadeBattleScene.updateCameraFollow) so the camera doesn't stay
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

  private updateTimerDisplay(): void {
    this.hud?.setClock(this.roundTimeRemaining * MS_PER_S);
  }

  /** Best-of score; highlighted once either side is one round from the match. */
  private updateScoreDisplay(): void {
    const remaining =
      this.winsNeeded() - Math.max(this.playerWins, this.enemyWins);
    this.hud?.setScore(this.playerWins, this.enemyWins, remaining === 1);
  }

  /** @returns Round wins that take the match. */
  private winsNeeded(): number {
    return this.matchFormat === "best_of_3" ? 2 : 3;
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
        this.cameras.main.setZoom(Phaser.Math.Clamp(zoom, 0.8, 2));
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
        this.scene.launch("SettingsScene", { returnScene: "DogfightScene" });
      },
      onQuit: () => {
        this.scene.start("MainMenuScene");
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

    this.ships.set(id, ship);

    if (owner === "player") {
      this.playerShipIds.push(id);
    } else {
      this.enemyShipIds.push(id);
    }

    this.createShipSprite(ship);
    // The player's durability lives on the HUD status ring.
    if (owner !== "player") this.createHealthBar(ship);
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
      isPlayer: ship.owner === "player",
    });

    container.setAngle(ship.angle);
    container.setDepth(10);
    container.setSize(size * 2, size * 2);
    container.setInteractive();
    ShipStatCard.attachHoverCard(this, container, ship.definitionId);

    this.shipSprites.set(ship.id, container);
  }

  private createHealthBar(ship: DogfightShip): void {
    const healthBar = new HealthBar({
      scene: this,
      x: ship.x,
      y: ship.y - 50,
      faction: ship.faction,
      maxHull: ship.maxHull,
      maxShields: ship.maxShields,
      currentHull: ship.hull,
      currentShields: ship.shields,
    });
    this.healthBars.set(ship.id, healthBar);
  }

  /**
   * Flies every ship one frame on the X-Wing cycle engine (template arcs,
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
        modifiers: stressModifiersOf(ship.modifiers),
      });
      this.setFlight(ship, tick.state);
      ship.shields = regenerateShields(
        ship.shields,
        ship.maxShields,
        ship.modifiers,
        deltaMs,
      );
      if (tick.completed) this.onCycleCommitted(ship, tick.state);
      this.shipSprites
        .get(ship.id)
        ?.setPosition(ship.x, ship.y)
        .setAngle(ship.angle);
      this.telemetry?.sample(ship.id, ship.x, ship.y, ship.angle);
    }
  }

  /**
   * A ship's maneuver cycle committed: its pilot (human or bot) learns which
   * maneuver the new cycle started; the player's is relayed online.
   *
   * @param ship - The ship.
   * @param flight - Its flight state after the commit.
   */
  private onCycleCommitted(ship: DogfightShip, flight: CycleFlightState): void {
    this.crew?.onCycleCommitted(ship);
    if (ship.id !== this.playerShipIds[0]) return;
    const { control } = flight.motion;
    this.pilot.onCycleCommitted(control.currentManeuver ?? "straight");
    this.sendManeuver(
      control.nextManeuver ?? "straight",
      control.speed,
      ship,
      true,
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
    const isPlayer = ship.owner === "player";
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
    // Online, only the local ship fires here — the opponent's ship is
    // authoritative on their own client, and its attack outcomes arrive via
    // the `combat_result` network message instead of being independently
    // re-rolled (see onRemoteAction()).
    const gunners = this.isOnlineMode
      ? [this.ships.get(this.playerShipIds[0] ?? "")]
      : [...this.ships.values()];
    for (const ship of gunners) {
      if (!ship || ship.hull <= 0) continue;
      ship.weaponCooldown = Math.max(0, ship.weaponCooldown - delta);
      if (ship.weaponCooldown > 0) continue;
      const target = primaryShotTarget({
        gunner: ship,
        candidates: this.ships.values(),
        isEnemy: (other) => other.owner !== ship.owner,
        ledger: this.hitLedger,
        nowMs: this.time.now,
        preferredId: this.crew?.targetOf(ship.id) ?? null,
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
      nowMs: this.time.now,
      roll: random.next(),
      targetMarked:
        this.crew?.isMarkedShot(attacker.id, target.id, this.time.now) ?? false,
    });
    if (result.hit) this.applyHit(attacker, target, result);
    this.effectsManager.fireLaser(
      attacker.x,
      attacker.y,
      target.x,
      target.y,
      attacker.faction,
      result.hit,
    );
    // In online mode only the local ship ever reaches fireAt() as attacker
    // (see processCombat()) — relay the authoritative result so the
    // opponent's client updates its own copy of this ship instead of
    // independently rolling dice for the same shot.
    if (this.isOnlineMode && attacker.id === (this.playerShipIds[0] ?? "")) {
      networkService.sendGameAction({
        type: "combat_result",
        data: {
          hit: result.hit,
          hullAfter: target.hull,
          shieldsAfter: target.shields,
        },
      });
    }
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
    if (after.shields < target.shields) {
      audioManager.playSoundAt("shield_hit", target.x, target.y, 0.4);
    }
    if (after.hull < target.hull) {
      audioManager.playSoundAt("hull_hit", target.x, target.y, 0.4);
    }
    const wasAlive = target.hull > 0;
    Object.assign(target, after);
    this.hitLedger.recordHit(attacker.id, target.id, this.time.now);
    this.healthBars.get(target.id)?.update(target.hull, target.shields);
    if (wasAlive && target.hull <= 0) this.onShipDestroyed(attacker, target);
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
      Object.assign(killer, rewardKill(combatantOf(killer), this.time.now));
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
   * the same pilot hands. Online the opponent is a remote human driven by
   * onRemoteAction() (the crew has no bot for it).
   *
   * @param time - Scene time (ms).
   * @param delta - Frame length (ms).
   */
  private updateAI(time: number, delta: number): void {
    for (const shipId of this.playerShipIds) {
      const ship = this.ships.get(shipId);
      if (ship && ship.hull > 0) this.flyPlayer(ship, time, delta);
    }
    if (this.pilot.takeMarkRequest()) this.markHudTarget();
    const crew = this.crew;
    if (!crew) return;
    const contacts = crew.contactsOf(this.ships.values());
    crew.command(contacts, this.time.now);
    for (const ship of this.ships.values()) {
      if (ship.hull > 0) this.flyBot(ship, contacts, delta);
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
    const result = this.crew?.fly(ship, contacts, this.time.now, delta);
    if (!result) return;
    this.setFlight(ship, { motion: result.motion, stress: result.stress });
    this.playFlightEvents(ship, result.events, origin);
  }

  /**
   * Runs one frame of the player's flight input through the shared pilot
   * controls (tap = drift, hold = bank, Q/E = hard turn, K-turn, Segnor,
   * Tallon, boost, barrel roll) and relays the queued maneuver online.
   *
   * @param ship - The player ship.
   * @param time - Scene time (ms).
   * @param delta - Frame length (ms).
   */
  private flyPlayer(ship: DogfightShip, time: number, delta: number): void {
    const origin = { x: ship.x, y: ship.y, angle: ship.angle };
    const result = this.pilot.fly({
      flight: ship.flight,
      ship: ship.flight.motion,
      dial: ship.dial,
      nowMs: time,
      deltaMs: delta,
      worldSize: BATTLEFIELD_SIZE,
    });
    this.setFlight(ship, { motion: result.motion, stress: result.stress });
    this.playFlightEvents(ship, result.events, origin);
    const { control } = result.motion;
    this.sendManeuver(
      control.nextManeuver ?? "straight",
      control.speed,
      ship,
      result.events.length > 0,
    );
  }

  /**
   * Mirrors the opponent's queued maneuver and speed and moves their ship to
   * the pose their client reports (each client is authoritative for its own
   * ship; the maneuver in progress is carried along, not restarted).
   *
   * @param opponent - The local copy of the opponent's ship.
   * @param data - The maneuver message payload.
   */
  private applyRemoteManeuver(
    opponent: DogfightShip,
    data: Record<string, unknown>,
  ): void {
    let motion = opponent.flight.motion;
    if (typeof data.x === "number" && typeof data.y === "number") {
      motion = shiftMotion(
        motion,
        torusDelta(data.x - motion.x),
        torusDelta(data.y - motion.y),
        BATTLEFIELD_SIZE,
      );
    }
    const dir = data.dir as ManeuverDirection | undefined;
    const speed = data.speed;
    const control = {
      ...motion.control,
      nextManeuver:
        dir === undefined
          ? motion.control.nextManeuver
          : dir === "straight"
            ? null
            : dir,
      speed: typeof speed === "number" ? speed : motion.control.speed,
    };
    this.setFlight(opponent, {
      ...opponent.flight,
      motion: { ...motion, control },
    });
  }

  /**
   * Relays the local ship's queued maneuver, speed and pose to the opponent
   * — only when the maneuver changed, an action moved the ship, or a cycle
   * committed (periodic pose sync), to avoid flooding the socket.
   *
   * @param dir - Queued maneuver.
   * @param speed - Queued speed.
   * @param ship - The local ship (its pose is sent).
   * @param force - Send even when the maneuver did not change.
   */
  private sendManeuver(
    dir: ManeuverDirection,
    speed: number,
    ship: Pose,
    force: boolean,
  ): void {
    if (!this.isOnlineMode) return;
    const unchanged =
      this.lastSentManeuver?.dir === dir &&
      this.lastSentManeuver.speed === speed;
    if (unchanged && !force) return;
    this.lastSentManeuver = { dir, speed };
    networkService.sendGameAction({
      type: "maneuver",
      data: { dir, speed, x: ship.x, y: ship.y },
    });
  }

  private updateSprites(): void {
    for (const [id, ship] of this.ships) {
      const healthBar = this.healthBars.get(id);
      if (healthBar) {
        healthBar.setPosition(ship.x, ship.y - 50);
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

  private endRound(result: "player_win" | "enemy_win" | "draw"): void {
    this.isRoundActive = false;
    this.roundResult = result;
    if (result === "player_win") this.playerWins++;
    else if (result === "enemy_win") this.enemyWins++;
    const banner = RESULT_BANNERS[result];
    this.showRoundResult(banner.text, banner.color);
    this.updateScoreDisplay();

    const winsNeeded = this.winsNeeded();
    if (this.playerWins >= winsNeeded || this.enemyWins >= winsNeeded) {
      this.time.delayedCall(2000, () => this.endMatch());
    } else {
      this.time.delayedCall(2000, () => this.startNextRound());
    }
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

    const playerWon = this.playerWins > this.enemyWins;
    audioManager.playFactionStinger(
      this.playerFaction,
      playerWon ? "victory" : "defeat",
    );
    const sweep =
      (playerWon && this.enemyWins === 0) ||
      (!playerWon && this.playerWins === 0);
    showDuelEndScreen(this, {
      header: "Dogfight \u2014 match result",
      title: playerWon ? "MATCH WON" : "MATCH LOST",
      won: playerWon,
      scoreLine: `Final score  ${this.playerWins}  \u2013  ${this.enemyWins}`,
      notes: sweep ? ["Sweep!"] : [],
      accent: factionAccent(this.playerFaction),
      onRematch: () => this.scene.restart(),
      onMenu: () => this.scene.start("MainMenuScene"),
    });
  }
}
