/**
 * SquadBuilderScene — squad configuration screen.
 *
 * Players configure squads and assign them to teams (T1–T4).
 * The battle format (1v1, 2v2, FFA, etc.) is derived automatically
 * from the squad–team assignments — no explicit preset selection needed.
 */

import Phaser from "phaser";
import { createHoverButton } from "../ui/ButtonFactory";
import type { FactionId } from "../config";
import { SHIP_DEFINITIONS } from "../data/ShipDefinitions";
import {
  type GameMode,
  type SquadEntry,
  makeSquad,
  MULTI_TEAM_MODES,
} from "../core/squadTypes";
import type { AIDifficultyLevel } from "../ai/AIDifficulty";
import { FormatPanel } from "../ui/squad/FormatPanel";
import type { FormatPanelState } from "../ui/squad/FormatPanel";
import { SquadListPanel } from "../ui/squad/SquadListPanel";
import { flashText } from "../ui/textFlash";

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
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x080c14);
    this.buildDefaultSquads();
    this.createTitle();
    this.createBackButton();
    this.buildPanels();
    this.createBottomBar();
    this.setupInput();
    this.listenForShipsPicked();
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
          color: "#ff8844",
        });
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
          color: "#ff8844",
        });
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
          color: "#cc8833",
          durationMs: 2500,
        });
      }
    }
    this.squadListPanel.update({ gameMode: this.gameMode });
  }

  /** Remove capital and huge ships from all squads when leaving epic mode. */
  private stripHugeShips(): void {
    for (const squad of this.squads) {
      squad.ships = squad.ships.filter(
        (id) =>
          SHIP_DEFINITIONS[id]?.baseStats.size !== "huge" &&
          SHIP_DEFINITIONS[id]?.role !== "capital",
      );
      squad.pointsUsed = squad.ships.reduce(
        (sum, id) => sum + (SHIP_DEFINITIONS[id]?.baseStats.pointCost ?? 0),
        0,
      );
    }
  }

  private createTitle(): void {
    this.add
      .text(this.scale.width / 2, 36, "SQUAD BUILDER", {
        font: "bold 28px Arial",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.instructionText = this.add
      .text(
        this.scale.width / 2,
        this.scale.height - 22,
        "Use team chips (T1–T4) to set sides · Tap card header to edit ships · Auto-Fill to build squads automatically",
        { font: "12px Arial", color: "#334455" },
      )
      .setOrigin(0.5);
  }

  private createBackButton(): void {
    this.add
      .text(18, 36, "< BACK", { font: "14px Arial", color: "#445566" })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("MainMenuScene"))
      .on("pointerover", function (this: Phaser.GameObjects.Text) {
        this.setColor("#6688aa");
      })
      .on("pointerout", function (this: Phaser.GameObjects.Text) {
        this.setColor("#445566");
      });
  }

  private createBottomBar(): void {
    const cx = this.scale.width / 2;
    const y = this.scale.height - 52;
    createHoverButton(
      this,
      cx - 175,
      y,
      {
        width: 150,
        height: 38,
        color: 0x1a3322,
        hoverColor: 0x2a5533,
        label: "AUTO-FILL ALL",
        font: "13px Arial",
        textColor: "#77cc88",
      },
      () => {
        this.squadListPanel.autoFillAll();
        this.squadListPanel.render();
      },
    );
    createHoverButton(
      this,
      cx,
      y,
      {
        width: 130,
        height: 38,
        color: 0x2a1a33,
        hoverColor: 0x4a2a55,
        label: "RANDOMIZE",
        font: "13px Arial",
        textColor: "#aa77cc",
      },
      () => this.randomizeAll(),
    );
    createHoverButton(
      this,
      cx + 165,
      y,
      {
        width: 150,
        height: 38,
        color: 0x1a3311,
        hoverColor: 0x2a5522,
        label: "START BATTLE",
        font: "bold 14px Arial",
        textColor: "#88ee88",
      },
      () => this.startBattle(),
    );
  }

  private setupInput(): void {
    this.input.keyboard!.on("keydown-ESC", () =>
      this.scene.start("MainMenuScene"),
    );
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
        color: "#ffaa44",
      });
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
        data.pointsUsed ??
        data.ships.reduce(
          (sum, id) => sum + (SHIP_DEFINITIONS[id]?.baseStats.pointCost ?? 0),
          0,
        );
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
        color: "#ff5544",
        durationMs: 3000,
      });
      this.tweens.add({
        targets: this.instructionText,
        scaleX: 1.12,
        scaleY: 1.12,
        yoyo: true,
        duration: 200,
      });
      return;
    }
    if (this.squads.some((s) => !s.factionId || s.ships.length === 0)) {
      flashText(this, this.instructionText, {
        message: "All squads must have ships before starting!",
        color: "#ff5544",
        durationMs: 3000,
      });
      this.tweens.add({
        targets: this.instructionText,
        scaleX: 1.12,
        scaleY: 1.12,
        yoyo: true,
        duration: 200,
      });
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
