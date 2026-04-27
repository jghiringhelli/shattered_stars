/**
 * SquadCard — renders one squad slot within a team.
 * Manages faction selection, controller toggle, ship list preview, and edit actions.
 * Emits events: 'changed' | 'factionChanged' | 'autoFill' | 'editShips' | 'remove'
 */

import Phaser from 'phaser';
import type { SquadEntry } from '../../core/squadTypes';
import { FACTION_COLORS } from '../../config';
import type { FactionId } from '../../config';
import { SHIP_DEFINITIONS } from '../../data/ShipDefinitions';
import { getShipLoadouts } from '../../data/ShipLoadouts';

export const CARD_W = 260;
export const CARD_H_COLLAPSED = 90;
const ACTION_Y = 60;
const BTN_W = 50;
const BTN_H = 22;
const SHIP_ROW_H = 26;
const DIVIDER_Y = CARD_H_COLLAPSED + 4;

const FACTION_IDS: FactionId[] = [
  'terran_hegemony', 'free_confederation', 'synthetic_collective',
  'void_corsairs', 'ascendant_empire',
];
const FACTION_SHORT: Record<FactionId, string> = {
  terran_hegemony: 'Terran', free_confederation: 'Confed',
  synthetic_collective: 'Synth', void_corsairs: 'Corsairs',
  ascendant_empire: 'Ascendant',
};
const FACTION_FULL: Record<FactionId, string> = {
  terran_hegemony: 'Terran Hegemony', free_confederation: 'Free Confederation',
  synthetic_collective: 'Synthetic Collective', void_corsairs: 'Void Corsairs',
  ascendant_empire: 'Ascendant Empire',
};

export class SquadCard extends Phaser.Events.EventEmitter {
  private readonly scene: Phaser.Scene;
  private readonly squad: SquadEntry;
  private readonly pointLimit: number;
  private readonly removable: boolean;
  private expanded = false;
  private container!: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    squad: SquadEntry,
    pointLimit: number,
    removable: boolean,
  ) {
    super();
    this.scene = scene;
    this.squad = squad;
    this.pointLimit = pointLimit;
    this.removable = removable;
  }

  /** Height including expansion */
  get height(): number {
    if (!this.expanded) return CARD_H_COLLAPSED;
    return CARD_H_COLLAPSED + 12 + Math.max(1, this.squad.ships.length) * SHIP_ROW_H + 10;
  }

  /** Render or re-render at position */
  render(x: number, y: number): void {
    this.container?.destroy();
    this.container = this.scene.add.container(x, y);
    this.drawBackground();
    this.drawHeader();
    this.drawActionRow();
    if (this.expanded) this.drawShipList();
  }

  destroy(): void {
    this.container?.destroy();
    super.destroy();
  }

  private drawBackground(): void {
    const h = this.height;
    const fCol = this.squad.factionId ? FACTION_COLORS[this.squad.factionId] : 0x334455;
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x11161f, 0.97);
    bg.fillRoundedRect(0, 0, CARD_W, h, 6);
    bg.lineStyle(2, fCol, 0.65);
    bg.strokeRoundedRect(0, 0, CARD_W, h, 6);
    // Clickable header strip for expand/collapse
    const strip = this.scene.add.rectangle(CARD_W / 2, 12, CARD_W - 4, 22, fCol, 0.06)
      .setInteractive({ useHandCursor: true });
    strip.on('pointerdown', () => { this.expanded = !this.expanded; this.emit('changed'); });
    this.container.add([bg, strip]);
  }

  private drawHeader(): void {
    const fCol = this.squad.factionId ? FACTION_COLORS[this.squad.factionId] : 0x334455;
    const hexCol = `#${fCol.toString(16).padStart(6, '0')}`;
    const name = this.squad.factionId ? FACTION_FULL[this.squad.factionId] : 'Select Faction';
    this.container.add(this.scene.add.text(10, 5, name, { font: 'bold 13px Arial', color: hexCol }));
    const over = this.squad.pointsUsed > this.pointLimit;
    this.container.add(this.scene.add.text(CARD_W - 8, 5,
      `${this.squad.pointsUsed}/${this.pointLimit}pt`,
      { font: '11px Arial', color: over ? '#ff5544' : '#44ff88' }).setOrigin(1, 0));
    this.container.add(this.scene.add.text(10, 22,
      `${this.squad.ships.length} ship${this.squad.ships.length !== 1 ? 's' : ''}`,
      { font: '11px Arial', color: '#445566' }));
    this.container.add(this.scene.add.text(CARD_W - 8, 22,
      this.expanded ? '▲' : '▼', { font: '10px Arial', color: '#445566' }).setOrigin(1, 0));
    if (this.removable) {
      this.container.add(this.makeBtn(CARD_W - 26, 38, '✕', '#774444', () => this.emit('remove')));
    }
  }

  private drawActionRow(): void {
    const ctrlColor = this.squad.controller === 'player' ? '#44ee88' : '#ee8844';
    const fLabel = this.squad.factionId ? FACTION_SHORT[this.squad.factionId] : 'Faction';
    this.container.add(this.makeBtn(6,   ACTION_Y, fLabel,    '#99aacc', () => this.cycleFaction()));
    this.container.add(this.makeBtn(60,  ACTION_Y, this.squad.controller === 'player' ? 'Player' : 'AI',
      ctrlColor, () => this.toggleController()));
    this.container.add(this.makeBtn(130, ACTION_Y, 'Auto',    '#8899aa', () => this.emit('autoFill')));
    this.container.add(this.makeBtn(184, ACTION_Y, 'Edit ✎',  '#5588bb', () => this.emit('editShips')));
  }

  private drawShipList(): void {
    const divider = this.scene.add.graphics();
    divider.lineStyle(1, 0x1e2a38, 1);
    divider.lineBetween(8, DIVIDER_Y, CARD_W - 8, DIVIDER_Y);
    this.container.add(divider);
    if (this.squad.ships.length === 0) {
      this.container.add(this.scene.add.text(14, DIVIDER_Y + 8,
        'No ships — click Edit ✎ to add', { font: '10px Arial', color: '#334455' }));
      return;
    }
    this.squad.ships.forEach((shipId, i) => this.drawShipRow(shipId, i));
  }

  private drawShipRow(shipId: string, index: number): void {
    const def = SHIP_DEFINITIONS[shipId];
    if (!def) return;
    const y = DIVIDER_Y + 8 + index * SHIP_ROW_H;
    const loadoutId = this.squad.loadoutChoices[shipId];
    const loadout = loadoutId ? getShipLoadouts(shipId).find((l) => l.id === loadoutId) : null;
    const pts = loadout?.pointCost ?? def.baseStats.pointCost;
    const sub = loadout ? loadout.name.slice(0, 22) : def.role.replace(/_/g, ' ');
    this.container.add(this.scene.add.text(14, y, def.name, { font: '11px Arial', color: '#bbccdd' }));
    this.container.add(this.scene.add.text(CARD_W - 8, y, `${pts}pt`,
      { font: '10px Arial', color: '#445566' }).setOrigin(1, 0));
    this.container.add(this.scene.add.text(14, y + 13, sub,
      { font: '9px Arial', color: '#334455' }));
  }

  private cycleFaction(): void {
    const idx = this.squad.factionId ? FACTION_IDS.indexOf(this.squad.factionId) : -1;
    this.squad.factionId = FACTION_IDS[(idx + 1) % FACTION_IDS.length] as FactionId;
    this.emit('factionChanged');
  }

  private toggleController(): void {
    this.squad.controller = this.squad.controller === 'player' ? 'ai' : 'player';
    this.emit('changed');
  }

  private makeBtn(
    x: number, y: number, label: string, color: string, onClick: () => void,
  ): Phaser.GameObjects.Container {
    const c = this.scene.add.container(x, y);
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a2030, 1);
    bg.fillRoundedRect(0, 0, BTN_W, BTN_H, 3);
    const txt = this.scene.add.text(BTN_W / 2, BTN_H / 2, label,
      { font: '10px Arial', color }).setOrigin(0.5);
    c.add([bg, txt]);
    c.setInteractive(new Phaser.Geom.Rectangle(0, 0, BTN_W, BTN_H), Phaser.Geom.Rectangle.Contains);
    c.on('pointerover', () => { bg.clear(); bg.fillStyle(0x28374a, 1); bg.fillRoundedRect(0, 0, BTN_W, BTN_H, 3); });
    c.on('pointerout',  () => { bg.clear(); bg.fillStyle(0x1a2030, 1); bg.fillRoundedRect(0, 0, BTN_W, BTN_H, 3); });
    c.on('pointerdown', onClick);
    return c;
  }
}
