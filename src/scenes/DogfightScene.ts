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
import { maneuverLerpAlpha } from "../rendering/ManeuverInterpolation";
import { createHoverButton, createToggleButton } from "../ui/ButtonFactory";
import { quickTipLine } from "../ui/ControlsReference";
import type { FactionId } from "../config";
import { BATTLEFIELD_SIZE, SHIP_SIZES } from "../config";
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
import { syncListenerToCamera } from "../audio/CameraListener";
import { addPaintedSpaceBackground } from "../ui/TexturedPanel";
import {
  createPerformanceState,
  updateFPS,
  evaluateQuality,
  type PerformanceState,
} from "../systems/PerformanceSystem";
import type { ManeuverDirection } from "../core/types";
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

type MatchFormat = "best_of_3" | "best_of_5";

export class DogfightScene extends Phaser.Scene {
  private ships: Map<string, DogfightShip> = new Map();
  private shipSprites: Map<string, ShipSprite> = new Map();
  private healthBars: Map<string, HealthBar> = new Map();

  private playerShipIds: string[] = [];
  private enemyShipIds: string[] = [];

  // Match state
  private matchFormat: MatchFormat = "best_of_3";
  private playerWins = 0;
  private enemyWins = 0;
  private currentRound = 0;
  private roundTimeRemaining = 180; // 3 minutes in seconds
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

  // Game state
  private isPaused = false;
  private isSetupPhase = true;
  private matchComplete = false;

  // Timing
  private lastManeuverTime = 0;
  private maneuverInterval = 300;
  private lastSecondTime = 0;

  // Camera follow (manual — toroid wrap makes Phaser's startFollow jump at the seam)
  private cameraVirtualX = BATTLEFIELD_SIZE / 2;
  private cameraVirtualY = BATTLEFIELD_SIZE / 2;

  // Effects
  private effectsManager!: EffectsManager;
  private background!: ParallaxBackground;
  private performanceState: PerformanceState = createPerformanceState();
  private telemetry: ShipTelemetry | null = null;

  // UI
  private roundText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private controlsHintText!: Phaser.GameObjects.Text;
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
    // No setBounds — camera is driven manually for seamless toroid wrapping (see updateCameraFollow).
    this.cameras.main.setBackgroundColor(0x050510);
    addPaintedSpaceBackground(this, "nebula_purple", 0);

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
    this.showRoundResult("OPPONENT DISCONNECTED", "#ff8844");
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
        const dir = msg.data?.dir as ManeuverDirection | undefined;
        const speed = msg.data?.speed as number | undefined;
        if (dir) opponent.currentManeuverDir = dir;
        if (typeof speed === "number") opponent.currentSpeed = speed;
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

  private resetMatchState(): void {
    this.playerWins = 0;
    this.enemyWins = 0;
    this.currentRound = 0;
    this.isRoundActive = false;
    this.matchComplete = false;
  }

  private resetRoundState(): void {
    this.ships.clear();
    this.shipSprites.forEach((s) => s.destroy());
    this.shipSprites.clear();
    this.healthBars.forEach((h) => h.destroy());
    this.healthBars.clear();
    this.playerShipIds = [];
    this.enemyShipIds = [];
    this.roundTimeRemaining = 180;
    this.roundResult = "none";
    this.playerSideScore = createSideScore();
    this.enemySideScore = createSideScore();
    this.isPaused = false;
  }

  private showSetupScreen(): void {
    // Destroy any previous setup-screen objects. Buttons are NOT reparented
    // into a shared container (see setupObjects doc comment) — track and
    // destroy them individually instead.
    this.setupObjects.forEach((o) => o.destroy());
    this.setupObjects = [];

    const centerX = this.scale.width / 2;

    // Textured background image — drawn above the space parallax layer
    // (which renders at a higher depth than TexturedPanel's default -1)
    // but below every setup-screen control.
    if (this.textures.exists("tex_menu_bg")) {
      const bgImage = this.add
        .image(centerX, this.scale.height / 2, "tex_menu_bg")
        .setDisplaySize(this.scale.width, this.scale.height)
        .setScrollFactor(0)
        .setDepth(1999);
      this.setupObjects.push(bgImage);
    }

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.55);
    bg.fillRect(0, 0, this.scale.width, this.scale.height);
    this.track(bg);

    // Title
    const title = this.add
      .text(centerX, 50, "DOGFIGHT", {
        font: "bold 48px Arial",
        color: "#ff8844",
      })
      .setOrigin(0.5);
    this.track(title);

    const subtitle = this.add
      .text(centerX, 95, "1v1 Quick Duels", {
        font: "20px Arial",
        color: "#aaaaaa",
      })
      .setOrigin(0.5);
    this.track(subtitle);

    // Format selection
    const formatLabel = this.add
      .text(centerX, 140, "Match Format:", {
        font: "bold 20px Arial",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.track(formatLabel);

    const formats: Array<{ id: MatchFormat; name: string }> = [
      { id: "best_of_3", name: "Best of 3" },
      { id: "best_of_5", name: "Best of 5" },
    ];

    formats.forEach((format, i) => {
      const btn = this.createSelectionButton(
        centerX - 100 + i * 200,
        180,
        format.name,
        format.id === this.matchFormat,
        () => {
          this.matchFormat = format.id;
          this.showSetupScreen();
        },
      );
      this.track(btn);
    });

    // Ship selection - Player
    const playerLabel = this.add
      .text(centerX - 200, 240, "Your Ship:", {
        font: "bold 20px Arial",
        color: "#44ff44",
      })
      .setOrigin(0.5);
    this.track(playerLabel);

    const playerShips = getShipsByFaction(this.playerFaction);
    let yPos = 280;
    playerShips.slice(0, 4).forEach((ship) => {
      const btn = this.createSelectionButton(
        centerX - 200,
        yPos,
        ship.name,
        ship.id === this.playerShipId,
        () => {
          this.playerShipId = ship.id;
          this.showSetupScreen();
        },
      );
      this.track(btn);
      yPos += 40;
    });

    // Ship selection - Enemy
    const enemyLabel = this.add
      .text(centerX + 200, 240, "Enemy Ship:", {
        font: "bold 20px Arial",
        color: "#ff4444",
      })
      .setOrigin(0.5);
    this.track(enemyLabel);

    const enemyShips = getShipsByFaction(this.enemyFaction);
    yPos = 280;
    enemyShips.slice(0, 4).forEach((ship) => {
      const btn = this.createSelectionButton(
        centerX + 200,
        yPos,
        ship.name,
        ship.id === this.enemyShipId,
        () => {
          this.enemyShipId = ship.id;
          this.showSetupScreen();
        },
      );
      this.track(btn);
      yPos += 40;
    });

    // Faction selection
    const factions: FactionId[] = [
      "terran_hegemony",
      "free_confederation",
      "synthetic_collective",
      "void_corsairs",
      "ascendant_empire",
    ];
    const factionNames: Record<FactionId, string> = {
      terran_hegemony: "Hegemony",
      free_confederation: "Confederation",
      synthetic_collective: "Collective",
      void_corsairs: "Corsairs",
      ascendant_empire: "Empire",
    };

    // Player faction
    const playerFactionLabel = this.add
      .text(centerX - 200, 460, "Your Faction:", {
        font: "16px Arial",
        color: "#888888",
      })
      .setOrigin(0.5);
    this.track(playerFactionLabel);

    factions.forEach((faction, i) => {
      const btn = this.createSmallButton(
        centerX - 320 + i * 60,
        490,
        factionNames[faction].substring(0, 3),
        faction === this.playerFaction,
        () => {
          this.playerFaction = faction;
          const ships = getShipsByFaction(faction);
          this.playerShipId = ships[0]?.id ?? "";
          this.showSetupScreen();
        },
      );
      this.track(btn);
    });

    // Enemy faction
    const enemyFactionLabel = this.add
      .text(centerX + 200, 460, "Enemy Faction:", {
        font: "16px Arial",
        color: "#888888",
      })
      .setOrigin(0.5);
    this.track(enemyFactionLabel);

    factions.forEach((faction, i) => {
      const btn = this.createSmallButton(
        centerX + 80 + i * 60,
        490,
        factionNames[faction].substring(0, 3),
        faction === this.enemyFaction,
        () => {
          this.enemyFaction = faction;
          const ships = getShipsByFaction(faction);
          this.enemyShipId = ships[0]?.id ?? "";
          this.showSetupScreen();
        },
      );
      this.track(btn);
    });

    // Difficulty
    const diffLabel = this.add
      .text(centerX, 540, "AI Difficulty:", {
        font: "16px Arial",
        color: "#888888",
      })
      .setOrigin(0.5);
    this.track(diffLabel);

    const difficulties: Array<"easy" | "normal" | "hard" | "brutal"> = [
      "easy",
      "normal",
      "hard",
      "brutal",
    ];
    difficulties.forEach((diff, i) => {
      const btn = this.createSmallButton(
        centerX - 120 + i * 80,
        570,
        diff.toUpperCase(),
        diff === this.difficulty,
        () => {
          this.difficulty = diff;
          this.showSetupScreen();
        },
      );
      this.track(btn);
    });

    // Start button
    const startBtn = createHoverButton(
      this,
      centerX,
      this.scale.height - 80,
      {
        width: 160,
        height: 50,
        radius: 10,
        color: 0x884422,
        hoverColor: 0xaa6633,
        label: "FIGHT!",
        font: "bold 28px Arial",
      },
      () => this.startMatch(),
    );
    this.track(startBtn);

    const tip = this.add
      .text(
        centerX,
        this.scale.height - 30,
        quickTipLine([
          { label: "Steer", intents: ["STEER_LEFT", "STEER_RIGHT"] },
          { label: "Throttle", intents: ["THRUST_UP", "THRUST_DOWN"] },
          { label: "Weapon", intents: [] },
          { label: "Pause", intents: ["PAUSE"] },
        ]),
        { font: "13px Arial", color: "#6688aa" },
      )
      .setOrigin(0.5);
    this.track(tip);

    // Back button
    const backBtn = this.add
      .text(50, 40, "< BACK", {
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
   * Registers a setup-screen object for fixed-position rendering and later
   * cleanup. Objects are kept as direct scene children (never reparented
   * into a shared container) — reparenting an already-interactive Container
   * into another Container was found to silently break real pointer-click
   * hit-testing (verified live: emitting "pointerdown" directly on the
   * button still worked, but an actual mouse click at the same screen
   * coordinates did not) even though the identical pattern works fine for
   * top-level containers (compare MainMenuScene's menu buttons).
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
      bg.fillStyle(0x446688, 1);
      bg.lineStyle(2, 0x66aaff, 1);
    } else {
      bg.fillStyle(0x222233, 0.8);
    }
    bg.fillRoundedRect(-80, -15, 160, 30, 5);
    if (selected) {
      bg.strokeRoundedRect(-80, -15, 160, 30, 5);
    }
    container.add(bg);

    const text = this.add
      .text(0, 0, label, {
        font: selected ? "bold 14px Arial" : "14px Arial",
        color: selected ? "#44ffaa" : "#888888",
      })
      .setOrigin(0.5);
    container.add(text);

    const hitArea = this.add
      .rectangle(0, 0, 160, 30)
      .setInteractive({ useHandCursor: true });
    container.add(hitArea);

    hitArea.on("pointerdown", onClick);

    return container;
  }

  private createSmallButton(
    x: number,
    y: number,
    label: string,
    selected: boolean,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    return createToggleButton(
      this,
      x,
      y,
      label,
      selected,
      {
        width: 50,
        height: 24,
        selectedColor: 0x446688,
        normalColor: 0x222233,
        selectedFont: "bold 11px Arial",
        font: "11px Arial",
      },
      onClick,
    );
  }

  private startMatch(): void {
    this.setupObjects.forEach((o) => o.destroy());
    this.setupObjects = [];
    this.isSetupPhase = false;

    audioManager.playFactionMusic(this.playerFaction, "combat");

    this.createHUD();
    this.setupInput();
    this.startNextRound();
  }

  private startNextRound(): void {
    this.resetRoundState();
    this.currentRound++;

    this.roundText.setText(`ROUND ${this.currentRound}`);
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

  private showRoundStart(): void {
    const text = this.add
      .text(
        this.scale.width / 2,
        this.scale.height / 2,
        `ROUND ${this.currentRound}`,
        {
          font: "bold 48px Arial",
          color: "#ffaa00",
          stroke: "#000000",
          strokeThickness: 4,
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1001);

    this.tweens.add({
      targets: text,
      scale: 1.5,
      alpha: 0,
      duration: 1500,
      onComplete: () => {
        text.destroy();
        this.isRoundActive = true;
      },
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

    if (time - this.lastManeuverTime >= this.maneuverInterval) {
      this.processManeuvers();
      this.lastManeuverTime = time;
    }

    this.interpolatePositions(delta);
    this.processCombat(delta);
    this.updateAI();
    this.updateSprites();
    this.updateCameraFollow();
    this.checkRoundEnd();
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

  private createHUD(): void {
    this.roundText = this.add
      .text(this.scale.width / 2, 25, "ROUND 1", {
        font: "bold 24px Arial",
        color: "#ffaa00",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);

    this.timerText = this.add
      .text(this.scale.width / 2, 55, "3:00", {
        font: "bold 32px monospace",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);

    this.scoreText = this.add
      .text(this.scale.width / 2, 90, "0 - 0", {
        font: "bold 28px Arial",
        color: "#888888",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);

    this.controlsHintText = this.add
      .text(
        this.scale.width / 2,
        this.scale.height - 25,
        "UP/DOWN: Speed | LEFT/RIGHT: Turn | Weapon autofires | ESC: Pause",
        {
          font: "14px monospace",
          color: "#666666",
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1000);
  }

  private updateTimerDisplay(): void {
    const minutes = Math.floor(this.roundTimeRemaining / 60);
    const seconds = this.roundTimeRemaining % 60;
    this.timerText.setText(`${minutes}:${seconds.toString().padStart(2, "0")}`);

    // Change color when low on time
    if (this.roundTimeRemaining <= 30) {
      this.timerText.setColor("#ff4444");
    } else if (this.roundTimeRemaining <= 60) {
      this.timerText.setColor("#ffaa44");
    }
  }

  private updateScoreDisplay(): void {
    const winsNeeded = this.matchFormat === "best_of_3" ? 2 : 3;
    this.scoreText.setText(`${this.playerWins} - ${this.enemyWins}`);

    // Show how many wins needed
    const remaining = winsNeeded - Math.max(this.playerWins, this.enemyWins);
    if (remaining === 1) {
      this.scoreText.setColor("#ffdd00");
    }
  }

  private setupInput(): void {
    setupSceneInput(this);
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
      currentManeuverDir: "straight",
      currentSpeed: 2,
      targetX: x,
      targetY: y,
      targetAngle: angle,
      weaponCooldown: 0,
    };

    this.ships.set(id, ship);

    if (owner === "player") {
      this.playerShipIds.push(id);
    } else {
      this.enemyShipIds.push(id);
    }

    this.createShipSprite(ship);
    this.createHealthBar(ship);
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
    const t = maneuverLerpAlpha(delta, 280, 3);

    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;

      ship.x = Phaser.Math.Linear(ship.x, ship.targetX, t);
      ship.y = Phaser.Math.Linear(ship.y, ship.targetY, t);

      let angleDiff = ship.targetAngle - ship.angle;
      if (angleDiff > 180) angleDiff -= 360;
      if (angleDiff < -180) angleDiff += 360;
      ship.angle += angleDiff * t;
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
      this.telemetry?.sample(ship.id, ship.x, ship.y, ship.angle);
    }
  }

  private processCombat(delta: number): void {
    if (this.isOnlineMode) {
      // Only the local ship's cooldown/firing is simulated here — the
      // opponent's ship is authoritative on their own client, and its
      // attack outcomes arrive via the `combat_result` network message
      // instead of being independently re-rolled (see onRemoteAction()).
      const ship = this.ships.get(this.playerShipIds[0] ?? "");
      if (!ship || ship.hull <= 0) return;

      ship.weaponCooldown = Math.max(0, ship.weaponCooldown - delta);
      if (ship.weaponCooldown <= 0) {
        const target = this.findTarget(ship);
        if (target) {
          this.fireAt(ship, target);
          ship.weaponCooldown = ship.combatStats.weaponCooldown;
        }
      }
      return;
    }

    for (const ship of this.ships.values()) {
      if (ship.hull <= 0) continue;

      ship.weaponCooldown = Math.max(0, ship.weaponCooldown - delta);

      if (ship.weaponCooldown <= 0) {
        // Primary weapon always autofires once in range/arc — player and AI alike.
        const target = this.findTarget(ship);
        if (target) {
          this.fireAt(ship, target);
          ship.weaponCooldown = ship.combatStats.weaponCooldown;
        }
      }
    }
  }

  private findTarget(ship: DogfightShip): DogfightShip | null {
    const maxRange = ship.combatStats.weaponRange;
    const maxArcRad = (ship.combatStats.firingArc / 2) * Phaser.Math.DEG_TO_RAD;

    for (const other of this.ships.values()) {
      if (other.faction === ship.faction || other.hull <= 0) continue;

      const dist = Phaser.Math.Distance.Between(
        ship.x,
        ship.y,
        other.x,
        other.y,
      );
      const angleToTarget = Phaser.Math.Angle.Between(
        ship.x,
        ship.y,
        other.x,
        other.y,
      );
      const shipFacing = (ship.angle - 90) * Phaser.Math.DEG_TO_RAD;
      let angleDiff = Math.abs(angleToTarget - shipFacing);
      if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

      if (dist < maxRange && angleDiff < maxArcRad) {
        return other;
      }
    }

    return null;
  }

  private fireAt(attacker: DogfightShip, target: DogfightShip): void {
    // Apply difficulty modifier to AI
    let hitChance = calculateHitChance(
      attacker.combatStats.attackDice,
      target.combatStats.agilityDice,
    );

    if (attacker.owner === "ai") {
      const diffMod = { easy: 0.7, normal: 1, hard: 1.1, brutal: 1.2 }[
        this.difficulty
      ];
      hitChance *= diffMod;
    }

    const hit = random.chance(hitChance);

    if (hit) {
      let damage = attacker.combatStats.attackDice;

      if (target.shields > 0) {
        const shieldDmg = Math.min(target.shields, damage);
        target.shields -= shieldDmg;
        damage -= shieldDmg;
        audioManager.playSoundAt("shield_hit", target.x, target.y, 0.4);
      }
      if (damage > 0) {
        audioManager.playSoundAt("hull_hit", target.x, target.y, 0.4);
        const wasAlive = target.hull > 0;
        target.hull = Math.max(0, target.hull - damage);
        if (wasAlive && target.hull <= 0) {
          if (target.owner === "player") {
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
        }
      }

      this.effectsManager.fireLaser(
        attacker.x,
        attacker.y,
        target.x,
        target.y,
        attacker.faction,
        true,
      );

      const healthBar = this.healthBars.get(target.id);
      healthBar?.update(target.hull, target.shields);
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

    // In online mode only the local ship ever reaches fireAt() as attacker
    // (see processCombat()) — relay the authoritative result so the
    // opponent's client updates its own copy of this ship instead of
    // independently rolling dice for the same shot.
    if (this.isOnlineMode && attacker.id === (this.playerShipIds[0] ?? "")) {
      networkService.sendGameAction({
        type: "combat_result",
        data: { hit, hullAfter: target.hull, shieldsAfter: target.shields },
      });
    }
  }

  private updateAI(): void {
    // In online mode the opponent's ship is a human on the other client,
    // driven entirely by onRemoteAction() — running local AI on it too
    // would fight the network-received maneuver every frame.
    if (this.isOnlineMode) {
      for (const shipId of this.playerShipIds) {
        const ship = this.ships.get(shipId);
        if (!ship || ship.hull <= 0) continue;
        this.applyPlayerControl(ship);
      }
      return;
    }

    for (const shipId of this.enemyShipIds) {
      const ship = this.ships.get(shipId);
      if (!ship || ship.hull <= 0) continue;

      const target = this.ships.get(this.playerShipIds[0] ?? "");
      if (!target || target.hull <= 0) continue;

      const angleDiff = headingDiffToTarget(
        ship.x,
        ship.y,
        ship.angle,
        target.x,
        target.y,
      );

      const dial = getShipDial(ship.definitionId);

      // AI decision quality based on difficulty
      const optimalChance = { easy: 0.5, normal: 0.7, hard: 0.9, brutal: 1 }[
        this.difficulty
      ];

      if (random.chance(optimalChance)) {
        // Optimal decision
        if (Math.abs(angleDiff) < 15) {
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
      } else {
        // Random suboptimal decision
        const maneuvers = dial.filter((m) =>
          ["straight", "bank_left", "bank_right"].includes(m.direction),
        );
        const chosen = random.pick(maneuvers);
        if (chosen) {
          ship.currentManeuverDir = chosen.direction;
          ship.currentSpeed = chosen.speed;
        }
      }
    }

    // Player ships respond to real keyboard input (see applyPlayerControl).
    for (const shipId of this.playerShipIds) {
      const ship = this.ships.get(shipId);
      if (!ship || ship.hull <= 0) continue;
      this.applyPlayerControl(ship);
    }
  }

  /**
   * Picks the player ship's next maneuver from its dial based on held
   * intents (keyboard arrows, gamepad stick, or the touch movement stick —
   * all normalized through InputManager). UP/DOWN ramp speed through the
   * dial's available speeds; LEFT/RIGHT bank at the current speed (falling
   * back to any available speed for that direction); no input holds a
   * straight maneuver.
   */
  private applyPlayerControl(ship: DogfightShip): void {
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
      this.sendManeuverIfChanged(chosen.direction, chosen.speed);
    }
  }

  /** Sends a maneuver update only when it changed, to avoid flooding the socket every frame. */
  private sendManeuverIfChanged(dir: ManeuverDirection, speed: number): void {
    if (!this.isOnlineMode) return;
    if (
      this.lastSentManeuver &&
      this.lastSentManeuver.dir === dir &&
      this.lastSentManeuver.speed === speed
    ) {
      return;
    }
    this.lastSentManeuver = { dir, speed };
    networkService.sendGameAction({ type: "maneuver", data: { dir, speed } });
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

    if (result === "player_win") {
      this.playerWins++;
      this.showRoundResult("VICTORY!", "#44ff44");
    } else if (result === "enemy_win") {
      this.enemyWins++;
      this.showRoundResult("DEFEAT", "#ff4444");
    } else {
      this.showRoundResult("DRAW", "#ffaa44");
    }

    this.updateScoreDisplay();

    // Check match end
    const winsNeeded = this.matchFormat === "best_of_3" ? 2 : 3;

    if (this.playerWins >= winsNeeded || this.enemyWins >= winsNeeded) {
      this.time.delayedCall(2000, () => this.endMatch());
    } else {
      this.time.delayedCall(2000, () => this.startNextRound());
    }
  }

  private showRoundResult(message: string, color: string): void {
    const text = this.add
      .text(this.scale.width / 2, this.scale.height / 2, message, {
        font: "bold 48px Arial",
        color,
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
      delay: 1500,
      duration: 500,
      onComplete: () => text.destroy(),
    });
  }

  private endMatch(): void {
    this.matchComplete = true;
    // Same scrollFactor(0)-vs-zoom hit-test issue as the setup screen — the
    // player may have zoomed with the mouse wheel during the match, which
    // would make REMATCH/MENU unclickable below if left as-is.
    this.cameras.main.setZoom(1.0);
    // Hide the in-battle HUD — previously bled through the semi-transparent overlay.
    this.roundText.setVisible(false);
    this.timerText.setVisible(false);
    this.scoreText.setVisible(false);
    this.controlsHintText.setVisible(false);

    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.85);
    bg.fillRect(0, 0, this.scale.width, this.scale.height);
    bg.setScrollFactor(0);
    bg.setDepth(2000);

    const playerWon = this.playerWins > this.enemyWins;
    const title = playerWon ? "MATCH WON!" : "MATCH LOST";
    const color = playerWon ? "#44ff44" : "#ff4444";
    audioManager.playFactionStinger(
      this.playerFaction,
      playerWon ? "victory" : "defeat",
    );

    this.add
      .text(centerX, centerY - 80, title, {
        font: "bold 56px Arial",
        color,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001);

    this.add
      .text(
        centerX,
        centerY - 20,
        `Final Score: ${this.playerWins} - ${this.enemyWins}`,
        {
          font: "28px Arial",
          color: "#ffffff",
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001);

    // Sweep bonus indicator
    if (
      (playerWon && this.enemyWins === 0) ||
      (!playerWon && this.playerWins === 0)
    ) {
      this.add
        .text(centerX, centerY + 20, "SWEEP!", {
          font: "bold 24px Arial",
          color: "#ffdd00",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(2001);
    }

    // Buttons
    const retryBtn = this.add
      .text(centerX - 100, centerY + 80, "REMATCH", {
        font: "bold 24px Arial",
        color: "#44ff44",
        backgroundColor: "#224422",
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2001)
      .setInteractive({ useHandCursor: true });

    retryBtn.on("pointerdown", () => {
      this.scene.restart();
    });

    const menuBtn = this.add
      .text(centerX + 100, centerY + 80, "MENU", {
        font: "bold 24px Arial",
        color: "#ffffff",
        backgroundColor: "#444444",
        padding: { x: 20, y: 8 },
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
