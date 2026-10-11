/**
 * Survival Setup Scene — pre-run picker for the Survival roguelite
 * (docs/adr/ADR-0004-survival-roguelite-run-structure.md): faction, flagship
 * (meta unlocks add heavier ones), quick build, seed and ascension, then
 * LAUNCH a new run onto the sector map; CONTINUE / ABANDON a saved run;
 * UNLOCKS (Star Charts) and HISTORY (last 20 runs). LAUNCH sits
 * bottom-centre (game-modes-tour clicks (centre, height − 60)).
 */

import Phaser from "phaser";
import { createHoverButton, createToggleButton } from "../ui/ButtonFactory";
import { quickTipLine } from "../ui/ControlsReference";
import { FACTION_COLORS, type FactionId } from "../config";
import { getShipDefinition } from "../data/ShipDefinitions";
import { starterChoices } from "../data/survival/metaUnlocks";
import { FACTION_NAMES_SHORT } from "../data/survival/factionNames";
import {
  runServiceOf,
  type RoguelikeRunService,
} from "../systems/survival/RoguelikeRunService";
import { RunSetupControls } from "../ui/survival/RunSetupControls";
import { SurvivalChoicePanel } from "../ui/survival/SurvivalChoicePanel";
import {
  addSavedRunButtons,
  showUnlockShop,
} from "../ui/survival/setupRunMenus";
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
  cardsTop: 170,
  cardWidth: 320,
  cardHeight: 200,
  cardGap: 32,
  /** Widest the ship-card row may get (px). */
  cardsMaxWidth: 1200,
  chooserY: 388,
  chooserWidth: 520,
  launchInset: 60,
  launchWidth: 220,
  launchHeight: 52,
  /** CONTINUE / ABANDON sit this far left / right of LAUNCH. */
  sideButtonOffset: 280,
  sideButtonWidth: 230,
} as const;

const FACTION_ORDER: readonly FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];

/** Faction toggle labels (shared with the rest of Survival). */
const FACTION_NAMES = FACTION_NAMES_SHORT;

export class SurvivalSetupScene extends Phaser.Scene {
  private selectedFaction: FactionId = "terran_hegemony";
  private selectedShipId = "terran_viper";
  private shipCardObjects: Phaser.GameObjects.GameObject[] = [];
  private factionButtons: Phaser.GameObjects.Container[] = [];
  /** The flagship's quick-build pick (default until the player cycles it). */
  private playerBuilds: QuickBuildSelection | null = null;
  private quickBuildObjects: Phaser.GameObjects.GameObject[] = [];
  private header!: MenuHeader;
  private service!: RoguelikeRunService;
  /** Seed, ascension, unlocks and history row. */
  controls!: RunSetupControls;
  private panel!: SurvivalChoicePanel;

  constructor() {
    super({ key: "SurvivalSetupScene" });
  }

  create(): void {
    this.quickBuildObjects = [];
    this.shipCardObjects = [];
    this.service = runServiceOf(this.registry);
    this.selectedShipId = this.starters()[0]!;
    addMenuBackdrop(this, { textureId: "starfield_deep" });
    this.header = addMenuHeader(this, {
      title: "Survival",
      subtitle:
        "Three sectors, one fleet. Plot your route, collect relics, repair what you can — the Nexus flagship waits at the end.",
      accent: factionAccent(this.selectedFaction),
    });
    addBackButton(this, () => this.scene.start("MainMenuScene"));
    this.input.keyboard?.on("keydown-ESC", () => {
      if (!this.controls.isTyping && !this.panel.isOpen)
        this.scene.start("MainMenuScene");
    });
    this.add
      .text(this.scale.width / 2, SETUP_LAYOUT.factionCaptionY, "FACTION", {
        ...holoFont(HOLO_TYPE_SCALE.caption.size, "600"),
        color: toCssColor(HOLO_PALETTE.textSecondary),
      })
      .setLetterSpacing(HOLO_TYPE_SCALE.caption.letterSpacing * 2)
      .setOrigin(0.5);
    this.createFactionRow();
    this.renderShipChoices();
    this.controls = new RunSetupControls(this, this.service.meta.maxAscension, {
      onUnlocks: () =>
        showUnlockShop(this.panel, this.service, () => this.scene.restart()),
      onHistory: () =>
        this.scene.start("SurvivalSummaryScene", { historyOnly: true }),
    });
    this.createLaunchButton();
    this.createSavedRunButtons();
    this.panel = new SurvivalChoicePanel(this, this.selectedFaction);
  }

  /** @returns Flagships offered for the selected faction (meta unlocks included). */
  private starters(): string[] {
    return starterChoices(this.selectedFaction, this.service.meta.unlocked);
  }

  /**
   * Starts a new run from the current picks and opens the sector map
   * (also the e2e entry point).
   */
  launchRun(): void {
    this.service.startRun({
      faction: this.selectedFaction,
      flagshipId: this.selectedShipId,
      loadoutId:
        selectionFor([this.selectedShipId], this.playerBuilds).loadoutIds[0] ??
        null,
      ascension: this.controls.ascensionLevel,
      ...(this.controls.seed !== undefined ? { seed: this.controls.seed } : {}),
    });
    this.scene.start("SurvivalMapScene");
  }

  /** CONTINUE / ABANDON for a saved run (shown only when one exists). */
  private createSavedRunButtons(): void {
    addSavedRunButtons(this, this.service, {
      y: this.scale.height - SETUP_LAYOUT.launchInset,
      offset: SETUP_LAYOUT.sideButtonOffset,
      width: SETUP_LAYOUT.sideButtonWidth,
      height: SETUP_LAYOUT.launchHeight,
      onContinue: () => this.scene.start("SurvivalMapScene"),
      onAbandoned: () => this.scene.restart(),
    });
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
    this.selectedShipId = this.starters()[0]!;
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
    const { cardGap } = SETUP_LAYOUT;
    const choices = this.starters();
    const cardWidth = Math.min(
      SETUP_LAYOUT.cardWidth,
      (SETUP_LAYOUT.cardsMaxWidth - (choices.length - 1) * cardGap) /
        choices.length,
    );
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
      () => this.launchRun(),
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
