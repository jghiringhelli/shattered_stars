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

const FACTION_ROW_Y = 78;
const CATALOG_TOP_Y = 122;
const CATALOG_PANEL_H = 546;

export class SimpleSquadFlow extends Phaser.Events.EventEmitter {
  private selectedFaction: FactionId;
  private catalog: ShipCatalogPanel | null = null;
  private factionButtons: Phaser.GameObjects.Container[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    initialFaction: FactionId,
  ) {
    super();
    this.selectedFaction = initialFaction;
  }

  render(): void {
    this.factionButtons.forEach((b) => b.destroy());
    this.factionButtons = [];
    this.renderFactionRow();
    this.renderCatalog();
  }

  destroy(): void {
    this.factionButtons.forEach((b) => b.destroy());
    this.catalog?.destroy();
  }

  private renderFactionRow(): void {
    const centerX = this.scene.scale.width / 2;
    const spacing = 220;
    const startX = centerX - ((FACTION_ORDER.length - 1) * spacing) / 2;

    this.factionButtons = FACTION_ORDER.map((faction, i) =>
      createToggleButton(
        this.scene,
        startX + i * spacing,
        FACTION_ROW_Y,
        FACTION_NAMES[faction],
        faction === this.selectedFaction,
        {
          width: 200,
          height: 36,
          radius: 6,
          selectedColor: FACTION_COLORS[faction],
          normalColor: 0x222233,
          font: "13px Arial",
          selectedFont: "bold 13px Arial",
        },
        () => {
          this.selectedFaction = faction;
          this.render();
        },
      ),
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
      CATALOG_TOP_Y,
      CATALOG_PANEL_H,
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
