/**
 * TeamPanel — renders all teams and their squad cards side-by-side.
 * Emits: 'squadChanged' | 'editShips' {teamIdx,squadIdx} | 'addSquad' teamIdx |
 *        'removeSquad' {teamIdx,squadIdx} | 'addTeam' | 'removeTeam' teamIdx
 */

import Phaser from 'phaser';
import type { TeamEntry, SquadEntry, GameMode } from '../../core/squadTypes';
import { makeSquad, MULTI_TEAM_MODES } from '../../core/squadTypes';
import { SquadCard, CARD_W, CARD_H_COLLAPSED } from './SquadCard';
import { getShipsByFaction } from '../../data/ShipDefinitions';

const PANEL_X = 320;
const PANEL_Y = 68;
const TEAM_HEADER_H = 28;
const TEAM_GAP = 14;
const CARD_GAP = 10;
const ADD_BTN_W = 70;
const MAX_SQUADS_PER_TEAM = 4;
const MAX_TEAMS = 4;

export interface TeamPanelConfig {
  readonly teams: TeamEntry[];
  readonly gameMode: GameMode;
  readonly pointLimit: number;
  readonly sceneWidth: number;
}

export class TeamPanel extends Phaser.Events.EventEmitter {
  private readonly scene: Phaser.Scene;
  private config: TeamPanelConfig;
  private cards: SquadCard[] = [];
  private container!: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, config: TeamPanelConfig) {
    super();
    this.scene = scene;
    this.config = config;
  }

  /** Re-render all teams using the current config */
  render(): void {
    this.cards.forEach((c) => c.destroy());
    this.cards = [];
    this.container?.destroy();
    this.container = this.scene.add.container(0, 0);
    let y = PANEL_Y;
    this.config.teams.forEach((team, teamIdx) => {
      y = this.renderTeam(team, teamIdx, y) + TEAM_GAP;
    });
    if (this.config.teams.length < MAX_TEAMS && this.isMultiMode()) {
      this.renderAddTeamButton(y);
    }
  }

  /** Update config and re-render */
  update(patch: Partial<TeamPanelConfig>): void {
    this.config = { ...this.config, ...patch };
    this.render();
  }

  destroy(): void {
    this.cards.forEach((c) => c.destroy());
    this.container?.destroy();
    super.destroy();
  }

  private isMultiMode(): boolean {
    return MULTI_TEAM_MODES.includes(this.config.gameMode);
  }

  private renderTeam(team: TeamEntry, teamIdx: number, startY: number): number {
    const rowH = TEAM_HEADER_H + CARD_H_COLLAPSED + 16;
    this.drawTeamBg(startY, rowH, team.color);
    this.drawTeamHeader(team, teamIdx, startY);
    let cardX = PANEL_X + 10;
    team.squads.forEach((squad, squadIdx) => {
      this.renderCard(squad, team, teamIdx, squadIdx, cardX, startY + TEAM_HEADER_H + 6);
      cardX += CARD_W + CARD_GAP;
    });
    if (team.squads.length < MAX_SQUADS_PER_TEAM && this.isMultiMode()) {
      this.drawAddSquadButton(cardX, startY + TEAM_HEADER_H + 6, teamIdx);
    }
    return startY + rowH;
  }

  private drawTeamBg(y: number, h: number, color: number): void {
    const g = this.scene.add.graphics();
    const w = this.config.sceneWidth - PANEL_X - 12;
    g.fillStyle(color, 0.05);
    g.fillRoundedRect(PANEL_X, y, w, h, 6);
    g.lineStyle(1, color, 0.22);
    g.strokeRoundedRect(PANEL_X, y, w, h, 6);
    this.container.add(g);
  }

  private drawTeamHeader(team: TeamEntry, teamIdx: number, y: number): void {
    const hexCol = `#${team.color.toString(16).padStart(6, '0')}`;
    const label = this.scene.add.text(PANEL_X + 12, y + 6, `TEAM ${team.label}`, {
      font: 'bold 12px Arial', color: hexCol,
    });
    this.container.add(label);
    if (this.config.teams.length > 2 && this.isMultiMode()) {
      const removeBtn = this.scene.add.text(
        this.config.sceneWidth - 28, y + 6, '✕',
        { font: '13px Arial', color: '#664444' },
      ).setInteractive({ useHandCursor: true });
      removeBtn.on('pointerdown', () => this.emit('removeTeam', teamIdx));
      this.container.add(removeBtn);
    }
  }

  private renderCard(
    squad: SquadEntry,
    team: TeamEntry,
    teamIdx: number,
    squadIdx: number,
    x: number,
    y: number,
  ): void {
    const removable = team.squads.length > 1;
    const card = new SquadCard(this.scene, squad, this.config.pointLimit, removable);
    card.render(x, y);
    card.on('changed', () => this.emit('squadChanged'));
    card.on('factionChanged', () => {
      this.autoFill(squad);
      this.emit('squadChanged');
    });
    card.on('autoFill', () => { this.autoFill(squad); this.emit('squadChanged'); });
    card.on('editShips', () => this.emit('editShips', { teamIdx, squadIdx }));
    card.on('remove', () => this.emit('removeSquad', { teamIdx, squadIdx }));
    this.cards.push(card);
  }

  private autoFill(squad: SquadEntry): void {
    if (!squad.factionId) return;
    const ships = getShipsByFaction(squad.factionId)
      .filter((s) => this.config.gameMode === 'epic' || s.baseStats.size !== 'huge')
      .sort((a, b) => b.baseStats.pointCost - a.baseStats.pointCost);
    squad.ships = [];
    squad.pointsUsed = 0;
    for (const ship of ships) {
      if (squad.ships.length >= 6) break;
      if (squad.pointsUsed + ship.baseStats.pointCost > this.config.pointLimit) continue;
      squad.ships.push(ship.id);
      squad.pointsUsed += ship.baseStats.pointCost;
    }
  }

  private drawAddSquadButton(x: number, y: number, teamIdx: number): void {
    const h = CARD_H_COLLAPSED;
    const btn = this.scene.add.container(x, y);
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x141a25, 0.9);
    bg.fillRoundedRect(0, 0, ADD_BTN_W, h, 6);
    bg.lineStyle(1, 0x22334a, 0.9);
    bg.strokeRoundedRect(0, 0, ADD_BTN_W, h, 6);
    btn.add([
      bg,
      this.scene.add.text(ADD_BTN_W / 2, h / 2, '+ Squad',
        { font: '11px Arial', color: '#334466' }).setOrigin(0.5),
    ]);
    btn.setInteractive(new Phaser.Geom.Rectangle(0, 0, ADD_BTN_W, h), Phaser.Geom.Rectangle.Contains);
    btn.on('pointerover', () => { bg.lineStyle(1, 0x3a5588, 1); bg.strokeRoundedRect(0, 0, ADD_BTN_W, h, 6); });
    btn.on('pointerdown', () => this.emit('addSquad', teamIdx));
    this.container.add(btn);
  }

  private renderAddTeamButton(y: number): void {
    const btn = this.scene.add.container(PANEL_X + 10, y);
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x141a25, 0.9);
    bg.fillRoundedRect(0, 0, 130, 34, 6);
    bg.lineStyle(1, 0x22334a, 0.9);
    bg.strokeRoundedRect(0, 0, 130, 34, 6);
    btn.add([
      bg,
      this.scene.add.text(65, 17, '+ Add Team',
        { font: 'bold 12px Arial', color: '#335577' }).setOrigin(0.5),
    ]);
    btn.setInteractive(new Phaser.Geom.Rectangle(0, 0, 130, 34), Phaser.Geom.Rectangle.Contains);
    btn.on('pointerdown', () => this.emit('addTeam'));
    this.container.add(btn);
  }

  /** Expose autoFill so the scene can call it on all squads */
  autoFillAll(): void {
    this.config.teams.forEach((team) => team.squads.forEach((s) => this.autoFill(s)));
  }

  /** Return a new squad entry, auto-filled for the given team index */
  buildNewSquad(teamIdx: number, squadIndex: number): SquadEntry {
    const squad = makeSquad(teamIdx * 2 + squadIndex, 'ai');
    this.autoFill(squad);
    return squad;
  }
}
