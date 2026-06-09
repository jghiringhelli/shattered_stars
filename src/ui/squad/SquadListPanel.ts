/**
 * SquadListPanel — renders squad cards grouped by team.
 * The battle format (1v1, 2v2, FFA, etc.) is derived automatically
 * from squad–team assignments. Each team occupies its own row.
 *
 * Emits: 'squadChanged' | 'editShips' {squadIdx} | 'teamChanged' {squadIdx, teamId} |
 *        'addSquad' teamId | 'addTeam' | 'removeSquad' {squadIdx} | 'removeTeam' teamId
 */

import Phaser from "phaser";
import type { SquadEntry, GameMode } from "../../core/squadTypes";
import {
  makeSquad,
  MULTI_TEAM_MODES,
  TEAM_COLORS,
  TEAM_LABELS,
  computeFormatLabel,
} from "../../core/squadTypes";
import {
  SquadCard,
  CARD_W,
  CARD_H_COLLAPSED,
  SHIP_ROW_H,
  MAX_SHOWN_SHIPS,
} from "./SquadCard";
import { getShipsByFaction } from "../../data/ShipDefinitions";

const PANEL_X = 320;
const PANEL_Y = 68;
const ROW_START_Y = PANEL_Y + 28;
const TEAM_HEADER_H = 28;
const TEAM_GAP = 14;
const CARD_GAP = 10;
const ADD_BTN_W = 80;
const MAX_TEAMS = 4;
export const MAX_SQUADS = 8;

export interface SquadListPanelConfig {
  readonly squads: SquadEntry[];
  readonly gameMode: GameMode;
  readonly pointLimit: number;
  readonly sceneWidth: number;
}

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

  private readonly CLIP_TOP = PANEL_Y;
  private readonly CLIP_BOTTOM_MARGIN = 70; // above START BATTLE bar

  constructor(scene: Phaser.Scene, config: SquadListPanelConfig) {
    super();
    this.scene = scene;
    this.config = config;
    this.setupScrollInput();
  }

  /** Render or re-render the entire panel */
  render(): void {
    this.cards.forEach((c) => c.destroy());
    this.cards = [];
    this.container?.destroy();
    this.container = this.scene.add.container(0, -this.scrollY);
    this.drawFormatLabel();
    let y = ROW_START_Y;
    for (const teamId of this.sortedTeamIds()) {
      y = this.drawTeamSection(teamId, y) + TEAM_GAP;
    }
    if (this.isMultiMode() && this.sortedTeamIds().length < MAX_TEAMS) {
      this.drawAddTeamButton(y);
      y += 44;
    }
    this.contentH = y - ROW_START_Y;
    this.applyClipMask();
    this.drawScrollbar();
  }

  /** Update config and re-render */
  update(patch: Partial<SquadListPanelConfig>): void {
    this.config = { ...this.config, ...patch };
    this.render();
  }

  destroy(): void {
    this.cards.forEach((c) => c.destroy());
    this.container?.destroy();
    this.clipMask?.destroy();
    this.scrollbarGraphics?.destroy();
    super.destroy();
  }

  /** Draw a thin scrollbar track + thumb on the right edge. Lives outside the container. */
  private drawScrollbar(): void {
    this.scrollbarGraphics?.destroy();
    const visibleH =
      this.scene.scale.height - this.CLIP_TOP - this.CLIP_BOTTOM_MARGIN;
    const maxScroll = Math.max(0, this.contentH - visibleH + ROW_START_Y);
    if (maxScroll <= 0) return;
    const trackX = this.config.sceneWidth - 7;
    const thumbH = Math.max(
      24,
      visibleH * (visibleH / (this.contentH + ROW_START_Y)),
    );
    const thumbY =
      this.CLIP_TOP + (this.scrollY / maxScroll) * (visibleH - thumbH);
    this.scrollbarGraphics = this.scene.add.graphics();
    this.scrollbarGraphics.fillStyle(0x0e1622, 1);
    this.scrollbarGraphics.fillRoundedRect(
      trackX,
      this.CLIP_TOP,
      4,
      visibleH,
      2,
    );
    this.scrollbarGraphics.fillStyle(0x334466, 1);
    this.scrollbarGraphics.fillRoundedRect(trackX, thumbY, 4, thumbH, 2);
  }

  /** Auto-fill ships for all squads up to the point limit */
  autoFillAll(): void {
    this.config.squads.forEach((s) => this.autoFill(s));
  }

  /** Create and auto-fill a new squad for the given teamId */
  buildNewSquad(teamId: number, index: number): SquadEntry {
    const squad = makeSquad(teamId, index, "ai");
    this.autoFill(squad);
    return squad;
  }

  /** Wire mouse-wheel on the scene to scroll this panel. */
  private setupScrollInput(): void {
    this.scene.input.on(
      "wheel",
      (_ptr: unknown, _gos: unknown, _dx: number, dy: number) => {
        const visibleH =
          this.scene.scale.height - this.CLIP_TOP - this.CLIP_BOTTOM_MARGIN;
        const maxScroll = Math.max(0, this.contentH - visibleH + ROW_START_Y);
        this.scrollY = Math.max(
          0,
          Math.min(maxScroll, this.scrollY + dy * 0.8),
        );
        if (this.container) this.container.setY(-this.scrollY);
        this.drawScrollbar();
      },
    );
  }

  /** Create or refresh the rectangular clip mask for the scroll area. */
  private applyClipMask(): void {
    this.clipMask?.destroy();
    const h = this.scene.scale.height - this.CLIP_TOP - this.CLIP_BOTTOM_MARGIN;
    // make.graphics with add:false creates the shape without adding it to the display list
    this.clipMask = this.scene.make.graphics({
      add: false,
    } as Phaser.Types.GameObjects.Graphics.Options);
    this.clipMask.fillStyle(0xffffff);
    this.clipMask.fillRect(
      PANEL_X,
      this.CLIP_TOP,
      this.config.sceneWidth - PANEL_X,
      h,
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

  private drawFormatLabel(): void {
    const label = computeFormatLabel(this.config.squads);
    this.container.add(
      this.scene.add.text(PANEL_X + 10, PANEL_Y + 6, `Format: ${label}`, {
        font: "bold 13px Arial",
        color: "#5577aa",
      }),
    );
  }

  private drawTeamSection(teamId: number, startY: number): number {
    const teamSquads = this.config.squads
      .map((squad, idx) => ({ squad, idx }))
      .filter(({ squad }) => squad.teamId === teamId);
    const maxCardH =
      teamSquads.length > 0
        ? Math.max(
            ...teamSquads.map(({ squad }) => {
              const shown = Math.min(
                Math.max(squad.ships.length, 1),
                MAX_SHOWN_SHIPS,
              );
              return CARD_H_COLLAPSED + 12 + shown * SHIP_ROW_H + 10;
            }),
          )
        : CARD_H_COLLAPSED + 12 + SHIP_ROW_H + 10;
    const rowH = TEAM_HEADER_H + maxCardH + 16;
    this.drawTeamBg(startY, rowH, teamId);
    this.drawTeamHeader(teamId, startY);
    let cardX = PANEL_X + 10;
    for (const { squad, idx } of teamSquads) {
      this.renderCard(squad, idx, cardX, startY + TEAM_HEADER_H + 6);
      cardX += CARD_W + CARD_GAP;
    }
    if (this.isMultiMode() && this.config.squads.length < MAX_SQUADS) {
      this.drawAddSquadButton(cardX, startY + TEAM_HEADER_H + 6, teamId);
    }
    return startY + rowH;
  }

  private drawTeamBg(y: number, h: number, teamId: number): void {
    const color = TEAM_COLORS[teamId - 1] ?? 0x446688;
    const w = this.config.sceneWidth - PANEL_X - 12;
    const g = this.scene.add.graphics();
    g.fillStyle(color, 0.05);
    g.fillRoundedRect(PANEL_X, y, w, h, 6);
    g.lineStyle(1, color, 0.22);
    g.strokeRoundedRect(PANEL_X, y, w, h, 6);
    this.container.add(g);
  }

  private drawTeamHeader(teamId: number, y: number): void {
    const color = TEAM_COLORS[teamId - 1] ?? 0x446688;
    const hexCol = `#${color.toString(16).padStart(6, "0")}`;
    const label = TEAM_LABELS[teamId - 1] ?? `T${teamId}`;
    this.container.add(
      this.scene.add.text(PANEL_X + 12, y + 6, `TEAM ${label}`, {
        font: "bold 12px Arial",
        color: hexCol,
      }),
    );
    if (this.sortedTeamIds().length > 2 && this.isMultiMode()) {
      const rm = this.scene.add
        .text(this.config.sceneWidth - 28, y + 6, "✕ remove team", {
          font: "11px Arial",
          color: "#664444",
        })
        .setInteractive({ useHandCursor: true });
      rm.on("pointerover", () => rm.setColor("#ff6666"));
      rm.on("pointerout", () => rm.setColor("#664444"));
      rm.on("pointerdown", () => this.emit("removeTeam", teamId));
      this.container.add(rm);
    }
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
    // Card must live inside the container so it scrolls with team backgrounds/headers.
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

  private drawAddSquadButton(x: number, y: number, teamId: number): void {
    const h = CARD_H_COLLAPSED;
    const btn = this.scene.add.container(x, y);
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x141a25, 0.9);
    bg.fillRoundedRect(0, 0, ADD_BTN_W, h, 6);
    bg.lineStyle(1, 0x22334a, 0.9);
    bg.strokeRoundedRect(0, 0, ADD_BTN_W, h, 6);
    btn.add([
      bg,
      this.scene.add
        .text(ADD_BTN_W / 2, h / 2, "+ Squad", {
          font: "11px Arial",
          color: "#334466",
        })
        .setOrigin(0.5),
    ]);
    btn.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, ADD_BTN_W, h),
      Phaser.Geom.Rectangle.Contains,
    );
    btn.on("pointerover", () => {
      bg.clear();
      bg.fillStyle(0x1a2535, 0.9);
      bg.fillRoundedRect(0, 0, ADD_BTN_W, h, 6);
      bg.lineStyle(1, 0x3a5588, 1);
      bg.strokeRoundedRect(0, 0, ADD_BTN_W, h, 6);
    });
    btn.on("pointerout", () => {
      bg.clear();
      bg.fillStyle(0x141a25, 0.9);
      bg.fillRoundedRect(0, 0, ADD_BTN_W, h, 6);
      bg.lineStyle(1, 0x22334a, 0.9);
      bg.strokeRoundedRect(0, 0, ADD_BTN_W, h, 6);
    });
    btn.on("pointerdown", () => this.emit("addSquad", teamId));
    this.container.add(btn);
  }

  private drawAddTeamButton(y: number): void {
    const w = 130;
    const h = 34;
    const btn = this.scene.add.container(PANEL_X + 10, y);
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x141a25, 0.9);
    bg.fillRoundedRect(0, 0, w, h, 6);
    bg.lineStyle(1, 0x22334a, 0.9);
    bg.strokeRoundedRect(0, 0, w, h, 6);
    btn.add([
      bg,
      this.scene.add
        .text(w / 2, h / 2, "+ Add Team", {
          font: "bold 12px Arial",
          color: "#335577",
        })
        .setOrigin(0.5),
    ]);
    btn.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, w, h),
      Phaser.Geom.Rectangle.Contains,
    );
    btn.on("pointerdown", () => this.emit("addTeam"));
    this.container.add(btn);
  }

  private autoFill(squad: SquadEntry): void {
    if (!squad.factionId) return;
    const ships = getShipsByFaction(squad.factionId)
      .filter(
        (s) =>
          this.config.gameMode === "epic" ||
          (s.role !== "capital" && s.baseStats.size !== "huge"),
      )
      .sort((a, b) => b.baseStats.pointCost - a.baseStats.pointCost);
    squad.ships = [];
    squad.pointsUsed = 0;
    for (const ship of ships) {
      if (squad.ships.length >= 6) break;
      if (squad.pointsUsed + ship.baseStats.pointCost > this.config.pointLimit)
        continue;
      squad.ships.push(ship.id);
      squad.pointsUsed += ship.baseStats.pointCost;
    }
  }
}
