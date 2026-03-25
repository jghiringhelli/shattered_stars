/**
 * ShipPickerScene
 *
 * Launched on top of SquadBuilderScene when a player clicks "Ships" on a slot.
 * Displays a scrollable grid of all ships for the slot's faction with hover stat
 * cards. Clicking a ship toggles it in/out of the selection. DONE saves back
 * via game.events and stops this scene.
 */

import Phaser from 'phaser';
import { getShipsByFaction, getShipDefinition } from '../data/ShipDefinitions';
import type { ShipDefinition } from '../core/types';
import { getEncyclopediaEntry } from '../data/ShipEncyclopedia';
import { ShipStatCard } from '../ui/ShipStatCard';
import { FACTION_COLORS } from '../config';
import type { FactionId } from '../config';

const COLS = 4;
const CELL_W = 240;
const CELL_H = 58;
const GRID_X = 90;
const GRID_Y = 120;

interface PickerConfig {
  slotIndex: number;
  factionId: FactionId;
  selectedShips: string[];
  pointLimit: number;
}

export class ShipPickerScene extends Phaser.Scene {
  private config!: PickerConfig;
  private selected: Set<string> = new Set();
  private ships: ShipDefinition[] = [];
  private cellBgs = new Map<string, Phaser.GameObjects.Graphics>();
  private pointsText!: Phaser.GameObjects.Text;
  private activeCard: ShipStatCard | null = null;

  constructor() {
    super({ key: 'ShipPickerScene' });
  }

  init(data: PickerConfig): void {
    this.config = data;
    this.selected = new Set(data.selectedShips);
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const fCol = FACTION_COLORS[this.config.factionId];
    this.ships = getShipsByFaction(this.config.factionId);

    // Dark overlay backdrop
    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x000000, 0.82);
    backdrop.fillRect(0, 0, w, h);

    // Panel
    const panelX = 60;
    const panelW = w - 120;
    const panelH = h - 80;
    const panel = this.add.graphics();
    panel.fillStyle(0x0d1525, 1);
    panel.fillRoundedRect(panelX, 40, panelW, panelH, 12);
    panel.lineStyle(2, fCol, 0.8);
    panel.strokeRoundedRect(panelX, 40, panelW, panelH, 12);

    // Title
    const def0 = getShipDefinition(this.ships[0]?.id ?? '');
    const factionLabel = def0?.faction.replace(/_/g, ' ').toUpperCase() ?? '';
    this.add.text(w / 2, 66, `SELECT SHIPS — ${factionLabel}`, {
      font: 'bold 18px Arial',
      color: '#aaccee',
    }).setOrigin(0.5);

    // Points counter
    this.pointsText = this.add.text(panelX + panelW - 16, 66, '', {
      font: 'bold 14px Arial',
      color: '#44ff88',
    }).setOrigin(1, 0.5);
    this.updatePointsText();

    this.buildShipGrid();
    this.addDoneButton(panelX + panelW / 2, h - 52);
    this.addClearButton(panelX + panelW / 2 - 120, h - 52);

    // Close on Escape
    this.input.keyboard!.on('keydown-ESC', () => this.finish());
  }

  private buildShipGrid(): void {
    this.ships.forEach((def, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = GRID_X + col * (CELL_W + 10);
      const cy = GRID_Y + row * (CELL_H + 8);
      this.createShipCell(def, cx, cy);
    });
  }

  private createShipCell(def: ShipDefinition, cx: number, cy: number): void {
    const bg = this.add.graphics();
    this.cellBgs.set(def.id, bg);
    this.drawCell(def.id);

    const nameText = this.add.text(cx + 12, cy + 8, def.name, { font: 'bold 13px Arial', color: '#ddeeff' });
    const roleText = this.add.text(cx + 12, cy + 28, def.role.replace(/_/g, ' '), { font: '11px Arial', color: '#6677aa' });
    const ptText = this.add.text(cx + CELL_W - 8, cy + 8, `${def.baseStats.pointCost}pts`, {
      font: '11px Arial', color: '#888899',
    }).setOrigin(1, 0);

    const hit = this.add.rectangle(cx + CELL_W / 2, cy + CELL_H / 2, CELL_W, CELL_H, 0, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => this.showCard(def, cx + CELL_W / 2, cy));
    hit.on('pointerout', () => this.hideCard());
    hit.on('pointerdown', () => this.toggleShip(def));
    void nameText; void roleText; void ptText;
  }

  private drawCell(shipId: string): void {
    const bg = this.cellBgs.get(shipId);
    if (!bg) return;
    const i = this.ships.findIndex((s) => s.id === shipId);
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cx = GRID_X + col * (CELL_W + 10);
    const cy = GRID_Y + row * (CELL_H + 8);
    const isSelected = this.selected.has(shipId);
    bg.clear();
    bg.fillStyle(isSelected ? 0x0f2a1a : 0x1a1a2a, 1);
    bg.fillRoundedRect(cx, cy, CELL_W, CELL_H, 6);
    bg.lineStyle(2, isSelected ? 0x44ff88 : 0x2a3a4a, 1);
    bg.strokeRoundedRect(cx, cy, CELL_W, CELL_H, 6);
  }

  private toggleShip(def: ShipDefinition): void {
    if (this.selected.has(def.id)) {
      this.selected.delete(def.id);
    } else {
      this.selected.add(def.id);
    }
    this.drawCell(def.id);
    this.updatePointsText();
  }

  private updatePointsText(): void {
    const total = [...this.selected].reduce((sum, id) => {
      return sum + (getShipDefinition(id)?.baseStats.pointCost ?? 0);
    }, 0);
    const over = total > this.config.pointLimit;
    this.pointsText.setText(`${total} / ${this.config.pointLimit} pts`);
    this.pointsText.setColor(over ? '#ff4444' : '#44ff88');
  }

  private showCard(def: ShipDefinition, tx: number, ty: number): void {
    this.activeCard?.destroy();
    this.activeCard = new ShipStatCard(this, 0, 0, getEncyclopediaEntry(def.id));
    ShipStatCard.positionNear(this.activeCard, tx, ty, this.scale.width, this.scale.height);
  }

  private hideCard(): void {
    this.activeCard?.destroy();
    this.activeCard = null;
  }

  private addDoneButton(cx: number, cy: number): void {
    const btn = this.add.container(cx, cy);
    const bg = this.add.graphics();
    bg.fillStyle(0x1a3a1a, 1);
    bg.fillRoundedRect(-70, -18, 140, 36, 8);
    bg.lineStyle(2, 0x44ff88, 1);
    bg.strokeRoundedRect(-70, -18, 140, 36, 8);
    btn.add([bg, this.add.text(0, 0, 'DONE', { font: 'bold 16px Arial', color: '#44ff88' }).setOrigin(0.5)]);
    btn.setInteractive(new Phaser.Geom.Rectangle(-70, -18, 140, 36), Phaser.Geom.Rectangle.Contains);
    btn.on('pointerdown', () => this.finish());
  }

  private addClearButton(cx: number, cy: number): void {
    const btn = this.add.container(cx, cy);
    const bg = this.add.graphics();
    bg.fillStyle(0x2a1a1a, 1);
    bg.fillRoundedRect(-55, -18, 110, 36, 8);
    btn.add([bg, this.add.text(0, 0, 'CLEAR', { font: '14px Arial', color: '#aa4444' }).setOrigin(0.5)]);
    btn.setInteractive(new Phaser.Geom.Rectangle(-55, -18, 110, 36), Phaser.Geom.Rectangle.Contains);
    btn.on('pointerdown', () => {
      this.selected.clear();
      this.cellBgs.forEach((_, id) => this.drawCell(id));
      this.updatePointsText();
    });
  }

  private finish(): void {
    this.game.events.emit('shipsPicked', {
      slotIndex: this.config.slotIndex,
      ships: [...this.selected],
    });
    this.scene.stop();
  }
}
