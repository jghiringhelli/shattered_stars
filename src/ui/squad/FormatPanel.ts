/**
 * FormatPanel — left sidebar of SquadBuilderScene.
 * Controls game mode, point limit, AI difficulty, and battle format preset.
 * Emits: 'modeChanged' GameMode | 'pointsChanged' number |
 *        'difficultyChanged' AIDifficultyLevel | 'formatChanged' FormatPreset
 */

import Phaser from 'phaser';
import type { AIDifficultyLevel } from '../../ai/AIDifficulty';
import { DIFFICULTY_NAMES } from '../../ai/AIDifficulty';
import type { FormatPreset, FormatPresetId, GameMode } from '../../core/squadTypes';
import { FORMAT_PRESETS, MULTI_TEAM_MODES } from '../../core/squadTypes';

const PANEL_X = 10;
const PANEL_W = 296;
const PANEL_Y = 68;
const PANEL_H = 598;
const ROW_X = PANEL_X + 10;
const SECTION_PAD = 18;
const BTN_H = 26;
const GAP = 5;

export interface FormatPanelState {
  gameMode: GameMode;
  pointLimit: number;
  aiDifficulty: AIDifficultyLevel;
  activePreset: FormatPresetId;
}

export class FormatPanel extends Phaser.Events.EventEmitter {
  private readonly scene: Phaser.Scene;
  private state: FormatPanelState;
  private container!: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, initial: FormatPanelState) {
    super();
    this.scene = scene;
    this.state = { ...initial };
  }

  /** Render or re-render the panel */
  render(): void {
    this.container?.destroy();
    this.container = this.scene.add.container(0, 0);
    this.drawBackground();
    let y = PANEL_Y + 10;
    y = this.section(y, 'GAME MODE', (sy) => this.renderModeRow(sy));
    y = this.section(y, 'POINTS', (sy) => this.renderPointsRow(sy));
    y = this.section(y, 'AI DIFFICULTY', (sy) => this.renderDifficultyRow(sy));
    if (MULTI_TEAM_MODES.includes(this.state.gameMode)) {
      this.section(y, 'BATTLE FORMAT', (sy) => this.renderFormatGrid(sy));
    }
  }

  /** Merge partial state and re-render */
  setState(patch: Partial<FormatPanelState>): void {
    this.state = { ...this.state, ...patch };
    this.render();
  }

  getState(): Readonly<FormatPanelState> { return this.state; }

  destroy(): void { this.container?.destroy(); super.destroy(); }

  private drawBackground(): void {
    const g = this.scene.add.graphics();
    g.fillStyle(0x0c1018, 0.95);
    g.fillRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 8);
    g.lineStyle(1, 0x1e2d40, 0.9);
    g.strokeRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 8);
    this.container.add(g);
  }

  private section(y: number, title: string, renderFn: (y: number) => number): number {
    this.container.add(this.scene.add.text(ROW_X, y, title,
      { font: 'bold 9px Arial', color: '#445566' }));
    return renderFn(y + 14) + SECTION_PAD;
  }

  private renderModeRow(y: number): number {
    const modes: Array<{ id: GameMode; label: string }> = [
      { id: 'arcade', label: 'Arcade' },
      { id: 'turn_based', label: 'Turn-Based' },
      { id: 'continuous', label: 'Continuous' },
    ];
    const w = 88;
    modes.forEach((m, i) => {
      this.container.add(this.makeToggle(
        ROW_X + i * (w + 4), y, w, BTN_H, m.label,
        this.state.gameMode === m.id,
        () => { this.state.gameMode = m.id; this.emit('modeChanged', m.id); this.render(); },
      ));
    });
    return y + BTN_H + GAP;
  }

  private renderPointsRow(y: number): number {
    if (this.state.gameMode === 'epic') {
      this.container.add(this.scene.add.text(ROW_X, y + 4, '400 pts  ·  EPIC FORMAT', {
        font: 'bold 11px Arial', color: '#cc8833',
      }));
      return y + BTN_H + GAP;
    }
    const limits = [100, 150, 200, 300];
    const w = 60;
    limits.forEach((pts, i) => {
      this.container.add(this.makeToggle(
        ROW_X + i * (w + 8), y, w, BTN_H, `${pts}`,
        this.state.pointLimit === pts,
        () => { this.state.pointLimit = pts; this.emit('pointsChanged', pts); this.render(); },
      ));
    });
    return y + BTN_H + GAP;
  }

  private renderDifficultyRow(y: number): number {
    const diffs: AIDifficultyLevel[] = ['easy', 'normal', 'hard', 'brutal'];
    const w = 62;
    diffs.forEach((d, i) => {
      this.container.add(this.makeToggle(
        ROW_X + i * (w + 4), y, w, BTN_H, DIFFICULTY_NAMES[d],
        this.state.aiDifficulty === d,
        () => { this.state.aiDifficulty = d; this.emit('difficultyChanged', d); this.render(); },
      ));
    });
    return y + BTN_H + GAP;
  }

  private renderFormatGrid(y: number): number {
    const btnW = 80;
    const btnH = 28;
    const cols = 3;
    FORMAT_PRESETS.forEach((p, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      this.container.add(this.makeToggle(
        ROW_X + col * (btnW + 6), y + row * (btnH + 6), btnW, btnH, p.label,
        this.state.activePreset === p.id,
        () => { this.state.activePreset = p.id; this.emit('formatChanged', p); this.render(); },
      ));
    });
    return y + Math.ceil(FORMAT_PRESETS.length / cols) * (btnH + 6);
  }

  private makeToggle(
    x: number, y: number, w: number, h: number,
    label: string, active: boolean, onClick: () => void,
  ): Phaser.GameObjects.Container {
    const c = this.scene.add.container(x, y);
    const bg = this.scene.add.graphics();
    const fill = active ? 0x1a3355 : 0x111820;
    const border = active ? 0x3366aa : 0x1a2535;
    bg.fillStyle(fill, 1);
    bg.fillRoundedRect(0, 0, w, h, 4);
    bg.lineStyle(1, border, 1);
    bg.strokeRoundedRect(0, 0, w, h, 4);
    const txt = this.scene.add.text(w / 2, h / 2, label, {
      font: `${active ? 'bold ' : ''}10px Arial`,
      color: active ? '#77aadd' : '#445566',
    }).setOrigin(0.5);
    c.add([bg, txt]);
    c.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    c.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(active ? 0x22406a : 0x182030, 1);
      bg.fillRoundedRect(0, 0, w, h, 4);
      txt.setColor('#88bbee');
    });
    c.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(fill, 1);
      bg.fillRoundedRect(0, 0, w, h, 4);
      txt.setColor(active ? '#77aadd' : '#445566');
    });
    c.on('pointerdown', onClick);
    return c;
  }
}
