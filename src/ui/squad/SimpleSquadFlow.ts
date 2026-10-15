/**
 * SimpleSquadFlow — the default "easy mode" entry to Skirmish: pick a
 * faction, pick one ship (role-sorted), pick a payload, launch.
 *
 * Reuses ShipCatalogPanel (role-sorted grid + loadout picker with playstyle
 * hints) shifted down to make room for a faction row above it — the picking
 * UX matches the advanced builder exactly, this is a focused single-ship
 * wrapper with a faction-first step and a relabeled confirm button.
 *
 * Emits: 'start' { factionId: FactionId, shipId: string, loadoutId: string | null }
 */

import Phaser from "phaser";
import { FACTION_COLORS, type FactionId } from "../../config";
import { createToggleButton, createHoverButton } from "../ButtonFactory";
import { getShipsByFaction } from "../../data/ShipDefinitions";
import type { GameMode } from "../../core/squadTypes";
import { ShipCatalogPanel, type CatalogSelection } from "../picker/ShipCatalogPanel";
import { PointsBar, POINTS_BAR_H } from "../picker/PointsBar";
import type { HoloPressButton } from "../menu/HoloPressButton";
import { budgetOf, wingmenCaption } from "../picker/pointsBudget";
import { createMapThemeButton } from "./MapThemeButton";
import { previewSimpleSquad } from "./simpleBudget";
import { factionTermId } from "../../data/tooltips";
import type { FocusTarget } from "../menu/MenuFocus";
import { attachToggleTooltip, focusTipTarget } from "../menu/tooltipTargets";
import { HOLO_PALETTE, HOLO_RADIUS, HOLO_SPACING, factionAccent } from "../theme/HoloTheme";
import { SQUAD_TYPE } from "./squadBuilderStyle";
import { QUICK_PRESETS, presetShip, type QuickPreset } from "./quickPresets";

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

/** Faction row + embedded catalog geometry (scene coordinates). */
const FLOW_LAYOUT = {
  /** Outer margin matching the menu grid. */
  margin: 32,
  /** Faction row vertical centre (first content row below the header). */
  factionRowY: 120,
  factionButtonH: 32,
  factionGap: 12,
  /** Faction colour pip inside each toggle. */
  pipRadius: 4,
  pipInset: 16,
  /** Catalog panel top and height (the points bar sits under it, above the footer). */
  catalogTopY: 148,
  catalogPanelH: 516,
  /** Gap between the catalog and the points bar. */
  barGap: 8,
  /** Map button beside the bar. */
  mapButtonW: 200,
  /** Quick-start chips (header row 2, under the title). */
  presetY: 64,
  presetW: 104,
  presetH: 26,
  presetGap: 10,
} as const;

/** What the flow needs to price the squad. */
export interface SimpleFlowOptions {
  readonly gameMode: GameMode;
  readonly pointLimit: number;
}

/** Faction → ship → payload → launch wrapper around ShipCatalogPanel. */
export class SimpleSquadFlow extends Phaser.Events.EventEmitter {
  private selectedFaction: FactionId;
  private catalog: ShipCatalogPanel | null = null;
  private pointsBar: PointsBar | null = null;
  private mapButton: HoloPressButton | null = null;
  private factionButtons: Phaser.GameObjects.Container[] = [];
  private presetButtons: HoloPressButton[] = [];
  private factionTargets: FocusTarget[] = [];
  /** Faction chips then filter chips — one array so a MenuFocus can keep it. */
  private readonly allTargets: FocusTarget[] = [];

  /**
   * @param scene - Owning scene.
   * @param initialFaction - Faction selected on entry.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    initialFaction: FactionId,
    private readonly options: SimpleFlowOptions,
  ) {
    super();
    this.selectedFaction = initialFaction;
  }

  /** The faction selected in the faction row. */
  get faction(): FactionId {
    return this.selectedFaction;
  }

  /** Render (or re-render) the faction row and the catalog. */
  render(): void {
    this.factionButtons.forEach((b) => b.destroy());
    this.factionButtons = [];
    this.factionTargets = [];
    this.renderFactionRow();
    this.renderPresets();
    this.renderCatalog();
  }

  /** Destroy the faction row and catalog. */
  destroy(): void {
    this.factionButtons.forEach((b) => b.destroy());
    this.presetButtons.forEach((b) => b.destroy());
    this.presetButtons = [];
    this.catalog?.destroy();
    this.pointsBar?.destroy();
    this.mapButton?.destroy();
    this.allTargets.length = 0;
  }

  private renderFactionRow(): void {
    const { margin, factionGap, factionButtonH, factionRowY } = FLOW_LAYOUT;
    const count = FACTION_ORDER.length;
    const rowW = this.scene.scale.width - margin * 2;
    const width = (rowW - factionGap * (count - 1)) / count;
    this.factionButtons = FACTION_ORDER.map((faction, i) => {
      const button = createToggleButton(
        this.scene,
        margin + width / 2 + i * (width + factionGap),
        factionRowY,
        FACTION_NAMES[faction],
        faction === this.selectedFaction,
        {
          width,
          height: factionButtonH,
          radius: HOLO_RADIUS.sm,
          selectedColor: FACTION_COLORS[faction],
          normalColor: FACTION_COLORS[faction],
          font: `${SQUAD_TYPE.body}px`,
          selectedFont: `600 ${SQUAD_TYPE.body}px`,
        },
        () => {
          this.selectedFaction = faction;
          this.render();
        },
      );
      const hit = attachToggleTooltip(
        this.scene,
        button,
        factionTermId(faction),
      );
      button.add(this.createFactionPip(faction, width));
      this.factionTargets.push(
        focusTipTarget(hit, () => {
          this.selectedFaction = faction;
          this.render();
        }),
      );
      return button;
    });
  }

  /** Small faction-colour dot at the left of a faction toggle. */
  private createFactionPip(
    faction: FactionId,
    buttonWidth: number,
  ): Phaser.GameObjects.Arc {
    return this.scene.add.circle(
      -buttonWidth / 2 + FLOW_LAYOUT.pipInset,
      0,
      FLOW_LAYOUT.pipRadius,
      factionAccent(faction),
    );
  }

  /** Capital ships Skirmish leaves out (listed as an epic-only notice). */
  private hiddenCapitalCount(): number {
    return getShipsByFaction(this.selectedFaction).filter(
      (s) => s.role === "capital" || s.baseStats.size === "huge",
    ).length;
  }

  /** Quick-start chips (BALANCED / ACES / SWARM) under the title: one click launches. */
  private renderPresets(): void {
    this.presetButtons.forEach((b) => b.destroy());
    const { presetY, presetW, presetH, presetGap } = FLOW_LAYOUT;
    const count = QUICK_PRESETS.length;
    const startX =
      this.scene.scale.width / 2 - ((count - 1) * (presetW + presetGap)) / 2;
    this.presetButtons = QUICK_PRESETS.map((preset, i) =>
      createHoverButton(
        this.scene,
        startX + i * (presetW + presetGap),
        presetY,
        {
          width: presetW,
          height: presetH,
          label: preset.label,
          color: HOLO_PALETTE.panelFill,
          variant: "secondary",
          font: `600 ${SQUAD_TYPE.label}px`,
        },
        () => this.launchPreset(preset),
      ).setName(`quickPreset_${preset.id}`),
    );
  }

  private launchPreset(preset: QuickPreset): void {
    const shipId = presetShip(this.selectedFaction, preset);
    if (!shipId) return;
    this.emit("start", {
      factionId: this.selectedFaction,
      shipId,
      loadoutId: null,
    });
  }

  /** Faction chips then the catalog's filter chips (same array across re-renders). */
  get focusTargets(): FocusTarget[] {
    return this.allTargets;
  }

  private syncFocusTargets(): void {
    this.allTargets.splice(
      0,
      this.allTargets.length,
      ...this.factionTargets,
      ...this.presetButtons,
      ...(this.catalog?.focusTargets ?? []),
      ...(this.mapButton ? [this.mapButton] : []),
    );
    this.emit("focusTargetsChanged");
  }

  private renderCatalog(): void {
    this.catalog?.destroy();
    const ships = getShipsByFaction(this.selectedFaction).filter(
      (s) => s.role !== "capital" && s.baseStats.size !== "huge",
    );
    this.catalog = new ShipCatalogPanel(
      this.scene,
      ships,
      this.selectedFaction,
      undefined,
      "LAUNCH",
      FLOW_LAYOUT.catalogTopY,
      FLOW_LAYOUT.catalogPanelH,
      { hiddenCapitals: this.hiddenCapitalCount() },
    );
    this.catalog.on(
      "addInstance",
      (e: { shipId: string; loadoutId: string | null }) => {
        this.emit("start", {
          factionId: this.selectedFaction,
          shipId: e.shipId,
          loadoutId: e.loadoutId,
        });
      },
    );
    this.catalog.on("focusTargetsChanged", () => this.syncFocusTargets());
    this.catalog.on("selectionChanged", (s: CatalogSelection) =>
      this.refreshBudget(s),
    );
    this.drawBottomRow();
    this.catalog.render();
  }

  /** The points bar with the Map button at its right end. */
  private drawBottomRow(): void {
    const { margin, catalogTopY, catalogPanelH, barGap, mapButtonW } = FLOW_LAYOUT;
    const y = catalogTopY + catalogPanelH + barGap;
    const full = this.scene.scale.width - margin * 2;
    this.pointsBar?.destroy();
    this.mapButton?.destroy();
    this.pointsBar = new PointsBar(
      this.scene,
      { x: margin, y, width: full - mapButtonW - HOLO_SPACING.sm },
      factionAccent(this.selectedFaction),
    );
    this.mapButton = createMapThemeButton(this.scene, {
      x: margin + full - mapButtonW / 2,
      y: y + POINTS_BAR_H / 2,
      width: mapButtonW,
    });
  }

  /**
   * Prices the squad the launch would field and shows it in the bar.
   *
   * @param selection - The ship and build staged in the catalog.
   */
  private refreshBudget(selection: CatalogSelection): void {
    const { pointLimit, gameMode } = this.options;
    const note = `Enemy squad matched to ${pointLimit} pts`;
    if (!selection.shipId) {
      this.pointsBar?.update(
        budgetOf(0, pointLimit),
        note,
        `Pick a ship \u2014 your ${pointLimit} points also buy AI wingmen`,
      );
      return;
    }
    const preview = previewSimpleSquad(
      this.selectedFaction,
      selection.shipId,
      selection.loadoutId,
      gameMode,
      pointLimit,
    );
    this.pointsBar?.update(
      budgetOf(preview.squadTotal, pointLimit),
      note,
      wingmenCaption(preview.ownCost, preview.squadTotal, pointLimit),
    );
  }
}
