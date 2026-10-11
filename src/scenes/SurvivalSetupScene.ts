/**
 * Survival Setup Scene — lightweight pre-run picker.
 *
 * Survival does not need a squad builder: pick a faction, pick one of two
 * viable starter ships, launch. Everything else (power drafts, evolutions,
 * escort recruitment) is chosen progressively during the run itself — see
 * SurvivalRunController and SurvivalChoicePanel.
 */

import Phaser from "phaser";
import { createHoverButton, createToggleButton } from "../ui/ButtonFactory";
import { addSceneBackground, addSceneTitleFrame } from "../ui/TexturedPanel";
import { renderMenuStarfield } from "../rendering/Starfield";
import { quickTipLine } from "../ui/ControlsReference";
import { FACTION_COLORS, type FactionId } from "../config";
import { getShipDefinition } from "../data/ShipDefinitions";
import { getRoleProsCons } from "../data/ShipRoleProfiles";
import { SURVIVAL_STARTER_CHOICES } from "./SurvivalScene";
import {
  cycleQuickBuild,
  selectionFor,
  type QuickBuildSelection,
} from "../arcade/systems/QuickBuildChoice";
import { renderQuickBuildChooser } from "../ui/QuickBuildChooser";

/** The flagship's quick-build chooser, centred below the ship cards. */
const QUICK_BUILD_CHOOSER_Y = 476;
const QUICK_BUILD_CHOOSER_W = 520;

const FACTION_ORDER: readonly FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];

const FACTION_NAMES: Record<FactionId, string> = {
  terran_hegemony: "Terran Hegemony",
  free_confederation: "Free Confederation",
  synthetic_collective: "Synthetic Collective",
  void_corsairs: "Void Corsairs",
  ascendant_empire: "Ascendant Empire",
};

export class SurvivalSetupScene extends Phaser.Scene {
  private selectedFaction: FactionId = "terran_hegemony";
  private selectedShipId: string = SURVIVAL_STARTER_CHOICES.terran_hegemony[0]!;
  private shipCardObjects: Phaser.GameObjects.GameObject[] = [];
  private factionButtons: Phaser.GameObjects.Container[] = [];
  /** The flagship's quick-build pick (default until the player cycles it). */
  private playerBuilds: QuickBuildSelection | null = null;
  private quickBuildObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: "SurvivalSetupScene" });
  }

  create(): void {
    this.quickBuildObjects = [];
    this.cameras.main.setBackgroundColor(0x050510);
    addSceneBackground(this);
    renderMenuStarfield(this, {
      starCount: 120,
      bounds: { minX: 0, maxX: 1280, minY: 0, maxY: 720 },
    });

    const centerX = this.scale.width / 2;
    addSceneTitleFrame(this, 60, 110);

    this.add
      .text(centerX, 45, "SURVIVAL", {
        font: "bold 48px Arial",
        color: "#ffffff",
        stroke: "#003366",
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    this.add
      .text(
        centerX,
        95,
        "Choose a faction and a ship. Everything else — powers, evolutions, your squad — is earned as you survive.",
        { font: "16px Arial", color: "#88aacc" },
      )
      .setOrigin(0.5);

    this.createFactionRow(centerX, 155);
    this.renderShipChoices(centerX, 250);
    this.createLaunchButton(centerX);
    this.createBackButton();
  }

  private createFactionRow(centerX: number, y: number): void {
    this.add
      .text(centerX, y - 30, "Faction:", {
        font: "bold 18px Arial",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const spacing = 220;
    const startX = centerX - ((FACTION_ORDER.length - 1) * spacing) / 2;

    this.factionButtons = FACTION_ORDER.map((faction, i) => {
      const btn = createToggleButton(
        this,
        startX + i * spacing,
        y,
        FACTION_NAMES[faction],
        faction === this.selectedFaction,
        {
          width: 200,
          height: 40,
          radius: 6,
          selectedColor: FACTION_COLORS[faction],
          normalColor: 0x222233,
          font: "13px Arial",
          selectedFont: "bold 13px Arial",
        },
        () => {
          this.selectedFaction = faction;
          this.selectedShipId = SURVIVAL_STARTER_CHOICES[faction][0]!;
          this.refreshFactionButtons();
          this.renderShipChoices(centerX, 250);
        },
      );
      return btn;
    });
  }

  private refreshFactionButtons(): void {
    // Toggle buttons don't expose a setSelected() — cheapest correct fix is
    // rebuilding the row, matching the (working) pattern already used for
    // Dogfight's setup screen after the earlier click-registration fix.
    this.factionButtons.forEach((b) => b.destroy());
    this.createFactionRow(this.scale.width / 2, 155);
  }

  private renderShipChoices(centerX: number, y: number): void {
    this.shipCardObjects.forEach((o) => o.destroy());
    this.shipCardObjects = [];

    const choices = SURVIVAL_STARTER_CHOICES[this.selectedFaction];
    const cardWidth = 320;
    const cardHeight = 210;
    const gap = 40;
    const totalWidth = choices.length * cardWidth + (choices.length - 1) * gap;
    const startX = centerX - totalWidth / 2 + cardWidth / 2;

    choices.forEach((shipId, i) => {
      const def = getShipDefinition(shipId);
      if (!def) return;
      const cardX = startX + i * (cardWidth + gap);
      this.createShipCard(
        cardX,
        y + cardHeight / 2,
        cardWidth,
        cardHeight,
        def,
        shipId,
      );
    });
    this.renderQuickBuildChoice(centerX);
  }

  /**
   * The flagship's quick-build chooser below the ship cards. Defaults to
   * what the run would hand out, so launching untouched changes nothing.
   *
   * @param centerX - Horizontal centre of the chooser.
   */
  private renderQuickBuildChoice(centerX: number): void {
    this.quickBuildObjects.forEach((o) => o.destroy());
    this.playerBuilds = selectionFor([this.selectedShipId], this.playerBuilds);
    const chooser = renderQuickBuildChooser(this, {
      x: centerX - QUICK_BUILD_CHOOSER_W / 2,
      y: QUICK_BUILD_CHOOSER_Y,
      width: QUICK_BUILD_CHOOSER_W,
      heading: "FLAGSHIP QUICK BUILD",
      shipId: this.selectedShipId,
      loadoutId: this.playerBuilds.loadoutIds[0] ?? null,
      name: "survivalQuickBuild",
      accentColor: 0x66aaff,
      onCycle: (step) => {
        if (!this.playerBuilds) return;
        this.playerBuilds = cycleQuickBuild(this.playerBuilds, 0, step);
        this.renderQuickBuildChoice(centerX);
      },
    });
    this.quickBuildObjects = chooser.objects;
  }

  private createShipCard(
    x: number,
    y: number,
    width: number,
    height: number,
    def: NonNullable<ReturnType<typeof getShipDefinition>>,
    shipId: string,
  ): void {
    const selected = shipId === this.selectedShipId;
    const halfW = width / 2;
    const halfH = height / 2;

    const bg = this.add.graphics();
    bg.fillStyle(selected ? 0x224466 : 0x161622, 0.95);
    bg.fillRoundedRect(x - halfW, y - halfH, width, height, 10);
    bg.lineStyle(selected ? 3 : 1, selected ? 0x66aaff : 0x333344, 1);
    bg.strokeRoundedRect(x - halfW, y - halfH, width, height, 10);
    bg.setScrollFactor(0);
    this.shipCardObjects.push(bg);

    const name = this.add
      .text(x, y - halfH + 24, def.name, {
        font: "bold 18px Arial",
        color: selected ? "#ffe066" : "#ffffff",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.shipCardObjects.push(name);

    const role = this.add
      .text(x, y - halfH + 48, def.role.replace("_", " ").toUpperCase(), {
        font: "12px Arial",
        color: "#88aacc",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.shipCardObjects.push(role);

    const stats = this.add
      .text(
        x,
        y - halfH + 76,
        `HULL ${def.baseStats.hull}   SHIELDS ${def.baseStats.shields}   AGILITY ${def.baseStats.agility}`,
        { font: "13px monospace", color: "#cccccc" },
      )
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.shipCardObjects.push(stats);

    const desc = this.add
      .text(x, y - halfH + 110, def.description, {
        font: "11px Arial",
        color: "#666677",
        wordWrap: { width: width - 30 },
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0);
    this.shipCardObjects.push(desc);

    const { pros, cons } = getRoleProsCons(def.role);
    const prosText = this.add
      .text(x - halfW + 16, y - halfH + 150, `+ ${pros}`, {
        font: "12px Arial",
        color: "#66ff88",
        wordWrap: { width: width - 32 },
      })
      .setScrollFactor(0);
    this.shipCardObjects.push(prosText);

    const consText = this.add
      .text(x - halfW + 16, y - halfH + 174, `\u2212 ${cons}`, {
        font: "12px Arial",
        color: "#ff8866",
        wordWrap: { width: width - 32 },
      })
      .setScrollFactor(0);
    this.shipCardObjects.push(consText);

    const hit = this.add
      .rectangle(x, y, width, height, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0);
    hit.on("pointerdown", () => {
      this.selectedShipId = shipId;
      this.renderShipChoices(this.scale.width / 2, y - halfH);
    });
    this.shipCardObjects.push(hit);
  }

  private createLaunchButton(centerX: number): void {
    const btn = createHoverButton(
      this,
      centerX,
      this.scale.height - 60,
      {
        width: 220,
        height: 56,
        radius: 12,
        color: 0x226644,
        hoverColor: 0x33aa66,
        label: "LAUNCH",
        font: "bold 28px Arial",
      },
      () => {
        this.scene.start("SurvivalScene", {
          factionId: this.selectedFaction,
          shipId: this.selectedShipId,
          loadoutId:
            selectionFor([this.selectedShipId], this.playerBuilds)
              .loadoutIds[0] ?? null,
        });
      },
    ).setScrollFactor(0);
    btn.setDepth(10);

    this.add
      .text(
        centerX,
        this.scale.height - 14,
        quickTipLine([
          { label: "Steer", intents: ["STEER_LEFT", "STEER_RIGHT"] },
          { label: "Throttle", intents: ["THRUST_UP", "THRUST_DOWN"] },
          { label: "Weapon", intents: [] },
          { label: "Pause", intents: ["PAUSE"] },
        ]),
        { font: "12px Arial", color: "#6688aa" },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(10);
  }

  private createBackButton(): void {
    const backBtn = this.add
      .text(50, 40, "< BACK", {
        font: "bold 20px Arial",
        color: "#aaaaaa",
      })
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0);

    backBtn.on("pointerover", () => backBtn.setColor("#ffffff"));
    backBtn.on("pointerout", () => backBtn.setColor("#aaaaaa"));
    backBtn.on("pointerdown", () => this.scene.start("MainMenuScene"));
  }
}
