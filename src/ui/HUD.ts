/**
 * Battle HUD
 * Displays turn info, phase, score, and status
 */

import Phaser from 'phaser';
import type { FactionId } from '../config';
import { FACTION_COLORS } from '../config';

export type BattlePhase = 'planning' | 'execution' | 'combat' | 'cleanup';

export interface HUDConfig {
  scene: Phaser.Scene;
  playerFaction: FactionId;
  enemyFaction: FactionId;
}

export class HUD extends Phaser.GameObjects.Container {
  private turnText: Phaser.GameObjects.Text;
  private phaseText: Phaser.GameObjects.Text;
  private playerFactionText: Phaser.GameObjects.Text;
  private enemyFactionText: Phaser.GameObjects.Text;
  private scoreText: Phaser.GameObjects.Text;
  private statusText: Phaser.GameObjects.Text;
  private instructionsText: Phaser.GameObjects.Text;

  private turnNumber = 1;
  private currentPhase: BattlePhase = 'planning';
  private score = 0;

  constructor(config: HUDConfig) {
    super(config.scene, 0, 0);

    const width = config.scene.cameras.main.width;
    const height = config.scene.cameras.main.height;

    // Turn counter (top center)
    this.turnText = config.scene.add.text(width / 2, 20, 'TURN 1', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#ffffff',
    });
    this.turnText.setOrigin(0.5, 0);
    this.turnText.setScrollFactor(0);
    this.add(this.turnText);

    // Phase indicator (below turn)
    this.phaseText = config.scene.add.text(width / 2, 48, 'PLANNING', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#88ff88',
    });
    this.phaseText.setOrigin(0.5, 0);
    this.phaseText.setScrollFactor(0);
    this.add(this.phaseText);

    // Player faction (top left)
    const playerColor = FACTION_COLORS[config.playerFaction] ?? 0xffffff;
    this.playerFactionText = config.scene.add.text(
      20,
      20,
      this.formatFactionName(config.playerFaction),
      {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: `#${playerColor.toString(16).padStart(6, '0')}`,
      }
    );
    this.playerFactionText.setScrollFactor(0);
    this.add(this.playerFactionText);

    // Enemy faction (top right)
    const enemyColor = FACTION_COLORS[config.enemyFaction] ?? 0xff0000;
    this.enemyFactionText = config.scene.add.text(
      width - 20,
      20,
      this.formatFactionName(config.enemyFaction),
      {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: `#${enemyColor.toString(16).padStart(6, '0')}`,
      }
    );
    this.enemyFactionText.setOrigin(1, 0);
    this.enemyFactionText.setScrollFactor(0);
    this.add(this.enemyFactionText);

    // Score (bottom left)
    this.scoreText = config.scene.add.text(20, height - 40, 'SCORE: 0', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ffff00',
    });
    this.scoreText.setScrollFactor(0);
    this.add(this.scoreText);

    // Status text (bottom center) - for messages
    this.statusText = config.scene.add.text(width / 2, height - 40, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff',
    });
    this.statusText.setOrigin(0.5, 0);
    this.statusText.setScrollFactor(0);
    this.add(this.statusText);

    // Instructions (bottom right)
    this.instructionsText = config.scene.add.text(
      width - 20,
      height - 60,
      '↑↓ Speed | ←→ Turn | SHIFT+←→ Bank\nZ K-Turn | SPACE Fire | ESC Pause',
      {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#888888',
        align: 'right',
      }
    );
    this.instructionsText.setOrigin(1, 0);
    this.instructionsText.setScrollFactor(0);
    this.add(this.instructionsText);

    config.scene.add.existing(this);
    this.setDepth(100); // Above everything
  }

  private formatFactionName(faction: FactionId): string {
    return faction
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  setTurn(turn: number): void {
    this.turnNumber = turn;
    this.turnText.setText(`TURN ${turn}`);
  }

  setPhase(phase: BattlePhase): void {
    this.currentPhase = phase;

    const phaseColors: Record<BattlePhase, string> = {
      planning: '#88ff88',
      execution: '#ffff88',
      combat: '#ff8888',
      cleanup: '#8888ff',
    };

    const phaseNames: Record<BattlePhase, string> = {
      planning: 'PLANNING',
      execution: 'EXECUTION',
      combat: 'COMBAT',
      cleanup: 'CLEANUP',
    };

    this.phaseText.setText(phaseNames[phase]);
    this.phaseText.setColor(phaseColors[phase]);
  }

  setScore(score: number): void {
    this.score = score;
    this.scoreText.setText(`SCORE: ${score}`);
  }

  addScore(points: number): void {
    this.setScore(this.score + points);
  }

  showStatus(message: string, duration = 2000): void {
    this.statusText.setText(message);
    this.statusText.setAlpha(1);

    this.scene.tweens.add({
      targets: this.statusText,
      alpha: 0,
      delay: duration,
      duration: 500,
    });
  }

  showDamage(x: number, y: number, damage: number, isCrit = false): void {
    const text = isCrit ? `CRIT! -${damage}` : `-${damage}`;
    const color = isCrit ? '#ffff00' : '#ff4444';

    const damageText = this.scene.add.text(x, y, text, {
      fontFamily: 'monospace',
      fontSize: isCrit ? '20px' : '16px',
      color,
      stroke: '#000000',
      strokeThickness: 2,
    });
    damageText.setOrigin(0.5, 0.5);

    this.scene.tweens.add({
      targets: damageText,
      y: y - 40,
      alpha: 0,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => damageText.destroy(),
    });
  }

  showKill(x: number, y: number): void {
    const killText = this.scene.add.text(x, y, '+KILL', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#00ff00',
      stroke: '#000000',
      strokeThickness: 3,
    });
    killText.setOrigin(0.5, 0.5);

    this.scene.tweens.add({
      targets: killText,
      y: y - 60,
      alpha: 0,
      scale: 1.5,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => killText.destroy(),
    });
  }

  getScore(): number {
    return this.score;
  }
}
