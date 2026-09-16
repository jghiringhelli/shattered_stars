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
import { createHoverButton } from "../ui/ButtonFactory";
import { ShipStatCard } from "../ui/ShipStatCard";
import { PauseMenu } from "../ui/PauseMenu";
import { InputManager } from "../input/InputManager";
import { setupSceneInput, teardownSceneInput } from "../input/setupSceneInput";
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
import type { ManeuverDirection } from "../core/types";
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
  tickMatchTimer,
  formatMatchClock,
  type MatchTimerState,
} from "../systems/arena/MatchTimer";

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
  currentManeuverDir: ManeuverDirection;
  currentSpeed: number;
  targetX: number;
  targetY: number;
  targetAngle: number;
  weaponCooldown: number;
}

interface ShipSprite extends Phaser.GameObjects.Container {
  shipId: string;
}

// Boss definitions from spec
const BOSS_DEFINITIONS: Record<
  FactionId,
  {
    name: string;
    totalHull: number;
    shields: number;
    /** Flat damage reduction applied to every incoming hit before shields/hull. */
    armor: number;
    sections: Array<{
      name: string;
      hull: number;
      offsetX: number;
      offsetY: number;
      weapons: boolean;
      shields: boolean;
    }>;
    escortCount: number;
  }
> = {
  terran_hegemony: {
    name: "Hegemony Battlecruiser",
    totalHull: 180,
    shields: 40,
    armor: 3,
    sections: [
      {
        name: "Fore",
        hull: 90,
        offsetX: 0,
        offsetY: -40,
        weapons: true,
        shields: true,
      },
      {
        name: "Aft",
        hull: 90,
        offsetX: 0,
        offsetY: 40,
        weapons: true,
        shields: false,
      },
    ],
    escortCount: 6,
  },
  free_confederation: {
    name: "Freedom Corvette",
    totalHull: 150,
    shields: 30,
    armor: 3,
    sections: [
      {
        name: "Fore",
        hull: 50,
        offsetX: 0,
        offsetY: -30,
        weapons: true,
        shields: false,
      },
      {
        name: "Mid",
        hull: 50,
        offsetX: 0,
        offsetY: 0,
        weapons: false,
        shields: true,
      },
      {
        name: "Aft",
        hull: 50,
        offsetX: 0,
        offsetY: 30,
        weapons: true,
        shields: false,
      },
    ],
    escortCount: 4,
  },
  synthetic_collective: {
    name: "Collective Mothership",
    totalHull: 140,
    shields: 50,
    armor: 3,
    sections: [
      {
        name: "Core",
        hull: 80,
        offsetX: 0,
        offsetY: 0,
        weapons: true,
        shields: true,
      },
      {
        name: "Shell",
        hull: 60,
        offsetX: 0,
        offsetY: 0,
        weapons: true,
        shields: false,
      },
    ],
    escortCount: 10,
  },
  void_corsairs: {
    name: "Pirate Mothership",
    totalHull: 140,
    shields: 25,
    armor: 3,
    sections: [
      {
        name: "Weapons Bay",
        hull: 70,
        offsetX: -30,
        offsetY: 0,
        weapons: true,
        shields: false,
      },
      {
        name: "Engines",
        hull: 70,
        offsetX: 30,
        offsetY: 0,
        weapons: false,
        shields: true,
      },
    ],
    escortCount: 5,
  },
  ascendant_empire: {
    name: "Ascendant Dreadnought",
    totalHull: 200,
    shields: 60,
    armor: 3,
    sections: [
      {
        name: "Bio Core",
        hull: 80,
        offsetX: 0,
        offsetY: -30,
        weapons: false,
        shields: true,
      },
      {
        name: "Psionic Array",
        hull: 60,
        offsetX: 0,
        offsetY: 0,
        weapons: true,
        shields: false,
      },
      {
        name: "Heart",
        hull: 60,
        offsetX: 0,
        offsetY: 30,
        weapons: true,
        shields: true,
      },
    ],
    escortCount: 4,
  },
};

export class EpicBattleScene extends Phaser.Scene {
  private ships: Map<string, EpicShip> = new Map();
  private shipSprites: Map<string, ShipSprite> = new Map();
  private healthBars: Map<string, HealthBar> = new Map();

  private playerShipIds: string[] = [];
  private escortShipIds: string[] = [];

  // Boss state
  private boss: BossShip | null = null;
  private bossSprite: Phaser.GameObjects.Container | null = null;
  private bossSectionBars: Map<string, HealthBar> = new Map();
  private selectedBossFaction: FactionId = "terran_hegemony";
  private difficulty: "easy" | "medium" | "hard" | "mythic" = "medium";

  // Player settings
  private playerFaction: FactionId = "free_confederation";
  private playerSquadPoints = 300;

  // Game state
  private isPaused = false;
  private isSetupPhase = true;
  private gameResult: "none" | "victory" | "defeat" = "none";

  /** Raid time limit (ms); on timeout the boss survives and points decide it. */
  private static readonly RAID_DURATION_MS = 300_000;
  private raidTimer: MatchTimerState = createMatchTimer(
    EpicBattleScene.RAID_DURATION_MS,
  );
  private timerText: Phaser.GameObjects.Text | null = null;
  /** Point cost of enemy ships the player destroyed. */
  private playerSideScore: SideScore = createSideScore();
  /** Point cost of the player's ships the enemy destroyed. */
  private enemySideScore: SideScore = createSideScore();

  // Timing
  private lastManeuverTime = 0;
  private maneuverInterval = 300;
  private lastBossAbilityTime = 0;
  private bossAbilityInterval = 5000;

  // Effects
  private effectsManager!: EffectsManager;
  private background!: ParallaxBackground;
  private performanceState: PerformanceState = createPerformanceState();

  // UI
  private phaseText!: Phaser.GameObjects.Text;
  private bossHealthBar!: Phaser.GameObjects.Graphics;
  private setupObjects: Phaser.GameObjects.GameObject[] = [];
  private pauseMenu!: PauseMenu;
  private inputSubscriptionIds: number[] = [];

  constructor() {
    super({ key: "EpicBattleScene" });
  }

  shutdown(): void {
    this.inputSubscriptionIds.forEach((id) => InputManager.off(id));
    this.inputSubscriptionIds = [];
    teardownSceneInput();
  }

  create(): void {
    this.cameras.main.setBounds(0, 0, BATTLEFIELD_SIZE, BATTLEFIELD_SIZE);
    this.cameras.main.setBackgroundColor(0x050510);
    addPaintedSpaceBackground(this, "galaxy_spiral", 0);

    audioManager.initialize();

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

    this.resetState();
    this.showSetupScreen();

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
  }

  private showSetupScreen(): void {
    const centerX = this.scale.width / 2;

    this.setupObjects.forEach((o) => o.destroy());
    this.setupObjects = [];

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.9);
    bg.fillRect(0, 0, this.scale.width, this.scale.height);
    this.track(bg);

    // Title — positioned near the very top to avoid blank gap
    const title = this.add
      .text(centerX, 22, "CAPITAL ASSAULT", {
        font: "bold 48px Arial",
        color: "#ff6644",
      })
      .setOrigin(0.5);
    this.track(title);

    const subtitle = this.add
      .text(centerX, 70, "Destroy the enemy capital ship", {
        font: "20px Arial",
        color: "#aaaaaa",
      })
      .setOrigin(0.5);
    this.track(subtitle);

    // Boss selection
    const bossLabel = this.add
      .text(centerX, 110, "Select Target:", {
        font: "bold 24px Arial",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.track(bossLabel);

    const factions: FactionId[] = [
      "terran_hegemony",
      "free_confederation",
      "synthetic_collective",
      "void_corsairs",
      "ascendant_empire",
    ];
    const factionNames: Record<FactionId, string> = {
      terran_hegemony: "Hegemony Battlecruiser",
      free_confederation: "Freedom Corvette",
      synthetic_collective: "Collective Mothership",
      void_corsairs: "Pirate Mothership",
      ascendant_empire: "Ascendant Dreadnought",
    };

    let yPos = 150;
    factions.forEach((faction, i) => {
      const btn = this.createSelectionButton(
        centerX - 200,
        yPos,
        factionNames[faction],
        faction === this.selectedBossFaction,
        () => {
          this.selectedBossFaction = faction;
          this.showSetupScreen();
        },
      );
      this.track(btn);
      yPos += 45;
    });

    // Difficulty selection
    const diffLabel = this.add
      .text(centerX + 200, 110, "Difficulty:", {
        font: "bold 24px Arial",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.track(diffLabel);

    const difficulties: Array<{
      id: "easy" | "medium" | "hard" | "mythic";
      name: string;
      mult: string;
    }> = [
      { id: "easy", name: "Easy", mult: "0.75x" },
      { id: "medium", name: "Medium", mult: "1.0x" },
      { id: "hard", name: "Hard", mult: "1.5x" },
      { id: "mythic", name: "Mythic", mult: "2.0x" },
    ];

    yPos = 150;
    difficulties.forEach((diff) => {
      const btn = this.createSelectionButton(
        centerX + 200,
        yPos,
        `${diff.name} (${diff.mult})`,
        diff.id === this.difficulty,
        () => {
          this.difficulty = diff.id;
          this.showSetupScreen();
        },
      );
      this.track(btn);
      yPos += 45;
    });

    // Boss info
    const bossDef = BOSS_DEFINITIONS[this.selectedBossFaction];
    const infoY = 450;
    const info = this.add
      .text(
        centerX,
        infoY,
        [
          `Hull: ${bossDef.totalHull} | Shields: ${bossDef.shields}`,
          `Sections: ${bossDef.sections.map((s) => s.name).join(", ")}`,
          `Escorts: ${bossDef.escortCount} fighters`,
        ].join("\n"),
        {
          font: "16px Arial",
          color: "#88aacc",
          align: "center",
        },
      )
      .setOrigin(0.5);
    this.track(info);

    // Start button
    const startBtn = createHoverButton(
      this,
      centerX,
      this.scale.height - 100,
      {
        width: 200,
        height: 60,
        radius: 10,
        color: 0x227722,
        hoverColor: 0x33aa33,
        label: "BEGIN ASSAULT",
        font: "bold 24px Arial",
      },
      () => this.startBattle(),
    );
    this.track(startBtn);

    // Back button
    const backBtn = this.add
      .text(50, 50, "< BACK", {
        font: "bold 20px Arial",
        color: "#aaaaaa",
      })
      .setInteractive({ useHandCursor: true });

    backBtn.on("pointerover", () => backBtn.setColor("#ffffff"));
    backBtn.on("pointerout", () => backBtn.setColor("#aaaaaa"));
    backBtn.on("pointerdown", () => {
      this.scene.start("MainMenuScene");
    });

    this.track(backBtn);
  }

  /**
   * Tracks a setup-screen object for later cleanup, forcing its own
   * scrollFactor(0)/depth so it hit-tests correctly regardless of camera
   * zoom (see the reparenting/zoom note in showSetupScreen's caller).
   */
  private track(obj: Phaser.GameObjects.GameObject): void {
    const withTransform = obj as unknown as {
      setScrollFactor?: (x: number) => unknown;
      setDepth?: (d: number) => unknown;
    };
    withTransform.setScrollFactor?.(0);
    withTransform.setDepth?.(2000);
    this.setupObjects.push(obj);
  }

  private createSelectionButton(
    x: number,
    y: number,
    label: string,
    selected: boolean,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    if (selected) {
      bg.fillStyle(0x336688, 1);
      bg.lineStyle(2, 0x44aaff, 1);
    } else {
      bg.fillStyle(0x222233, 0.8);
    }
    bg.fillRoundedRect(-120, -18, 240, 36, 6);
    if (selected) {
      bg.strokeRoundedRect(-120, -18, 240, 36, 6);
    }
    container.add(bg);

    const text = this.add
      .text(0, 0, label, {
        font: selected ? "bold 16px Arial" : "16px Arial",
        color: selected ? "#44ffaa" : "#888888",
      })
      .setOrigin(0.5);
    container.add(text);

    const hitArea = this.add
      .rectangle(0, 0, 240, 36)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0);
    container.add(hitArea);

    hitArea.on("pointerdown", onClick);

    return container;
  }

  private startBattle(): void {
    this.setupObjects.forEach((o) => o.destroy());
    this.setupObjects = [];
    this.isSetupPhase = false;
    this.cameras.main.setZoom(0.7);

    audioManager.playMusic("combat_high");

    this.createHUD();
    this.setupInput();
    this.createPauseMenu();
    this.spawnBoss();
    this.spawnPlayerSquad();
    this.spawnEscorts();
  }

  update(time: number, delta: number): void {
    InputManager.update();
    if (this.isSetupPhase || this.isPaused || this.gameResult !== "none")
      return;
    this.performanceState = updateFPS(this.performanceState, delta);
    this.performanceState = evaluateQuality(this.performanceState, time);
    this.effectsManager.setQualitySettings(
      this.performanceState.effectSettings,
    );

    this.background.update();

    if (this.updateRaidTimer(delta)) return;

    if (time - this.lastManeuverTime >= this.maneuverInterval) {
      this.processManeuvers();
      this.lastManeuverTime = time;
    }

    this.interpolatePositions(delta);
    this.processCombat(delta);
    this.processBossAbilities(time);
    this.updateAI();
    this.updateSprites();
    this.checkVictoryConditions();
  }

  private createHUD(): void {
    const style = { font: "bold 20px monospace", color: "#ffffff" };

    this.phaseText = this.add
      .text(this.scale.width / 2, 30, "PHASE 1", {
        font: "bold 28px Arial",
        color: "#44ff44",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);

    this.timerText = this.add
      .text(
        this.scale.width - 20,
        30,
        formatMatchClock(EpicBattleScene.RAID_DURATION_MS),
        {
          font: "bold 22px Arial",
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: 3,
        },
      )
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(1000);

    // Boss health bar
    this.bossHealthBar = this.add.graphics();
    this.bossHealthBar.setScrollFactor(0);
    this.bossHealthBar.setDepth(1000);
    this.updateBossHealthBar();

    this.add
      .text(
        this.scale.width / 2,
        this.scale.height - 30,
        "UP/DOWN: Speed | LEFT/RIGHT: Turn | Weapon autofires | Scroll: Zoom | ESC: Pause",
        {
          font: "14px monospace",
          color: "#666666",
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);
  }

  private updateBossHealthBar(): void {
    if (!this.boss || !this.bossHealthBar) return;

    const barWidth = 400;
    const barHeight = 30;
    const x = (this.scale.width - barWidth) / 2;
    const y = 60;

    this.bossHealthBar.clear();

    // Background
    this.bossHealthBar.fillStyle(0x222222, 1);
    this.bossHealthBar.fillRect(x, y, barWidth, barHeight);

    // Shields
    if (this.boss.shields > 0) {
      const shieldRatio = this.boss.shields / this.boss.maxShields;
      this.bossHealthBar.fillStyle(0x4488ff, 1);
      this.bossHealthBar.fillRect(x, y, barWidth * shieldRatio, barHeight / 3);
    }

    // Hull
    const hullRatio = this.boss.totalHull / this.boss.maxTotalHull;
    let hullColor = 0x44ff44;
    if (hullRatio < 0.3) hullColor = 0xff4444;
    else if (hullRatio < 0.6) hullColor = 0xffaa44;

    this.bossHealthBar.fillStyle(hullColor, 1);
    this.bossHealthBar.fillRect(
      x,
      y + barHeight / 3,
      barWidth * hullRatio,
      (barHeight * 2) / 3,
    );

    // Border
    this.bossHealthBar.lineStyle(2, 0xffffff, 0.8);
    this.bossHealthBar.strokeRect(x, y, barWidth, barHeight);

    // Section indicators
    let sectionX = x;
    this.boss.sections.forEach((section, i) => {
      const sectionWidth =
        (section.maxHull / this.boss!.maxTotalHull) * barWidth;

      if (section.isDisabled) {
        this.bossHealthBar.fillStyle(0x444444, 0.8);
        this.bossHealthBar.fillRect(sectionX, y, sectionWidth, barHeight);
      }

      if (i < this.boss!.sections.length - 1) {
        this.bossHealthBar.lineStyle(1, 0x888888, 1);
        this.bossHealthBar.lineBetween(
          sectionX + sectionWidth,
          y,
          sectionX + sectionWidth,
          y + barHeight,
        );
      }

      sectionX += sectionWidth;
    });
  }

  private setupInput(): void {
    setupSceneInput(this);
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
        this.cameras.main.setZoom(Phaser.Math.Clamp(zoom, 0.4, 1.5));
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
        this.scene.launch("SettingsScene", { returnScene: "EpicBattleScene" });
      },
      onQuit: () => {
        this.scene.start("MainMenuScene");
      },
    });
  }

  /**
   * ESC previously just flipped `isPaused` with no visual feedback or way
   * back to the menu — the freeze looked like a bug. Zoom is reset to 1.0
   * first for the same scrollFactor(0)-vs-zoom hit-testing reason as the
   * setup/end screens.
   */
  private togglePause(): void {
    if (this.isSetupPhase || this.gameResult !== "none") return;
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.cameras.main.setZoom(1.0);
      this.pauseMenu.show();
    }
  }

  private spawnBoss(): void {
    const bossDef = BOSS_DEFINITIONS[this.selectedBossFaction];
    const diffMultiplier = { easy: 0.75, medium: 1, hard: 1.5, mythic: 2 }[
      this.difficulty
    ];

    const sections: BossSection[] = bossDef.sections.map((s, i) => ({
      id: `section_${i}`,
      name: s.name,
      hull: Math.floor(s.hull * diffMultiplier),
      maxHull: Math.floor(s.hull * diffMultiplier),
      isDisabled: false,
      offsetX: s.offsetX,
      offsetY: s.offsetY,
      weapons: s.weapons,
      shields: s.shields,
    }));

    this.boss = {
      id: "boss",
      faction: this.selectedBossFaction,
      x: BATTLEFIELD_SIZE / 2,
      y: 200,
      angle: 180,
      sections,
      totalHull: sections.reduce((sum, s) => sum + s.hull, 0),
      maxTotalHull: sections.reduce((sum, s) => sum + s.maxHull, 0),
      shields: Math.floor(bossDef.shields * diffMultiplier),
      maxShields: Math.floor(bossDef.shields * diffMultiplier),
      armor: bossDef.armor,
      phase: 1,
      abilities: this.getBossAbilities(),
      abilityCooldowns: new Map(),
    };

    this.createBossSprite();
  }

  private getBossAbilities(): BossAbility[] {
    return [
      {
        id: "broadside",
        name: "Broadside",
        cooldown: 8000,
        effect: (boss) => {
          // Hit all player ships in range
          for (const shipId of this.playerShipIds) {
            const ship = this.ships.get(shipId);
            if (!ship || ship.hull <= 0) continue;

            const dist = Phaser.Math.Distance.Between(
              boss.x,
              boss.y,
              ship.x,
              ship.y,
            );
            if (dist < 400) {
              const damage = bossBroadsideDamage(boss.phase);
              this.damageShip(ship, damage);
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
        },
      },
      {
        id: "launch_fighters",
        name: "Launch Fighters",
        cooldown: 15000,
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
            for (let i = 0; i < escortCount; i++) {
              const angle = (i / escortCount) * Math.PI - Math.PI / 2;
              const x = boss.x + Math.cos(angle) * 100;
              const y = boss.y + 100 + Math.sin(angle) * 50;
              this.spawnEscort(escortDef.id, boss.faction, x, y);
            }
          }
        },
      },
      {
        id: "shield_regen",
        name: "Shield Regeneration",
        cooldown: 12000,
        effect: (boss) => {
          if (boss.phase < 3) {
            boss.shields = Math.min(boss.maxShields, boss.shields + 10);
            this.updateBossHealthBar();
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
    const centerX = BATTLEFIELD_SIZE / 2;
    const startY = BATTLEFIELD_SIZE - 200;

    // Spawn a squad within point budget
    let pointsUsed = 0;
    const maxShips = 5;
    let shipCount = 0;

    for (const shipDef of ships) {
      if (shipCount >= maxShips) break;
      if (pointsUsed + 50 > this.playerSquadPoints) break;

      const x = centerX + (shipCount - 2) * 80;
      const y = startY + (shipCount % 2) * 60;

      this.spawnPlayerShip(shipDef.id, x, y);
      pointsUsed += 50;
      shipCount++;
    }
  }

  private spawnPlayerShip(defId: string, x: number, y: number): void {
    const id = `player_${this.playerShipIds.length}`;
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

    for (let i = 0; i < bossDef.escortCount; i++) {
      const angle = (i / bossDef.escortCount) * Math.PI * 2;
      const radius = 150 + Math.random() * 50;
      const x = this.boss.x + Math.cos(angle) * radius;
      const y = this.boss.y + 100 + (Math.sin(angle) * radius) / 2;

      this.spawnEscort(escortDef.id, this.boss.faction, x, y);
    }
  }

  private spawnEscort(
    defId: string,
    faction: FactionId,
    x: number,
    y: number,
  ): void {
    const id = `escort_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const ship = this.createShip(id, defId, faction, "ai", x, y, 180);
    this.ships.set(id, ship);
    this.escortShipIds.push(id);
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
  ): EpicShip {
    const combatStats = getModeCombatStats(defId, "continuous");

    return {
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
      currentManeuverDir: "straight",
      currentSpeed: 2,
      targetX: x,
      targetY: y,
      targetAngle: angle,
      weaponCooldown: 0,
    };
  }

  private createShipSprite(ship: EpicShip): void {
    const container = this.add.container(
      ship.x,
      ship.y,
    ) as unknown as ShipSprite;
    container.shipId = ship.id;

    const color = FACTION_COLORS[ship.faction] ?? 0xffffff;
    const shipDef = getShipDefinition(ship.definitionId);
    const size = SHIP_SIZES[shipDef?.baseStats.size ?? "small"];

    const body = this.add.graphics();
    body.fillStyle(color, 1);
    body.beginPath();
    body.moveTo(0, -size / 2);
    body.lineTo(-size / 3, size / 2);
    body.lineTo(0, size / 3);
    body.lineTo(size / 3, size / 2);
    body.closePath();
    body.fillPath();
    body.lineStyle(2, 0xffffff, 0.8);
    body.strokePath();
    container.add(body);

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
    });
    this.healthBars.set(ship.id, healthBar);
  }

  private processManeuvers(): void {
    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;

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
    }
  }

  private processCombat(delta: number): void {
    // Player ships attack boss and escorts
    for (const shipId of this.playerShipIds) {
      const ship = this.ships.get(shipId);
      if (!ship || ship.hull <= 0) continue;

      ship.weaponCooldown = Math.max(0, ship.weaponCooldown - delta);

      if (ship.weaponCooldown <= 0) {
        // Prefer attacking boss if in range
        if (this.boss && this.boss.totalHull > 0) {
          const distToBoss = Phaser.Math.Distance.Between(
            ship.x,
            ship.y,
            this.boss.x,
            this.boss.y,
          );
          if (distToBoss < ship.combatStats.weaponRange) {
            this.attackBoss(ship);
            ship.weaponCooldown = ship.combatStats.weaponCooldown;
            continue;
          }
        }

        // Otherwise attack escorts
        const target = this.findEscortTarget(ship);
        if (target) {
          this.attackShip(ship, target);
          ship.weaponCooldown = ship.combatStats.weaponCooldown;
        }
      }
    }

    // Escorts attack player ships
    for (const shipId of this.escortShipIds) {
      const ship = this.ships.get(shipId);
      if (!ship || ship.hull <= 0) continue;

      ship.weaponCooldown = Math.max(0, ship.weaponCooldown - delta);

      if (ship.weaponCooldown <= 0) {
        const target = this.findPlayerTarget(ship);
        if (target) {
          this.attackShip(ship, target);
          ship.weaponCooldown = ship.combatStats.weaponCooldown;
        }
      }
    }
  }

  private findEscortTarget(ship: EpicShip): EpicShip | null {
    let best: EpicShip | null = null;
    let bestDist = Infinity;

    for (const escortId of this.escortShipIds) {
      const escort = this.ships.get(escortId);
      if (!escort || escort.hull <= 0) continue;

      const dist = Phaser.Math.Distance.Between(
        ship.x,
        ship.y,
        escort.x,
        escort.y,
      );
      if (dist < ship.combatStats.weaponRange && dist < bestDist) {
        best = escort;
        bestDist = dist;
      }
    }

    return best;
  }

  private findPlayerTarget(ship: EpicShip): EpicShip | null {
    let best: EpicShip | null = null;
    let bestDist = Infinity;

    for (const playerId of this.playerShipIds) {
      const player = this.ships.get(playerId);
      if (!player || player.hull <= 0) continue;

      const dist = Phaser.Math.Distance.Between(
        ship.x,
        ship.y,
        player.x,
        player.y,
      );
      if (dist < ship.combatStats.weaponRange && dist < bestDist) {
        best = player;
        bestDist = dist;
      }
    }

    return best;
  }

  private attackBoss(attacker: EpicShip): void {
    if (!this.boss) return;

    const hitChance = calculateHitChance(attacker.combatStats.attackDice, 2);
    const hit = Math.random() < hitChance;

    if (hit) {
      let damage = Math.max(
        1,
        attacker.combatStats.attackDice - this.boss.armor,
      );

      // Damage shields first
      if (this.boss.shields > 0) {
        const shieldDmg = Math.min(this.boss.shields, damage);
        this.boss.shields -= shieldDmg;
        damage -= shieldDmg;
        audioManager.playSound("shield_hit", 0.4);
      }

      // Then damage a random active section
      if (damage > 0) {
        audioManager.playSound("hull_hit", 0.4);
        const activeSections = this.boss.sections.filter(
          (s) => !s.isDisabled && s.hull > 0,
        );
        if (activeSections.length > 0) {
          const targetSection =
            activeSections[Math.floor(Math.random() * activeSections.length)]!;
          targetSection.hull = Math.max(0, targetSection.hull - damage);

          if (targetSection.hull <= 0) {
            targetSection.isDisabled = true;
            this.showMessage(`${targetSection.name} DISABLED!`);
          }
        }

        this.boss.totalHull = sumSectionHull(this.boss.sections);
        this.checkBossPhaseTransition();
      }

      this.effectsManager.fireLaser(
        attacker.x,
        attacker.y,
        this.boss.x,
        this.boss.y,
        attacker.faction,
        true,
      );
      this.updateBossHealthBar();
    } else {
      this.effectsManager.fireLaser(
        attacker.x,
        attacker.y,
        this.boss.x,
        this.boss.y,
        attacker.faction,
        false,
      );
    }
  }

  private checkBossPhaseTransition(): void {
    if (!this.boss) return;

    const hullRatio = this.boss.totalHull / this.boss.maxTotalHull;
    const targetPhase = bossPhaseForHullRatio(hullRatio);

    if (targetPhase === 3 && this.boss.phase < 3) {
      this.boss.phase = 3;
      this.phaseText.setText("PHASE 3 - CRITICAL");
      this.phaseText.setColor("#ff4444");
      this.showMessage("BOSS ENTERING CRITICAL PHASE!");
    } else if (targetPhase === 2 && this.boss.phase < 2) {
      this.boss.phase = 2;
      this.phaseText.setText("PHASE 2 - SHIELDS FAILING");
      this.phaseText.setColor("#ffaa44");
      this.showMessage("Boss shields failing! Reinforcements incoming!");
      // Spawn reinforcements
      this.boss.abilities
        .find((a) => a.id === "launch_fighters")
        ?.effect(this.boss);
    }
  }

  private attackShip(attacker: EpicShip, target: EpicShip): void {
    const hitChance = calculateHitChance(
      attacker.combatStats.attackDice,
      target.combatStats.agilityDice,
    );
    const hit = Math.random() < hitChance;

    if (hit) {
      this.damageShip(target, attacker.combatStats.attackDice);
      this.effectsManager.fireLaser(
        attacker.x,
        attacker.y,
        target.x,
        target.y,
        attacker.faction,
        true,
      );
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

  private damageShip(ship: EpicShip, damage: number): void {
    if (ship.shields > 0) {
      const shieldDmg = Math.min(ship.shields, damage);
      ship.shields -= shieldDmg;
      damage -= shieldDmg;
      audioManager.playSound("shield_hit", 0.4);
    }

    if (damage > 0) {
      audioManager.playSound("hull_hit", 0.4);
      ship.hull = Math.max(0, ship.hull - damage);
    }

    const healthBar = this.healthBars.get(ship.id);
    healthBar?.update(ship.hull, ship.shields);

    if (ship.hull <= 0) {
      this.destroyShip(ship.id);
    }
  }

  private destroyShip(shipId: string): void {
    const ship = this.ships.get(shipId);
    if (!ship) return;

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

  private updateAI(): void {
    // Escort AI - attack player ships
    for (const escortId of this.escortShipIds) {
      const ship = this.ships.get(escortId);
      if (!ship || ship.hull <= 0) continue;

      const target = this.findClosestPlayer(ship);
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
        ship.currentManeuverDir = "straight";
        ship.currentSpeed = 2;
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

    // Escort ships in the player squad (everything but the flagship) fly
    // on AI toward the boss/escorts, same as before.
    const flagshipId = this.playerShipIds[0] ?? "";
    for (const playerId of this.playerShipIds) {
      if (playerId === flagshipId) continue;
      const ship = this.ships.get(playerId);
      if (!ship || ship.hull <= 0) continue;

      // Target boss if it exists, otherwise closest escort
      let targetX = this.boss?.x ?? BATTLEFIELD_SIZE / 2;
      let targetY = this.boss?.y ?? 200;

      if (!this.boss || this.boss.totalHull <= 0) {
        const escort = this.findClosestEscort(ship);
        if (escort) {
          targetX = escort.x;
          targetY = escort.y;
        }
      }

      const angleDiff = headingDiffToTarget(
        ship.x,
        ship.y,
        ship.angle,
        targetX,
        targetY,
      );

      const dial = getShipDial(ship.definitionId);

      if (Math.abs(angleDiff) < 25) {
        ship.currentManeuverDir = "straight";
        ship.currentSpeed = 2;
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

    const flagship = this.ships.get(flagshipId);
    if (flagship && flagship.hull > 0) {
      this.applyPlayerControl(flagship);
    }
  }

  /**
   * Picks the flagship's next maneuver from its dial based on held intents
   * (keyboard/gamepad/touch, normalized through InputManager). UP/DOWN ramp
   * speed through the dial's available speeds; LEFT/RIGHT bank at the
   * current speed (falling back to any available speed for that
   * direction); no input holds a straight maneuver.
   */
  private applyPlayerControl(ship: EpicShip): void {
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

  private findClosestPlayer(ship: EpicShip): EpicShip | null {
    let closest: EpicShip | null = null;
    let closestDist = Infinity;

    for (const playerId of this.playerShipIds) {
      const player = this.ships.get(playerId);
      if (!player || player.hull <= 0) continue;

      const dist = Phaser.Math.Distance.Between(
        ship.x,
        ship.y,
        player.x,
        player.y,
      );
      if (dist < closestDist) {
        closest = player;
        closestDist = dist;
      }
    }

    return closest;
  }

  private findClosestEscort(ship: EpicShip): EpicShip | null {
    let closest: EpicShip | null = null;
    let closestDist = Infinity;

    for (const escortId of this.escortShipIds) {
      const escort = this.ships.get(escortId);
      if (!escort || escort.hull <= 0) continue;

      const dist = Phaser.Math.Distance.Between(
        ship.x,
        ship.y,
        escort.x,
        escort.y,
      );
      if (dist < closestDist) {
        closest = escort;
        closestDist = dist;
      }
    }

    return closest;
  }

  private updateSprites(): void {
    for (const [id, ship] of this.ships) {
      const healthBar = this.healthBars.get(id);
      if (healthBar) {
        healthBar.setPosition(ship.x, ship.y - 40);
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
    if (this.timerText) {
      const remaining = this.raidTimer.remainingMs;
      this.timerText.setText(formatMatchClock(remaining));
      this.timerText.setColor(
        remaining <= 30_000
          ? "#ff4444"
          : remaining <= 60_000
            ? "#ffcc00"
            : "#ffffff",
      );
    }
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
    const playersAlive = this.playerShipIds.filter((id) => {
      const ship = this.ships.get(id);
      return ship && ship.hull > 0;
    }).length;

    if (playersAlive === 0) {
      this.gameResult = "defeat";
      this.showDefeatScreen();
    }
  }

  private showMessage(message: string): void {
    const text = this.add
      .text(this.scale.width / 2, this.scale.height / 2, message, {
        font: "bold 32px Arial",
        color: "#ffdd00",
        stroke: "#000000",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001);

    this.tweens.add({
      targets: text,
      alpha: 0,
      y: this.scale.height / 2 - 50,
      duration: 1500,
      onComplete: () => text.destroy(),
    });
  }

  private showVictoryScreen(): void {
    this.isPaused = true;

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    // Destroy boss sprite with big explosion
    if (this.bossSprite) {
      this.effectsManager.createExplosion(this.boss!.x, this.boss!.y, "large");
      this.bossSprite.destroy();
    }

    this.time.delayedCall(1000, () => {
      const bg = this.add.graphics();
      bg.fillStyle(0x000000, 0.8);
      bg.fillRect(0, 0, this.scale.width, this.scale.height);
      bg.setScrollFactor(0);
      bg.setDepth(2000);

      this.add
        .text(centerX, centerY - 80, "VICTORY!", {
          font: "bold 56px Arial",
          color: "#44ff44",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(2001);

      this.add
        .text(
          centerX,
          centerY - 20,
          `${BOSS_DEFINITIONS[this.selectedBossFaction].name} Destroyed`,
          {
            font: "24px Arial",
            color: "#ffffff",
          },
        )
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(2001);

      const playersRemaining = this.playerShipIds.filter((id) => {
        const ship = this.ships.get(id);
        return ship && ship.hull > 0;
      }).length;

      this.add
        .text(centerX, centerY + 20, `Ships Remaining: ${playersRemaining}`, {
          font: "20px Arial",
          color: "#aaaaaa",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(2001);

      this.createEndButtons(centerX, centerY + 100);
    });
  }

  private showDefeatScreen(): void {
    this.isPaused = true;

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRect(0, 0, this.scale.width, this.scale.height);
    bg.setScrollFactor(0);
    bg.setDepth(2000);

    this.add
      .text(centerX, centerY - 80, "DEFEAT", {
        font: "bold 56px Arial",
        color: "#ff4444",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001);

    const bossRemaining = this.boss
      ? Math.floor((this.boss.totalHull / this.boss.maxTotalHull) * 100)
      : 0;
    this.add
      .text(centerX, centerY - 20, `Boss Hull Remaining: ${bossRemaining}%`, {
        font: "24px Arial",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001);

    this.createEndButtons(centerX, centerY + 80);
  }

  private createEndButtons(x: number, y: number): void {
    // Same scrollFactor(0)-vs-zoom hit-test issue as the setup screen — the
    // mouse wheel can leave zoom far from 1.0 by the time the match ends.
    this.cameras.main.setZoom(1.0);

    const retryBtn = this.add
      .text(x - 100, y, "RETRY", {
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
      .text(x + 100, y, "MENU", {
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
}
