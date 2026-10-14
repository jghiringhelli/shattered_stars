/**
 * SquadBuilderScene — squad configuration screen.
 *
 * Players configure squads and assign them to teams (T1–T4).
 * The battle format (1v1, 2v2, FFA, etc.) is derived automatically
 * from the squad–team assignments — no explicit preset selection needed.
 */

import Phaser from "phaser";
import { audioManager } from "../audio/AudioManager";
import type { FactionId } from "../config";
import { SHIP_DEFINITIONS } from "../data/ShipDefinitions";
import {
  type GameMode,
  type SquadEntry,
  makeSquad,
  autoFillSquad,
  fillSquadWingmen,
  flownSquadCost,
  pickOpponentFaction,
} from "../core/squadTypes";
import type { AIDifficultyLevel } from "../ai/AIDifficulty";
import { defaultDifficulty } from "../systems/SettingsStorage";
import { FormatPanel } from "../ui/squad/FormatPanel";
import type { FormatPanelState } from "../ui/squad/FormatPanel";
import { SquadListPanel } from "../ui/squad/SquadListPanel";
import { readMapChoice } from "../ui/squad/MapThemeButton";
import { SimpleSquadFlow } from "../ui/squad/SimpleSquadFlow";
import { flashText } from "../ui/textFlash";
import { shake } from "../ui/UIJuice";
import {
  addBackButton,
  addFooterHint,
  addMenuBackdrop,
  addMenuHeader,
} from "../ui/menu/MenuScaffold";
import { MenuFocus, type FocusTarget } from "../ui/menu/MenuFocus";
import {
  bindMenuBack,
  fadeInMenu,
  goToScene,
} from "../ui/menu/menuTransitions";
import type { HoloPressButton } from "../ui/menu/HoloPressButton";
import {
  createActionBar,
  createModeToggle,
} from "../ui/squad/squadBuilderChrome";
import { FLASH_COLORS } from "../ui/squad/squadBuilderStyle";
import { ScenarioPicker } from "./scenario/ScenarioPicker";
import { SquadReinforcementSetup } from "../ui/squad/SquadReinforcementSetup";

type ShipsPickedEvent = {
  slotIndex: number;
  ships: string[];
  loadoutChoices?: Record<string, string>;
  pointsUsed?: number;
};

export class SquadBuilderScene extends Phaser.Scene {
  /** Exposed for E2E tests */
  public gameMode: GameMode = "arcade";
  /** Exposed for E2E tests */
  public pointLimit = 200;

  /** Exposed for E2E tests — flat squad list */
  public squads: SquadEntry[] = [];

  private aiDifficulty: AIDifficultyLevel = "normal";
  /** squadIdx for the slot currently open in ShipPickerScene */
  private editTarget: { squadIdx: number } | null = null;
  private formatPanel!: FormatPanel;
  /** Exposed for E2E tests */
  public squadListPanel!: SquadListPanel;
  private instructionText!: Phaser.GameObjects.Text;
  /** Exposed for E2E tests — easy single-ship flow is the default for Skirmish. */
  public simpleMode = true;
  private simpleFlow: SimpleSquadFlow | null = null;
  private bottomBarObjects: HoloPressButton[] = [];
  private backButton!: HoloPressButton;
  private modeToggleButton: HoloPressButton | null = null;
  private menuFocus: MenuFocus | null = null;
  /** Skirmish only: the X-Wing 2.0 scenario selector (header, left of the mode toggle). */
  private scenarioPicker: ScenarioPicker | null = null;
  /** Exposed for E2E tests — Classic / Reinforcements, strategy and reserve (Skirmish, Epic, Scenario). */
  public reinforcementSetup: SquadReinforcementSetup | null = null;

  constructor() {
    super({ key: "SquadBuilderScene" });
  }

  /** Exposed for E2E tests */
  public get numFactions(): number {
    return this.squads.length;
  }

  /** Exposed for E2E tests */
  public get factionSlots(): SquadEntry[] {
    return this.squads;
  }

  init(data: Record<string, unknown>): void {
    const allowed: GameMode[] = [
      "arcade",
      "continuous",
      "survival",
      "online",
      "epic",
    ];
    if (allowed.includes(data?.initialMode as GameMode)) {
      this.gameMode = data.initialMode as GameMode;
    }
    this.pointLimit = this.gameMode === "epic" ? 400 : 200;
    // Settings › Gameplay › Default difficulty preselects the opposition.
    this.aiDifficulty = defaultDifficulty();
    // Simple mode only fits a single-ship, single-squad flow — other formats
    // (multi-squad epic, online, continuous) need the advanced builder.
    this.simpleMode = this.gameMode === "arcade";
  }

  create(): void {
    addMenuBackdrop(this, { textureId: "nebula_crimson" });
    audioManager.playSubmenuMusic();
    // Controls from a previous visit were destroyed with the old display list.
    this.menuFocus = null;
    this.modeToggleButton = null;
    this.bottomBarObjects = [];
    this.buildDefaultSquads();
    this.createTitle();
    this.backButton = addBackButton(this, () => this.goBack());
    this.scenarioPicker =
      this.gameMode === "arcade" ? new ScenarioPicker(this) : null;
    this.reinforcementSetup = new SquadReinforcementSetup(this, {
      mode: () => this.gameMode,
      hasScenario: () => Boolean(this.scenarioPicker?.selected),
      playerFaction: () =>
        this.simpleFlow?.faction ??
        this.squads.find((s) => s.controller === "player")?.factionId ??
        "terran_hegemony",
    });
    this.renderBuilderMode();
    this.setupInput();
    this.listenForShipsPicked();
    fadeInMenu(this);
  }

  /** Shows the simple single-ship flow or the advanced multi-squad builder, per simpleMode. */
  private renderBuilderMode(): void {
    // Drop the focus ring while the old controls still exist.
    this.menuFocus?.clear();
    this.menuFocus?.destroy();
    this.menuFocus = null;
    this.simpleFlow?.destroy();
    this.simpleFlow = null;
    this.formatPanel?.destroy();
    this.squadListPanel?.destroy();
    this.bottomBarObjects.forEach((o) => o.destroy());
    this.bottomBarObjects = [];
    this.createModeToggle();

    if (this.simpleMode) {
      this.instructionText.setText(
        "Pick a faction, a ship, and a payload \u2014 the battle starts as soon as you launch",
      );
      this.buildSimpleFlow();
    } else {
      this.instructionText.setText(
        "Use team chips (T1\u2013T4) to set sides \u00b7 Tap card header to edit ships \u00b7 Auto-Fill to build squads automatically",
      );
      this.buildPanels();
      this.createBottomBar();
    }
    this.wireMenuFocus();
  }

  /** Keyboard focus over BACK, the mode toggle, the catalog chips and the action bar. */
  private wireMenuFocus(): void {
    const targets: FocusTarget[] = [];
    const sync = (): void => {
      targets.splice(
        0,
        targets.length,
        this.backButton,
        ...(this.reinforcementSetup?.focusTargets() ?? []),
        ...(this.scenarioPicker ? [this.scenarioPicker.button] : []),
        ...(this.modeToggleButton ? [this.modeToggleButton] : []),
        ...(this.simpleFlow?.focusTargets ?? []),
        ...this.bottomBarObjects,
      );
    };
    sync();
    this.simpleFlow?.on("focusTargetsChanged", sync);
    this.menuFocus = new MenuFocus(this, targets, {
      columns: targets.length,
      isActive: () =>
        !this.scene.isActive("ShipPickerScene") &&
        !this.reinforcementSetup?.isEditing,
    });
  }

  /** Faction → ship → payload → launch, for players who just want to play. */
  private buildSimpleFlow(): void {
    const playerSquad = this.squads[0];
    const startFaction = playerSquad?.factionId ?? "terran_hegemony";
    this.simpleFlow = new SimpleSquadFlow(this, startFaction, {
      gameMode: this.gameMode,
      pointLimit: this.pointLimit,
    });
    this.simpleFlow.on(
      "start",
      (e: {
        factionId: FactionId;
        shipId: string;
        loadoutId: string | null;
      }) => {
        const def = SHIP_DEFINITIONS[e.shipId];
        const player: SquadEntry = {
          teamId: 1,
          factionId: e.factionId,
          controller: "player",
          ships: [e.shipId],
          loadoutChoices: e.loadoutId ? { "0": e.loadoutId } : {},
          pointsUsed: def?.baseStats.pointCost ?? 0,
        };
        // The player flies the ship they picked; the rest of the budget buys
        // AI wingmen. Without this the launch is one fighter against the
        // opponent's full auto-filled squad.
        fillSquadWingmen(player, this.gameMode, this.pointLimit);
        this.squads[0] = player;
        const opponent = makeSquad(2, 0, "ai");
        opponent.factionId = pickOpponentFaction(e.factionId);
        autoFillSquad(opponent, this.gameMode, this.pointLimit);
        this.squads[1] = opponent;
        this.startBattle();
      },
    );
    this.simpleFlow.render();
  }

  /** Small always-visible button to switch between the simple flow and the full builder. */
  private createModeToggle(): void {
    this.modeToggleButton?.destroy();
    this.modeToggleButton = createModeToggle(this, this.simpleMode, () => {
      this.simpleMode = !this.simpleMode;
      // Defer so the pressed button is not destroyed inside its own handler.
      this.time.delayedCall(0, () => this.renderBuilderMode());
    });
  }

  private buildDefaultSquads(): void {
    this.squads = [makeSquad(1, 0, "player"), makeSquad(2, 1, "ai")];
  }

  private buildPanels(): void {
    const formatState: FormatPanelState = {
      gameMode: this.gameMode,
      pointLimit: this.pointLimit,
      aiDifficulty: this.aiDifficulty,
    };
    this.formatPanel = new FormatPanel(this, formatState);
    this.formatPanel.on("modeChanged", (mode: GameMode) => {
      this.gameMode = mode;
      this.onFormatChange();
    });
    this.formatPanel.on("pointsChanged", (pts: number) => {
      this.pointLimit = pts;
      this.squadListPanel.update({ pointLimit: pts });
      this.squadListPanel.autoFillAll();
      this.squadListPanel.render();
    });
    this.formatPanel.on("difficultyChanged", (d: AIDifficultyLevel) => {
      this.aiDifficulty = d;
    });
    this.formatPanel.render();

    this.squadListPanel = new SquadListPanel(this, {
      squads: this.squads,
      gameMode: this.gameMode,
      pointLimit: this.pointLimit,
      sceneWidth: this.scale.width,
    });
    this.squadListPanel.on("squadChanged", () => this.squadListPanel.render());
    this.squadListPanel.on("editShips", (e: { squadIdx: number }) => {
      this.editTarget = e;
      this.openShipPicker(e.squadIdx);
    });
    this.squadListPanel.on(
      "teamChanged",
      (e: { squadIdx: number; teamId: number }) => {
        if (this.squads[e.squadIdx]) this.squads[e.squadIdx]!.teamId = e.teamId;
        this.squadListPanel.render();
      },
    );
    this.squadListPanel.on("addSquad", (teamId: number = 1) => {
      const squad = this.squadListPanel.buildNewSquad(
        teamId ?? 1,
        this.squads.length,
      );
      this.squads.push(squad);
      this.squadListPanel.render();
    });
    this.squadListPanel.on("addTeam", () => {
      const maxTeamId = Math.max(...this.squads.map((s) => s.teamId));
      const squad = this.squadListPanel.buildNewSquad(
        Math.min(maxTeamId + 1, 4),
        this.squads.length,
      );
      this.squads.push(squad);
      this.squadListPanel.render();
    });
    this.squadListPanel.on("removeSquad", (e: { squadIdx: number }) => {
      if (this.squads.length <= 2) {
        flashText(this, this.instructionText, {
          message: "Minimum 2 squads required",
          color: FLASH_COLORS.warning,
        });
        shake(this, this.instructionText);
        return;
      }
      this.squads.splice(e.squadIdx, 1);
      this.squadListPanel.render();
    });
    this.squadListPanel.on("removeTeam", (teamId: number) => {
      const uniqueTeams = new Set(this.squads.map((s) => s.teamId));
      if (uniqueTeams.size <= 2) {
        flashText(this, this.instructionText, {
          message: "Minimum 2 teams required",
          color: FLASH_COLORS.warning,
        });
        shake(this, this.instructionText);
        return;
      }
      this.squads = this.squads.filter((s) => s.teamId !== teamId);
      this.squadListPanel.render();
    });
    this.squadListPanel.autoFillAll();
    this.squadListPanel.render();
  }

  private onFormatChange(): void {
    this.formatPanel.setState({ gameMode: this.gameMode });
    if (this.gameMode !== "epic") {
      const hadCapitals = this.squads.some((s) =>
        s.ships.some((id) => {
          const def = SHIP_DEFINITIONS[id];
          return def?.baseStats.size === "huge" || def?.role === "capital";
        }),
      );
      this.stripHugeShips();
      if (hadCapitals) {
        flashText(this, this.instructionText, {
          message: "Capital ships removed — not allowed outside Epic mode",
          color: FLASH_COLORS.warning,
          durationMs: 2500,
        });
      }
    }
    this.squadListPanel.update({ gameMode: this.gameMode });
    this.reinforcementSetup?.refresh();
  }

  /** Remove capital and huge ships from all squads when leaving epic mode. */
  private stripHugeShips(): void {
    for (const squad of this.squads) {
      squad.ships = squad.ships.filter(
        (id) =>
          SHIP_DEFINITIONS[id]?.baseStats.size !== "huge" &&
          SHIP_DEFINITIONS[id]?.role !== "capital",
      );
      squad.pointsUsed = flownSquadCost(squad.ships, squad.loadoutChoices);
    }
  }

  private createTitle(): void {
    addMenuHeader(this, { title: "SQUAD BUILDER" });
    this.instructionText = addFooterHint(
      this,
      "Use team chips (T1–T4) to set sides · Tap card header to edit ships · Auto-Fill to build squads automatically",
    );
  }

  private createBottomBar(): void {
    this.bottomBarObjects = createActionBar(this, {
      onAutoFill: () => {
        this.squadListPanel.autoFillAll();
        this.squadListPanel.render();
      },
      onRandomize: () => this.randomizeAll(),
      onStart: () => this.startBattle(),
    });
  }

  private setupInput(): void {
    // One back affordance (ESC / gamepad B / right-click), inert while the
    // ship picker overlay owns the screen.
    bindMenuBack(this, () => this.goBack(), {
      isActive: () =>
        !this.scene.isActive("ShipPickerScene") &&
        !this.reinforcementSetup?.isEditing,
    });
  }

  private goBack(): void {
    goToScene(this, "MainMenuScene");
  }

  private randomizeAll(): void {
    const factions: FactionId[] = [
      "terran_hegemony",
      "free_confederation",
      "synthetic_collective",
      "void_corsairs",
      "ascendant_empire",
    ];
    this.squads.forEach((squad) => {
      squad.factionId = factions[
        Math.floor(Math.random() * factions.length)
      ] as FactionId;
    });
    this.squadListPanel.autoFillAll();
    this.squadListPanel.render();
  }

  private openShipPicker(squadIdx: number): void {
    const squad = this.squads[squadIdx];
    if (!squad?.factionId) {
      flashText(this, this.instructionText, {
        message: "Select a faction first (click the faction button)",
        color: FLASH_COLORS.warning,
      });
      shake(this, this.instructionText);
      return;
    }
    this.scene.launch("ShipPickerScene", {
      slotIndex: squadIdx,
      factionId: squad.factionId,
      selectedShips: [...squad.ships],
      loadoutChoices: { ...squad.loadoutChoices },
      pointLimit: this.pointLimit,
      allowCapitals: this.gameMode === "epic",
    });
  }

  private listenForShipsPicked(): void {
    this.game.events.on("shipsPicked", (data: ShipsPickedEvent) => {
      if (!this.editTarget) return;
      const squad = this.squads[this.editTarget.squadIdx];
      if (!squad) return;
      squad.ships = data.ships;
      squad.loadoutChoices = data.loadoutChoices ?? {};
      squad.pointsUsed =
        data.pointsUsed ?? flownSquadCost(data.ships, squad.loadoutChoices);
      this.editTarget = null;
      this.squadListPanel.render();
    });
  }

  /** Exposed for E2E tests */
  public startBattle(): void {
    if (this.gameMode !== "epic") this.stripHugeShips();
    const uniqueTeams = new Set(this.squads.map((s) => s.teamId));
    if (uniqueTeams.size < 2) {
      flashText(this, this.instructionText, {
        message: "Assign squads to at least 2 different teams before starting!",
        color: FLASH_COLORS.danger,
        durationMs: 3000,
      });
      shake(this, this.instructionText);
      return;
    }
    if (this.squads.some((s) => !s.factionId || s.ships.length === 0)) {
      flashText(this, this.instructionText, {
        message: "All squads must have ships before starting!",
        color: FLASH_COLORS.danger,
        durationMs: 3000,
      });
      shake(this, this.instructionText);
      return;
    }
    const factions = this.squads.map((squad) => ({
      factionId: squad.factionId,
      controller: squad.controller,
      ships: squad.ships,
      loadoutChoices: squad.loadoutChoices,
      teamId: `team_${squad.teamId}`,
    }));
    this.registry.set("battleConfig", {
      factions,
      gameMode: this.gameMode,
      pointLimit: this.pointLimit,
      aiDifficulty: this.aiDifficulty,
      mapTheme: readMapChoice(this.registry),
      ...(this.gameMode === "arcade" && this.scenarioPicker?.selected
        ? { scenario: this.scenarioPicker.selected }
        : {}),
      ...this.reinforcementSetup?.battleConfigFields(factions),
    });
    this.navigateToBattle();
  }

  private navigateToBattle(): void {
    if (this.gameMode === "epic") {
      this.scene.start("ArcadeBattleScene");
    } else if (this.gameMode === "arcade") {
      this.scene.start("ArcadeBattleScene");
    } else if (this.gameMode === "survival") {
      const player = this.squads.find((s) => s.controller === "player");
      this.scene.start("SurvivalScene", {
        factionId: player?.factionId ?? "free_confederation",
      });
    } else if (this.gameMode === "online") {
      const player = this.squads.find((s) => s.controller === "player");
      this.registry.set("onlineSquad", player?.ships ?? []);
      this.registry.set(
        "onlineFaction",
        player?.factionId ?? "free_confederation",
      );
      this.registry.set("onlinePointLimit", this.pointLimit);
      this.scene.start("LobbyScene");
    } else {
      this.scene.start("ContinuousTacticalScene");
    }
  }
}
