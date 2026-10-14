/**
 * Survival Setup Scene — pre-run picker for the Survival roguelite
 * (docs/adr/ADR-0004-survival-roguelite-run-structure.md): faction, flagship
 * (meta unlocks add heavier ones), quick build, seed and ascension, then
 * LAUNCH a new run onto the sector map; CONTINUE / ABANDON a saved run;
 * DAILY (today's fixed-seed challenge + local best / history);
 * UNLOCKS (Star Charts) and HISTORY (last 20 runs). LAUNCH sits
 * bottom-centre (game-modes-tour clicks (centre, height − 60)).
 */

import Phaser from "phaser";
import { createHoverButton, createToggleButton } from "../ui/ButtonFactory";
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
import { addDailyButton, openDailyPanel } from "../ui/survival/dailyMenu";
import {
  dailyChallengeFor,
  dailyRunRequest,
} from "../systems/survival/DailyChallenge";
import {
  addSavedRunButtons,
  showUnlockShop,
} from "../ui/survival/setupRunMenus";
import {
  selectionFor,
  type QuickBuildSelection,
} from "../arcade/systems/QuickBuildChoice";
import { factionTermId } from "../data/tooltips";
import { attachTermTooltip } from "../ui/menu/HintTooltip";
import { addTipZone, attachToggleTooltip } from "../ui/menu/tooltipTargets";
import {
  ShipDetailPanel,
  type StagingSelection,
} from "../ui/picker/ShipDetailPanel";
import { buildSelection, starterCardRects } from "../ui/survival/starterModel";
import {
  addBackButton,
  addMenuBackdrop,
  addMenuHeader,
  MENU_LAYOUT,
  type MenuHeader,
} from "../ui/menu/MenuScaffold";
import { renderSurvivalShipCard } from "../ui/survival/survivalShipCard";
import { drawAccentRule } from "../ui/menu/holoChrome";
import { factionAccent, HOLO_PALETTE } from "../ui/theme/HoloTheme";
import { audioManager } from "../audio/AudioManager";

/** Screen grid. */
const SETUP_LAYOUT = {
  factionRowY: 124,
  factionSpacing: 220,
  factionWidth: 200,
  factionHeight: 36,
  cardsTop: 152,
  cardHeight: 40,
  /** The detail panel under the ship cards (OVERVIEW / LOADOUT / BUILDS). */
  detailTop: 208,
  detailHeight: 376,
  detailWidth: 1024,
  launchInset: 60,
  launchWidth: 220,
  launchHeight: 48,
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
  private detailPanel!: ShipDetailPanel;
  /** What the detail panel reads and writes: the flagship and its build. */
  private readonly staging: StagingSelection = {
    getSelectedShipId: () => this.selectedShipId,
    getSelectedLoadoutId: () => this.playerBuilds?.loadoutIds[0] ?? null,
    selectLoadout: (loadoutId) => {
      this.playerBuilds = buildSelection(this.selectedShipId, loadoutId);
    },
  };
  private header!: MenuHeader;
  private service!: RoguelikeRunService;
  /** Seed, ascension, unlocks and history row. */
  controls!: RunSetupControls;
  private panel!: SurvivalChoicePanel;

  constructor() {
    super({ key: "SurvivalSetupScene" });
  }

  create(): void {
    this.shipCardObjects = [];
    this.service = runServiceOf(this.registry);
    this.selectedShipId = this.starters()[0]!;
    addMenuBackdrop(this, { textureId: "starfield_deep" });
    audioManager.playSubmenuMusic();
    this.header = addMenuHeader(this, {
      title: "Survival",
      accent: factionAccent(this.selectedFaction),
    });
    addTipZone(
      this,
      null,
      this.header.title.getBounds(),
      "survival.mode",
    );
    addBackButton(this, () => this.scene.start("MainMenuScene"));
    this.input.keyboard?.on("keydown-ESC", () => {
      if (!this.controls.isTyping && !this.panel.isOpen)
        this.scene.start("MainMenuScene");
    });
    this.detailPanel = new ShipDetailPanel(
      this,
      () => {},
      "survivalStarter",
      () => !this.controls?.isTyping && !this.panel?.isOpen,
    );
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
    addDailyButton(this, () =>
      openDailyPanel(this.panel, this.service.meta.history, () =>
        this.launchDaily(),
      ),
    );
  }

  /** Starts today's Daily challenge run (also the e2e entry point). */
  launchDaily(): void {
    this.service.startRun(dailyRunRequest(dailyChallengeFor(new Date())));
    this.scene.start("SurvivalMapScene");
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
    this.factionButtons = FACTION_ORDER.map((faction, i) => {
      const button = createToggleButton(
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
      );
      attachToggleTooltip(this, button, factionTermId(faction));
      return button;
    });
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
    const choices = this.starters();
    const rects = starterCardRects(choices.length, this.scale.width);
    choices.forEach((shipId, i) => {
      const def = getShipDefinition(shipId);
      const rect = rects[i];
      if (!def || !rect) return;
      this.shipCardObjects.push(
        ...renderSurvivalShipCard(this, {
          x: rect.x,
          top: SETUP_LAYOUT.cardsTop,
          width: rect.width,
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
    this.renderDetailPanel(choices);
  }

  /**
   * The detail panel under the cards (flagship + build). The build defaults
   * to what the run would hand out, so launching untouched changes nothing.
   */
  private renderDetailPanel(choices: readonly string[]): void {
    this.playerBuilds = selectionFor([this.selectedShipId], this.playerBuilds);
    const ships = choices.flatMap((id) => getShipDefinition(id) ?? []);
    const { detailWidth, detailTop, detailHeight } = SETUP_LAYOUT;
    this.detailPanel.render(
      ships,
      this.staging,
      (this.scale.width - detailWidth) / 2,
      detailTop,
      detailWidth,
      detailHeight,
    );
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
    attachTermTooltip(this, btn, "survival.launch");
  }
}
