/**
 * Survival Setup Scene — lightweight pre-run picker.
 *
 * Survival does not need a squad builder: pick a faction, pick one of two
 * viable starter ships, launch. Everything else (power drafts, evolutions,
 * escort recruitment) is chosen progressively during the run itself — see
 * SurvivalRunController and SurvivalChoicePanel.
 *
 * Holo layout: header, faction toggles, two ship cards, the flagship's
 * quick-build chooser and LAUNCH bottom-centre (game-modes-tour clicks it at
 * (centre, height − 60)). Everything is tinted with the faction accent.
 */

import Phaser from "phaser";
import { createHoverButton, createToggleButton } from "../ui/ButtonFactory";
import { quickTipLine } from "../ui/ControlsReference";
import { FACTION_COLORS, type FactionId } from "../config";
import { getShipDefinition } from "../data/ShipDefinitions";
import { SURVIVAL_STARTER_CHOICES } from "./SurvivalScene";
import {
  cycleQuickBuild,
  selectionFor,
  type QuickBuildSelection,
} from "../arcade/systems/QuickBuildChoice";
import { renderQuickBuildChooser } from "../ui/QuickBuildChooser";
import {
  addBackButton,
  addFooterHint,
  addMenuBackdrop,
  addMenuHeader,
  MENU_LAYOUT,
  type MenuHeader,
} from "../ui/menu/MenuScaffold";
import { renderSurvivalShipCard } from "../ui/survival/survivalShipCard";
import { drawAccentRule } from "../ui/menu/holoChrome";
import { holoFont } from "../ui/theme/holoFont";
import {
  factionAccent,
  HOLO_PALETTE,
  HOLO_TYPE_SCALE,
} from "../ui/theme/HoloTheme";
import { toCssColor } from "../ui/theme/colorMath";

/** Screen grid. */
const SETUP_LAYOUT = {
  factionCaptionY: 112,
  factionRowY: 140,
  factionSpacing: 220,
  factionWidth: 200,
  factionHeight: 36,
  cardsTop: 180,
  cardWidth: 320,
  cardHeight: 216,
  cardGap: 32,
  chooserY: 416,
  chooserWidth: 520,
  launchInset: 60,
  launchWidth: 220,
  launchHeight: 52,
} as const;

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
  private header!: MenuHeader;

  constructor() {
    super({ key: "SurvivalSetupScene" });
  }

  create(): void {
    this.quickBuildObjects = [];
    this.shipCardObjects = [];
    addMenuBackdrop(this, { textureId: "starfield_deep" });
    this.header = addMenuHeader(this, {
      title: "Survival",
      subtitle:
        "Choose a faction and a ship. Everything else — powers, evolutions, your squad — is earned as you survive.",
      accent: factionAccent(this.selectedFaction),
    });
    addBackButton(this, () => this.scene.start("MainMenuScene"));
    this.input.keyboard?.on("keydown-ESC", () =>
      this.scene.start("MainMenuScene"),
    );
    this.add
      .text(this.scale.width / 2, SETUP_LAYOUT.factionCaptionY, "FACTION", {
        ...holoFont(HOLO_TYPE_SCALE.caption.size, "600"),
        color: toCssColor(HOLO_PALETTE.textSecondary),
      })
      .setLetterSpacing(HOLO_TYPE_SCALE.caption.letterSpacing * 2)
      .setOrigin(0.5);
    this.createFactionRow();
    this.renderShipChoices();
    this.createLaunchButton();
  }

  private createFactionRow(): void {
    const centerX = this.scale.width / 2;
    const spacing = SETUP_LAYOUT.factionSpacing;
    const startX = centerX - ((FACTION_ORDER.length - 1) * spacing) / 2;
    this.factionButtons = FACTION_ORDER.map((faction, i) =>
      createToggleButton(
        this,
        startX + i * spacing,
        SETUP_LAYOUT.factionRowY,
        FACTION_NAMES[faction],
        faction === this.selectedFaction,
        {
          width: SETUP_LAYOUT.factionWidth,
          height: SETUP_LAYOUT.factionHeight,
          selectedColor: FACTION_COLORS[faction],
          normalColor: HOLO_PALETTE.panelFill,
          font: "13px",
          selectedFont: "600 13px",
        },
        () => this.selectFaction(faction),
      ),
    );
  }

  private selectFaction(faction: FactionId): void {
    this.selectedFaction = faction;
    this.selectedShipId = SURVIVAL_STARTER_CHOICES[faction][0]!;
    this.refreshFactionButtons();
    this.renderShipChoices();
  }

  private refreshFactionButtons(): void {
    // Toggle buttons don't expose a setSelected() — rebuild the row, matching
    // the pattern used by Dogfight's setup screen.
    this.factionButtons.forEach((b) => b.destroy());
    this.createFactionRow();
    this.header.rule.clear();
    drawAccentRule(
      this.header.rule,
      {
        x: MENU_LAYOUT.margin,
        y: MENU_LAYOUT.ruleY,
        width: this.scale.width - MENU_LAYOUT.margin * 2,
        height: 0,
      },
      factionAccent(this.selectedFaction),
    );
  }

  private renderShipChoices(): void {
    this.shipCardObjects.forEach((o) => o.destroy());
    this.shipCardObjects = [];
    const { cardWidth, cardGap } = SETUP_LAYOUT;
    const choices = SURVIVAL_STARTER_CHOICES[this.selectedFaction];
    const totalWidth =
      choices.length * cardWidth + (choices.length - 1) * cardGap;
    const startX = this.scale.width / 2 - totalWidth / 2 + cardWidth / 2;
    choices.forEach((shipId, i) => {
      const def = getShipDefinition(shipId);
      if (!def) return;
      this.shipCardObjects.push(
        ...renderSurvivalShipCard(this, {
          x: startX + i * (cardWidth + cardGap),
          top: SETUP_LAYOUT.cardsTop,
          width: cardWidth,
          height: SETUP_LAYOUT.cardHeight,
          def,
          selected: shipId === this.selectedShipId,
          accent: factionAccent(this.selectedFaction),
          onSelect: () => {
            this.selectedShipId = shipId;
            this.renderShipChoices();
          },
        }),
      );
    });
    this.renderQuickBuildChoice();
  }

  /**
   * The flagship's quick-build chooser below the ship cards. Defaults to
   * what the run would hand out, so launching untouched changes nothing.
   */
  private renderQuickBuildChoice(): void {
    const centerX = this.scale.width / 2;
    this.quickBuildObjects.forEach((o) => o.destroy());
    this.playerBuilds = selectionFor([this.selectedShipId], this.playerBuilds);
    const chooser = renderQuickBuildChooser(this, {
      x: centerX - SETUP_LAYOUT.chooserWidth / 2,
      y: SETUP_LAYOUT.chooserY,
      width: SETUP_LAYOUT.chooserWidth,
      heading: "FLAGSHIP QUICK BUILD",
      shipId: this.selectedShipId,
      loadoutId: this.playerBuilds.loadoutIds[0] ?? null,
      name: "survivalQuickBuild",
      accentColor: factionAccent(this.selectedFaction),
      onCycle: (step) => {
        if (!this.playerBuilds) return;
        this.playerBuilds = cycleQuickBuild(this.playerBuilds, 0, step);
        this.renderQuickBuildChoice();
      },
    });
    this.quickBuildObjects = chooser.objects;
  }

  private createLaunchButton(): void {
    const btn = createHoverButton(
      this,
      this.scale.width / 2,
      this.scale.height - SETUP_LAYOUT.launchInset,
      {
        width: SETUP_LAYOUT.launchWidth,
        height: SETUP_LAYOUT.launchHeight,
        color: HOLO_PALETTE.accent,
        variant: "primary",
        label: "LAUNCH",
        font: "600 22px",
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
    );
    btn.setDepth(10);
    addFooterHint(
      this,
      quickTipLine([
        { label: "Steer", intents: ["STEER_LEFT", "STEER_RIGHT"] },
        { label: "Throttle", intents: ["THRUST_UP", "THRUST_DOWN"] },
        { label: "Weapon", intents: [] },
        { label: "Pause", intents: ["PAUSE"] },
      ]),
    ).setDepth(10);
  }
}
