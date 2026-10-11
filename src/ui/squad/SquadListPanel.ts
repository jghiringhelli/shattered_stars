/**
 * SquadListPanel — renders squad cards grouped by team.
 * The battle format (1v1, 2v2, FFA, etc.) is derived automatically
 * from squad–team assignments. Each team occupies its own lane.
 *
 * Emits: 'squadChanged' | 'editShips' {squadIdx} | 'teamChanged' {squadIdx, teamId} |
 *        'addSquad' teamId | 'addTeam' | 'removeSquad' {squadIdx} | 'removeTeam' teamId
 */

import Phaser from "phaser";
import type { SquadEntry, GameMode } from "../../core/squadTypes";
import {
  autoFillSquad,
  makeSquad,
  MULTI_TEAM_MODES,
  computeFormatLabel,
} from "../../core/squadTypes";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { SquadCard } from "./SquadCard";
import { CARD_W, squadCardHeight } from "./squadCardLayout";
import {
  LIST_LAYOUT,
  createAddSquadTile,
  createAddTeamButton,
  createRemoveTeamLink,
  createTeamLane,
  drawListScrollbar,
} from "./squadListParts";
import { SQUAD_TYPE, addSquadText } from "./squadBuilderStyle";

const MAX_TEAMS = 4;
export const MAX_SQUADS = 8;

/** Configuration for {@link SquadListPanel}. */
export interface SquadListPanelConfig {
  readonly squads: SquadEntry[];
  readonly gameMode: GameMode;
  readonly pointLimit: number;
  readonly sceneWidth: number;
}

/** Scrollable, team-grouped list of squad cards. */
export class SquadListPanel extends Phaser.Events.EventEmitter {
  private readonly scene: Phaser.Scene;
  private config: SquadListPanelConfig;
  private cards: SquadCard[] = [];
  private container!: Phaser.GameObjects.Container;
  private clipMask!: Phaser.GameObjects.Graphics;
  /** Pixels scrolled downward; applied as negative container Y offset. */
  private scrollY = 0;
  /** Total rendered height of the panel content, updated on each render(). */
  private contentH = 0;
  /** Scrollbar track + thumb — lives outside the container so it stays fixed. */
  private scrollbarGraphics: Phaser.GameObjects.Graphics | null = null;
  private readonly onWheel = (
    _pointer: unknown,
    _objects: unknown,
    _dx: number,
    dy: number,
  ): void => this.scrollBy(dy * LIST_LAYOUT.wheelFactor);

  /**
   * @param scene - Owning scene.
   * @param config - Squads (shared, mutated by cards), mode, limit and width.
   */
  constructor(scene: Phaser.Scene, config: SquadListPanelConfig) {
    super();
    this.scene = scene;
    this.config = config;
    this.scene.input.on("wheel", this.onWheel);
  }

  /** Render or re-render the entire panel */
  render(): void {
    this.cards.forEach((c) => c.destroy());
    this.cards = [];
    this.container?.destroy();
    this.container = this.scene.add.container(0, -this.scrollY);
    this.drawFormatLabel();
    let y: number = LIST_LAYOUT.rowStartY;
    for (const teamId of this.sortedTeamIds()) {
      y = this.drawTeamSection(teamId, y) + LIST_LAYOUT.laneGap;
    }
    if (this.isMultiMode() && this.sortedTeamIds().length < MAX_TEAMS) {
      this.container.add(
        createAddTeamButton(this.scene, LIST_LAYOUT.x, y, () =>
          this.emit("addTeam"),
        ),
      );
      y += LIST_LAYOUT.addTeamRowH;
    }
    this.contentH = y - LIST_LAYOUT.rowStartY;
    this.applyClipMask();
    this.drawScrollbar();
  }

  /**
   * Update config and re-render.
   *
   * @param patch - Fields to replace.
   */
  update(patch: Partial<SquadListPanelConfig>): void {
    this.config = { ...this.config, ...patch };
    this.render();
  }

  /** Destroy display objects and the wheel listener. */
  destroy(): void {
    this.scene.input?.off("wheel", this.onWheel);
    this.cards.forEach((c) => c.destroy());
    this.container?.destroy();
    this.clipMask?.destroy();
    this.scrollbarGraphics?.destroy();
    super.destroy();
  }

  /** Auto-fill ships for all squads up to the point limit */
  autoFillAll(): void {
    this.config.squads.forEach((s) => this.autoFill(s));
  }

  /**
   * Create and auto-fill a new squad for the given teamId.
   *
   * @param teamId - Team number 1–4.
   * @param index - Squad index (drives the default faction).
   * @returns The new squad (not yet added to the list).
   */
  buildNewSquad(teamId: number, index: number): SquadEntry {
    const squad = makeSquad(teamId, index, "ai");
    this.autoFill(squad);
    return squad;
  }

  private get visibleH(): number {
    const { clipTop, clipBottomMargin } = LIST_LAYOUT;
    return this.scene.scale.height - clipTop - clipBottomMargin;
  }

  private get maxScroll(): number {
    const { rowStartY, clipTop } = LIST_LAYOUT;
    return Math.max(0, this.contentH - this.visibleH + rowStartY - clipTop);
  }

  private scrollBy(delta: number): void {
    this.scrollY = Phaser.Math.Clamp(this.scrollY + delta, 0, this.maxScroll);
    if (this.container) this.container.setY(-this.scrollY);
    this.drawScrollbar();
  }

  /** Draw a thin scrollbar on the right edge. Lives outside the container. */
  private drawScrollbar(): void {
    this.scrollbarGraphics?.destroy();
    this.scrollbarGraphics = null;
    const maxScroll = this.maxScroll;
    if (maxScroll <= 0) return;
    this.scrollbarGraphics = this.scene.add.graphics();
    drawListScrollbar(this.scrollbarGraphics, {
      trackX:
        this.config.sceneWidth -
        LIST_LAYOUT.rightMargin +
        LIST_LAYOUT.scrollbarInset,
      top: LIST_LAYOUT.clipTop,
      visibleH: this.visibleH,
      contentH: this.visibleH + maxScroll,
      scrollY: this.scrollY,
      maxScroll,
    });
  }

  /** Create or refresh the rectangular clip mask for the scroll area. */
  private applyClipMask(): void {
    this.clipMask?.destroy();
    // make.graphics with add:false creates the shape without adding it to the display list
    this.clipMask = this.scene.make.graphics({
      add: false,
    } as Phaser.Types.GameObjects.Graphics.Options);
    this.clipMask.fillStyle(0xffffff);
    this.clipMask.fillRect(
      LIST_LAYOUT.x,
      LIST_LAYOUT.clipTop,
      this.config.sceneWidth - LIST_LAYOUT.x,
      this.visibleH,
    );
    this.container.setMask(
      new Phaser.Display.Masks.GeometryMask(this.scene, this.clipMask),
    );
  }

  private sortedTeamIds(): number[] {
    return [...new Set(this.config.squads.map((s) => s.teamId))].sort(
      (a, b) => a - b,
    );
  }

  private isMultiMode(): boolean {
    return MULTI_TEAM_MODES.includes(this.config.gameMode);
  }

  private get laneRight(): number {
    return this.config.sceneWidth - LIST_LAYOUT.rightMargin;
  }

  private drawFormatLabel(): void {
    const label = computeFormatLabel(this.config.squads);
    this.container.add(
      addSquadText(
        this.scene,
        LIST_LAYOUT.x,
        LIST_LAYOUT.formatLabelY,
        `Format: ${label}`,
        {
          size: SQUAD_TYPE.name,
          weight: "600",
          color: HOLO_PALETTE.textSecondary,
          letterSpacing: 1,
        },
      ),
    );
  }

  private drawTeamSection(teamId: number, startY: number): number {
    const { x, lanePad, laneHeaderH, cardGap } = LIST_LAYOUT;
    const teamSquads = this.config.squads
      .map((squad, idx) => ({ squad, idx }))
      .filter(({ squad }) => squad.teamId === teamId);
    const maxCardH = Math.max(
      ...teamSquads.map(({ squad }) => squadCardHeight(squad)),
      squadCardHeight({ ships: [] }),
    );
    const rowH = laneHeaderH + maxCardH + lanePad;
    const laneRect = { x, y: startY, width: this.laneRight - x, height: rowH };
    this.container.add(createTeamLane(this.scene, laneRect, teamId));
    this.drawRemoveTeam(teamId, startY);
    const cardY = startY + laneHeaderH;
    let cardX = x + lanePad;
    for (const { squad, idx } of teamSquads) {
      this.renderCard(squad, idx, cardX, cardY);
      cardX += CARD_W + cardGap;
    }
    if (this.isMultiMode() && this.config.squads.length < MAX_SQUADS) {
      this.container.add(
        createAddSquadTile(this.scene, cardX, cardY, () =>
          this.emit("addSquad", teamId),
        ),
      );
    }
    return startY + rowH;
  }

  private drawRemoveTeam(teamId: number, laneTop: number): void {
    if (this.sortedTeamIds().length <= 2 || !this.isMultiMode()) return;
    this.container.add(
      createRemoveTeamLink(
        this.scene,
        this.laneRight - LIST_LAYOUT.lanePad,
        laneTop + LIST_LAYOUT.laneHeaderH / 2,
        () => this.emit("removeTeam", teamId),
      ),
    );
  }

  private renderCard(
    squad: SquadEntry,
    idx: number,
    x: number,
    y: number,
  ): void {
    const card = new SquadCard(this.scene, {
      squad,
      pointLimit: this.config.pointLimit,
    });
    card.render(x, y);
    // Card must live inside the container so it scrolls with team lanes.
    this.container.add(card.cardContainer);
    card.on("changed", () => this.emit("squadChanged"));
    card.on("factionChanged", () => {
      this.autoFill(squad);
      this.emit("squadChanged");
    });
    card.on("autoFill", () => {
      this.autoFill(squad);
      this.emit("squadChanged");
    });
    card.on("editShips", () => this.emit("editShips", { squadIdx: idx }));
    card.on("remove", () => this.emit("removeSquad", { squadIdx: idx }));
    card.on("teamChanged", (teamId: number) =>
      this.emit("teamChanged", { squadIdx: idx, teamId }),
    );
    this.cards.push(card);
  }

  private autoFill(squad: SquadEntry): void {
    autoFillSquad(squad, this.config.gameMode, this.config.pointLimit);
  }
}
