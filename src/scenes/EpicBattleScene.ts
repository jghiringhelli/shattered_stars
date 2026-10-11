/**
 * Epic Battle Scene - Capital Assault
 *
 * Boss encounters where player squadron attacks massive capital ships.
 * Features:
 * - Multi-section damage (disable sections separately)
 * - Phase transitions (100-60%, 60-30%, 30-0%)
 * - Special boss abilities
 * - Escort fighters
 */

import Phaser from "phaser";
import { ShipStatCard } from "../ui/ShipStatCard";
import { InputManager } from "../input/InputManager";
import { setupSceneInput, teardownSceneInput } from "../input/setupSceneInput";
import { trackModeEnd, trackModeStart } from "../telemetry/telemetry";
import { matchStats } from "../telemetry/matchTelemetry";
import { addShipVisual } from "../rendering/ShipVisual";
import type { FactionId } from "../config";
import {
  BATTLEFIELD_SIZE,
  CYCLE_DURATION_MS,
  FACTION_COLORS,
  SHIP_SIZES,
} from "../config";
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
import { applyAllyAuraRepairs } from "../systems/aura/AllyAuraRepair";
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
import type { FlightEvent } from "../arcade/systems/PilotFlightTypes";
import { playFlightEventFx } from "../arcade/ArcadeFX";
import {
  assignQuickBuilds,
  equipFlight,
  equipQuickBuild,
  stressModifiersOf,
} from "../arcade/systems/QuickBuildEquip";
import { combatantOf, resolveDiceAttack } from "../arcade/systems/DiceAttack";
import {
  bossDamagePoints,
  bossDurability,
  bossRegenPoints,
  bossTempoMs,
  RAID_CLOCK_MS,
  mitigateBossDamage,
  resolveBossShot,
} from "../arcade/systems/EpicRaidCombat";
import {
  attackIntervalMs,
  HitImmunityLedger,
} from "../arcade/systems/CombatTempo";
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
import { random } from "../utils/random";
import { torusDistance } from "../core/Torus";
import { ShipTelemetry } from "../debug/ShipTelemetry";
import {
  raidBotSkill,
  type EpicAiSide,
  type EpicDifficulty,
} from "../arcade/systems/EpicAiFlight";
import type { BotContact } from "../arcade/ai";
import {
  bossPhaseForHullRatio,
  bossBroadsideDamage,
  bossReinforcementCount,
  sumSectionHull,
} from "../systems/EpicBossRules";
import {
  createSideScore,
  creditKill,
  resolveByPoints,
  type SideScore,
} from "../systems/arena/BattleScore";
import {
  createMatchTimer,
  formatMatchClock,
  tickMatchTimer,
  type MatchTimerState,
} from "../systems/arena/MatchTimer";
import { cameraViewFrom } from "../ui/hud/hudMath";
import { createHoloText } from "../ui/hud/holoPrimitives";
import { HOLO_DEPTH, HOLO_PALETTE } from "../ui/theme/HoloTheme";
import {
  BOSS_ABILITY_BASE_MS,
  BOSS_BROADSIDE_RANGE_PX,
  BOSS_DEFINITIONS,
  BOSS_SHIELD_REGEN_POINTS,
  raidDifficultyMultiplier,
} from "./epicRaid/bossDefinitions";
import { buildRaidSetupScreen } from "./epicRaid/RaidSetupScreen";
import {
  SettingsDefaultPick,
  raidDifficultyFor,
} from "../ui/menu/setupDefaults";
import { defaultDifficulty } from "../systems/SettingsStorage";
import { raidBriefing, showSortieBriefing } from "../ui/briefing";
import { FACTION_NAMES_SHORT } from "../data/survival/factionNames";
import { RaidHud } from "./epicRaid/RaidHud";
import { BOSS_CONTACT_ID, raidContacts } from "./epicRaid/raidHudSnapshot";
import {
  bossContact,
  escortWaveKey,
  RAID_BOSS_SIDE,
  RAID_PLAYER_SIDE,
  screenBossUntilEscortsFall,
} from "./epicRaid/raidTactics";
import type { BossStatusView } from "./epicRaid/bossStatus";
import { HoloPauseOverlay } from "./battleUi/HoloPauseOverlay";
import { showHoloResultScreen } from "./battleUi/HoloResultScreen";
import { fitBackdropToZoom } from "./battleUi/fitBackdropToZoom";
import {
  markContacts,
  playerHudState,
  primaryWeaponSlot,
} from "./battleUi/hudSnapshot";
import { BattleBots } from "./battleUi/BattleBots";
import { botContactOf } from "../arcade/ai/SceneContact";
import { pickShotTarget } from "./battleUi/shotPreference";

interface BossSection {
  id: string;
  name: string;
  hull: number;
  maxHull: number;
  isDisabled: boolean;
  offsetX: number;
  offsetY: number;
  weapons: boolean;
  shields: boolean;
}

interface BossShip {
  id: string;
  faction: FactionId;
  x: number;
  y: number;
  angle: number;
  sections: BossSection[];
  totalHull: number;
  maxTotalHull: number;
  shields: number;
  maxShields: number;
  /** Flat damage reduction applied to every incoming hit before shields/hull. */
  armor: number;
  phase: 1 | 2 | 3;
  abilities: BossAbility[];
  abilityCooldowns: Map<string, number>;
}

interface BossAbility {
  id: string;
  name: string;
  cooldown: number;
  effect: (boss: BossShip) => void;
}

interface EpicShip {
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

/** Agility dice the boss rolls against every bolt fired at it. */
const BOSS_AGILITY_DICE = 2;
/** Banner geometry/timing: above the followed flagship, rising as it fades. */
const BANNER_OFFSET_Y = 120;
const BANNER_SCALE = 1.5;
const BANNER_RISE_PX = 50;
const BANNER_DURATION_MS = 1500;
/** Pause after the boss explodes before the victory screen. */
const VICTORY_SCREEN_DELAY_MS = 1000;
/** Camera zoom in battle and the mouse-wheel limits. */
const RAID_ZOOM = { battle: 0.7, min: 0.4, max: 1.5 } as const;
/** Painted backdrop texture id. */
const RAID_BACKDROP = "galaxy_spiral";
/**
 * Where the boss lies: a quarter world from the top seam, so the fight
 * around it never straddles the wrap.
 */
const BOSS_SPAWN = {
  x: BATTLEFIELD_SIZE / 2,
  y: BATTLEFIELD_SIZE / 4,
} as const;
/** The squad starts half a world south of the boss: as far as the torus allows. */
const SQUAD_SPAWN = {
  x: BOSS_SPAWN.x,
  y: BOSS_SPAWN.y + BATTLEFIELD_SIZE / 2,
} as const;

/**
 * @param a - A point.
 * @param b - Another point.
 * @returns Their shortest distance on the wrapping battlefield.
 */
function worldDistance(
  a: Readonly<{ x: number; y: number }>,
  b: Readonly<{ x: number; y: number }>,
): number {
  return torusDistance(a.x, a.y, b.x, b.y, BATTLEFIELD_SIZE);
}

/** What {@link EpicBattleScene.createShip} needs to build a flying ship. */
interface ShipSpawn {
  readonly id: string;
  readonly defId: string;
  readonly faction: FactionId;
  readonly owner: "player" | "ai";
  readonly pose: Pose;
  /** Quick build it flies, or null for the bare hull. */
  readonly loadoutId: string | null;
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

export class EpicBattleScene extends Phaser.Scene {
  private ships: Map<string, EpicShip> = new Map();
  private shipSprites: Map<string, ShipSprite> = new Map();
  private healthBars: Map<string, HealthBar> = new Map();
  /** Repair mechanic + overlay shimmer + repair drones (built in create). */
  private repairFeedback: ShipRepairFeedback | null = null;

  private playerShipIds: string[] = [];
  private escortShipIds: string[] = [];

  // Boss state
  private boss: BossShip | null = null;
  private bossSprite: Phaser.GameObjects.Container | null = null;
  private bossSectionBars: Map<string, HealthBar> = new Map();
  private selectedBossFaction: FactionId = "terran_hegemony";
  private difficulty: EpicDifficulty = "medium";
  /** Preselects Settings › Default Difficulty (kept across retries). */
  private readonly difficultyDefault = new SettingsDefaultPick(
    raidDifficultyFor,
  );

  // Player settings
  private playerFaction: FactionId = "free_confederation";
  private playerSquadPoints = 300;

  // Game state
  private isPaused = false;
  private isSetupPhase = true;
  private gameResult: "none" | "victory" | "defeat" = "none";

  /** Raid time limit (ms); on timeout the boss survives and points decide it. */
  private static readonly RAID_DURATION_MS = RAID_CLOCK_MS;
  private raidTimer: MatchTimerState = createMatchTimer(
    EpicBattleScene.RAID_DURATION_MS,
  );
  /** Point cost of enemy ships the player destroyed. */
  private playerSideScore: SideScore = createSideScore();
  /** Point cost of the player's ships the enemy destroyed. */
  private enemySideScore: SideScore = createSideScore();

  // Timing
  private lastBossAbilityTime = 0;
  private bossAbilityInterval = bossTempoMs(BOSS_ABILITY_BASE_MS.tick);

  // Effects
  private effectsManager!: EffectsManager;
  private background!: ParallaxBackground;
  private performanceState: PerformanceState = createPerformanceState();
  private cameraShakeEnabled = true;
  private telemetry: ShipTelemetry | null = null;

  /** The human pilot's flight input (InputManager-driven) for the flagship. */
  private readonly pilot = new PlayerFlightPilot(InputManager);
  /** Ship the pilot last flew; a new flagship starts with fresh input memory. */
  private pilotedShipId: string | null = null;

  /** X-Wing round tempo: who struck whom this maneuver cycle. */
  private readonly hitLedger = new HitImmunityLedger();

  /** The raid's AI: escorts' and wingmen's bot pilots, squads and marks. */
  private readonly bots = new BattleBots({
    worldSize: BATTLEFIELD_SIZE,
    random: () => random.next(),
  });
  /** Escort waves launched so far (each wave flies as its own squad). */
  private escortWaves = 0;

  // UI
  private raidHud: RaidHud | null = null;
  private setupRoot: Phaser.GameObjects.Container | null = null;
  private pauseMenu: HoloPauseOverlay | null = null;
  private inputSubscriptionIds: number[] = [];

  constructor() {
    super({ key: "EpicBattleScene" });
  }

  shutdown(): void {
    this.inputSubscriptionIds.forEach((id) => InputManager.off(id));
    this.inputSubscriptionIds = [];
    teardownSceneInput();
    this.pilot.detach();
  }

  create(): void {
    // Phaser never calls shutdown() on its own; without this, every restart
    // stacks another set of input subscriptions.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.cameras.main.setBounds(0, 0, BATTLEFIELD_SIZE, BATTLEFIELD_SIZE);
    this.cameras.main.setBackgroundColor(0x050510);
    this.cameras.main.setZoom(1);
    addPaintedSpaceBackground(this, RAID_BACKDROP, 0);
    fitBackdropToZoom(this, RAID_BACKDROP, RAID_ZOOM.min);

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
    this.background = new ParallaxBackground(
      this,
      BATTLEFIELD_SIZE,
      BATTLEFIELD_SIZE,
    );
    this.background.startShootingStars();

    this.resetState();
    this.difficulty =
      this.difficultyDefault.next(defaultDifficulty()) ?? this.difficulty;
    this.showSetupScreen();

    if (ShipTelemetry.isEnabled()) {
      this.telemetry = new ShipTelemetry();
      this.telemetry.start();
      (
        window as unknown as { __shipTelemetry: ShipTelemetry }
      ).__shipTelemetry = this.telemetry;
    }

    this.cameras.main.centerOn(BATTLEFIELD_SIZE / 2, BATTLEFIELD_SIZE / 2);
    // Zoom is applied only once the battle starts (startBattle()) — a camera
    // zoom != 1.0 while scrollFactor(0) setup UI is showing breaks Phaser's
    // pointer hit-testing for that UI, even though it renders in the right spot.
  }

  private resetState(): void {
    this.ships.clear();
    this.shipSprites.forEach((s) => s.destroy());
    this.shipSprites.clear();
    this.healthBars.forEach((h) => h.destroy());
    this.healthBars.clear();
    this.bossSectionBars.forEach((h) => h.destroy());
    this.bossSectionBars.clear();
    this.playerShipIds = [];
    this.escortShipIds = [];
    this.boss = null;
    if (this.bossSprite) {
      this.bossSprite.destroy();
      this.bossSprite = null;
    }
    this.isPaused = false;
    this.isSetupPhase = true;
    this.gameResult = "none";
    this.raidTimer = createMatchTimer(EpicBattleScene.RAID_DURATION_MS);
    this.playerSideScore = createSideScore();
    this.enemySideScore = createSideScore();
    this.pilot.reset();
    this.pilotedShipId = null;
    this.hitLedger.clear();
    this.bots.reset();
    this.escortWaves = 0;
    this.lastBossAbilityTime = 0;
    this.raidHud = null;
    this.pauseMenu = null;
  }

  /** (Re)builds the holographic briefing screen with the current choices. */
  private showSetupScreen(): void {
    this.setupRoot?.destroy();
    this.setupRoot = buildRaidSetupScreen({
      scene: this,
      bossFaction: this.selectedBossFaction,
      difficulty: this.difficulty,
      onSelectBoss: (faction) => {
        this.selectedBossFaction = faction;
        this.showSetupScreen();
      },
      onSelectDifficulty: (difficulty) => {
        this.difficulty = difficulty;
        this.showSetupScreen();
      },
      onStart: () => this.briefSortie(),
      onBack: () => this.scene.start("MainMenuScene"),
    });
  }

  /** The pre-sortie briefing (≤ 3 s, skippable); the raid starts when it closes. */
  private briefSortie(): void {
    const boss = BOSS_DEFINITIONS[this.selectedBossFaction];
    showSortieBriefing(this, {
      briefing: raidBriefing({
        bossName: boss.name,
        bossFaction: FACTION_NAMES_SHORT[this.selectedBossFaction],
        difficulty: this.difficulty,
        clockMs: EpicBattleScene.RAID_DURATION_MS,
        escorts: boss.escortCount,
      }),
      accent: HOLO_PALETTE.danger,
      onLaunch: () => this.startBattle(),
    });
  }

  private startBattle(): void {
    this.setupRoot?.destroy();
    this.setupRoot = null;
    this.isSetupPhase = false;
    trackModeStart("boss_raid");
    matchStats.start(
      "boss_raid",
      { difficulty: this.difficulty, boss: this.selectedBossFaction },
      this.events,
    );
    this.cameras.main.setZoom(RAID_ZOOM.battle);

    audioManager.playMusic("combat_high");

    this.setupInput();
    this.createPauseMenu();
    this.addPlayerSquad();
    this.spawnBoss();
    this.spawnPlayerSquad();
    this.spawnEscorts();
    this.raidHud = new RaidHud(
      this,
      BOSS_DEFINITIONS[this.selectedBossFaction].name,
      BATTLEFIELD_SIZE,
    );
    this.refreshHud();

    // Follow the flagship: the boss and the squad spawn half a world apart,
    // so the camera's create()-time centre shows neither.
    const flagship = this.shipSprites.get(this.playerShipIds[0] ?? "");
    if (flagship) {
      this.cameras.main.startFollow(flagship, true, 0.09, 0.09);
    }
  }
  update(time: number, delta: number): void {
    InputManager.update();
    // Mix every positional sound relative to what the player is
    // looking at, so a distant firefight sounds distant.
    syncListenerToCamera(this.cameras.main);
    if (this.isSetupPhase || this.isPaused || this.gameResult !== "none")
      return;
    this.performanceState = updateFPS(this.performanceState, delta);
    this.performanceState = evaluateQuality(this.performanceState, time);
    this.effectsManager.setQualitySettings(
      this.performanceState.effectSettings,
    );

    this.background.update();

    if (this.updateRaidTimer(delta)) return;

    this.updateAI(time, delta);
    this.flyShips(delta);
    this.processCombat(delta);
    this.processBossAbilities(time);
    this.updateSprites();
    this.checkVictoryConditions();
    this.refreshHud();
  }

  /** Feeds the holographic HUD this frame's flagship, contacts, boss and clock. */
  private refreshHud(): void {
    if (!this.raidHud) return;
    const flagship = this.livingFlagship();
    const boss = this.boss;
    const contacts = raidContacts({
      flagshipId: flagship?.id ?? null,
      ships: this.ships.values(),
      boss: boss
        ? {
            id: boss.id,
            x: boss.x,
            y: boss.y,
            angle: boss.angle,
            hull: boss.totalHull,
          }
        : null,
      targetId: flagship ? this.flagshipTargetId(flagship) : null,
    });
    this.raidHud.update({
      battle: {
        player: flagship ? playerHudState(flagship) : null,
        contacts: markContacts(
          contacts,
          this.bots.markedTarget(RAID_PLAYER_SIDE, this.time.now),
        ),
        weapons: flagship
          ? [
              primaryWeaponSlot(
                flagship.weaponCooldown,
                attackIntervalMs(flagship.combatStats.weaponCooldown),
              ),
            ]
          : [],
        camera: cameraViewFrom(this.cameras.main),
      },
      boss: this.bossStatusView(),
      remainingMs: this.raidTimer.remainingMs,
    });
  }

  /** @returns The flagship (first living player ship), or null. */
  private livingFlagship(): EpicShip | null {
    const flagship = this.ships.get(this.playerShipIds[0] ?? "");
    return flagship && flagship.hull > 0 ? flagship : null;
  }

  /**
   * What the flagship's lasers are locked on (and what R marks): the target
   * it would shoot now, else the boss as the raid objective.
   *
   * @param flagship - The flagship.
   * @returns A HUD contact id, or null.
   */
  private flagshipTargetId(flagship: EpicShip): string | null {
    const shot = this.shotTargetId(flagship);
    if (shot) return shot;
    return this.boss && this.boss.totalHull > 0 ? BOSS_CONTACT_ID : null;
  }

  /** @returns The boss as the status panel shows it, or null once it is gone. */
  private bossStatusView(): BossStatusView | null {
    const boss = this.boss;
    if (!boss || boss.totalHull <= 0) return null;
    return {
      name: BOSS_DEFINITIONS[boss.faction].name,
      phase: boss.phase,
      shields: boss.shields,
      maxShields: boss.maxShields,
      hull: boss.totalHull,
      maxHull: boss.maxTotalHull,
      sections: boss.sections.map((section) => ({
        hull: section.hull,
        maxHull: section.maxHull,
        disabled: section.isDisabled,
      })),
    };
  }
  private setupInput(): void {
    setupSceneInput(this);
    this.pilot.attach();
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
        this.cameras.main.setZoom(
          Phaser.Math.Clamp(zoom, RAID_ZOOM.min, RAID_ZOOM.max),
        );
      },
    );
  }

  private createPauseMenu(): void {
    this.pauseMenu = new HoloPauseOverlay({
      scene: this,
      faction: this.playerFaction,
      onResume: () => this.resumeFromPause(),
      onRestart: () => {
        this.scene.restart();
      },
      onSettings: () => {
        this.scene.launch("SettingsScene", { returnScene: "EpicBattleScene" });
      },
      onQuit: () => {
        this.scene.start("MainMenuScene");
      },
    });
  }

  /**
   * ESC opens (or closes) the holographic pause menu. Zoom is reset to 1.0
   * first: scrollFactor(0) buttons mis-hit-test under camera zoom.
   */
  private togglePause(): void {
    if (this.isSetupPhase || this.gameResult !== "none") return;
    if (this.isPaused) {
      this.pauseMenu?.hide();
      this.resumeFromPause();
      return;
    }
    this.isPaused = true;
    // The HUD stops updating while paused, so it would keep the old zoom's
    // compensation: hide it under the menu.
    this.raidHud?.setVisible(false);
    this.cameras.main.setZoom(1.0);
    this.pauseMenu?.show();
  }

  /** Leaves the pause menu: the raid and its HUD resume. */
  private resumeFromPause(): void {
    this.isPaused = false;
    this.raidHud?.setVisible(true);
  }

  /** Spawns the raid boss at the difficulty, in real-time hit points. */
  private spawnBoss(): void {
    const bossDef = BOSS_DEFINITIONS[this.selectedBossFaction];
    const multiplier = raidDifficultyMultiplier(this.difficulty);

    const sections: BossSection[] = bossDef.sections.map((s, i) => ({
      id: `section_${i}`,
      name: s.name,
      hull: bossDurability(s.hull, multiplier),
      maxHull: bossDurability(s.hull, multiplier),
      isDisabled: false,
      offsetX: s.offsetX,
      offsetY: s.offsetY,
      weapons: s.weapons,
      shields: s.shields,
    }));

    this.boss = {
      id: BOSS_CONTACT_ID,
      faction: this.selectedBossFaction,
      x: BOSS_SPAWN.x,
      y: BOSS_SPAWN.y,
      angle: 180,
      sections,
      totalHull: sumSectionHull(sections),
      maxTotalHull: sumSectionHull(sections),
      shields: bossDurability(bossDef.shields, multiplier),
      maxShields: bossDurability(bossDef.shields, multiplier),
      armor: bossDef.armor,
      phase: 1,
      abilities: this.getBossAbilities(),
      abilityCooldowns: new Map(),
    };

    this.createBossSprite();
    matchStats.record({
      kind: "deploy",
      friendly: false,
      shipId: BOSS_CONTACT_ID,
    });
  }

  /**
   * Broadside: one shot at every player ship within reach, at the phase's
   * damage in real-time points; a ship the boss struck this cycle is spared.
   *
   * @param boss - The boss.
   */
  private fireBroadside(boss: BossShip): void {
    const now = this.time.now;
    for (const ship of this.livingShips(this.playerShipIds)) {
      if (worldDistance(boss, ship) >= BOSS_BROADSIDE_RANGE_PX) continue;
      if (this.hitLedger.isImmune(boss.id, ship.id, now)) continue;
      const damage = mitigateBossDamage(
        bossDamagePoints(bossBroadsideDamage(boss.phase)),
        ship.modifiers,
        this.fliesWithWingman(ship),
      );
      this.damageShip(ship, damage);
      this.hitLedger.recordHit(boss.id, ship.id, now);
      this.effectsManager.fireLaser(
        boss.x,
        boss.y,
        ship.x,
        ship.y,
        boss.faction,
        true,
      );
    }
  }

  /**
   * @param ids - Ship ids.
   * @returns The living ships among them.
   */
  private livingShips(ids: readonly string[]): EpicShip[] {
    return ids.flatMap((id) => {
      const ship = this.ships.get(id);
      return ship && ship.hull > 0 ? [ship] : [];
    });
  }
  private getBossAbilities(): BossAbility[] {
    return [
      {
        id: "broadside",
        name: "Broadside",
        cooldown: bossTempoMs(BOSS_ABILITY_BASE_MS.broadside),
        effect: (boss) => this.fireBroadside(boss),
      },
      {
        id: "launch_fighters",
        name: "Launch Fighters",
        cooldown: bossTempoMs(BOSS_ABILITY_BASE_MS.launchFighters),
        effect: (boss) => {
          // Spawn additional escorts
          const escortCount = bossReinforcementCount(boss.phase);
          const ships = getShipsByFaction(boss.faction);
          const escortDef =
            ships.find(
              (s) =>
                s.role === "light_fighter" ||
                s.role === "heavy_fighter" ||
                s.role === "interceptor",
            ) ?? ships[0];

          if (escortDef) {
            const positions = Array.from({ length: escortCount }, (_, i) => {
              const angle = (i / escortCount) * Math.PI - Math.PI / 2;
              return {
                x: boss.x + Math.cos(angle) * 100,
                y: boss.y + 100 + Math.sin(angle) * 50,
              };
            });
            this.spawnEscortGroup(escortDef.id, boss.faction, positions);
          }
        },
      },
      {
        id: "shield_regen",
        name: "Shield Regeneration",
        cooldown: bossTempoMs(BOSS_ABILITY_BASE_MS.shieldRegen),
        effect: (boss) => {
          if (boss.phase < 3) {
            boss.shields = Math.min(
              boss.maxShields,
              boss.shields + bossRegenPoints(BOSS_SHIELD_REGEN_POINTS),
            );
          }
        },
      },
    ];
  }

  private createBossSprite(): void {
    if (!this.boss) return;

    this.bossSprite = this.add.container(this.boss.x, this.boss.y);

    const color = FACTION_COLORS[this.boss.faction] ?? 0xffffff;
    const size = 120;

    // Main hull
    const body = this.add.graphics();
    body.fillStyle(color, 1);

    // Capital ship shape
    body.beginPath();
    body.moveTo(0, -size / 2);
    body.lineTo(-size / 2.5, 0);
    body.lineTo(-size / 3, size / 2);
    body.lineTo(size / 3, size / 2);
    body.lineTo(size / 2.5, 0);
    body.closePath();
    body.fillPath();

    body.lineStyle(3, 0xffffff, 0.9);
    body.strokePath();

    // Add glow
    const glow = this.add.graphics();
    glow.fillStyle(0xff4444, 0.15);
    glow.fillCircle(0, 0, size * 1.2);
    this.bossSprite.add(glow);

    this.bossSprite.add(body);

    // Section indicators
    this.boss.sections.forEach((section) => {
      const sectionGraphic = this.add.graphics();
      sectionGraphic.fillStyle(0xffffff, 0.3);
      sectionGraphic.fillCircle(section.offsetX, section.offsetY, 15);
      sectionGraphic.setData("sectionId", section.id);
      this.bossSprite!.add(sectionGraphic);
    });

    this.bossSprite.setAngle(this.boss.angle);
    this.bossSprite.setDepth(20);
  }

  private spawnPlayerSquad(): void {
    const ships = getShipsByFaction(this.playerFaction);
    const centerX = SQUAD_SPAWN.x;
    const startY = SQUAD_SPAWN.y;

    // Spawn a squad within point budget
    let pointsUsed = 0;
    const maxShips = 5;
    const squad: { defId: string; x: number; y: number }[] = [];

    for (const shipDef of ships) {
      if (squad.length >= maxShips) break;
      if (pointsUsed + 50 > this.playerSquadPoints) break;

      const x = centerX + (squad.length - 2) * 80;
      const y = startY + (squad.length % 2) * 60;

      squad.push({ defId: shipDef.id, x, y });
      pointsUsed += 50;
    }

    const loadoutIds = assignQuickBuilds(squad.map((slot) => slot.defId));
    squad.forEach((slot, index) =>
      this.spawnPlayerShip(slot.defId, slot, loadoutIds[index] ?? null),
    );
  }

  /**
   * @param defId - Ship definition id.
   * @param at - Spawn position.
   * @param loadoutId - Quick build it flies, or null for the bare hull.
   */
  private spawnPlayerShip(
    defId: string,
    at: Readonly<{ x: number; y: number }>,
    loadoutId: string | null,
  ): void {
    const id = `player_${this.playerShipIds.length}`;
    const ship = this.createShip({
      id,
      defId,
      faction: this.playerFaction,
      owner: "player",
      pose: { x: at.x, y: at.y, angle: 0 },
      loadoutId,
    });
    this.ships.set(id, ship);
    this.playerShipIds.push(id);
    matchStats.record({ kind: "deploy", friendly: true, shipId: id });
    this.crewShip(id, "wingman", RAID_PLAYER_SIDE);
    this.createShipSprite(ship);
    this.createHealthBar(ship);
  }

  /**
   * The player's squad: the player marks (R); without a mark the wingmen
   * mark their own focus, clearing the escort screen before the boss.
   */
  private addPlayerSquad(): void {
    this.bots.addSquad({
      key: RAID_PLAYER_SIDE,
      side: RAID_PLAYER_SIDE,
      aiLeader: false,
      assistMark: true,
      screen: (contacts, nowMs) =>
        screenBossUntilEscortsFall(contacts, {
          bossId: BOSS_CONTACT_ID,
          bossMarked:
            this.bots.markedTarget(RAID_PLAYER_SIDE, nowMs) === BOSS_CONTACT_ID,
        }),
    });
  }

  /**
   * Gives an AI-capable ship its bot pilot and squad. Every player ship gets
   * one: a wingman promoted to flagship is simply not flown by it.
   *
   * @param shipId - The ship.
   * @param side - Escort or wingman (sets the bot's tier).
   * @param squadKey - Its squad.
   */
  private crewShip(shipId: string, side: EpicAiSide, squadKey: string): void {
    const skill = raidBotSkill(side, this.difficulty);
    this.bots.addPilot({
      shipId,
      tier: skill.tier,
      reactionScale: skill.reactionScale,
    });
    this.bots.enlist(shipId, squadKey);
  }

  private spawnEscorts(): void {
    if (!this.boss) return;

    const bossDef = BOSS_DEFINITIONS[this.selectedBossFaction];
    const ships = getShipsByFaction(this.boss.faction);
    const escortDef =
      ships.find(
        (s) =>
          s.role === "light_fighter" ||
          s.role === "heavy_fighter" ||
          s.role === "interceptor",
      ) ?? ships[0];

    if (!escortDef) return;

    const boss = this.boss;
    const positions = Array.from({ length: bossDef.escortCount }, (_, i) => {
      const angle = (i / bossDef.escortCount) * Math.PI * 2;
      const radius = 150 + Math.random() * 50;
      return {
        x: boss.x + Math.cos(angle) * radius,
        y: boss.y + 100 + (Math.sin(angle) * radius) / 2,
      };
    });
    this.spawnEscortGroup(escortDef.id, boss.faction, positions);
  }

  /**
   * Spawns one wave of boss escorts, flying as its own AI-led squad; the
   * wave's quick builds are assigned together so no unique ace flies twice
   * in it.
   *
   * @param defId - Ship definition id of every escort in the wave.
   * @param faction - The boss's faction.
   * @param positions - One spawn position per escort.
   */
  private spawnEscortGroup(
    defId: string,
    faction: FactionId,
    positions: readonly Readonly<{ x: number; y: number }>[],
  ): void {
    this.escortWaves += 1;
    const squadKey = escortWaveKey(this.escortWaves);
    this.bots.addSquad({ key: squadKey, side: RAID_BOSS_SIDE, aiLeader: true });
    const loadoutIds = assignQuickBuilds(positions.map(() => defId));
    positions.forEach((at, index) =>
      this.spawnEscort(
        { defId, faction, at, loadoutId: loadoutIds[index] ?? null },
        squadKey,
      ),
    );
  }

  /**
   * @param escort - Definition, faction, position and quick build.
   * @param squadKey - Its wave's squad.
   */
  private spawnEscort(
    escort: Readonly<{
      defId: string;
      faction: FactionId;
      at: Readonly<{ x: number; y: number }>;
      loadoutId: string | null;
    }>,
    squadKey: string,
  ): void {
    const id = `escort_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const ship = this.createShip({
      id,
      defId: escort.defId,
      faction: escort.faction,
      owner: "ai",
      pose: { x: escort.at.x, y: escort.at.y, angle: 180 },
      loadoutId: escort.loadoutId,
    });
    this.ships.set(id, ship);
    this.escortShipIds.push(id);
    matchStats.record({ kind: "deploy", friendly: false, shipId: id });
    this.crewShip(id, "escort", squadKey);
    this.createShipSprite(ship);
    this.createHealthBar(ship);
  }

  /**
   * Builds a flying ship record with its quick build equipped: stat bonuses,
   * modifier sheet, and faster action recharges / top speed on its flight.
   *
   * @param spawn - Identity, side, pose and loadout of the new ship.
   * @returns The equipped ship record.
   */
  private createShip(spawn: ShipSpawn): EpicShip {
    const { id, defId, pose } = spawn;
    const combatStats = getModeCombatStats(defId, "continuous");

    const ship: EpicShip = {
      id,
      definitionId: defId,
      faction: spawn.faction,
      owner: spawn.owner,
      x: pose.x,
      y: pose.y,
      angle: pose.angle,
      hull: combatStats.hull,
      maxHull: combatStats.maxHull,
      shields: combatStats.shields,
      maxShields: combatStats.maxShields,
      combatStats,
      flight: createCycleFlight(defId, pose),
      dial: getShipDial(defId),
      weaponCooldown: 0,
      loadoutId: spawn.loadoutId,
      modifiers: NEUTRAL_MODIFIERS,
      frenzyUntilMs: 0,
    };
    ship.modifiers = equipQuickBuild(ship, spawn.loadoutId);
    ship.flight = equipFlight(ship.flight, ship.modifiers);
    return ship;
  }
  private createShipSprite(ship: EpicShip): void {
    const container = this.add.container(
      ship.x,
      ship.y,
    ) as unknown as ShipSprite;
    container.shipId = ship.id;

    const shipDef = getShipDefinition(ship.definitionId);
    const size = SHIP_SIZES[shipDef?.baseStats.size ?? "small"];

    addShipVisual(this, container, {
      definitionId: ship.definitionId,
      faction: ship.faction,
      fallbackSizeName: shipDef?.baseStats.size ?? "small",
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

  private createHealthBar(ship: EpicShip): void {
    const healthBar = new HealthBar({
      scene: this,
      x: ship.x,
      y: ship.y - 40,
      faction: ship.faction,
      maxHull: ship.maxHull,
      maxShields: ship.maxShields,
      currentHull: ship.hull,
      currentShields: ship.shields,
      side: overlaySide(
        ship.id === this.pilotedShipId,
        ship.owner === "player",
      ),
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
        modifiers: stressModifiersOf(ship.modifiers),
      });
      this.setFlight(ship, tick.state);
      this.regenerateShipShields(ship, deltaMs);
      if (tick.completed) {
        const started = tick.state.motion.control.currentManeuver ?? "straight";
        if (ship.id === this.pilotedShipId)
          matchStats.record({
            kind: "cycle",
            dial: ship.dial,
            direction: tick.completed.direction,
            speed: tick.completed.speed,
          });
        if (ship.id === this.pilotedShipId)
          this.pilot.onCycleCommitted(started);
        else this.bots.onCycleCommitted(ship.id, started);
      }
      this.shipSprites
        .get(ship.id)
        ?.setPosition(ship.x, ship.y)
        .setAngle(ship.angle);
      this.telemetry?.sample(ship.id, ship.x, ship.y, ship.angle);
    }
    applyAllyAuraRepairs(this.ships.values(), this.repairFeedback, deltaMs);
  }

  /**
   * Stores a ship's new flight state and mirrors its pose onto the record
   * (combat, AI and camera read x/y/angle).
   *
   * @param ship - The ship.
   * @param flight - Its new flight state.
   */
  private setFlight(ship: EpicShip, flight: CycleFlightState): void {
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
    ship: EpicShip,
    events: readonly FlightEvent[],
    origin: Pose,
  ): void {
    const isPiloted = ship.id === this.pilotedShipId;
    for (const event of events) {
      playFlightEventFx(this, {
        event,
        origin,
        definitionId: ship.definitionId,
        faction: ship.faction,
        sprite: this.shipSprites.get(ship.id),
        cameraShake: isPiloted && this.cameraShakeEnabled,
        zoomPulse: isPiloted,
      });
    }
  }

  /**
   * One frame of laser fire on the X-Wing round tempo: each ship attacks at
   * most once per maneuver cycle, and holds its shot while its target is
   * still immune to it (struck by it this cycle).
   *
   * @param delta - Frame length (ms).
   */
  private processCombat(delta: number): void {
    for (const ship of this.livingShips(this.playerShipIds)) {
      if (this.weaponReady(ship, delta)) this.fireShot(ship);
    }
    for (const ship of this.livingShips(this.escortShipIds)) {
      if (this.weaponReady(ship, delta)) this.fireShot(ship);
    }
  }

  /**
   * A ready ship fires at its shot target (the boss, or a ship), if any.
   *
   * @param ship - A living ship whose weapon is ready.
   */
  private fireShot(ship: EpicShip): void {
    const targetId = this.shotTargetId(ship);
    if (!targetId) return;
    if (this.boss && targetId === this.boss.id) {
      this.fireAt(ship, targetId, () => this.attackBoss(ship));
      return;
    }
    const target = this.ships.get(targetId);
    if (target)
      this.fireAt(ship, targetId, () => this.attackShip(ship, target));
  }

  /**
   * Ticks a ship's weapon cooldown.
   *
   * @param ship - A living ship.
   * @param delta - Frame length (ms).
   * @returns True once it may fire.
   */
  private weaponReady(ship: EpicShip, delta: number): boolean {
    ship.weaponCooldown = Math.max(0, ship.weaponCooldown - delta);
    return ship.weaponCooldown <= 0;
  }

  /**
   * Fires one attack unless the target is immune to this attacker; a hit
   * makes it immune for a cycle. The weapon waits a full attack interval.
   *
   * @param attacker - The firing ship.
   * @param targetId - The target's id (the boss's for a boss shot).
   * @param attack - Resolves the shot; returns whether it hit.
   */
  private fireAt(
    attacker: EpicShip,
    targetId: string,
    attack: () => boolean,
  ): void {
    const now = this.time.now;
    if (this.hitLedger.isImmune(attacker.id, targetId, now)) return;
    if (attack()) this.hitLedger.recordHit(attacker.id, targetId, now);
    attacker.weaponCooldown = attackIntervalMs(
      attacker.combatStats.weaponCooldown,
    );
  }

  /**
   * @param ship - A ship.
   * @returns Whether the standing boss is within its weapon range.
   */
  private bossInRange(ship: EpicShip): boolean {
    if (!this.boss || this.boss.totalHull <= 0) return false;
    return worldDistance(ship, this.boss) < ship.combatStats.weaponRange;
  }

  /**
   * What a ship shoots now: its squad's mark, then its pilot's target (AI
   * ships), then the nearest enemy ship in range, then the boss in range —
   * the escort screen first unless the boss is marked.
   *
   * @param ship - A living ship.
   * @returns Target id (the boss's for the boss), or null.
   */
  private shotTargetId(ship: EpicShip): string | null {
    const isPlayerSide = ship.owner === "player";
    const enemies = this.livingShips(
      isPlayerSide ? this.escortShipIds : this.playerShipIds,
    );
    const inRange = enemies
      .map((enemy) => ({
        id: enemy.id,
        distance: worldDistance(ship, enemy),
      }))
      .filter((entry) => entry.distance < ship.combatStats.weaponRange)
      .sort((a, b) => a.distance - b.distance)
      .map((entry) => entry.id);
    if (isPlayerSide && this.boss && this.bossInRange(ship))
      inRange.push(this.boss.id);
    return pickShotTarget(inRange, [
      this.markedTargetOf(ship),
      ship.id === this.pilotedShipId ? null : this.bots.pilotTargetOf(ship.id),
    ]);
  }

  /**
   * @param ship - A ship.
   * @returns The target its squad has marked right now, or null.
   */
  private markedTargetOf(ship: EpicShip): string | null {
    return this.bots.markedTargetFor(ship.id, this.sideOf(ship), this.time.now);
  }

  /**
   * @param ship - A ship.
   * @returns Its raid side key.
   */
  private sideOf(ship: EpicShip): string {
    return ship.owner === "player" ? RAID_PLAYER_SIDE : RAID_BOSS_SIDE;
  }

  /**
   * One bolt at the boss, carrying the attacker's laser bonuses (and the
   * squad mark's when the player's side marked the boss); the boss's pose
   * stands in as the target for the pilot's conditional bonuses.
   *
   * @param attacker - The firing player-side ship.
   * @returns Whether the bolt damaged the boss.
   */
  private attackBoss(attacker: EpicShip): boolean {
    if (!this.boss) return false;

    const damage = resolveBossShot({
      attacker: combatantOf(attacker),
      boss: this.boss,
      hitChance: calculateHitChance(
        attacker.combatStats.attackDice,
        BOSS_AGILITY_DICE,
      ),
      baseDamage: attacker.combatStats.attackDice,
      attackerHasWingman: this.fliesWithWingman(attacker),
      nowMs: this.time.now,
      roll: random.next(),
      targetMarked: this.markedTargetOf(attacker) === this.boss.id,
    });
    const hit = damage > 0;
    matchStats.record({ kind: "shot", friendly: true, weapon: "primary", hit });
    if (hit) this.damageBoss(this.boss, damage);

    this.effectsManager.fireLaser(
      attacker.x,
      attacker.y,
      this.boss.x,
      this.boss.y,
      attacker.faction,
      hit,
    );
    return hit;
  }

  /**
   * Damage taken by the boss: shields first, then a random active section
   * (which may disable it and move the boss to its next phase).
   *
   * @param boss - The boss.
   * @param damage - Damage after the attacker's bonuses and the boss's armor.
   */
  private damageBoss(boss: BossShip, damage: number): void {
    let remaining = damage;
    if (boss.shields > 0) {
      const shieldDmg = Math.min(boss.shields, remaining);
      boss.shields -= shieldDmg;
      remaining -= shieldDmg;
      audioManager.playSoundAt("shield_hit", boss.x, boss.y, 0.4);
    }
    matchStats.record({
      kind: "damage",
      toFriendly: false,
      shield: damage - remaining,
      hull: remaining,
    });

    if (remaining > 0) {
      audioManager.playSoundAt("hull_hit", boss.x, boss.y, 0.4);
      const activeSections = boss.sections.filter(
        (s) => !s.isDisabled && s.hull > 0,
      );
      if (activeSections.length > 0) {
        const targetSection =
          activeSections[Math.floor(Math.random() * activeSections.length)]!;
        targetSection.hull = Math.max(0, targetSection.hull - remaining);

        if (targetSection.hull <= 0) {
          targetSection.isDisabled = true;
          this.showMessage(`${targetSection.name} DISABLED!`);
        }
      }

      boss.totalHull = sumSectionHull(boss.sections);
      this.checkBossPhaseTransition();
    }
  }

  private checkBossPhaseTransition(): void {
    if (!this.boss) return;

    const hullRatio = this.boss.totalHull / this.boss.maxTotalHull;
    const targetPhase = bossPhaseForHullRatio(hullRatio);

    if (targetPhase === 3 && this.boss.phase < 3) {
      this.boss.phase = 3;
      this.showMessage("BOSS ENTERING CRITICAL PHASE!");
    } else if (targetPhase === 2 && this.boss.phase < 2) {
      this.boss.phase = 2;
      this.showMessage("Boss shields failing! Reinforcements incoming!");
      // Spawn reinforcements
      this.boss.abilities
        .find((a) => a.id === "launch_fighters")
        ?.effect(this.boss);
    }
  }

  /**
   * One ship-vs-ship bolt resolved with both ships' equipment: laser and
   * ability bonuses, the target's mitigation, stress on hit, and the
   * pilot-ability effects of a kill.
   *
   * @param attacker - The firing ship.
   * @param target - The ship fired at.
   * @returns Whether the bolt damaged the target.
   */
  private attackShip(attacker: EpicShip, target: EpicShip): boolean {
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
      targetMarked: this.markedTargetOf(attacker) === target.id,
    });

    this.effectsManager.fireLaser(
      attacker.x,
      attacker.y,
      target.x,
      target.y,
      attacker.faction,
      result.hit,
    );
    matchStats.record({
      kind: "shot",
      friendly: attacker.owner === "player",
      weapon: "primary",
      hit: result.hit,
    });
    if (!result.hit) return false;
    this.setFlight(target, {
      ...target.flight,
      stress: applyInstantStress(target.flight.stress, result.stressOnTarget),
    });
    this.damageShip(target, result.damage, attacker);
    return result.damage > 0;
  }

  /**
   * Damage taken shields first, then hull; a kill removes the ship and
   * resolves the pilot-ability effects of it.
   *
   * @param ship - The ship hit.
   * @param damage - Damage after equipment and mitigation.
   * @param killer - The ship that dealt it, or null (boss, death blast).
   */
  private damageShip(
    ship: EpicShip,
    damage: number,
    killer: EpicShip | null = null,
  ): void {
    if (ship.hull <= 0) return;
    matchStats.record({
      kind: "damage",
      toFriendly: ship.owner === "player",
      shield: Math.min(Math.max(0, ship.shields), damage),
      hull: Math.min(
        ship.hull,
        Math.max(0, damage - Math.max(0, ship.shields)),
      ),
    });
    if (ship.shields > 0) {
      const shieldDmg = Math.min(ship.shields, damage);
      ship.shields -= shieldDmg;
      damage -= shieldDmg;
      audioManager.playSoundAt("shield_hit", ship.x, ship.y, 0.4);
    }

    if (damage > 0) {
      audioManager.playSoundAt("hull_hit", ship.x, ship.y, 0.4);
      ship.hull = Math.max(0, ship.hull - damage);
    }

    const healthBar = this.healthBars.get(ship.id);
    healthBar?.update(ship.hull, ship.shields);

    if (ship.hull <= 0) {
      this.destroyShip(ship.id);
      this.resolveAbilityKill(killer, ship);
    }
  }

  /**
   * @param ship - The ship asking.
   * @returns Whether another living ship of its side flies within wingman range.
   */
  private fliesWithWingman(ship: EpicShip): boolean {
    const allies = [...this.ships.values()].filter(
      (other) => other.owner === ship.owner && other.hull > 0,
    );
    return hasWingman(ship, allies);
  }

  /**
   * Pilot-ability effects of a kill: the killer's reward (shields, frenzy)
   * and the victim's death blast on enemies nearby.
   *
   * @param killer - The ship that made the kill, or null (boss, blast).
   * @param victim - The ship destroyed.
   */
  private resolveAbilityKill(killer: EpicShip | null, victim: EpicShip): void {
    if (killer && killer.hull > 0) {
      Object.assign(killer, rewardKill(combatantOf(killer), this.time.now));
      this.healthBars.get(killer.id)?.update(killer.hull, killer.shields);
    }
    const enemies = [...this.ships.values()].filter(
      (other) => other.owner !== victim.owner && other.hull > 0,
    );
    for (const caught of deathBlastTargets(combatantOf(victim), enemies)) {
      this.damageShip(caught, deathBlastDamage(combatantOf(victim)), victim);
    }
  }

  /**
   * Applies a ship's own shield regen and hull repair for one frame
   * (equipment / pilot ability); the repair feedback refreshes its overlay.
   *
   * @param ship - The ship.
   * @param deltaMs - Frame length (ms).
   */
  private regenerateShipShields(ship: EpicShip, deltaMs: number): void {
    this.repairFeedback?.selfRepair(ship, deltaMs);
  }

  private destroyShip(shipId: string): void {
    const ship = this.ships.get(shipId);
    if (!ship) return;
    this.hitLedger.forget(shipId);
    this.bots.remove(shipId);
    matchStats.record({
      kind: "kill",
      victimFriendly: ship.owner === "player",
      victimIsPlayer: shipId === this.pilotedShipId,
    });

    if (ship.owner === "player") {
      this.enemySideScore = creditKill(this.enemySideScore, ship.definitionId);
    } else {
      this.playerSideScore = creditKill(
        this.playerSideScore,
        ship.definitionId,
      );
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
    this.escortShipIds = this.escortShipIds.filter((id) => id !== shipId);
  }

  private processBossAbilities(time: number): void {
    if (!this.boss || this.boss.totalHull <= 0) return;

    if (time - this.lastBossAbilityTime >= this.bossAbilityInterval) {
      // Pick a random ability that's not on cooldown
      const availableAbilities = this.boss.abilities.filter((a) => {
        const cooldown = this.boss!.abilityCooldowns.get(a.id) ?? 0;
        return cooldown <= time;
      });

      if (availableAbilities.length > 0) {
        const ability =
          availableAbilities[
            Math.floor(Math.random() * availableAbilities.length)
          ]!;
        ability.effect(this.boss);
        this.boss.abilityCooldowns.set(ability.id, time + ability.cooldown);
        this.showMessage(ability.name + "!");
      }

      this.lastBossAbilityTime = time;
    }
  }

  /**
   * Queues every ship's next maneuver: the flagship's from the player's
   * input, every other ship's from its bot pilot (escorts at the raid
   * difficulty's tier, wingmen average) under its squad's orders. The
   * player's R marks the flagship's target for the player's squad.
   *
   * @param time - Scene time (ms).
   * @param delta - Frame length (ms).
   */
  private updateAI(time: number, delta: number): void {
    const flagship = this.livingFlagship();
    this.takePlayerMark(flagship);
    const contacts = this.aiContacts();
    this.bots.command(this.time.now, contacts);
    const aiShips = [
      ...this.livingShips(this.escortShipIds),
      ...this.livingShips(this.playerShipIds),
    ];
    for (const ship of aiShips) {
      if (ship !== flagship) this.flyBot(ship, contacts, time, delta);
    }
    if (flagship) this.flyPlayer(flagship, time, delta);
  }

  /**
   * R (MARK_TARGET) marks the flagship's target for the player's squad: an
   * escort to focus, or the boss to turn the whole squad onto it.
   *
   * @param flagship - The flagship, or null.
   */
  private takePlayerMark(flagship: EpicShip | null): void {
    if (!this.pilot.takeMarkRequest() || !flagship) return;
    const targetId = this.flagshipTargetId(flagship);
    if (targetId) this.bots.mark(RAID_PLAYER_SIDE, targetId, this.time.now);
    if (targetId) matchStats.record({ kind: "mark" });
  }

  /** @returns Every living ship and the standing boss, as the AI sees them. */
  private aiContacts(): BotContact[] {
    const contacts = this.livingShips([...this.ships.keys()]).map((ship) =>
      botContactOf(ship, this.sideOf(ship)),
    );
    if (this.boss && this.boss.totalHull > 0)
      contacts.push(bossContact(this.boss));
    return contacts;
  }

  /**
   * An AI ship's bot pilot flies one frame through the player's controls.
   *
   * @param ship - The AI ship.
   * @param contacts - Every ship and the boss.
   * @param time - Scene time (ms).
   * @param delta - Frame length (ms).
   */
  private flyBot(
    ship: EpicShip,
    contacts: readonly BotContact[],
    time: number,
    delta: number,
  ): void {
    const origin = { x: ship.x, y: ship.y, angle: ship.angle };
    const result = this.bots.fly(ship.id, contacts, {
      flight: ship.flight,
      dial: ship.dial,
      nowMs: time,
      deltaMs: delta,
    });
    if (!result) return;
    this.setFlight(ship, { motion: result.motion, stress: result.stress });
    this.playFlightEvents(ship, result.events, origin);
  }

  /**
   * Runs one frame of the player's input on the flagship through the shared
   * pilot controls (tap = drift, hold = bank, Q/E = hard turn, K-turn,
   * Segnor, Tallon, boost, barrel roll). A new flagship (the old one fell)
   * starts with fresh input memory.
   *
   * @param ship - The flagship.
   * @param time - Scene time (ms).
   * @param delta - Frame length (ms).
   */
  private flyPlayer(ship: EpicShip, time: number, delta: number): void {
    if (ship.id !== this.pilotedShipId) {
      this.pilot.reset();
      this.pilotedShipId = ship.id;
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
    this.setFlight(ship, { motion: result.motion, stress: result.stress });
    this.playFlightEvents(ship, result.events, origin);
    matchStats.record({ kind: "flight", events: result.events });
    matchStats.record({
      kind: "stress",
      ms: delta,
      stressed: result.stress.isStressed,
    });
  }

  private updateSprites(): void {
    for (const [id, ship] of this.ships) {
      const healthBar = this.healthBars.get(id);
      if (healthBar) {
        healthBar.setPosition(ship.x, ship.y - 40);
        healthBar.setSide(
          overlaySide(id === this.pilotedShipId, ship.owner === "player"),
        );
      }
    }
  }

  /**
   * Advance the raid clock. On timeout the boss has survived, so the winner is
   * decided by destroyed squad-point cost (marginal victory) else defeat.
   * @returns true if the raid ended this frame.
   */
  private updateRaidTimer(deltaMs: number): boolean {
    this.raidTimer = tickMatchTimer(this.raidTimer, deltaMs);
    if (!this.raidTimer.expired) return false;
    const outcome = resolveByPoints(this.playerSideScore, this.enemySideScore);
    if (outcome === "side1") {
      this.gameResult = "victory";
      this.showVictoryScreen();
    } else {
      this.gameResult = "defeat";
      this.showDefeatScreen();
    }
    return true;
  }

  private checkVictoryConditions(): void {
    // Victory: Boss destroyed
    if (this.boss && this.boss.totalHull <= 0) {
      this.gameResult = "victory";
      this.showVictoryScreen();
      return;
    }

    // Defeat: All player ships destroyed
    if (this.livingShips(this.playerShipIds).length === 0) {
      this.gameResult = "defeat";
      this.showDefeatScreen();
    }
  }

  /**
   * A short holographic banner (ability, section disabled, phase change).
   *
   * @param message - Banner text.
   */
  private showMessage(message: string): void {
    const text = createHoloText(
      this,
      this.scale.width / 2,
      this.scale.height / 2 - BANNER_OFFSET_Y,
      message.toUpperCase(),
      "heading",
      HOLO_PALETTE.warning,
    )
      .setScale(BANNER_SCALE)
      .setScrollFactor(0)
      .setDepth(HOLO_DEPTH.hudIndicators);

    this.tweens.add({
      targets: text,
      alpha: 0,
      y: text.y - BANNER_RISE_PX,
      duration: BANNER_DURATION_MS,
      onComplete: () => text.destroy(),
    });
  }

  /** Raid won: the boss blows up (if it fell), then the result screen. */
  private showVictoryScreen(): void {
    this.isPaused = true;
    this.raidHud?.setVisible(false);
    const bossDestroyed = this.boss !== null && this.boss.totalHull <= 0;
    if (bossDestroyed && this.bossSprite && this.boss) {
      this.effectsManager.createExplosion(this.boss.x, this.boss.y, "large");
      this.bossSprite.destroy();
      this.bossSprite = null;
    }
    const bossName = BOSS_DEFINITIONS[this.selectedBossFaction].name;
    this.time.delayedCall(VICTORY_SCREEN_DELAY_MS, () =>
      this.showResult(
        true,
        bossDestroyed
          ? `${bossName} destroyed`
          : "Raid clock expired — won on points",
      ),
    );
  }

  /** Raid lost: the result screen. */
  private showDefeatScreen(): void {
    this.isPaused = true;
    this.raidHud?.setVisible(false);
    this.showResult(false, "Squadron lost — the capital ship survives");
  }

  /**
   * The holographic end screen with the raid's stats, RETRY and MENU.
   *
   * @param victory - Whether the player won.
   * @param subtitle - One-line outcome.
   */
  private showResult(victory: boolean, subtitle: string): void {
    trackModeEnd("boss_raid", victory ? "victory" : "defeat");
    matchStats.finish(victory ? "victory" : "defeat");
    const boss = this.boss;
    const bossHullPct = boss
      ? Math.floor((Math.max(0, boss.totalHull) / boss.maxTotalHull) * 100)
      : 0;
    showHoloResultScreen({
      scene: this,
      victory,
      subtitle,
      stats: [
        {
          label: "Ships remaining",
          value: `${this.livingShips(this.playerShipIds).length}`,
        },
        { label: "Boss hull remaining", value: `${bossHullPct}%` },
        { label: "Escorts destroyed", value: `${this.playerSideScore.kills}` },
        {
          label: "Raid time",
          value: formatMatchClock(
            EpicBattleScene.RAID_DURATION_MS - this.raidTimer.remainingMs,
          ),
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
}
