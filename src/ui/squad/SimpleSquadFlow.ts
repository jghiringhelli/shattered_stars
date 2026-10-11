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
import { createToggleButton } from "../ButtonFactory";
import { getShipsByFaction } from "../../data/ShipDefinitions";
import { ShipCatalogPanel } from "../picker/ShipCatalogPanel";
import { HOLO_RADIUS, factionAccent } from "../theme/HoloTheme";
import { SQUAD_TYPE } from "./squadBuilderStyle";

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
  /** Catalog panel top and height (bottom edge at 680, above the footer). */
  catalogTopY: 148,
  catalogPanelH: 532,
} as const;

/** Faction → ship → payload → launch wrapper around ShipCatalogPanel. */
export class SimpleSquadFlow extends Phaser.Events.EventEmitter {
  private selectedFaction: FactionId;
  private catalog: ShipCatalogPanel | null = null;
  private factionButtons: Phaser.GameObjects.Container[] = [];

  /**
   * @param scene - Owning scene.
   * @param initialFaction - Faction selected on entry.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    initialFaction: FactionId,
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
    this.renderFactionRow();
    this.renderCatalog();
  }

  /** Destroy the faction row and catalog. */
  destroy(): void {
    this.factionButtons.forEach((b) => b.destroy());
    this.catalog?.destroy();
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
      button.add(this.createFactionPip(faction, width));
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
    this.catalog.render();
  }
}
