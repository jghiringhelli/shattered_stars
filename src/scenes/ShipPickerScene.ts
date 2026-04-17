/**
 * ShipPickerScene — split-panel ship picker.
 * Left = ship list for the faction; right = detail panel with stats and loadout cards.
 * Clicking a loadout card selects that ship at the loadout's point cost.
 */

import Phaser from 'phaser';
import { getShipsByFaction, getShipDefinition } from '../data/ShipDefinitions';
import type { ShipDefinition } from '../core/types';
import { getEncyclopediaEntry } from '../data/ShipEncyclopedia';
import { getShipLoadouts, type ShipLoadout } from '../data/ShipLoadouts';
import { FACTION_COLORS } from '../config';
import type { FactionId } from '../config';

const LIST_X = 60;
const LIST_W = 500;
const DETAIL_X = 580;
const DETAIL_W = 620;
const TOP_Y = 98;
const PANEL_H = 570;
const ROW_H = 50;
const COLS = 2;
const COL_W = LIST_W / COLS;

interface PickerConfig {
  slotIndex: number;
  factionId: FactionId;
  selectedShips: string[];
  pointLimit: number;
}

export class ShipPickerScene extends Phaser.Scene {
  private config!: PickerConfig;
  private ships: ShipDefinition[] = [];
  /** shipId → selected loadout (or null = base) */
  private selectedLoadouts = new Map<string, ShipLoadout | null>();
  private rowBgs = new Map<string, Phaser.GameObjects.Graphics>();
  private pointsText!: Phaser.GameObjects.Text;
  private detailContainer!: Phaser.GameObjects.Container;
  private focusedShipId: string | null = null;

  constructor() { super({ key: 'ShipPickerScene' }); }

  init(data: PickerConfig): void {
    this.config = data;
    this.selectedLoadouts.clear();
    for (const id of data.selectedShips) this.selectedLoadouts.set(id, null);
  }

  create(): void {
    const { width: w, height: h } = this.scale;
    const fCol = FACTION_COLORS[this.config.factionId];
    this.ships = getShipsByFaction(this.config.factionId).filter(
      (s) => s.baseStats.size !== 'huge',
    );

    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x000000, 0.86);
    backdrop.fillRect(0, 0, w, h);

    this.drawPanelBorder(LIST_X, fCol );
    this.drawPanelBorder(DETAIL_X, fCol);

    const faction = this.ships[0]?.faction.replace(/_/g, ' ').toUpperCase() ?? '';
    this.add.text(w / 2, 68, `SELECT SHIPS — ${faction}`, {
      font: 'bold 18px Arial', color: '#aaccee',
    }).setOrigin(0.5);

    this.pointsText = this.add.text(DETAIL_X + DETAIL_W - 12, 68, '', {
      font: 'bold 14px Arial', color: '#44ff88',
    }).setOrigin(1, 0.5);
    this.updatePointsText();

    this.buildShipList();
    this.detailContainer = this.add.container(0, 0);
    this.addActionButtons(w / 2, h - 38);

    this.input.keyboard!.on('keydown-ESC', () => this.finish());
  }

  private drawPanelBorder(px: number, color: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x0d1525, 1);
    g.fillRoundedRect(px, TOP_Y, px === LIST_X ? LIST_W : DETAIL_W, PANEL_H, 10);
    g.lineStyle(2, color, 0.7);
    g.strokeRoundedRect(px, TOP_Y, px === LIST_X ? LIST_W : DETAIL_W, PANEL_H, 10);
  }

  private buildShipList(): void {
    this.ships.forEach((def, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = LIST_X + col * COL_W + 6;
      const cy = TOP_Y + 8 + row * (ROW_H + 4);
      this.createShipRow(def, cx, cy);
    });
  }

  private createShipRow(def: ShipDefinition, cx: number, cy: number): void {
    const bg = this.add.graphics();
    this.rowBgs.set(def.id, bg);
    this.drawRow(def.id);

    this.add.text(cx + 6, cy + 6, def.name, { font: 'bold 12px Arial', color: '#ddeeff' });
    this.add.text(cx + 6, cy + 24, def.role.replace(/_/g, ' '), { font: '10px Arial', color: '#6677aa' });
    this.add.text(cx + COL_W - 14, cy + 6, `${def.baseStats.pointCost}pt`, {
      font: '10px Arial', color: '#888899',
    }).setOrigin(1, 0);

    const hit = this.add.rectangle(cx + COL_W / 2 - 6, cy + ROW_H / 2, COL_W - 12, ROW_H, 0, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.focusShip(def));
  }

  private drawRow(shipId: string): void {
    const bg = this.rowBgs.get(shipId);
    if (!bg) return;
    const i = this.ships.findIndex((s) => s.id === shipId);
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cx = LIST_X + col * COL_W + 6;
    const cy = TOP_Y + 8 + row * (ROW_H + 4);
    const isSel = this.selectedLoadouts.has(shipId);
    const isFocused = this.focusedShipId === shipId;
    bg.clear();
    bg.fillStyle(isSel ? 0x0f2a1a : isFocused ? 0x151e30 : 0x11151e, 1);
    bg.fillRoundedRect(cx, cy, COL_W - 12, ROW_H, 5);
    bg.lineStyle(2, isSel ? 0x44ff88 : isFocused ? 0x5588cc : 0x1e2a3a, 1);
    bg.strokeRoundedRect(cx, cy, COL_W - 12, ROW_H, 5);
  }

  private focusShip(def: ShipDefinition): void {
    const prev = this.focusedShipId;
    this.focusedShipId = def.id;
    if (prev) this.drawRow(prev);
    this.drawRow(def.id);
    this.renderDetail(def);
  }

  private renderDetail(def: ShipDefinition): void {
    this.detailContainer.removeAll(true);
    const entry = getEncyclopediaEntry(def.id);
    const fCol = FACTION_COLORS[def.faction as FactionId] ?? 0x4488cc;
    const x = DETAIL_X + 14;
    let y = TOP_Y + 14;

    const nameText = this.add.text(x, y, def.name, { font: 'bold 16px Arial', color: '#ffffff' });
    const sizeText = this.add.text(DETAIL_X + DETAIL_W - 16, y + 2, def.baseStats.size.toUpperCase(),
      { font: '11px Arial', color: '#667799' }).setOrigin(1, 0);
    this.detailContainer.add([nameText, sizeText]);
    y += 24;

    const roleBg = this.add.graphics();
    roleBg.fillStyle(0x4488cc, 0.85);
    roleBg.fillRoundedRect(x, y, 110, 16, 4);
    const roleText = this.add.text(x + 55, y + 8, def.role.replace(/_/g, ' ').toUpperCase(),
      { font: '9px Arial', color: '#fff' }).setOrigin(0.5);
    this.detailContainer.add([roleBg, roleText]);
    y += 26;

    const stats = [
      { label: 'ATK', value: def.baseStats.attack, color: '#ff6666' },
      { label: 'AGI', value: def.baseStats.agility, color: '#44ffaa' },
      { label: 'HUL', value: def.baseStats.hull, color: '#66ccff' },
      { label: 'SHD', value: def.baseStats.shields, color: '#4488ff' },
      { label: 'SPD', value: def.baseStats.speed.max, color: '#ffcc44' },
    ];
    const barW = 80; const step = (DETAIL_W - 28) / stats.length;
    stats.forEach((s, idx) => {
      const sx = x + idx * step;
      const lbl = this.add.text(sx, y, s.label, { font: 'bold 10px Arial', color: s.color });
      const val = this.add.text(sx + barW * 0.5, y + 14, String(s.value),
        { font: 'bold 13px Arial', color: '#ffffff' }).setOrigin(0.5, 0);
      const bar = this.add.graphics();
      bar.fillStyle(parseInt(s.color.replace('#', ''), 16), 0.2);
      bar.fillRect(sx, y + 12, barW - 4, 18);
      bar.fillStyle(parseInt(s.color.replace('#', ''), 16), 0.7);
      bar.fillRect(sx, y + 12, Math.max(4, (s.value / 8) * (barW - 4)), 18);
      this.detailContainer.add([lbl, bar, val]);
    });
    y += 42;

    const loreText = this.add.text(x, y, entry?.lore?.slice(0, 130) ?? '', {
      font: '11px Arial', color: '#889aaa', wordWrap: { width: DETAIL_W - 28 },
    });
    this.detailContainer.add(loreText);
    y += Math.min(50, (loreText.height || 0) + 10);

    const divider = this.add.graphics();
    divider.lineStyle(1, fCol, 0.4);
    divider.lineBetween(x, y, DETAIL_X + DETAIL_W - 14, y);
    this.detailContainer.add(divider);
    y += 10;

    const loadouts = getShipLoadouts(def.id);
    if (loadouts.length > 0) {
      this.detailContainer.add(this.add.text(x, y, 'LOADOUTS', { font: 'bold 10px Arial', color: '#8899aa' }));
      y += 18;
      loadouts.forEach((ld) => this.renderLoadoutCard(def, ld, x, y, (ny) => { y = ny; }));
    } else {
      const isSel = this.selectedLoadouts.has(def.id);
      const selT = this.add.text(x, y, isSel ? '[ REMOVE SHIP ]' : '[ SELECT SHIP ]',
        { font: 'bold 13px Arial', color: isSel ? '#88ee88' : '#aaccff' }).setInteractive({ useHandCursor: true });
      selT.on('pointerdown', () => {
        if (isSel) { this.selectedLoadouts.delete(def.id); } else { this.selectedLoadouts.set(def.id, null); }
        this.drawRow(def.id); this.updatePointsText(); this.renderDetail(def);
      });
      this.detailContainer.add(selT);
    }
  }

  private renderLoadoutCard(
    def: ShipDefinition,
    ld: ShipLoadout,
    x: number,
    startY: number,
    advance: (y: number) => void,
  ): void {
    const cardH = 52;
    const cardW = DETAIL_W - 28;
    const isSelected = this.selectedLoadouts.get(def.id)?.id === ld.id;
    const bg = this.add.graphics();
    bg.fillStyle(isSelected ? 0x0f2a1a : 0x141e2a, 1);
    bg.fillRoundedRect(x, startY, cardW, cardH, 6);
    bg.lineStyle(2, isSelected ? 0x44ff88 : 0x2a3a4a, 1);
    bg.strokeRoundedRect(x, startY, cardW, cardH, 6);

    const nameT = this.add.text(x + 8, startY + 6, ld.name, { font: 'bold 12px Arial', color: '#ddeeff' });
    const descT = this.add.text(x + 8, startY + 24, ld.description.slice(0, 55),
      { font: '10px Arial', color: '#6677aa' });
    const ptT = this.add.text(x + cardW - 8, startY + 6, `${ld.pointCost}pts`,
      { font: 'bold 12px Arial', color: '#44ff88' }).setOrigin(1, 0);

    const hit = this.add.rectangle(x + cardW / 2, startY + cardH / 2, cardW, cardH, 0, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.selectLoadout(def, ld));
    this.detailContainer.add([bg, nameT, descT, ptT, hit]);
    advance(startY + cardH + 6);
  }

  private selectLoadout(def: ShipDefinition, ld: ShipLoadout): void {
    this.selectedLoadouts.set(def.id, ld);
    this.drawRow(def.id);
    this.updatePointsText();
    this.renderDetail(def);
  }

  private updatePointsText(): void {
    let total = 0;
    for (const [shipId, loadout] of this.selectedLoadouts) {
      const def = getShipDefinition(shipId);
      total += loadout?.pointCost ?? def?.baseStats.pointCost ?? 0;
    }
    const over = total > this.config.pointLimit;
    this.pointsText.setText(`${total} / ${this.config.pointLimit} pts`);
    this.pointsText.setColor(over ? '#ff4444' : '#44ff88');
  }

  private addActionButtons(cx: number, cy: number): void {
    const doneBtn = this.add.container(cx + 90, cy);
    const doneBg = this.add.graphics();
    doneBg.fillStyle(0x1a3a1a, 1); doneBg.fillRoundedRect(-65, -16, 130, 32, 7);
    doneBg.lineStyle(2, 0x44ff88, 1); doneBg.strokeRoundedRect(-65, -16, 130, 32, 7);
    doneBtn.add([doneBg, this.add.text(0, 0, 'DONE', { font: 'bold 15px Arial', color: '#44ff88' }).setOrigin(0.5)]);
    doneBtn.setInteractive(new Phaser.Geom.Rectangle(-65, -16, 130, 32), Phaser.Geom.Rectangle.Contains);
    doneBtn.on('pointerdown', () => this.finish());

    const clearBtn = this.add.container(cx - 90, cy);
    const clearBg = this.add.graphics();
    clearBg.fillStyle(0x2a1a1a, 1); clearBg.fillRoundedRect(-55, -16, 110, 32, 7);
    clearBtn.add([clearBg, this.add.text(0, 0, 'CLEAR ALL', { font: '13px Arial', color: '#aa4444' }).setOrigin(0.5)]);
    clearBtn.setInteractive(new Phaser.Geom.Rectangle(-55, -16, 110, 32), Phaser.Geom.Rectangle.Contains);
    clearBtn.on('pointerdown', () => {
      this.selectedLoadouts.clear();
      this.rowBgs.forEach((_, id) => this.drawRow(id));
      this.updatePointsText();
      const def = this.focusedShipId ? getShipDefinition(this.focusedShipId) : null;
      if (def) this.renderDetail(def);
    });
  }

  private finish(): void {
    const loadoutChoices: Record<string, string> = {};
    for (const [shipId, ld] of this.selectedLoadouts) {
      if (ld) loadoutChoices[shipId] = ld.id;
    }
    this.game.events.emit('shipsPicked', {
      slotIndex: this.config.slotIndex,
      ships: [...this.selectedLoadouts.keys()],
      loadoutChoices,
    });
    this.scene.stop();
  }
}
