/**
 * EncyclopediaScene
 *
 * Browsable ship encyclopedia with faction filtering, scrollable ship list,
 * and a full detail panel showing cinematic art, lore, and normalized stats.
 * Navigation: faction chips, mouse wheel scroll, UP/DOWN to step through
 * ships, ESC to return to menu.
 */

import Phaser from "phaser";
import {
  getAllEncyclopediaEntries,
  getEncyclopediaEntry,
} from "../data/ShipEncyclopedia";
import type { EncyclopediaEntry } from "../data/ShipEncyclopedia";
import { getShipDefinition } from "../data/ShipDefinitions";
import { EncyclopediaDetailPanel } from "../ui/EncyclopediaDetailPanel";
import type { FactionId } from "../config";
import {
  addBackButton,
  addFooterHint,
  addMenuBackdrop,
  addMenuHeader,
  type MenuHeader,
} from "../ui/menu/MenuScaffold";
import { footerKeys } from "../ui/menu/footerKeys";
import { factionAccent } from "../ui/theme/HoloTheme";
import {
  bindMenuBack,
  fadeInMenu,
  goToScene,
} from "../ui/menu/menuTransitions";
import {
  ENCYCLOPEDIA_LAYOUT,
  encyclopediaRegions,
  snakeToLabel,
} from "../ui/encyclopedia/encyclopediaLayout";
import { FactionFilterChips } from "../ui/encyclopedia/FactionFilterChips";
import { EncyclopediaShipList } from "../ui/encyclopedia/EncyclopediaShipList";

/** Painted backdrop behind the encyclopedia. */
const BACKDROP_TEXTURE = "starfield_deep";
/** Scene returned to on BACK / ESC. */
const MENU_SCENE = "MainMenuScene";

export class EncyclopediaScene extends Phaser.Scene {
  private detailPanel!: EncyclopediaDetailPanel;
  private shipList!: EncyclopediaShipList;
  private factionChips!: FactionFilterChips;
  private header!: MenuHeader;
  private filteredEntries: EncyclopediaEntry[] = [];
  private activeFaction: FactionId | null = null;
  private selectedShipId: string | null = null;

  constructor() {
    super({ key: "EncyclopediaScene" });
  }

  create(): void {
    const regions = encyclopediaRegions(this.scale.width, this.scale.height);
    addMenuBackdrop(this, { textureId: BACKDROP_TEXTURE });
    this.header = addMenuHeader(this, {
      title: "SHIP ENCYCLOPEDIA",
      subtitle: " ",
    });
    addBackButton(this, () => this.returnToMenu());
    addFooterHint(
      this,
      footerKeys([
        ["↑ ↓", "browse ships"],
        ["WHEEL", "scroll"],
        ["ESC", "back"],
      ]),
    );
    this.factionChips = new FactionFilterChips(this, regions.chips, (faction) =>
      this.onFactionFilter(faction),
    );
    this.shipList = new EncyclopediaShipList(this, regions.list, (shipId) =>
      this.showDetail(shipId),
    );
    this.detailPanel = new EncyclopediaDetailPanel(this, regions.detail);
    this.activeFaction = null;
    this.rebuildList();
    this.setupInput();
    fadeInMenu(this);
  }

  private returnToMenu(): void {
    goToScene(this, MENU_SCENE);
  }

  private onFactionFilter(faction: FactionId | null): void {
    this.activeFaction = faction;
    this.factionChips.setActive(faction);
    this.rebuildList();
  }

  private rebuildList(): void {
    const all = getAllEncyclopediaEntries();
    this.filteredEntries = this.activeFaction
      ? all.filter(
          (e) => getShipDefinition(e.shipId)?.faction === this.activeFaction,
        )
      : [...all];
    this.shipList.setEntries(
      this.filteredEntries,
      factionAccent(this.activeFaction ?? undefined),
    );
    this.updateSubtitle();
    if (this.filteredEntries[0])
      this.showDetail(this.filteredEntries[0].shipId);
  }

  private updateSubtitle(): void {
    const scope = this.activeFaction
      ? snakeToLabel(this.activeFaction)
      : "ALL FACTIONS";
    this.header.subtitle?.setText(
      `${this.filteredEntries.length} ships  ·  ${scope}`,
    );
  }

  private showDetail(shipId: string): void {
    this.selectedShipId = shipId;
    this.detailPanel.show(getEncyclopediaEntry(shipId));
    this.shipList.setSelected(shipId);
  }

  /**
   * Move the selection up or down the filtered list.
   *
   * @param step - -1 for previous, +1 for next.
   */
  private stepSelection(step: number): void {
    const count = this.filteredEntries.length;
    if (count === 0) return;
    const current = this.filteredEntries.findIndex(
      (e) => e.shipId === this.selectedShipId,
    );
    const next = Phaser.Math.Clamp(current + step, 0, count - 1);
    const entry = this.filteredEntries[next];
    if (entry && next !== current) this.showDetail(entry.shipId);
  }

  private setupInput(): void {
    const keyboard = this.input.keyboard!;
    bindMenuBack(this, () => this.returnToMenu());
    let lastStepEvent: KeyboardEvent | null = null;
    const step = (delta: number) => (event: KeyboardEvent) => {
      // Phaser can re-emit one queued native event across scene steps.
      if (event === lastStepEvent) return;
      lastStepEvent = event;
      this.stepSelection(delta);
    };
    keyboard.on("keydown-UP", step(-1));
    keyboard.on("keydown-DOWN", step(1));
    this.input.on(
      "wheel",
      (_p: unknown, _go: unknown, _dx: unknown, dy: number) => {
        this.shipList.scrollBy(dy * ENCYCLOPEDIA_LAYOUT.wheelScale);
      },
    );
  }
}
