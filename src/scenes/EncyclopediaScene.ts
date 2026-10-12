/**
 * EncyclopediaScene
 *
 * The codex: ships (art, lore, stats), pilots (abilities and their real-time
 * reading), upgrade cards (by slot, with role hints) and factions. Section
 * tabs (click or LEFT / RIGHT), faction chips, type-to-search (BACKSPACE
 * deletes, DELETE clears), mouse wheel scroll, UP / DOWN to step through the
 * list, ESC to return to the menu.
 */

import Phaser from "phaser";
import { audioManager } from "../audio/AudioManager";
import { getEncyclopediaEntry } from "../data/ShipEncyclopedia";
import type { EncyclopediaEntry } from "../data/ShipEncyclopedia";
import {
  CODEX_SECTIONS,
  codexEntries,
  filterCodex,
  type CodexEntry,
  type CodexSection,
} from "../data/encyclopedia/codex";
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
import { HOLO_PALETTE, factionAccent } from "../ui/theme/HoloTheme";
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
import {
  createFactionFilterChips,
  type FactionFilterChips,
} from "../ui/encyclopedia/FactionFilterChips";
import { EncyclopediaChipRow } from "../ui/encyclopedia/EncyclopediaChipRow";
import { EncyclopediaShipList } from "../ui/encyclopedia/EncyclopediaShipList";
import { CodexTextPanel } from "../ui/encyclopedia/CodexTextPanel";
import { CodexSearchField } from "../ui/encyclopedia/CodexSearchField";

/** Painted backdrop behind the encyclopedia. */
const BACKDROP_TEXTURE = "starfield_deep";
/** Scene returned to on BACK / ESC. */
const MENU_SCENE = "MainMenuScene";
/** Characters that type into the search field. */
const SEARCH_CHAR = /^[\p{L}\p{N} '-]$/u;
/** Longest search query kept. */
const MAX_QUERY_LENGTH = 24;

export class EncyclopediaScene extends Phaser.Scene {
  private detailPanel!: EncyclopediaDetailPanel;
  private textPanel!: CodexTextPanel;
  private shipList!: EncyclopediaShipList;
  private factionChips!: FactionFilterChips;
  private sectionTabs!: EncyclopediaChipRow<CodexSection>;
  private searchField!: CodexSearchField;
  private header!: MenuHeader;
  /** Ships of the ships section after the filters (ship detail data). */
  private filteredEntries: EncyclopediaEntry[] = [];
  /** Rows of the current section after the filters. */
  private codexRows: CodexEntry[] = [];
  private section: CodexSection = "ships";
  private activeFaction: FactionId | null = null;
  private query = "";
  private selectedId: string | null = null;
  /** Key events already typed into the search (dedupes Phaser re-emits). */
  private typedEvents = new WeakSet<KeyboardEvent>();

  constructor() {
    super({ key: "EncyclopediaScene" });
  }

  create(): void {
    const regions = encyclopediaRegions(this.scale.width, this.scale.height);
    addMenuBackdrop(this, { textureId: BACKDROP_TEXTURE });
    audioManager.playSubmenuMusic();
    this.header = addMenuHeader(this, { title: "ENCYCLOPEDIA", subtitle: " " });
    addBackButton(this, () => this.returnToMenu());
    addFooterHint(
      this,
      footerKeys([
        ["← →", "section"],
        ["↑ ↓", "browse"],
        ["TYPE", "search"],
        ["ESC", "back"],
      ]),
    );
    this.sectionTabs = new EncyclopediaChipRow(
      this,
      regions.tabs,
      CODEX_SECTIONS.map((s) => ({
        value: s.id,
        label: s.label,
        accent: HOLO_PALETTE.accent,
      })),
      (section) => this.setSection(section),
    );
    this.factionChips = createFactionFilterChips(this, regions.chips, (f) =>
      this.onFactionFilter(f),
    );
    this.searchField = new CodexSearchField(this, regions.search);
    this.shipList = new EncyclopediaShipList(this, regions.list, (id) =>
      this.select(id),
    );
    this.detailPanel = new EncyclopediaDetailPanel(this, regions.detail);
    this.textPanel = new CodexTextPanel(this, regions.detail);
    this.section = "ships";
    this.activeFaction = null;
    this.query = "";
    this.rebuildList();
    this.setupInput();
    fadeInMenu(this);
  }

  private returnToMenu(): void {
    goToScene(this, MENU_SCENE);
  }

  /** @param section - The section to browse. */
  private setSection(section: CodexSection): void {
    this.section = section;
    this.sectionTabs.setActive(section);
    this.rebuildList();
  }

  private onFactionFilter(faction: FactionId | null): void {
    this.activeFaction = faction;
    this.factionChips.setActive(faction);
    this.rebuildList();
  }

  /** @param query - The new search text. */
  private setQuery(query: string): void {
    this.query = query.slice(0, MAX_QUERY_LENGTH);
    this.searchField.setQuery(this.query);
    this.rebuildList();
  }

  private rebuildList(): void {
    this.codexRows = filterCodex(codexEntries(this.section), {
      faction: this.activeFaction,
      query: this.query,
    });
    this.filteredEntries =
      this.section === "ships"
        ? this.codexRows.map((row) => getEncyclopediaEntry(row.id))
        : [];
    const label = CODEX_SECTIONS.find((s) => s.id === this.section)!.label;
    this.shipList.setEntries(
      this.codexRows,
      factionAccent(this.activeFaction ?? undefined),
      label,
    );
    this.updateSubtitle(label);
    const first = this.codexRows[0];
    if (first) this.select(first.id);
    else this.textPanel.hide();
  }

  private updateSubtitle(label: string): void {
    const scope = this.activeFaction
      ? snakeToLabel(this.activeFaction)
      : "ALL FACTIONS";
    const search = this.query ? `  ·  “${this.query}”` : "";
    this.header.subtitle?.setText(
      `${this.codexRows.length} ${label.toLowerCase()}  ·  ${scope}${search}`,
    );
  }

  /** @param id - A row of the current section. */
  private select(id: string): void {
    if (this.section === "ships") this.showDetail(id);
    else this.showEntry(id);
  }

  private showDetail(shipId: string): void {
    this.selectedId = shipId;
    this.textPanel.hide();
    this.detailPanel.show(getEncyclopediaEntry(shipId));
    this.shipList.setSelected(shipId);
  }

  /** @param id - A pilot, upgrade or faction entry of the current section. */
  private showEntry(id: string): void {
    const entry = this.codexRows.find((row) => row.id === id);
    if (!entry) return;
    this.selectedId = id;
    this.textPanel.show(entry);
    this.shipList.setSelected(id);
  }

  /**
   * Move the selection up or down the filtered list.
   *
   * @param step - -1 for previous, +1 for next.
   */
  private stepSelection(step: number): void {
    const count = this.codexRows.length;
    if (count === 0) return;
    const current = this.codexRows.findIndex((e) => e.id === this.selectedId);
    const next = Phaser.Math.Clamp(current + step, 0, count - 1);
    const entry = this.codexRows[next];
    if (entry && next !== current) this.select(entry.id);
  }

  /** @param step - -1 for the previous section, +1 for the next. */
  private stepSection(step: number): void {
    const index = CODEX_SECTIONS.findIndex((s) => s.id === this.section);
    const next = Phaser.Math.Wrap(index + step, 0, CODEX_SECTIONS.length);
    this.setSection(CODEX_SECTIONS[next]!.id);
  }

  /** @param event - A key press: typed characters edit the search. */
  private onTyped(event: KeyboardEvent): void {
    // Phaser can re-emit queued native events across scene steps.
    if (this.typedEvents.has(event)) return;
    this.typedEvents.add(event);
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Backspace") this.setQuery(this.query.slice(0, -1));
    else if (event.key === "Delete") this.setQuery("");
    else if (SEARCH_CHAR.test(event.key)) this.setQuery(this.query + event.key);
  }

  private setupInput(): void {
    const keyboard = this.input.keyboard!;
    bindMenuBack(this, () => this.returnToMenu());
    let lastStepEvent: KeyboardEvent | null = null;
    const once =
      (action: () => void) =>
      (event: KeyboardEvent): void => {
        // Phaser can re-emit one queued native event across scene steps.
        if (event === lastStepEvent) return;
        lastStepEvent = event;
        action();
      };
    keyboard.on(
      "keydown-UP",
      once(() => this.stepSelection(-1)),
    );
    keyboard.on(
      "keydown-DOWN",
      once(() => this.stepSelection(1)),
    );
    keyboard.on(
      "keydown-LEFT",
      once(() => this.stepSection(-1)),
    );
    keyboard.on(
      "keydown-RIGHT",
      once(() => this.stepSection(1)),
    );
    keyboard.on("keydown", (event: KeyboardEvent) => this.onTyped(event));
    this.input.on(
      "wheel",
      (_p: unknown, _go: unknown, _dx: unknown, dy: number) => {
        this.shipList.scrollBy(dy * ENCYCLOPEDIA_LAYOUT.wheelScale);
      },
    );
  }
}
