/**
 * Ace Duel Scene - Preset Iconic Matchups
 *
 * No squad building - just pick a matchup and fight.
 * Features:
 * - Preset iconic matchups with pre-built loadouts
 * - Best-of-3 rounds
 * - Thematic flavor text
 * - Difficulty selection for AI opponent
 * - Completion tracker for all matchups
 */

import Phaser from "phaser";
import { ShipStatCard } from "../ui/ShipStatCard";
import { addShipVisual } from "../rendering/ShipVisual";
import type { FactionId } from "../config";
import { BATTLEFIELD_SIZE, CYCLE_DURATION_MS, SHIP_SIZES } from "../config";
import { getShipDefinition, getShipDial } from "../data/ShipDefinitions";
import {
  getModeCombatStats,
  type ModeCombatStats,
} from "../data/ModeBalancing";
import {
  createCycleFlight,
  tickCycleFlight,
  type CycleFlightState,
} from "../arcade/systems/CycleFlight";
import { PlayerFlightPilot } from "../arcade/systems/PlayerFlightPilot";
import type { FlightEvent } from "../arcade/systems/PilotFlightTypes";
import { difficultyToTier, type BotContact, type BotSkill } from "../arcade/ai";
import { DuelBotCrew } from "../arcade/systems/DuelBotCrew";
import {
  duelModifiers,
  duelShotOdds,
  marksmanshipDamage,
} from "../arcade/systems/AceDuelAbilities";
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

/** Values the remembered Ace Duel difficulty may hold. */
const ACE_DIFFICULTIES = ["easy", "normal", "hard", "brutal"] as const;
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
import { showResultsPanel } from "../ui/results/ResultsPanel";
import { resultRows } from "../ui/results/resultsModel";
import {
  renderAceDuelSetup,
  type AceDuelDifficulty,
  type AceDuelSetupActions,
} from "./duel/AceDuelSetupView";
import { SettingsDefaultPick } from "../ui/menu/setupDefaults";
import { defaultDifficulty } from "../systems/SettingsStorage";
import { aceDuelBriefing, showSortieBriefing } from "../ui/briefing";
import { bindMenuBack } from "../ui/menu/menuTransitions";
import { cameraViewFrom } from "../ui/hud/hudMath";
import { HOLO_PALETTE, factionAccent } from "../ui/theme/HoloTheme";
import { applyInstantStress } from "../arcade/ArcadeStress";
import {
  NEUTRAL_MODIFIERS,
  type CombatModifiers,
} from "../core/CombatModifiers";
import { playFlightEventFx } from "../arcade/ArcadeFX";
import type { ShipPose } from "../core/ArcadeControls";
import { ShipTelemetry } from "../debug/ShipTelemetry";
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
import { ACE_MATCHUPS, type AceMatchup } from "../data/AceMatchups";
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
import { browserStore } from "../systems/keyValueStore";
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

interface AceDuelShip {
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
  /** The duel ace's pilot abilities (preset by the matchup). */
  abilities: string[];
  /** Quick build flown (upgrades + pilot), or null for the bare hull. */
  loadoutId: string | null;
  /** Real-time effects of the quick build and the ace's sheet abilities. */
  modifiers: CombatModifiers;
  /** Scene time (ms) until which a kill-frenzy ability is active. */
  frenzyUntilMs: number;
}

interface ShipSprite extends Phaser.GameObjects.Container {
  shipId: string;
}

/**
 * The player's escorts (their side's other ships) fly as average pilots,
 * whatever the difficulty — it sets the opponents' tier only.
 */
const ESCORT_SKILL: BotSkill = { tier: "average", reactionScale: 1 };

/** Round wins that take the match (best of 3). */
const WINS_NEEDED = 2;

/** Distance (px) from the battlefield centre at which each side spawns. */
const SPAWN_DISTANCE = 200;

/** Gap (px) between ships of the same side at spawn. */
const SPAWN_SPACING = 60;

/** A ship to spawn at round start. */
interface ShipSpawn {
  readonly id: string;
  readonly defId: string;
  readonly faction: FactionId;
  readonly owner: "player" | "ai";
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly side: 1 | 2;
  readonly abilities: readonly string[];
  readonly loadoutId: string | null;
}

export class AceDuelScene extends Phaser.Scene {
  private ships: Map<string, AceDuelShip> = new Map();
  private shipSprites: Map<string, ShipSprite> = new Map();
  private healthBars: Map<string, HealthBar> = new Map();
  /** Repair mechanic + overlay shimmer + repair drones (built in create). */
  private repairFeedback: ShipRepairFeedback | null = null;

  private side1ShipIds: string[] = [];
  private side2ShipIds: string[] = [];
  /** Round tempo: a struck ship ignores the same attacker until the next cycle. */
  private readonly hitLedger = new HitImmunityLedger();
  /** Secondary weapons (missiles, torpedoes, turrets, bombs, mines, cloak). */
  private weapons: BattleWeapons | null = null;
  /** Faction auras resolved this frame (buffs every shot and stress tick). */
  private auras: ReadonlyMap<string, ActiveAura> = new Map();

  // Match state
  private selectedMatchup: AceMatchup = ACE_MATCHUPS[0]!;
  private playerSide: 1 | 2 = 1;
  private side1Wins = 0;
  private side2Wins = 0;
  private currentRound = 0;
  private isRoundActive = false;
  private matchComplete = false;

  /** Per-round time limit (ms); a timed-out round is decided by destroyed points. */
  private static readonly ROUND_DURATION_MS = 180_000;
  private roundTimer: MatchTimerState = createMatchTimer(
    AceDuelScene.ROUND_DURATION_MS,
  );
  /** Destroyed squad-point cost each side inflicted this round. */
  private side1Score: SideScore = createSideScore();
  private side2Score: SideScore = createSideScore();

  // Settings
  private difficulty: AceDuelDifficulty = "normal";
  /** Preselects Settings › Default Difficulty (kept across rematches). */
  private readonly difficultyDefault = new SettingsDefaultPick(
    (level): AceDuelDifficulty => level,
  );
  /**
   * The player's quick-build picks for their side's ships. Null (never
   * touched) means the defaults assignQuickBuilds would give; picks made
   * for another matchup/side are ignored (see selectionFor).
   */
  private playerBuilds: QuickBuildSelection | null = null;
  /** Which of the player's ships the setup BUILDS tab edits (sides with several ships). */
  private buildShip = 0;

  // Game state
  private isPaused = false;
  private isSetupPhase = true;

  /** The human pilot's flight input (InputManager-driven). */
  private readonly pilot = new PlayerFlightPilot(InputManager);
  /**
   * The round's AI: a BotPilot per AI ship (opponents at the difficulty's
   * tier, the player's escorts average), a SquadCommand per side of 2+ ships
   * and the squad marks (the player's R mark). Null outside a round.
   */
  private crew: DuelBotCrew | null = null;

  // Player input (routed through InputManager — see setupInput())
  private pauseMenu!: BattlePauseMenu;
  /** REMATCH / pause RESTART: skip the setup screen and replay the matchup. */
  private rematchRequested = false;
  /** Arrow / D-pad navigation of the setup screen (null outside setup). */
  private setupNav: SetupKeyNav | null = null;
  private inputSubscriptionIds: number[] = [];

  // Camera follow (manual — toroid wrap makes Phaser's startFollow jump at the seam)
  private cameraVirtualX = BATTLEFIELD_SIZE / 2;
  private cameraVirtualY = BATTLEFIELD_SIZE / 2;

  // Effects
  private effectsManager!: EffectsManager;
  private performanceState: PerformanceState = createPerformanceState();
  private telemetry: ShipTelemetry | null = null;
  private cameraShakeEnabled = true;

  // UI
  /** Holographic battle HUD + duel scoreboard; null outside a battle. */
  private hud: DuelHud | null = null;
  /** Setup-screen objects, tracked individually — see track()'s doc comment for why. */
  private setupObjects: Phaser.GameObjects.GameObject[] = [];

  // Completion tracking
  private completedMatchups: Set<string> = new Set();

  constructor() {
    super({ key: "AceDuelScene" });
  }

  /** @param data - `rematch: true` skips the setup screen and replays the matchup. */
  init(data: { rematch?: boolean } = {}): void {
    this.rematchRequested = data.rematch === true;
    consumeSceneData(this);
  }

  create(): void {
    // Phaser never calls shutdown() on its own; without this, every restart
    // stacks another set of input subscriptions.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
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

    this.loadCompletedMatchups();
    this.resetMatchState();
    this.weapons = createSceneWeapons(this, this.weaponsLink(), this.hitLedger);
    const fromSettings = this.difficultyDefault.next(defaultDifficulty());
    this.difficulty =
      remembered("ace_duel", "difficulty", ACE_DIFFICULTIES) ??
      fromSettings ??
      this.difficulty;
    this.showSetupScreen();
    this.setupNav = new SetupKeyNav(this, { isActive: () => this.isSetupPhase });
    this.setupNav.refresh();
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
    if (this.rematchRequested) this.startDuel();

    if (ShipTelemetry.isEnabled()) {
      this.telemetry = new ShipTelemetry();
      this.telemetry.start();
      (
        window as unknown as { __shipTelemetry: ShipTelemetry }
      ).__shipTelemetry = this.telemetry;
    }

    this.cameras.main.centerOn(BATTLEFIELD_SIZE / 2, BATTLEFIELD_SIZE / 2);
    this.cameras.main.setZoom(1.0);
  }

  private loadCompletedMatchups(): void {
    try {
      const saved = browserStore().getItem("shattered_stars_ace_duel");
      if (saved) {
        const ids: string[] = JSON.parse(saved);
        this.completedMatchups = new Set(ids);
      }
    } catch {
      // Use empty set on parse error
    }
  }

  private saveCompletedMatchups(): void {
    browserStore().setItem(
      "shattered_stars_ace_duel",
      JSON.stringify(Array.from(this.completedMatchups)),
    );
  }

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
  }

  private resetMatchState(): void {
    this.side1Wins = 0;
    this.side2Wins = 0;
    this.currentRound = 0;
    this.isRoundActive = false;
    this.matchComplete = false;
    this.isSetupPhase = true;
    this.isPaused = false;
    this.setupObjects = [];
    this.ships.clear();
    this.shipSprites.clear();
    this.healthBars.clear();
    this.side1ShipIds = [];
    this.side2ShipIds = [];
    this.hud = null;
    this.hitLedger.clear();
  }

  private resetRoundState(): void {
    this.ships.clear();
    this.shipSprites.forEach((s) => s.destroy());
    this.shipSprites.clear();
    this.healthBars.forEach((h) => h.destroy());
    this.healthBars.clear();
    this.side1ShipIds = [];
    this.side2ShipIds = [];
    this.roundTimer = createMatchTimer(AceDuelScene.ROUND_DURATION_MS);
    this.side1Score = createSideScore();
    this.side2Score = createSideScore();
    this.isPaused = false;
    this.pilot.reset();
    this.hitLedger.clear();
    this.weapons?.runtime.clear();
    this.crew = null;
  }

  /** @returns The player's side key (SquadMark / DuelBotCrew). */
  private get playerSideKey(): string {
    return `side${this.playerSide}`;
  }

  /**
   * The round's crew: the flagship is the human; the player's escorts fly
   * as average bots and the opponents at the difficulty's tier (easy =
   * novice, normal = average, hard = expert, brutal = expert with faster
   * reactions). Sides of 2+ ships fly under a SquadCommand.
   *
   * @returns The crew for the ships just spawned.
   */
  private createCrew(): DuelBotCrew {
    const enemySkill = difficultyToTier(this.difficulty, "ace");
    const member = (shipId: string, side: 1 | 2) => ({
      shipId,
      side: `side${side}`,
      skill:
        shipId === this.flagshipId
          ? null
          : side === this.playerSide
            ? ESCORT_SKILL
            : enemySkill,
    });
    return new DuelBotCrew({
      roster: [
        ...this.side1ShipIds.map((id) => member(id, 1)),
        ...this.side2ShipIds.map((id) => member(id, 2)),
      ],
      playerSide: this.playerSideKey,
      random: Math.random,
      worldSize: BATTLEFIELD_SIZE,
    });
  }

  private showSetupScreen(): void {
    // Destroy any previous setup-screen objects. Buttons are NOT reparented
    // into a shared container — see track()'s doc comment for why (same
    // fix as DogfightScene's setup screen).
    this.setupObjects.forEach((o) => o.destroy());
    this.setupObjects = [];
    const ships = this.playerSideShips();
    this.playerBuilds = selectionFor(ships, this.playerBuilds);
    renderAceDuelSetup(
      this,
      {
        matchups: ACE_MATCHUPS,
        selected: this.selectedMatchup,
        completed: this.completedMatchups,
        playerSide: this.playerSide,
        difficulty: this.difficulty,
        playerLoadoutIds: this.playerBuilds.loadoutIds,
        enemyLoadoutIds: assignQuickBuilds(this.enemySideShips(), []),
        buildShip: this.buildShip,
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
  private setupActions(): AceDuelSetupActions {
    const rerender = (): void => this.showSetupScreen();
    return {
      selectMatchup: (matchup) => {
        this.selectedMatchup = matchup;
        this.buildShip = 0;
        rerender();
      },
      selectSide: (side) => {
        this.playerSide = side;
        this.buildShip = 0;
        rerender();
      },
      selectBuild: (shipIndex, loadoutId) => {
        if (this.playerBuilds)
          this.playerBuilds = pickQuickBuild(this.playerBuilds, shipIndex, loadoutId);
        rerender();
      },
      selectBuildShip: (shipIndex) => {
        this.buildShip = shipIndex;
        rerender();
      },
      selectTab: (tab) => {
        openDuelTabById(tab);
        rerender();
      },
      selectDifficulty: (difficulty) => {
        this.difficulty = difficulty;
        rerender();
      },
      start: () => this.briefSortie(),
      back: () => this.scene.start("MainMenuScene"),
    };
  }

  /** The pre-sortie briefing (≤ 3 s, skippable); the duel starts when it closes. */
  private briefSortie(): void {
    const matchup = this.selectedMatchup;
    const [mine, rival] =
      this.playerSide === 1
        ? [matchup.side1, matchup.side2]
        : [matchup.side2, matchup.side1];
    showSortieBriefing(this, {
      briefing: aceDuelBriefing({
        matchupName: matchup.name,
        playerAce: mine.name,
        rivalAce: rival.name,
        rivalShips: rival.ships.map((id) => getShipDefinition(id)?.name ?? id),
        difficulty: this.difficulty,
      }),
      accent: factionAccent(this.playerSideFaction()),
      onLaunch: () => this.startDuel(),
    });
  }

  /** The ships the player flies in the selected matchup. */
  private playerSideShips(): readonly string[] {
    return this.playerSide === 1
      ? this.selectedMatchup.side1.ships
      : this.selectedMatchup.side2.ships;
  }

  /** The ships the AI flies in the selected matchup. */
  private enemySideShips(): readonly string[] {
    return this.playerSide === 1
      ? this.selectedMatchup.side2.ships
      : this.selectedMatchup.side1.ships;
  }

  /** The faction the player flies in the selected matchup. */
  private playerSideFaction(): FactionId {
    return this.playerSide === 1
      ? this.selectedMatchup.side1.faction
      : this.selectedMatchup.side2.faction;
  }

  /**
   * Registers a setup-screen object for fixed-position rendering and later
   * cleanup. Objects are kept as direct scene children (never reparented
   * into a shared container) and get their own scrollFactor(0) — both were
   * found to independently break real pointer-click hit-testing on the
   * identical DogfightScene setup screen (reparenting an already-interactive
   * Container into another Container, and relying on an ancestor's
   * scrollFactor(0) instead of the object's own). Container children get
   * scrollFactor(0) too: Phaser hit-tests each interactive object with its
   * OWN scroll factor, so buttons whose hit rectangle is a child ignored
   * real clicks while the camera sits at the battlefield centre.
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

  private startDuel(): void {
    this.setupNav?.destroy();
    this.setupNav = null;
    this.setupObjects.forEach((o) => o.destroy());
    this.setupObjects = [];
    this.isSetupPhase = false;
    remember("ace_duel", { difficulty: this.difficulty });
    trackModeStart("ace_duel", { matchup: this.selectedMatchup.name });
    matchStats.start(
      "ace_duel",
      { matchup: this.selectedMatchup.name },
      this.events,
    );

    audioManager.playBattleMusic(
      "dogfight",
      this.playerSide === 1
        ? this.selectedMatchup.side1.faction
        : this.selectedMatchup.side2.faction,
    );

    const { side1, side2 } = this.selectedMatchup;
    this.hud = new DuelHud(this, {
      accent: factionAccent(this.playerSideFaction()),
      scoreColors: [factionAccent(side1.faction), factionAccent(side2.faction)],
      subtitle: this.selectedMatchup.name,
    });
    this.setupInput();
    this.startNextRound();
  }

  private startNextRound(): void {
    this.resetRoundState();
    this.currentRound++;

    this.hud?.setRound(this.currentRound);
    this.hud?.setClock(this.roundTimer.remainingMs);
    this.updateScoreDisplay();

    this.spawnSide(1);
    this.spawnSide(2);
    this.crew = this.createCrew();

    this.showRoundStart();

    const playerSprite = this.shipSprites.get(`side${this.playerSide}_0`);
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

    if (this.isRoundActive) {
      this.roundTimer = tickMatchTimer(this.roundTimer, delta);
      this.hud?.setClock(this.roundTimer.remainingMs);
      if (this.roundTimer.expired) {
        const outcome = resolveByPoints(this.side1Score, this.side2Score);
        const winner: 1 | 2 =
          outcome === "side1"
            ? 1
            : outcome === "side2"
              ? 2
              : this.playerSide === 1
                ? 2
                : 1;
        this.endRound(winner);
        return;
      }
    }

    this.updateAI(time, delta);
    this.flyShips(delta);
    // Ships close in during the ROUND banner; weapons go live with the round.
    if (this.isRoundActive) {
      // Secondaries first: a held or chosen launch is this cycle's attack.
      this.weapons?.update(delta, this.time.now);
      this.processCombat(delta);
    }
    this.updateSprites();
    this.updateCameraFollow();
    this.updateHud();
    this.checkRoundEnd();
  }

  /** Feeds the holographic HUD this frame's ships, camera and the player's mark. */
  private updateHud(): void {
    audioManager.reportPlayerHull(
      hullFractionOf(this.ships.get(this.flagshipId)),
    );
    this.hud?.update(
      buildDuelHudSnapshot({
        ships: this.ships.values(),
        playerId: this.flagshipId,
        isAlly: (ship) => this.isPlayerSide(ship.id),
        camera: cameraViewFrom(this.cameras.main),
        worldSize: BATTLEFIELD_SIZE,
        markedId:
          this.crew?.markedTargetOf(this.playerSideKey, this.time.now) ?? null,
        secondaryWeapons: this.weapons?.hudSlots() ?? [],
      }),
    );
  }

  /**
   * @param shipId - A ship of the round.
   * @returns Whether it flies on the player's side.
   */
  private isPlayerSide(shipId: string): boolean {
    const playerSideIds =
      this.playerSide === 1 ? this.side1ShipIds : this.side2ShipIds;
    return playerSideIds.includes(shipId);
  }

  /**
   * R / gamepad R3: the player marks the HUD's current target for their
   * side; their escorts focus it (and shoot it with the mark bonus).
   */
  private markHudTarget(): void {
    const targetId = playerTargetId({
      ships: this.ships.values(),
      playerId: this.flagshipId,
      isAlly: (ship) => this.isPlayerSide(ship.id),
      worldSize: BATTLEFIELD_SIZE,
    });
    if (!targetId) return;
    this.crew?.markTarget(this.playerSideKey, targetId, this.time.now);
    matchStats.record({ kind: "mark" });
  }

  /**
   * Manually follows the player's flagship with toroid-aware shortest-path
   * lerp (mirrors ArcadeBattleScene/DogfightScene) so the camera doesn't
   * stay pinned to the battlefield center while ships fly around.
   */
  private updateCameraFollow(): void {
    const ship = this.ships.get(`side${this.playerSide}_0`);
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

  /** Best-of-3 score (side 1 left); highlighted at match point. */
  private updateScoreDisplay(): void {
    const matchPoint =
      Math.max(this.side1Wins, this.side2Wins) === WINS_NEEDED - 1;
    this.hud?.setScore(this.side1Wins, this.side2Wins, matchPoint);
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
        this.cameras.main.setZoom(Phaser.Math.Clamp(zoom, 0.7, 1.5));
      },
    );
  }

  private createPauseMenu(): void {
    this.pauseMenu = new BattlePauseMenu({
      scene: this,
      legend: "duel",
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
        if (!this.isPaused) this.togglePause();
      },
    });
  }

  /**
   * ESC previously just flipped `isPaused` with no visual feedback and no
   * way back to the menu. Now it shows a real pause overlay, resetting
   * zoom to 1.0 first — Phaser's hit-testing for scrollFactor(0) UI does
   * not correctly ignore camera zoom (see DogfightScene for the full
   * writeup of this bug).
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

  /**
   * Spawns one side of the matchup in a line facing the other side, each
   * ship flying a quick build (no unique pilot repeated within the side).
   *
   * @param side - Which side of the matchup to spawn.
   */
  private spawnSide(side: 1 | 2): void {
    const matchupSide =
      side === 1 ? this.selectedMatchup.side1 : this.selectedMatchup.side2;
    const center = BATTLEFIELD_SIZE / 2;
    const y = center + (side === 1 ? SPAWN_DISTANCE : -SPAWN_DISTANCE);
    const owner = this.playerSide === side ? "player" : "ai";
    const chosen =
      owner === "player"
        ? selectionFor(matchupSide.ships, this.playerBuilds).loadoutIds
        : [];
    const loadouts = assignQuickBuilds(matchupSide.ships, chosen);
    const lastIndex = matchupSide.ships.length - 1;
    matchupSide.ships.forEach((defId, i) => {
      this.spawnShip({
        id: `side${side}_${i}`,
        defId,
        faction: matchupSide.faction,
        owner,
        x: center + (i - lastIndex / 2) * SPAWN_SPACING,
        y,
        angle: side === 1 ? 0 : 180,
        side,
        abilities: matchupSide.abilities,
        loadoutId: loadouts[i] ?? null,
      });
    });
  }

  /**
   * Builds a ship, equips its quick build and the ace's sheet abilities, and
   * creates its sprite and health bar.
   *
   * @param spawn - Who, where and with what.
   */
  private spawnShip(spawn: ShipSpawn): void {
    const { id, defId, x, y, angle } = spawn;
    const combatStats = getModeCombatStats(defId, "continuous");

    const ship: AceDuelShip = {
      id,
      definitionId: defId,
      faction: spawn.faction,
      owner: spawn.owner,
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
      abilities: [...spawn.abilities],
      loadoutId: spawn.loadoutId,
      modifiers: NEUTRAL_MODIFIERS,
      frenzyUntilMs: 0,
    };
    ship.modifiers = duelModifiers(
      equipQuickBuild(ship, spawn.loadoutId),
      ship.abilities,
      spawn.loadoutId,
    );
    ship.flight = equipFlight(ship.flight, ship.modifiers);
    this.weapons?.equip(id, {
      definitionId: defId,
      loadoutId: spawn.loadoutId,
      modifiers: ship.modifiers,
    });

    this.ships.set(id, ship);
    matchStats.record({
      kind: "deploy",
      friendly: spawn.owner === "player",
      shipId: id,
    });

    if (spawn.side === 1) {
      this.side1ShipIds.push(id);
    } else {
      this.side2ShipIds.push(id);
    }

    this.createShipSprite(ship);
    // The flagship's durability lives on the HUD status ring.
    if (id !== this.flagshipId) this.createHealthBar(ship);
  }

  private createShipSprite(ship: AceDuelShip): void {
    const container = this.add.container(
      ship.x,
      ship.y,
    ) as unknown as ShipSprite;
    container.shipId = ship.id;

    const size = SHIP_SIZES.medium;
    const shipDef = getShipDefinition(ship.definitionId);

    addShipVisual(this, container, {
      definitionId: ship.definitionId,
      faction: ship.faction,
      fallbackSizeName: shipDef?.baseStats.size ?? "medium",
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

  private createHealthBar(ship: AceDuelShip): void {
    const healthBar = new HealthBar({
      scene: this,
      x: ship.x,
      y: ship.y - 50,
      faction: ship.faction,
      maxHull: ship.maxHull,
      maxShields: ship.maxShields,
      currentHull: ship.hull,
      currentShields: ship.shields,
      side: overlaySide(false, ship.owner === "player"),
      definitionId: ship.definitionId,
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
        modifiers: stressModifiersOf(ship.modifiers, this.auras.get(ship.id)),
      });
      this.setFlight(ship, tick.state);
      this.regenerateShieldsOf(ship, deltaMs);
      if (tick.completed) this.onCycleCommitted(ship);
      if (tick.completed && ship.id === this.flagshipId)
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
   * Applies a ship's own shield regen and hull repair for a frame (upgrades
   * and abilities on its sheet); the repair feedback refreshes its overlay.
   *
   * @param ship - The ship.
   * @param deltaMs - Frame length (ms).
   */
  private regenerateShieldsOf(ship: AceDuelShip, deltaMs: number): void {
    this.repairFeedback?.selfRepair(ship, deltaMs);
  }

  /**
   * End-of-cycle bookkeeping: the ship's pilot (the human's or its bot)
   * learns which maneuver the new cycle started. (regenerative_shields acts
   * through the modifier sheet as steady regeneration.)
   *
   * @param ship - The ship whose cycle just committed.
   */
  private onCycleCommitted(ship: AceDuelShip): void {
    this.crew?.onCycleCommitted(ship);
    if (ship.id === this.flagshipId) {
      const { currentManeuver } = ship.flight.motion.control;
      this.pilot.onCycleCommitted(currentManeuver ?? "straight");
    }
  }

  /**
   * Stores a ship's new flight state and mirrors its pose onto the record
   * (combat, AI and camera read x/y/angle).
   *
   * @param ship - The ship.
   * @param flight - Its new flight state.
   */
  private setFlight(ship: AceDuelShip, flight: CycleFlightState): void {
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
    ship: AceDuelShip,
    events: readonly FlightEvent[],
    origin: ShipPose,
  ): void {
    const isPlayer = ship.id === this.flagshipId;
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
      const shipOnSide1 = this.side1ShipIds.includes(ship.id);
      const target = primaryShotTarget({
        gunner: ship,
        candidates: this.ships.values(),
        isEnemy: (other) =>
          this.side1ShipIds.includes(other.id) !== shipOnSide1,
        ledger: this.hitLedger,
        nowMs: this.time.now,
        preferredId: this.crew?.targetOf(ship.id) ?? null,
        worldSize: BATTLEFIELD_SIZE,
      });
      if (!target) continue;
      this.fireAt(ship, target);
      ship.weaponCooldown = primaryCooldownAfterShot(ship);
    }
  }

  /**
   * Fires the primary weapon: the duel-only abilities set the dice odds
   * (the same for every pilot — an AI's skill is in its flying), the
   * squad-mark bonus applies when the shooter's squad marked the target,
   * and DiceAttack applies the quick build and sheet abilities to one
   * uniform roll.
   *
   * @param attacker - The firing ship.
   * @param target - The ship fired at.
   */
  private fireAt(attacker: AceDuelShip, target: AceDuelShip): void {
    const { hitChance, extraDamageChance } = duelShotOdds(attacker, target);
    const roll = Math.random();
    const result = resolveDiceAttack({
      attacker: combatantOf(attacker),
      target: combatantOf(target),
      hitChance,
      baseDamage:
        attacker.combatStats.attackDice +
        marksmanshipDamage(roll, hitChance, extraDamageChance),
      attackerHasWingman: this.fliesWithWingman(attacker),
      targetHasWingman: this.fliesWithWingman(target),
      nowMs: this.time.now,
      roll,
      targetMarked:
        this.crew?.isMarkedShot(attacker.id, target.id, this.time.now) ?? false,
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
      friendly: this.isPlayerSide(attacker.id),
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
   * hull, hit immunity for this attacker until the next cycle, and the kill
   * if it was the last hull point.
   *
   * @param attacker - The firing ship.
   * @param target - The ship hit.
   * @param result - The resolved shot.
   */
  private applyHit(
    attacker: AceDuelShip,
    target: AceDuelShip,
    result: DiceAttackResult,
  ): void {
    this.setFlight(target, {
      ...target.flight,
      stress: applyInstantStress(target.flight.stress, result.stressOnTarget),
    });
    const after = absorbDamage(target, result.damage);
    matchStats.record({
      kind: "damage",
      toFriendly: this.isPlayerSide(target.id),
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
    this.hitLedger.recordHit(attacker.id, target.id, this.time.now);
    this.healthBars.get(target.id)?.update(target.hull, target.shields);
    if (wasAlive && target.hull <= 0) this.onShipDestroyed(attacker, target);
  }

  /** @returns What the secondary weapons read from (and ask of) this scene. */
  private weaponsLink(): BattleWeaponsLink {
    const sideOf = (shipId: string): string | null =>
      this.side1ShipIds.includes(shipId)
        ? "side1"
        : this.side2ShipIds.includes(shipId)
          ? "side2"
          : null;
    return {
      bodies: () =>
        [...this.ships.values()].map((ship) =>
          weaponBodyOf(
            ship,
            sideOf(ship.id) ?? ship.owner,
            damageMitigationOf(
              ship.modifiers,
              this.fliesWithWingman(ship),
              this.auras.get(ship.id),
            ),
          ),
        ),
      wantedTargetOf: (shipId: string) =>
        shipId === this.flagshipId
          ? playerTargetId({
              ships: this.ships.values(),
              playerId: shipId,
              isAlly: (ship) => this.isPlayerSide(ship.id),
              worldSize: BATTLEFIELD_SIZE,
            })
          : (this.crew?.targetOf(shipId) ?? null),
      playerShipId: () => this.flagshipId,
      playerSide: () => this.playerSideKey,
      sideOf,
      applyHit: (hit: WeaponHit) => this.applyWeaponHit(hit),
      spriteOf: (shipId: string) => this.shipSprites.get(shipId),
    };
  }

  /**
   * A secondary weapon's hit: the same shields-then-hull path as a laser.
   *
   * @param hit - The hit from the weapons runtime.
   */
  private applyWeaponHit(hit: WeaponHit): void {
    const target = this.ships.get(hit.targetId);
    if (!target || target.hull <= 0) return;
    const attacker = this.ships.get(hit.attackerId) ?? target;
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
   * A ship was destroyed: its point cost goes to the other side's round
   * score, the killer collects its pilot-ability reward, and the victim's
   * death blast (if any) hits enemies nearby — possibly destroying them too.
   *
   * @param killer - The ship credited with the kill.
   * @param victim - The ship destroyed.
   */
  private onShipDestroyed(killer: AceDuelShip, victim: AceDuelShip): void {
    this.hitLedger.forget(victim.id);
    this.crew?.forget(victim.id);
    matchStats.record({
      kind: "kill",
      victimFriendly: this.isPlayerSide(victim.id),
      victimIsPlayer: victim.id === this.flagshipId,
    });
    if (victim.id === this.flagshipId)
      trackDeath("ace_duel", killer.definitionId);
    if (this.side1ShipIds.includes(victim.id)) {
      this.side2Score = creditKill(this.side2Score, victim.definitionId);
    } else {
      this.side1Score = creditKill(this.side1Score, victim.definitionId);
    }
    if (killer.hull > 0) {
      Object.assign(killer, rewardKill(combatantOf(killer), this.time.now));
      this.healthBars.get(killer.id)?.update(killer.hull, killer.shields);
    }
    const blastDamage = deathBlastDamage(combatantOf(victim));
    const caught = deathBlastTargets(
      combatantOf(victim),
      this.livingEnemiesOf(victim),
    );
    for (const ship of caught) {
      Object.assign(ship, absorbDamage(ship, blastDamage));
      this.healthBars.get(ship.id)?.update(ship.hull, ship.shields);
      if (ship.hull <= 0) this.onShipDestroyed(victim, ship);
    }
  }

  /**
   * @param ship - The ship asking.
   * @returns Whether another living ship of its side flies within wingman range.
   */
  private fliesWithWingman(ship: AceDuelShip): boolean {
    const allies = [...this.ships.values()].filter(
      (other) => other.faction === ship.faction && other.hull > 0,
    );
    return hasWingman(ship, allies);
  }

  /** Id of the ship the human flies; every other ship is AI-piloted. */
  private get flagshipId(): string {
    return `side${this.playerSide}_0`;
  }

  /**
   * Queues every ship's next maneuver: the flagship's from player input
   * (and the R mark), every other ship's (escorts and enemies) from its
   * BotPilot — the same controls, through the same pilot hands.
   *
   * @param time - Scene time (ms).
   * @param delta - Frame length (ms).
   */
  private updateAI(time: number, delta: number): void {
    const flagship = this.ships.get(this.flagshipId);
    if (flagship && flagship.hull > 0) this.flyPlayer(flagship, time, delta);
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
    ship: AceDuelShip,
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
   * @param ship - A ship on either side.
   * @returns The opposing side's ships that are still flying.
   */
  private livingEnemiesOf(ship: AceDuelShip): AceDuelShip[] {
    const enemyIds = this.side1ShipIds.includes(ship.id)
      ? this.side2ShipIds
      : this.side1ShipIds;
    return enemyIds
      .map((id) => this.ships.get(id))
      .filter((enemy): enemy is AceDuelShip => (enemy?.hull ?? 0) > 0);
  }

  /**
   * Runs one frame of the player's flight input through the shared pilot
   * controls (tap = drift, hold = bank, Q/E = hard turn, Snap turn, Hook,
   * Knife, boost, barrel roll).
   *
   * @param ship - The player's flagship.
   * @param time - Scene time (ms).
   * @param delta - Frame length (ms).
   */
  private flyPlayer(ship: AceDuelShip, time: number, delta: number): void {
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
      this.crew?.markedTargetOf(this.playerSideKey, this.time.now) ?? null;
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

    const side1Alive = this.side1ShipIds.some((id) => {
      const ship = this.ships.get(id);
      return ship && ship.hull > 0;
    });

    const side2Alive = this.side2ShipIds.some((id) => {
      const ship = this.ships.get(id);
      return ship && ship.hull > 0;
    });

    if (!side2Alive) {
      this.endRound(1);
    } else if (!side1Alive) {
      this.endRound(2);
    }
  }

  private endRound(winner: 1 | 2): void {
    this.isRoundActive = false;
    if (winner === 1) this.side1Wins++;
    else this.side2Wins++;
    const isPlayerWin = this.playerSide === winner;
    this.showRoundResult(
      isPlayerWin ? "VICTORY!" : "DEFEAT",
      isPlayerWin ? HOLO_PALETTE.success : HOLO_PALETTE.danger,
    );
    this.updateScoreDisplay();

    if (this.side1Wins >= WINS_NEEDED || this.side2Wins >= WINS_NEEDED) {
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
    // player may have zoomed with the mouse wheel during the match.
    this.cameras.main.setZoom(1.0);
    // Hide the in-battle HUD under the end screen.
    this.hud?.setVisible(false);

    const playerWins = this.playerSide === 1 ? this.side1Wins : this.side2Wins;
    const enemyWins = this.playerSide === 1 ? this.side2Wins : this.side1Wins;
    const playerWon = playerWins > enemyWins;
    trackModeEnd("ace_duel", playerWon ? "victory" : "defeat");
    matchStats.finish(playerWon ? "victory" : "defeat");
    const playerMatchupFaction =
      this.playerSide === 1
        ? this.selectedMatchup.side1?.faction
        : this.selectedMatchup.side2?.faction;
    if (playerMatchupFaction) {
      audioManager.playFactionStinger(
        playerMatchupFaction,
        playerWon ? "victory" : "defeat",
      );
    }
    if (playerWon) {
      this.completedMatchups.add(this.selectedMatchup.id);
      this.saveCompletedMatchups();
    }
    this.showEndScreen(playerWon, playerWins, enemyWins);
  }

  /**
   * The end-of-match panel with REMATCH / BACK TO SETUP / MAIN MENU.
   *
   * @param playerWon - Whether the player took the match.
   * @param playerWins - Rounds the player won.
   * @param enemyWins - Rounds the opponent won.
   */
  private showEndScreen(
    playerWon: boolean,
    playerWins: number,
    enemyWins: number,
  ): void {
    const allDone = this.completedMatchups.size === ACE_MATCHUPS.length;
    showResultsPanel({
      scene: this,
      tone: playerWon ? "victory" : "defeat",
      banner: playerWon ? "DUEL WON" : "DUEL LOST",
      subtitle: `${this.selectedMatchup.name ?? "Match"}  \u00b7  final score  ${playerWins}  \u2013  ${enemyWins}`,
      rows: resultRows(matchStats.lastSummary),
      notes: allDone ? ["\u2605 Duelist achievement unlocked"] : [],
      actions: {
        onRematch: () => this.scene.restart({ rematch: true }),
        onSetup: () => this.scene.restart(),
        setupLabel: "Back to setup",
        onMenu: () => this.scene.start("MainMenuScene"),
      },
    });
  }
}
