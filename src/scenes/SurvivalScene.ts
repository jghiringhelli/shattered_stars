/**
 * Survival Mode Scene — one battle node of the Survival roguelite
 * (docs/adr/ADR-0004-survival-roguelite-run-structure.md, leveling in
 * ADR-0003).
 *
 * The run (sector map, relics, salvage, persisted hull) lives in the
 * RoguelikeRunService; this scene fights the active combat / elite / boss
 * node: the saved fleet spawns with its persisted damage, the node's waves
 * arrive (threat scaled by sector, row and ascension; elites with affixes;
 * a boss with phases), and on clear the outcome goes back to the run and
 * the map. Losing the whole fleet ends the run (summary screen).
 * Launched without a run (menus, tests) it starts a quick run straight
 * into its first combat node.
 */

import Phaser from "phaser";
import { updateBankState, bankSquashFor } from "../rendering/ShipBanking";
import type { FactionId } from "../config";
import { BATTLEFIELD_SIZE, CYCLE_DURATION_MS } from "../config";
import { getShipDial } from "../data/ShipDefinitions";
import {
  getModeCombatStats,
  calculateHitChance,
  type ModeCombatStats,
} from "../data/ModeBalancing";
import {
  beltDamageForFrame,
  beltRetreatPoint,
  type BeltConfig,
} from "../systems/arena/ArenaBoundary";
import {
  SURVIVAL_AI_WORLD_SIZE,
  survivalBelt,
} from "../systems/survival/SurvivalBelt";
import { BeltWarningHud } from "../ui/survival/BeltWarningHud";
import { HealthBar } from "../ui/HealthBar";
import { ShipRepairFeedback, overlaySide } from "../ui/hud/overlay";
import { applyAllyAuraRepairs } from "../systems/aura/AllyAuraRepair";
import { BattleHud, cameraViewFrom } from "../ui/hud";
import { SurvivalModeHud } from "../ui/modeHud/SurvivalModeHud";
import {
  attackIntervalMs,
  HitImmunityLedger,
} from "../arcade/systems/CombatTempo";
import {
  nearestHostile,
  nearestTargetInArc,
} from "../arcade/systems/ArcTargeting";
import { squadHudSnapshot } from "../arcade/systems/FlagshipHudSnapshot";
import type {
  BattleWeapons,
  BattleWeaponsLink,
  WeaponHit,
} from "./battleUi/BattleWeapons";
import {
  createSceneWeapons,
  weaponBodyOf,
  withSecondaryWeapons,
} from "./battleUi/sceneWeapons";
import {
  armorReductionOf,
  damageMitigationOf,
  shotAurasOf,
} from "../arcade/systems/DamageRules";
import type { ActiveAura } from "../systems/SupportAura";
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
import { survivalBattleMode } from "../audio/musicContexts";
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
import { SURVIVAL_ESCORT_TIER } from "../arcade/systems/SurvivalSteering";
import { SquadBattleAi } from "../arcade/systems/SquadBattleAi";
import type { BotPilot } from "../arcade/ai/BotPilot";
import { playFlightEventFx } from "../arcade/ArcadeFX";
import {
  equipFlight,
  equipQuickBuild,
  stressModifiersOf,
} from "../arcade/systems/QuickBuildEquip";
import {
  absorbDamage,
  combatantOf,
  resolveDiceAttack,
} from "../arcade/systems/DiceAttack";
import {
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
  runServiceOf,
  type RoguelikeRunService,
} from "../systems/survival/RoguelikeRunService";
import {
  phaseCallsReinforcements,
  planCombat,
  shouldStartNextBossPhase,
} from "../systems/survival/CombatNodePlan";
import type { CreatureEncounter } from "../arcade/creatures/CreatureEncounter";
import {
  createBattleEncounter,
  creatureShipStats,
} from "../arcade/creatures/creatureSpawn";
import { getCreature } from "../data/creatures/creatureCatalog";
import {
  SceneCreatures,
  type SceneCreatureBridge,
} from "./creatures/SceneCreatures";
import { nodeWaveRoster } from "../systems/survival/NodeWaveRoster";
import {
  trackDeath,
  trackModeEnd,
  trackModeStart,
} from "../telemetry/telemetry";
import { matchStats } from "../telemetry/matchTelemetry";
import {
  layoutWave,
  reinforcementPoints,
  SURVIVAL_BASE_BELT,
  type SpawnPoint,
} from "../systems/survival/SurvivalSpawnArc";
import {
  fleetModifiers,
  reequipFlight,
} from "../systems/survival/runFlightEquip";
import {
  SurvivalBattleRules,
  type WaveSpec,
} from "../systems/survival/SurvivalBattleRules";
import type { ShipRecord } from "../systems/survival/RunTypes";
import { maneuverDifficultyOf } from "../systems/survival/maneuverDifficulty";
import { affixLabel, type EliteAffix } from "../data/survival/affixes";
import { FACTION_NAMES_SHORT } from "../data/survival/factionNames";
import { SURVIVAL_STARTER_CHOICES } from "../data/survival/starters";
import {
  addAffixLabel,
  addSurvivalShipSprite,
  affixLabelOffset,
  type SurvivalShipSprite,
} from "../ui/survival/survivalShipSprite";
import type {
  ShotAdjust,
  TriggerResult,
} from "../systems/survival/RelicCombatEngine";
import { ShipTelemetry } from "../debug/ShipTelemetry";
import { PauseMenu } from "../ui/PauseMenu";
import { InputManager } from "../input/InputManager";
import { openSettingsOverBattle } from "./battleUi/openSettingsOverBattle";
import { setupSceneInput, teardownSceneInput } from "../input/setupSceneInput";

/** Starter ships moved to data/survival/starters; re-exported for callers. */
export { SURVIVAL_STARTER_CHOICES };

/** Maximum ships (flagship + escorts) the player fleet may field. */
const MAX_FLEET = 6;

/** Extra weapon range in pixels granted per point of the range bonus. */
const RANGE_PER_POINT = 40;

/**
 * Base asteroid-belt containment field before tightening (shared with the
 * spawn-arc tests). The belt is harmless within `safeRadius` of the arena
 * center and impassable at `wallRadius`; waves squeeze it (see tightenBelt).
 */
const BASE_BELT: BeltConfig = SURVIVAL_BASE_BELT;

/** Extra attack dice an elite wave ship rolls. */
const ELITE_ATTACK_BONUS = 1;

/** Damage multiplier of a crit drafted by the player fleet. */
const CRIT_DAMAGE_MULTIPLIER = 2;

/** Floor on the fire-rate bonus's cooldown multiplier (at most 2x faster). */
const MIN_PLAYER_COOLDOWN_MOD = 0.5;

/** Relic hit-chance bonuses never push a shot above this. */
const MAX_HIT_CHANCE = 0.95;

/** Shot adjustments of a ship with no relics (enemies). */
const NEUTRAL_SHOT: ShotAdjust = {
  hitChanceBonus: 0,
  damageBonus: 0,
  damageMultiplier: 1,
  critChanceBonus: 0,
  shots: 1,
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
  /** The encounter driving it when it is a creature (no bot, no dial). */
  creature?: CreatureEncounter | null;
  /** Hull radius of a creature (px). */
  radiusPx?: number;
  /** True for a boss creature (its adds are counted against it). */
  isBossCreature?: boolean;
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

/** A wave ship about to spawn at a point, facing the arena centre. */
interface EnemySpawn {
  readonly slot: WaveSlot;
  readonly faction: FactionId;
  readonly spec: WaveSpec;
  readonly at: SpawnPoint;
}

/** Centre of the arena (the belt and the spawn arc are centred on it). */
const ARENA_CENTER = {
  x: BATTLEFIELD_SIZE / 2,
  y: BATTLEFIELD_SIZE / 2,
} as const;

/** Living ships per side this frame (wingman checks). */
type LivingBySide = ReadonlyMap<SurvivalShip["owner"], readonly SurvivalShip[]>;

type ShipSprite = SurvivalShipSprite;

/** Pause before the node's next wave arrives (ms). */
const NEXT_WAVE_DELAY_MS = 2500;
/** Pause between the last kill and returning to the map (ms). */
const RETURN_TO_MAP_DELAY_MS = 2000;
/** Regulars that join a boss when it enters a new phase. */
const BOSS_PHASE_REINFORCEMENTS = 2;
/** Reinforcements enter this far (px) from the boss. */
const BOSS_REINFORCEMENT_OFFSET_PX = 160;

export class SurvivalScene extends Phaser.Scene {
  private ships: Map<string, SurvivalShip> = new Map();
  private shipSprites: Map<string, ShipSprite> = new Map();
  private healthBars: Map<string, HealthBar> = new Map();
  /** Repair mechanic + overlay shimmer + repair drones (built in create). */
  private repairFeedback: ShipRepairFeedback | null = null;

  private playerShipIds: string[] = [];
  private enemyShipIds: string[] = [];

  /** Player ship ids that are escorts (weak basic bodies, no flagship bonuses). */
  private escortShipIds: Set<string> = new Set();

  // Survival state
  private wave = 0;
  private score = 0;

  // Asteroid-belt containment (ADR-0004): starts squeezed per the node plan, tightens each wave.
  private beltConfig: BeltConfig = BASE_BELT;
  private beltGraphics!: Phaser.GameObjects.Graphics;
  private playerFaction: FactionId = "free_confederation";
  private isWaveActive = false;
  private isPaused = false;
  /** True once the node is won or lost (no further wave / result handling). */
  private battleEnded = false;

  // Progression — the run's powers/level for this battle (restored from the run).
  private run!: SurvivalRunController;
  /** The roguelite run (map, relics, salvage, persisted hull). */
  private service!: RoguelikeRunService;
  /** This node's rules: plan, relic engine, seeded rolls, kill bookkeeping. */
  private rules!: SurvivalBattleRules;
  /** Saved record of each player ship (persisted hull, upgrades), by ship id. */
  private readonly records = new Map<string, ShipRecord>();
  /** Each player ship's modifier sheet without the run's Drive (see applyBonusesToFleet). */
  private readonly baseModifiers = new Map<string, CombatModifiers>();
  /** Phases a boss has started (1 = opening phase), by ship id. */
  private readonly bossPhases = new Map<string, number>();
  /** Floating affix labels of elites, by ship id. */
  private readonly affixLabels = new Map<string, Phaser.GameObjects.Text>();
  /** Scene time the battle started (duration measurement). */
  private battleStartMs = 0;
  /** Monotonic counter for deterministic enemy ids. */
  private enemySerial = 0;
  /** True when launched from the map with the run's battle node active. */
  private fromRun = false;
  /** Debug/e2e: let a bot fly the flagship (node duration measurement). */
  autopilot = false;

  // UI — holographic battle HUD (flight, radar, weapons) + Survival readouts
  private battleHud: BattleHud | null = null;
  private modeHud!: SurvivalModeHud;
  /** Pulsing edge/text/icon warning + audio cue near the asteroid belt. */
  private beltWarning: BeltWarningHud | null = null;

  /** X-Wing round tempo: a struck target ignores its attacker for a cycle. */
  private readonly hitLedger = new HitImmunityLedger();
  /** Secondary weapons (missiles, torpedoes, turrets, bombs, mines, cloak). */
  private weapons: BattleWeapons | null = null;
  /** Creature bosses and spawns: bodies, telegraphs, boss bar, cues. */
  private creatures: SceneCreatures<SurvivalShip> | null = null;
  /** Faction auras resolved this frame (buffs every shot and stress tick). */
  private auras: ReadonlyMap<string, ActiveAura> = new Map();

  /** The human pilot's flight input (InputManager-driven) — flies the flagship. */
  private readonly pilot = new PlayerFlightPilot(InputManager);
  /** Bots, squad orders and marks of every AI-flown ship (enemies, escorts). */
  private readonly squadAi = new SquadBattleAi({
    worldSize: SURVIVAL_AI_WORLD_SIZE,
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
    fromRun?: boolean;
  }): void {
    if (data?.factionId) this.playerFaction = data.factionId;
    this.starterShipId = data?.shipId ?? null;
    this.starterLoadoutId = data?.loadoutId ?? null;
    this.fromRun = data?.fromRun === true;
  }

  create(): void {
    // Phaser never calls shutdown() on its own; without this, every restart
    // stacks another set of input subscriptions.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    // No setBounds — camera is driven manually for seamless toroid wrapping (see updateCameraFollow).
    this.cameras.main.setBackgroundColor(0x050510);
    addPaintedSpaceBackground(this, "starfield_deep", 0);

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

    this.beltGraphics = this.add.graphics().setDepth(1);
    this.weapons = createSceneWeapons(this, this.weaponsLink(), this.hitLedger);
    this.creatures = new SceneCreatures(this, this.creatureBridge());
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
    const plan = this.rules.plan;
    const title =
      plan.kind === "boss"
        ? "SECTOR BOSS"
        : plan.kind === "elite"
          ? "ELITE CONTACT"
          : "HOSTILES";
    this.showMessage(
      title,
      `${FACTION_NAMES_SHORT[plan.enemyFaction]} — sector ${plan.sector}`,
    );
    this.time.delayedCall(2000, () => this.startNextWave());
  }

  shutdown(): void {
    this.inputSubscriptionIds.forEach((id) => InputManager.off(id));
    this.inputSubscriptionIds = [];
    teardownSceneInput();
    this.pilot.detach();
    this.battleHud?.destroy();
    this.battleHud = null;
    this.beltWarning?.destroy();
    this.beltWarning = null;
    this.weapons?.destroy();
    this.weapons = null;
    this.creatures?.destroy();
    this.creatures = null;
  }

  private resetState(): void {
    this.wave = 0;
    this.score = 0;
    this.enemySerial = 0;
    this.battleEnded = false;
    this.openRunBattle();
    // Sector boss → Dreadnought, belt-heavy node → Threading the Belt.
    audioManager.playBattleMusic(
      survivalBattleMode(this.rules.plan),
      this.playerFaction,
    );
    this.beltConfig = survivalBelt(this.rules.plan.beltSteps);
    this.drawBelt();
    this.isWaveActive = false;
    this.isPaused = false;
    this.pilot.reset();
    this.pilotedShipId = null;
    this.squadAi.reset();
    this.hitLedger.clear();

    this.creatures?.destroy();
    this.ships.clear();
    this.shipSprites.forEach((s) => s.destroy());
    this.shipSprites.clear();
    this.healthBars.forEach((h) => h.destroy());
    this.healthBars.clear();
    this.affixLabels.forEach((l) => l.destroy());
    this.affixLabels.clear();
    this.records.clear();
    this.baseModifiers.clear();
    this.bossPhases.clear();
    this.playerShipIds = [];
    this.enemyShipIds = [];
    this.escortShipIds.clear();
    trackModeStart("survival", {
      node: this.rules.plan.kind,
      sector: this.rules.plan.sector,
    });
    matchStats.start(
      "survival",
      {
        node: this.rules.plan.kind,
        sector: this.rules.plan.sector,
        row: this.rules.plan.row,
      },
      this.events,
    );
    this.spawnFleet();
    this.battleStartMs = this.time.now;
  }

  /**
   * Binds the battle to the run's active combat node. Launched without one
   * (menus, tests, quick play) it starts a quick run whose first combat
   * node is entered at once.
   */
  private openRunBattle(): void {
    this.service = runServiceOf(this.registry);
    const active = this.fromRun
      ? (this.service.run ?? this.service.resume())
      : null;
    const run =
      active && planCombat(active)
        ? active
        : this.service.startQuickRun({
            faction: this.playerFaction,
            flagshipId:
              this.starterShipId ??
              SURVIVAL_STARTER_CHOICES[this.playerFaction][0]!,
            loadoutId: this.starterLoadoutId,
            ascension: 0,
          });
    this.playerFaction = run.faction;
    this.run = SurvivalRunController.fromState(run.seed, run.progression);
    this.rules = new SurvivalBattleRules(run, planCombat(run)!);
  }

  /** Spawns the run's saved fleet (flagship first) with its persisted damage. */
  private spawnFleet(): void {
    const centerX = BATTLEFIELD_SIZE / 2;
    const centerY = BATTLEFIELD_SIZE / 2 + 100;
    this.rules.fleet().forEach((record, index) => {
      const spawned = this.spawnPlayerShip(
        {
          definitionId: record.definitionId,
          x: centerX + index * 80,
          y: centerY + (index > 0 ? 50 : 0),
          loadoutId: record.loadoutId,
        },
        index > 0,
      );
      this.records.set(spawned.id, record);
      this.rules.equipPlayer(
        spawned,
        index === 0 ? "flagship" : "escort",
        record,
      );
      this.baseModifiers.set(spawned.id, spawned.modifiers);
      this.healthBars.get(spawned.id)?.update(spawned.hull, spawned.shields);
    });
    this.applyBonusesToFleet();
  }

  /**
   * Folds the run's Drive ("speed" powers) into every player ship's sheet —
   * flagship and escorts alike — and re-applies it to the flight from the
   * hull's base (runFlightEquip), so calling this again never stacks.
   */
  private applyBonusesToFleet(): void {
    const speed = this.run.bonuses.speed;
    for (const id of this.playerShipIds) {
      const ship = this.ships.get(id);
      const base = this.baseModifiers.get(id);
      if (!ship || !base) continue;
      ship.modifiers = fleetModifiers(base, speed);
      ship.flight = reequipFlight(
        ship.flight,
        ship.definitionId,
        ship.modifiers,
      );
    }
  }

  update(time: number, delta: number): void {
    InputManager.update();
    // Mix every positional sound relative to what the player is
    // looking at, so a distant firefight sounds distant.
    syncListenerToCamera(this.cameras.main);
    this.modeHud.sync(this.cameras.main);
    this.beltWarning?.sync(this.cameras.main);
    if (this.isPaused) return;
    this.performanceState = updateFPS(this.performanceState, delta);
    this.performanceState = evaluateQuality(this.performanceState, time);
    this.effectsManager.setQualitySettings(
      this.performanceState.effectSettings,
    );

    this.background.update();

    this.updateAI(time, delta);
    this.flyShips(delta);
    this.creatures?.update(time, delta);
    // Secondaries first: a held or chosen launch is this cycle's attack.
    this.weapons?.update(delta, this.time.now);
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
    this.beltWarning = new BeltWarningHud(this, (volume) =>
      audioManager.playSound("belt_warning", volume),
    );
  }

  /**
   * Refreshes the battle HUD from this frame's state: the flagship as the
   * player (its status ring replaces its health bar), wing mates as allies,
   * wave ships as enemies, its primary's cooldown and the score readout.
   */
  private updateHud(): void {
    this.modeHud.setScore(
      this.score,
      `Wing ${this.playerShipIds.length}/${MAX_FLEET} · +${this.rules.salvageEarned} ⚙`,
    );
    const flagship = this.ships.get(this.playerShipIds[0] ?? "") ?? null;
    if (flagship) {
      this.retireHealthBar(flagship.id);
      audioManager.reportPlayerHull(flagship.hull / flagship.maxHull);
    }
    this.beltWarning?.update(
      flagship,
      ARENA_CENTER,
      this.beltConfig,
      this.time.now,
    );
    this.battleHud?.update({
      ...withSecondaryWeapons(
        squadHudSnapshot({
          flagship,
          ships: this.ships.values(),
          targetId: flagship ? this.hudTargetOf(flagship) : null,
          markedId: this.squadAi.playerMarkOf(this.time.now),
          cooldownRemainingMs: flagship?.weaponCooldown ?? 0,
          attackIntervalMs: flagship ? this.attackIntervalOf(flagship) : 0,
          camera: cameraViewFrom(this.cameras.main),
        }),
        this.weapons?.hudSlots() ?? [],
      ),
      boundary: { center: ARENA_CENTER, radius: this.beltConfig.safeRadius },
    });
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
        // A roguelite run cannot re-roll a battle: Restart abandons the run
        // (Star Charts are still paid) and opens the setup screen.
        this.service.abandon();
        this.scene.start("SurvivalSetupScene");
      },
      onSettings: () => {
        openSettingsOverBattle(this);
      },
      onQuit: () => {
        // The run stays saved at the node before this battle ("Continue").
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
    if (this.battleEnded) return;
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.cameras.main.setZoom(1.0);
      this.pauseMenu.show();
    } else {
      this.pauseMenu.hide();
    }
  }

  private showMessage(title: string, subtitle: string): void {
    this.modeHud.showMessage(title, subtitle);
  }

  // ==========================================
  // WAVE MANAGEMENT
  // ==========================================

  /**
   * Sends the node's next wave: its size comes from the run's threat scaled
   * by the node plan (sector, row, ascension), the belt holds the node's
   * squeeze, and the elite / boss arrive on the node's last wave.
   */
  private startNextWave(): void {
    if (this.battleEnded) return;
    const spec = this.rules.nextWave();
    this.wave = this.run.beginWave();
    this.beltConfig = survivalBelt(spec.beltSteps);
    this.drawBelt();
    const label = `Wave ${spec.index}/${spec.total}`;
    this.modeHud.setWave(this.wave, label);
    this.isWaveActive = true;
    this.showMessage(
      label.toUpperCase(),
      spec.isBossWave ? "BOSS INCOMING!" : FACTION_NAMES_SHORT[spec.faction],
    );
    this.squadAi.resetEnemySquad();
    this.spawnWaveEnemies(spec);
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
      if (ship.hull <= 0 || ship.creature) continue;
      const dist = Math.hypot(ship.x - cx, ship.y - cy);
      const damage = realTimeBeltDamage(
        beltDamageForFrame(dist, this.beltConfig, deltaMs),
      );
      if (damage <= 0) continue;
      ship.hull = Math.max(0, ship.hull - damage);
      this.healthBars.get(ship.id)?.update(ship.hull, ship.shields);
      if (ship.hull <= 0 && ship.id === this.pilotedShipId)
        trackDeath("survival", "belt", { sector: this.rules.plan.sector });
      if (ship.hull <= 0) this.destroyShip(ship.id, false);
    }
  }

  private checkWaveComplete(): void {
    if (this.battleEnded) return;
    const playersAlive = this.playerShipIds.filter((id) => {
      const ship = this.ships.get(id);
      return ship && ship.hull > 0;
    }).length;
    if (playersAlive === 0) {
      this.loseBattle();
      return;
    }
    if (!this.isWaveActive) return;
    const enemiesAlive = this.enemyShipIds.filter((id) => {
      const ship = this.ships.get(id);
      return ship && ship.hull > 0;
    }).length;
    if (enemiesAlive > 0) return;
    this.isWaveActive = false;
    this.score += this.wave * 100;
    if (!this.rules.onLastWave) {
      this.showMessage("WAVE CLEARED", "Next wave inbound");
      this.time.delayedCall(NEXT_WAVE_DELAY_MS, () => this.startNextWave());
      return;
    }
    this.winBattle();
  }

  /**
   * The node is cleared: the surviving fleet (with its damage) and the
   * battle's kills / salvage go back to the run, then the map (or the
   * summary after the final boss).
   */
  private winBattle(): void {
    this.battleEnded = true;
    const survivors = this.playerShipIds.flatMap((id) => {
      const ship = this.ships.get(id);
      const record = this.records.get(id);
      return ship && record && ship.hull > 0 ? [{ record, ...ship }] : [];
    });
    const durationMs = this.time.now - this.battleStartMs;
    const run = this.service.winBattle(
      this.rules.outcome(survivors, this.run.level, durationMs),
    );
    const won = run?.status === "victory" || this.service.run === null;
    trackModeEnd("survival", "victory", {
      node: this.rules.plan.kind,
      sector: this.rules.plan.sector,
      runWon: won,
    });
    matchStats.finish("victory", { runWon: won });
    this.showMessage(
      won ? "VICTORY" : "SECTOR NODE CLEARED",
      won ? "The Nexus flagship is down" : "Returning to the map",
    );
    if (won) audioManager.playFactionStinger(this.playerFaction, "victory");
    this.time.delayedCall(RETURN_TO_MAP_DELAY_MS, () =>
      this.scene.start(won ? "SurvivalSummaryScene" : "SurvivalMapScene"),
    );
  }

  /** The whole fleet is lost: the run ends and the summary shows. */
  private loseBattle(): void {
    this.battleEnded = true;
    this.isWaveActive = false;
    audioManager.playFactionStinger(this.playerFaction, "defeat");
    const enemy = FACTION_NAMES_SHORT[this.rules.plan.enemyFaction];
    const where =
      this.rules.plan.kind === "boss"
        ? "the sector boss"
        : `a ${this.rules.plan.kind} wing`;
    this.service.loseBattle(
      `Destroyed by ${where} of the ${enemy} (sector ${this.rules.plan.sector})`,
      this.time.now - this.battleStartMs,
      this.rules.killCount,
    );
    this.showMessage("FLEET DESTROYED", "The run is over");
    trackModeEnd("survival", "defeat", {
      node: this.rules.plan.kind,
      sector: this.rules.plan.sector,
    });
    matchStats.finish("defeat");
    this.time.delayedCall(RETURN_TO_MAP_DELAY_MS, () =>
      this.scene.start("SurvivalSummaryScene"),
    );
  }

  /**
   * Spawns an elite wave ship: its equipped build with +50% hull and +1 attack
   * (the multiplier applies to the already-scaled hull — no double scaling),
   * then its rolled affixes (shown above it and announced).
   *
   * @param spawn - The wave ship and where it enters.
   */
  private spawnEliteShip(spawn: EnemySpawn): void {
    const affixes = this.rules.eliteAffixes();
    const ship = this.createEnemy(spawn, "elite", affixes);
    ship.maxHull = eliteMaxHull(ship.maxHull);
    const bonusDice = this.rules.equipEnemy(ship, affixes);
    ship.flight = reequipFlight(ship.flight, ship.definitionId, ship.modifiers);
    ship.combatStats = {
      ...ship.combatStats,
      attackDice: ship.combatStats.attackDice + ELITE_ATTACK_BONUS + bonusDice,
    };
    this.addEnemy(ship, true);
    this.labelAffixes(ship, affixes);
  }

  /**
   * Shows an elite's affixes above it and on the mode HUD.
   *
   * @param ship - The elite.
   * @param affixes - Its affixes.
   */
  private labelAffixes(
    ship: SurvivalShip,
    affixes: readonly EliteAffix[],
  ): void {
    if (affixes.length === 0) return;
    const text = affixLabel(affixes);
    this.affixLabels.set(ship.id, addAffixLabel(this, text));
    this.showMessage("ELITE", text);
  }

  /**
   * Spawns the sector boss: its equipped (already scaled) build multiplied
   * by the sector's boss multiplier, with capital-style engines/turrets/bridge
   * subsystems splitting its final hull, and its phase count from the plan.
   *
   * @param spawn - The wave ship and where it enters.
   */
  private spawnBossShip(spawn: EnemySpawn): void {
    const creatureBoss = this.rules.plan.creatureBoss;
    if (creatureBoss) {
      const boss = this.spawnCreatureShip(
        creatureBoss.id,
        { ...spawn.at },
        "boss",
        creatureBoss.phases,
      );
      this.bossPhases.set(boss.id, 1);
      return;
    }
    const bossWave = this.rules.plan.bossWave;
    const multiplier = bossMultiplier(bossWave);
    const ship = this.createEnemy(spawn, "boss", []);
    const caps = bossDurability(ship, bossWave);
    ship.maxHull = caps.maxHull;
    ship.maxShields = caps.maxShields;
    this.rules.equipEnemy(ship, []);
    ship.combatStats = {
      ...ship.combatStats,
      attackDice: ship.combatStats.attackDice + Math.floor(multiplier / 2),
    };
    ship.capitalSystems = createCapitalSystems(ship.maxHull);
    this.bossPhases.set(ship.id, 1);
    this.addEnemy(ship, false, true);
  }

  /**
   * Puts a creature on the field: a ship record carrying its encounter, hit
   * points through the shared durability path, no primary weapon and no bot.
   *
   * @param creatureId - The creature.
   * @param at - Where it enters.
   * @param rank - Boss (the node's boss) or regular (an add it called).
   * @param phases - Phases of its fight.
   * @returns Its ship.
   */
  private spawnCreatureShip(
    creatureId: string,
    at: Pose,
    rank: "boss" | "elite" | "regular",
    phases: number,
  ): SurvivalShip {
    const definition = getCreature(creatureId);
    const stats = creatureShipStats(definition);
    const standIn = this.ships.get(this.playerShipIds[0] ?? "");
    const base = this.createShip({
      id: `${rank}_creature_${this.wave}_${this.enemySerial++}`,
      definitionId: standIn?.definitionId ?? definition.id,
      faction: this.rules.plan.enemyFaction,
      owner: "ai",
      pose: at,
      loadoutId: null,
    });
    this.weapons?.forget(base.id);
    const ship: SurvivalShip = {
      ...base,
      definitionId: definition.id,
      hull: stats.hull,
      maxHull: stats.maxHull,
      shields: stats.shields,
      maxShields: stats.maxShields,
      combatStats: {
        ...base.combatStats,
        attackDice: 0,
        agilityDice: stats.agilityDice,
      },
      creature: createBattleEncounter({
        definition,
        battleSeed: this.rules.plan.combatSeed,
        serial: this.enemySerial,
        worldSize: BATTLEFIELD_SIZE,
        belt: { ...ARENA_CENTER, safeRadius: this.beltConfig.safeRadius },
        phases,
        start: at,
      }),
      radiusPx: stats.radiusPx,
      isBossCreature: rank === "boss",
    };
    this.rules.registerEnemy(ship.id, rank);
    this.rules.equipEnemy(ship, []);
    this.ships.set(ship.id, ship);
    matchStats.record({ kind: "deploy", friendly: false, shipId: ship.id });
    this.enemyShipIds.push(ship.id);
    this.shipSprites.set(ship.id, this.creatures!.register(ship));
    this.createHealthBar(ship);
    return ship;
  }

  /** @returns What the creature layer asks of this scene (damage, stress, spawns). */
  private creatureBridge(): SceneCreatureBridge<SurvivalShip> {
    return {
      ships: () => this.ships.values(),
      isFlagship: (ship) => ship.id === this.playerShipIds[0],
      damage: (victim, amount, attacker) =>
        this.landHit(attacker, victim, { damage: amount, stress: 0 }),
      stress: (victim, amount) =>
        this.setFlight(victim, {
          ...victim.flight,
          stress: applyInstantStress(victim.flight.stress, amount),
        }),
      nudge: (victim, dx, dy) => {
        const motion = victim.flight.motion;
        this.setFlight(victim, {
          ...victim.flight,
          motion: { ...motion, x: motion.x + dx, y: motion.y + dy },
        });
      },
      setPose: (ship, x, y, angle) => {
        ship.x = x;
        ship.y = y;
        ship.angle = angle;
        this.shipSprites.get(ship.id)?.setPosition(x, y).setAngle(angle);
      },
      spawnAdd: (creatureId, x, y, angle) => {
        this.spawnCreatureShip(creatureId, { x, y, angle }, "regular", 1);
      },
      healed: (ship, hull) => {
        ship.hull = Math.min(ship.maxHull, ship.hull + hull);
        this.healthBars.get(ship.id)?.update(ship.hull, ship.shields);
      },
      effects: () => this.effectsManager,
    };
  }

  /**
   * Spawns the wave on an arc just inside the belt's safe radius, every ship
   * facing the arena centre (SurvivalSpawnArc): regulars on the arc, elites
   * and the boss a little further in, each flying its quick build.
   *
   * @param spec - The wave (faction, boss wave, tiers).
   */
  private spawnWaveEnemies(spec: WaveSpec): void {
    const faction = spec.faction;
    const slots = nodeWaveRoster({
      rules: this.rules,
      controller: this.run,
      spec,
      playerShips: this.playerShipIds.length,
    });
    const layout = layoutWave({
      center: ARENA_CENTER,
      safeRadius: this.beltConfig.safeRadius,
      regulars: slots.filter((s) => s.tier === "regular").length,
      elites: slots.filter((s) => s.tier === "elite").length,
      boss: slots.some((s) => s.tier === "boss"),
    });
    const eventCreature = this.rules.plan.eventCreature;
    if (eventCreature && spec.index >= spec.total) {
      const [point] = layoutWave({
        center: ARENA_CENTER,
        safeRadius: this.beltConfig.safeRadius,
        regulars: 0,
        elites: 1,
        boss: false,
      }).elites;
      if (point)
        this.spawnCreatureShip(eventCreature, { ...point }, "elite", 1);
    }
    let regular = 0;
    let elite = 0;
    for (const slot of slots) {
      if (slot.tier === "regular") {
        this.spawnEnemyShip({
          slot,
          faction,
          spec,
          at: layout.regulars[regular++]!,
        });
      } else if (slot.tier === "elite") {
        this.spawnEliteShip({
          slot,
          faction,
          spec,
          at: layout.elites[elite++]!,
        });
      } else if (layout.boss) {
        this.spawnBossShip({ slot, faction, spec, at: layout.boss });
      }
    }
  }

  /**
   * A boss crossing a phase threshold restores its shields and calls in
   * reinforcements (ascension 8 / the final boss add phases).
   *
   * @param boss - The boss just hit.
   */
  private checkBossPhase(boss: SurvivalShip): void {
    const started = this.bossPhases.get(boss.id);
    if (started === undefined || boss.hull <= 0) return;
    const { plan } = this.rules;
    const totalPhases = boss.creature
      ? (plan.creatureBoss?.phases ?? plan.bossPhases)
      : plan.bossPhases;
    if (
      !shouldStartNextBossPhase(totalPhases, started, boss.hull / boss.maxHull)
    )
      return;
    this.bossPhases.set(boss.id, started + 1);
    if (started + 1 >= totalPhases) {
      audioManager.setBossFinalPhase(true);
    }
    if (boss.creature && !phaseCallsReinforcements(plan.bossPhases, started)) {
      this.showMessage(
        `${boss.creature.definition.name.toUpperCase()}: ${boss.creature.phase.name}`,
        "It is enraged!",
      );
      return;
    }
    boss.shields = boss.maxShields;
    this.showMessage(
      `BOSS PHASE ${started + 1}`,
      "Shields restored — reinforcements inbound!",
    );
    const spec = { ...this.rules.currentWave(), isBossWave: false };
    const [slot] = planWaveRoster(this.rules.roster(spec.faction), {
      enemyCount: BOSS_PHASE_REINFORCEMENTS,
      eliteCount: 0,
      isMilestone: false,
    });
    if (!slot) return;
    const points = reinforcementPoints(
      boss,
      BOSS_PHASE_REINFORCEMENTS,
      ARENA_CENTER,
      this.beltConfig.safeRadius,
      BOSS_REINFORCEMENT_OFFSET_PX,
    );
    for (const at of points)
      this.spawnEnemyShip({ slot, faction: spec.faction, spec, at });
  }

  // ==========================================
  // SHIP MANAGEMENT
  // ==========================================

  /**
   * Spawns a player ship (the flagship, or an escort) flying its quick build.
   *
   * @param spawn - Ship, entry point and quick build.
   * @param isEscort - True for an escort (no drafted bonuses).
   * @returns The spawned ship.
   */
  private spawnPlayerShip(spawn: PlayerSpawn, isEscort = false): SurvivalShip {
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
    matchStats.record({ kind: "deploy", friendly: true, shipId: id });
    this.playerShipIds.push(id);
    this.baseModifiers.set(id, ship.modifiers);
    this.createShipSprite(ship);
    this.createHealthBar(ship);
    return ship;
  }

  /**
   * Spawns a regular wave ship flying its quick build.
   *
   * @param spawn - The wave ship and where it enters.
   */
  private spawnEnemyShip(spawn: EnemySpawn): void {
    const ship = this.createEnemy(spawn, "enemy", []);
    this.rules.equipEnemy(ship, []);
    this.addEnemy(ship);
  }

  /**
   * Builds (but does not add) a wave ship record with its quick build and
   * its BotPilot (tier from the node's effective wave, its rank and an Ace
   * affix — see SurvivalSteering / SurvivalBattleRules).
   *
   * @param spawn - The wave ship and where it enters.
   * @param idPrefix - Id prefix naming its tier.
   * @param affixes - Its elite affixes (empty for regulars and bosses).
   * @returns The equipped ship record.
   */
  private createEnemy(
    spawn: EnemySpawn,
    idPrefix: string,
    affixes: readonly EliteAffix[],
  ): SurvivalShip {
    const ship = this.createShip({
      id: `${idPrefix}_${this.wave}_${this.enemySerial++}`,
      definitionId: spawn.slot.definitionId,
      faction: spawn.faction,
      owner: "ai",
      pose: { ...spawn.at },
      loadoutId: spawn.slot.loadoutId,
    });
    ship.bot = this.squadAi.createPilot(
      this.rules.tierFor(spawn.spec, spawn.slot.tier, affixes),
    );
    this.rules.registerEnemy(ship.id, spawn.slot.tier);
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
    matchStats.record({ kind: "deploy", friendly: false, shipId: ship.id });
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
    this.weapons?.equip(id, {
      definitionId,
      loadoutId: spawn.loadoutId,
      modifiers: ship.modifiers,
    });
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
    this.shipSprites.set(
      ship.id,
      addSurvivalShipSprite(this, ship, { isElite, isBoss }),
    );
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
      side: overlaySide(false, ship.owner === "player"),
      definitionId: ship.definitionId,
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
      if (ship.hull <= 0 || ship.creature) continue;
      if (ship.capitalSystems && isEnginesOffline(ship.capitalSystems)) {
        continue;
      }
      const tick = tickCycleFlight(ship.flight, {
        deltaMs,
        worldSize: BATTLEFIELD_SIZE,
        dial: ship.dial,
        cycleMs: CYCLE_DURATION_MS,
        modifiers: stressModifiersOf(ship.modifiers, this.auras.get(ship.id)),
      });
      this.setFlight(ship, tick.state);
      this.repairFeedback?.selfRepair(ship, deltaMs);
      if (tick.completed) this.notifyCycleCommitted(ship, tick.state);
      if (tick.completed && ship.id === this.pilotedShipId)
        matchStats.record({
          kind: "cycle",
          dial: ship.dial,
          direction: tick.completed.direction,
          speed: tick.completed.speed,
        });
      this.syncShipSprite(ship, deltaMs);
      this.telemetry?.sample(ship.id, ship.x, ship.y, ship.angle);
    }
    this.auras = applyAllyAuraRepairs(
      this.ships.values(),
      this.repairFeedback,
      deltaMs,
    );
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
    if (ship.owner === "player") {
      const difficulty = maneuverDifficultyOf(
        ship.dial,
        started,
        flight.motion.control.speed,
      );
      this.applyTrigger(
        ship,
        this.rules.engine.onManeuver(
          ship.id,
          this.roleOf(ship),
          difficulty,
          this.time.now,
        ),
      );
    }
    if (ship.bot) ship.bot.onCycleCommitted(started);
    else if (ship.id === this.pilotedShipId) {
      this.pilot.onCycleCommitted(started);
    }
  }

  /**
   * @param ship - A player ship.
   * @returns Its relic role: the ship flown as flagship, or an escort.
   */
  private roleOf(ship: SurvivalShip): "flagship" | "escort" {
    return ship.id === this.playerShipIds[0] ? "flagship" : "escort";
  }

  /**
   * Applies a relic / mutation trigger: restores shields and calls out the
   * buffs it started.
   *
   * @param ship - The player ship that triggered it.
   * @param result - What the trigger did.
   */
  private applyTrigger(ship: SurvivalShip, result: TriggerResult): void {
    if (result.shieldRestoreFraction > 0) {
      ship.shields = Math.min(
        ship.maxShields,
        ship.shields + ship.maxShields * result.shieldRestoreFraction,
      );
      this.healthBars.get(ship.id)?.update(ship.hull, ship.shields);
    }
    for (const buff of result.started) {
      this.effectsManager.showFloatingText(
        ship.x,
        ship.y - 50,
        buff.toUpperCase(),
        "#7fe7ff",
      );
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
      if (ship.owner === "player") {
        this.applyTrigger(
          ship,
          this.rules.engine.onFlightEvent(
            ship.id,
            this.roleOf(ship),
            event,
            this.time.now,
          ),
        );
      }
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
      if (ship.hull <= 0 || ship.creature) continue;

      if (
        ship.owner === "player" &&
        regen > 0 &&
        this.rules.engine.passiveShieldRegen(this.roleOf(ship))
      ) {
        const before = { hull: ship.hull, shields: ship.shields };
        ship.shields = Math.min(
          ship.maxShields,
          ship.shields + (regen * delta) / 1000,
        );
        this.repairFeedback?.reportRepair(ship, before, {
          kind: "self_regen",
          sourceShipId: null,
        });
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
    const isPlayer = ship.owner === "player";
    const fireRate = isPlayer ? this.run.bonuses.fireRate : 0;
    const cooldownMod = Math.max(MIN_PLAYER_COOLDOWN_MOD, 1 - fireRate);
    const mutation = isPlayer
      ? this.rules.engine.attackIntervalMultiplier(this.roleOf(ship))
      : 1;
    return attackIntervalMs(
      ship.combatStats.weaponCooldown * cooldownMod * mutation,
    );
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
      ship.owner === "player"
        ? this.run.bonuses.range * RANGE_PER_POINT +
          this.rules.engine.rangeBonusPx(this.roleOf(ship))
        : 0;
    const now = this.time.now;
    return nearestTargetInArc(ship, this.ships.values(), {
      rangePx: ship.combatStats.weaponRange + rangeBonus,
      arcDeg: ship.combatStats.firingArc,
      worldSize: BATTLEFIELD_SIZE,
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
   * One attack: one bolt, or several with a Scatter Array mutation, each
   * rolled separately; player shots carry their relic / mutation adjustments.
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
    const marked = this.squadAi.isMarkedBy(
      attacker.owner,
      target.id,
      this.time.now,
    );
    const adjust = this.shotAdjustOf(attacker, marked);
    for (let bolt = 0; bolt < adjust.shots && target.hull > 0; bolt++) {
      this.fireBolt(attacker, target, sides, marked, adjust);
    }
  }

  /**
   * @param attacker - The firing ship.
   * @param marked - Whether its side marked the target.
   * @returns Relic / mutation adjustments of the shot (neutral for enemies).
   */
  private shotAdjustOf(attacker: SurvivalShip, marked: boolean): ShotAdjust {
    if (attacker.owner !== "player") return NEUTRAL_SHOT;
    return this.rules.engine.shot({
      shooterId: attacker.id,
      role: this.roleOf(attacker),
      targetMarked: marked,
      escortsAlive: Math.max(0, this.playerShipIds.length - 1),
      nowMs: this.time.now,
    });
  }

  /**
   * One bolt: the mode's dice odds and damage (run bonuses and relics
   * included) resolved through both ships' quick builds; a hit stresses the
   * target's pilot and a kill fires the pilot-ability kill effects.
   *
   * @param attacker - The firing ship.
   * @param target - The ship fired at.
   * @param sides - Living ships per side this frame (wingman checks).
   * @param marked - Whether its side marked the target.
   * @param adjust - The shot's relic / mutation adjustments.
   */
  private fireBolt(
    attacker: SurvivalShip,
    target: SurvivalShip,
    sides: LivingBySide,
    marked: boolean,
    adjust: ShotAdjust,
  ): void {
    const result = resolveDiceAttack({
      attacker: combatantOf(attacker),
      target: combatantOf(target),
      hitChance: Math.min(
        MAX_HIT_CHANCE,
        this.hitChanceOf(attacker, target) + adjust.hitChanceBonus,
      ),
      baseDamage: this.baseDamageOf(attacker, adjust),
      attackerHasWingman: hasWingman(attacker, sides.get(attacker.owner) ?? []),
      targetHasWingman: hasWingman(target, sides.get(target.owner) ?? []),
      nowMs: this.time.now,
      roll: this.rules.rng.next(),
      targetMarked: marked,
      ...shotAurasOf(this.auras, attacker.id, target.id),
      targetArmor: armorReductionOf(target.definitionId),
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
    this.weapons?.onAttack(attacker.id);
    if (!result.hit) return;
    const cloak = this.weapons?.incomingDamageFactor(target.id) ?? 1;
    this.landHit(attacker, target, {
      damage: Math.max(1, Math.round(result.damage * cloak)),
      stress: result.stressOnTarget,
    });
  }

  /**
   * A hit lands (laser or secondary weapon): stress, damage shields first
   * then hull, the attacker's immunity tick, and the kill.
   *
   * @param attacker - The ship credited with the hit.
   * @param target - The ship hit.
   * @param hit - Damage and stress to apply.
   */
  private landHit(
    attacker: SurvivalShip,
    target: SurvivalShip,
    hit: { readonly damage: number; readonly stress: number },
  ): void {
    if (hit.stress > 0) {
      this.setFlight(target, {
        ...target.flight,
        stress: applyInstantStress(target.flight.stress, hit.stress),
      });
    }
    this.dealDamage(target, hit.damage, attacker);
    if (hit.damage > 0) {
      this.hitLedger.recordHit(attacker.id, target.id, this.time.now);
    }
    if (target.hull > 0) return;
    this.resolveAbilityKill(attacker, target);
    if (attacker.owner === "player") this.restoreKillShields(attacker);
    if (target.id === this.pilotedShipId)
      trackDeath("survival", attacker.definitionId, {
        sector: this.rules.plan.sector,
      });
    this.destroyShip(target.id, attacker.owner === "player");
  }

  /** @returns What the secondary weapons read from (and ask of) this scene. */
  private weaponsLink(): BattleWeaponsLink {
    return {
      bodies: () => {
        const sides = this.livingBySide();
        return [...this.ships.values()].map((ship) =>
          weaponBodyOf(
            ship,
            ship.owner,
            damageMitigationOf(
              ship.modifiers,
              hasWingman(ship, sides.get(ship.owner) ?? []),
              this.auras.get(ship.id),
            ),
          ),
        );
      },
      wantedTargetOf: (shipId: string) => {
        const ship = this.ships.get(shipId);
        if (!ship) return null;
        return shipId === this.pilotedShipId
          ? this.hudTargetOf(ship)
          : this.wantedTargetOf(ship, this.time.now);
      },
      playerShipId: () => this.pilotedShipId,
      playerSide: () => "player",
      sideOf: (shipId: string) => this.ships.get(shipId)?.owner ?? null,
      applyHit: (hit: WeaponHit) => this.applyWeaponHit(hit),
      spriteOf: (shipId: string) => this.shipSprites.get(shipId),
    };
  }

  /**
   * A secondary weapon's hit, through the same path as a laser hit (relic
   * damage rules, boss systems, kills and salvage).
   *
   * @param hit - The hit from the weapons runtime.
   */
  private applyWeaponHit(hit: WeaponHit): void {
    const target = this.ships.get(hit.targetId);
    if (!target || target.hull <= 0) return;
    const attacker = this.ships.get(hit.attackerId) ?? target;
    this.landHit(attacker, target, { damage: hit.damage, stress: hit.stress });
  }

  /** The secondary-weapons glue (e2e). */
  get secondaryWeapons(): BattleWeapons | null {
    return this.weapons;
  }

  /**
   * Reactive Shields: a kill by the flagship restores part of its shields.
   *
   * @param killer - The player ship that made the kill.
   */
  private restoreKillShields(killer: SurvivalShip): void {
    const fraction = this.rules.engine.killShieldFraction(this.roleOf(killer));
    if (fraction <= 0 || killer.hull <= 0) return;
    killer.shields = Math.min(
      killer.maxShields,
      killer.shields + killer.maxShields * fraction,
    );
    this.healthBars.get(killer.id)?.update(killer.hull, killer.shields);
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
   * @param adjust - The shot's relic / mutation adjustments.
   * @returns The mode's damage before equipment: attack dice, plus the run's
   *   and relics' damage bonus, mutation multiplier and crit roll for the
   *   player fleet.
   */
  private baseDamageOf(attacker: SurvivalShip, adjust: ShotAdjust): number {
    if (attacker.owner !== "player") return attacker.combatStats.attackDice;
    const { damage, critChance } = this.run.bonuses;
    const base =
      (attacker.combatStats.attackDice + damage + adjust.damageBonus) *
      adjust.damageMultiplier;
    const crit = this.rules.rng.next() < critChance + adjust.critChanceBonus;
    return crit ? base * CRIT_DAMAGE_MULTIPLIER : base;
  }

  /**
   * Damage taken shields first, then hull — a boss's hull is its subsystems.
   * Player ships take less under protective relic buffs; a boss crossing a
   * phase threshold enters its next phase.
   *
   * @param target - The ship hit.
   * @param incoming - Damage to take.
   * @param attacker - Who hit it (a hit on a creature lands on the part facing them).
   */
  private dealDamage(
    target: SurvivalShip,
    incoming: number,
    attacker?: SurvivalShip,
  ): void {
    const mitigated =
      target.owner === "player"
        ? incoming *
          this.rules.engine.incomingMultiplier(
            target.id,
            this.roleOf(target),
            Math.max(0, this.playerShipIds.length - 1),
            this.time.now,
          )
        : incoming;
    const damage = target.creature
      ? target.creature.absorbHit({
          fromX: attacker?.x ?? target.x,
          fromY: attacker?.y ?? target.y,
          damage: mitigated,
          nowMs: this.time.now,
          shieldsUp: target.shields > 0 || attacker === undefined,
        }).damage
      : mitigated;
    const after = absorbDamage(target, damage);
    const hullDamage = damage - (target.shields - after.shields);
    matchStats.record({
      kind: "damage",
      toFriendly: target.owner === "player",
      shield: target.shields - after.shields,
      hull: Math.min(target.hull, hullDamage),
    });
    if (after.shields < target.shields) {
      audioManager.playSoundAt("shield_hit", target.x, target.y, 0.4);
    }
    target.shields = after.shields;
    if (hullDamage > 0) {
      audioManager.playSoundAt("hull_hit", target.x, target.y, 0.4);
      if (target.capitalSystems) {
        this.damageSystems(target, target.capitalSystems, hullDamage);
        this.checkBossPhase(target);
      } else {
        target.hull = after.hull;
        if (target.creature) this.checkBossPhase(target);
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
    matchStats.record({
      kind: "kill",
      victimFriendly: ship.owner === "player",
      victimIsPlayer: shipId === this.pilotedShipId,
    });

    if (wasPlayerKill) {
      this.score += 100;
      const salvage = this.rules.recordKill(shipId);
      this.effectsManager.showFloatingText(
        ship.x,
        ship.y - 30,
        `+${salvage} ⚙`,
        "#ffd34a",
      );
    }
    this.hitLedger.forget(shipId);
    this.squadAi.forget(shipId);
    this.weapons?.forget(shipId);
    this.creatures?.noteWreck(ship);
    this.creatures?.remove(shipId);
    this.affixLabels.get(shipId)?.destroy();
    this.affixLabels.delete(shipId);

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
    if (this.autopilot) this.flyAutopilot(flagshipId, time, delta);
    else this.flyFlagship(flagshipId, time, delta);
    this.applyMarkRequest(flagshipId);
    for (const id of [...this.enemyShipIds, ...escortIds]) {
      this.flyBot(id, time, delta);
    }
  }

  /**
   * Debug / e2e: a bot flies the flagship (used to measure node durations
   * without a human pilot) and marks its target (R) like a player would.
   *
   * @param shipId - The flagship's id, if any.
   * @param time - Scene time (ms).
   * @param delta - Frame length (ms).
   */
  private flyAutopilot(
    shipId: string | undefined,
    time: number,
    delta: number,
  ): void {
    const ship = this.ships.get(shipId ?? "");
    if (!ship || ship.hull <= 0) return;
    ship.bot ??= this.squadAi.createPilot(SURVIVAL_ESCORT_TIER);
    this.pilotedShipId = null;
    this.flyBot(ship.id, time, delta);
    const target = this.squadAi.playerMarkOf(time)
      ? null
      : this.hudTargetOf(ship);
    if (target) this.squadAi.markTarget(target, time);
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
    if (targetId) matchStats.record({ kind: "mark" });
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
    this.weapons?.showRefusals(result.refusals, ship);
    matchStats.record({ kind: "flight", events: result.events });
    matchStats.record({
      kind: "stress",
      ms: delta,
      stressed: result.stress.isStressed,
    });
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
    return nearestHostile(
      ship,
      this.ships.values(),
      BATTLEFIELD_SIZE,
      (other) => {
        return other.owner !== ship.owner;
      },
    );
  }

  private updateSprites(): void {
    for (const [id, ship] of this.ships) {
      const healthBar = this.healthBars.get(id);
      if (healthBar) {
        healthBar.setPosition(ship.x, ship.y - 40);
      }
      this.affixLabels
        .get(id)
        ?.setPosition(ship.x, ship.y - affixLabelOffset(false));
    }
  }
}
