/**
 * DebriefScene
 *
 * SC1-style post-mission debrief scene showing:
 * 1. Dialogue lines with portrait + typewriter effect
 * 2. Mission stats panel with animated pilot XP bars
 * 3. Evolution choice panel (on pivot missions)
 *
 * Triggered by CampaignBattleScene after victory.
 */

import Phaser from 'phaser';
import type { FactionId } from '../config';
import { FACTION_COLORS } from '../config';
import type { CampaignMission, DebriefLine, EvolutionOption } from '../data/CampaignData';
import type { CampaignSaveData, CampaignPilotState } from '../systems/CampaignSaveManager';
import { CampaignSaveManager } from '../systems/CampaignSaveManager';
import { applyEvolution, getPilotDefinition, XP_THRESHOLDS } from '../systems/CampaignPilotManager';
import type { LevelUpEvent } from '../systems/CampaignPilotManager';

// ============================================
// Scene Input Data
// ============================================

interface DebriefSceneData {
  factionId: FactionId;
  mission: CampaignMission;
  preMissionSave: CampaignSaveData;
  updatedSave: CampaignSaveData;
  xpEarned: number;
  creditsEarned: number;
  kills: number;
  shipsLost: number;
  protagonistBonusXp: number;
  levelUpEvents: LevelUpEvent[];
}

type DebriefState =
  | 'dialogue_typing'
  | 'dialogue_waiting'
  | 'stats_animating'
  | 'stats_waiting'
  | 'evolution'
  | 'transitioning';

const TYPEWRITER_INTERVAL_MS = 28;

// Mood border colors
const MOOD_COLORS: Record<string, number> = {
  neutral:  0x334455,
  proud:    0xffcc00,
  solemn:   0x4488cc,
  urgent:   0xffaa00,
  grim:     0x882222,
};

export class DebriefScene extends Phaser.Scene {
  private data_!: DebriefSceneData;
  private state: DebriefState = 'dialogue_typing';

  // Dialogue
  private lines: DebriefLine[] = [];
  private lineIndex: number = 0;
  private charIndex: number = 0;
  private typewriterTimer: Phaser.Time.TimerEvent | undefined = undefined;
  private talkTimer: Phaser.Time.TimerEvent | undefined = undefined;
  private currentPortraitTex: string = 'portrait_command';

  // UI objects
  private bg!: Phaser.GameObjects.Graphics;
  private topBar!: Phaser.GameObjects.Graphics;
  private topBarText!: Phaser.GameObjects.Text;
  private portraitBorder!: Phaser.GameObjects.Graphics;
  private portraitImage!: Phaser.GameObjects.Image;
  private portraitScanlines!: Phaser.GameObjects.Graphics;
  private portraitFlash!: Phaser.GameObjects.Graphics;
  private speakerText!: Phaser.GameObjects.Text;
  private dialogueBox!: Phaser.GameObjects.Graphics;
  private dialogueText!: Phaser.GameObjects.Text;
  private lineCounterText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private statsContainer!: Phaser.GameObjects.Container;
  private evolutionContainer!: Phaser.GameObjects.Container;

  // Input
  private spaceKey?: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'DebriefScene' });
  }

  create(data: DebriefSceneData): void {
    this.data_ = data;
    this.lines = [...(data.mission.debrief ?? [])];
    this.lineIndex = 0;
    this.charIndex = 0;
    this.state = 'dialogue_typing';

    const factionColor = FACTION_COLORS[data.factionId] ?? 0x334466;

    this.createBackground(factionColor);
    this.createTopBar(factionColor, data.mission);
    this.createDialogueArea(factionColor);
    this.createStatsContainer();
    this.createEvolutionContainer();

    // Input: space bar
    if (this.input.keyboard) {
      this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }

    // Input: click anywhere
    this.input.on('pointerdown', this.handleInput, this);

    if (this.lines.length === 0) {
      // No debrief text — go straight to stats
      this.state = 'stats_animating';
      this.showStatsPanel();
    } else {
      this.showLine(0);
    }
  }

  update(): void {
    if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.handleInput();
    }
  }

  // ============================================
  // Input Handler
  // ============================================

  private handleInput(): void {
    switch (this.state) {
      case 'dialogue_typing':
        this.skipTyping();
        break;
      case 'dialogue_waiting':
        this.advanceLine();
        break;
      case 'stats_waiting':
        this.proceedFromStats();
        break;
      default:
        break;
    }
  }

  // ============================================
  // Background & Top Bar
  // ============================================

  private createBackground(factionColor: number): void {
    this.bg = this.add.graphics();
    // Deep space background
    this.bg.fillStyle(0x050d1a, 1);
    this.bg.fillRect(0, 0, this.scale.width, this.scale.height);

    // Subtle star field (static dots)
    this.bg.fillStyle(0xffffff, 0.5);
    const rng = new Phaser.Math.RandomDataGenerator(['debrief_stars']);
    for (let i = 0; i < 80; i++) {
      const sx = rng.integerInRange(0, this.scale.width);
      const sy = rng.integerInRange(0, 500);
      this.bg.fillRect(sx, sy, 1, 1);
    }

    // Faction color gradient strip along bottom
    this.bg.fillStyle(factionColor, 0.08);
    this.bg.fillRect(0, this.scale.height - 220, this.scale.width, 220);
  }

  private createTopBar(factionColor: number, mission: CampaignMission): void {
    this.topBar = this.add.graphics();
    this.topBar.fillStyle(factionColor, 0.9);
    this.topBar.fillRect(0, 0, this.scale.width, 48);
    this.topBar.fillStyle(0x000000, 0.4);
    this.topBar.fillRect(0, 48, this.scale.width, 2);

    this.topBarText = this.add.text(
      640, 24,
      `MISSION ${mission.missionNumber}: ${mission.title.toUpperCase()}`,
      { fontSize: '18px', fontFamily: 'monospace', color: '#ffffff', fontStyle: 'bold' }
    ).setOrigin(0.5, 0.5);
  }

  // ============================================
  // Dialogue Area
  // ============================================

  private createDialogueArea(factionColor: number): void {
    const portraitX = 40;
    const portraitY = 90;
    const portraitW = 85;  // 2:3 ratio to match 512×768 source images
    const portraitH = 128;
    const textBoxX = portraitX + portraitW + 18;
    const textBoxY = portraitY - 8;
    const textBoxW = this.scale.width - textBoxX - 30;
    const textBoxH = 155;

    // Portrait border
    this.portraitBorder = this.add.graphics();
    this.portraitBorder.lineStyle(3, factionColor, 1);
    this.portraitBorder.strokeRect(portraitX - 3, portraitY - 3, portraitW + 6, portraitH + 6);

    // Portrait image (will update per line)
    this.portraitImage = this.add.image(portraitX + portraitW / 2, portraitY + portraitH / 2, 'portrait_command');
    this.portraitImage.setDisplaySize(portraitW, portraitH);

    // CRT scanline overlay — clipped to portrait bounds, scrolls downward
    const maskShape = this.add.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(portraitX, portraitY, portraitW, portraitH);
    const scanMask = maskShape.createGeometryMask();

    this.portraitScanlines = this.add.graphics();
    this.portraitScanlines.setMask(scanMask);
    const scanSpacing = 4;
    for (let sy = -scanSpacing; sy < portraitH + scanSpacing * 2; sy += scanSpacing) {
      this.portraitScanlines.fillStyle(0x000000, 0.20);
      this.portraitScanlines.fillRect(portraitX, portraitY + sy, portraitW, 1);
    }
    this.tweens.add({
      targets: this.portraitScanlines,
      y: scanSpacing,
      duration: 200,
      repeat: -1,
      ease: 'Linear',
      onRepeat: () => { this.portraitScanlines.y = 0; },
    });

    // Flash overlay for speaker-change transition
    this.portraitFlash = this.add.graphics();
    this.portraitFlash.fillStyle(0xffffff, 1);
    this.portraitFlash.fillRect(portraitX, portraitY, portraitW, portraitH);
    this.portraitFlash.setAlpha(0);

    // Speaker name label
    this.speakerText = this.add.text(
      portraitX, portraitY - 22,
      '',
      { fontSize: '13px', fontFamily: 'monospace', color: '#aabbcc', fontStyle: 'bold' }
    );

    // Dialogue text box background
    this.dialogueBox = this.add.graphics();
    this.dialogueBox.fillStyle(0x000d1e, 0.88);
    this.dialogueBox.fillRoundedRect(textBoxX, textBoxY, textBoxW, textBoxH, 6);
    this.dialogueBox.lineStyle(1, 0x1a3a5a, 1);
    this.dialogueBox.strokeRoundedRect(textBoxX, textBoxY, textBoxW, textBoxH, 6);

    // Dialogue text
    this.dialogueText = this.add.text(
      textBoxX + 16, textBoxY + 14,
      '',
      {
        fontSize: '16px',
        fontFamily: 'monospace',
        color: '#ddeeff',
        wordWrap: { width: textBoxW - 32 },
        lineSpacing: 4,
      }
    );

    // Line counter
    this.lineCounterText = this.add.text(
      textBoxX + 16, textBoxY + textBoxH + 8,
      '',
      { fontSize: '12px', fontFamily: 'monospace', color: '#556677' }
    );

    // Click / Space prompt
    this.promptText = this.add.text(
      1250, textBoxY + textBoxH + 8,
      'CLICK OR SPACE TO CONTINUE',
      { fontSize: '11px', fontFamily: 'monospace', color: '#445566' }
    ).setOrigin(1, 0);
  }

  // ============================================
  // Typewriter Effect
  // ============================================

  private showLine(index: number): void {
    if (index >= this.lines.length) {
      this.state = 'stats_animating';
      this.hideDialogueUI();
      this.showStatsPanel();
      return;
    }

    const line = this.lines[index]!;
    this.lineIndex = index;
    this.charIndex = 0;
    this.state = 'dialogue_typing';

    // Update portrait with flash if speaker changed
    const textureKey = line.portraitKey;
    const tex = this.textures.exists(textureKey) ? textureKey : 'portrait_command';
    const prevTex = this.portraitImage.texture.key;
    this.portraitImage.setTexture(tex);
    this.currentPortraitTex = tex;

    if (tex !== prevTex) {
      // Speaker changed — brief white flash
      this.tweens.killTweensOf(this.portraitFlash);
      this.portraitFlash.setAlpha(0.55);
      this.tweens.add({
        targets: this.portraitFlash,
        alpha: 0,
        duration: 280,
        ease: 'Cubic.easeOut',
      });
    }

    // Talking animation: alternate base ↔ _talk texture while typewriter is active
    if (this.talkTimer) {
      this.talkTimer.remove();
      this.talkTimer = undefined;
    }
    const talkKey = tex + '_talk';
    if (this.textures.exists(talkKey)) {
      this.talkTimer = this.time.addEvent({
        delay: 120,
        loop: true,
        callback: () => {
          const onTalk = this.portraitImage.texture.key !== talkKey;
          this.portraitImage.setTexture(onTalk ? talkKey : tex);
        },
      });
    }

    // Update speaker name
    this.speakerText.setText(line.speaker);

    // Update portrait border color by mood
    const moodColor = MOOD_COLORS[line.mood ?? 'neutral'] ?? MOOD_COLORS['neutral']!;
    this.portraitBorder.clear();
    this.portraitBorder.lineStyle(3, moodColor, 1);
    this.portraitBorder.strokeRect(37, 87, 91, 134);  // 85+6 wide, 128+6 tall

    // Update line counter
    this.lineCounterText.setText(`[${index + 1}/${this.lines.length}]`);

    // Clear text and start typewriter
    this.dialogueText.setText('');

    if (this.typewriterTimer) {
      this.typewriterTimer.remove();
    }

    this.typewriterTimer = this.time.addEvent({
      delay: TYPEWRITER_INTERVAL_MS,
      repeat: line.text.length - 1,
      callback: () => {
        this.charIndex++;
        this.dialogueText.setText(line.text.slice(0, this.charIndex));
        if (this.charIndex >= line.text.length) {
          this.stopTalkAnimation();
          this.state = 'dialogue_waiting';
          this.promptText.setAlpha(1);
          this.blinkPrompt();
        }
      },
    });
  }

  private skipTyping(): void {
    if (this.typewriterTimer) {
      this.typewriterTimer.remove();
    }
    const line = this.lines[this.lineIndex];
    if (line) {
      this.dialogueText.setText(line.text);
    }
    this.stopTalkAnimation();
    this.state = 'dialogue_waiting';
    this.promptText.setAlpha(1);
  }

  private stopTalkAnimation(): void {
    if (this.talkTimer) {
      this.talkTimer.remove();
      this.talkTimer = undefined;
    }
    this.portraitImage.setTexture(this.currentPortraitTex);
  }

  private advanceLine(): void {
    this.tweens.killTweensOf(this.promptText);
    this.promptText.setAlpha(1);
    this.showLine(this.lineIndex + 1);
  }

  private blinkPrompt(): void {
    this.tweens.add({
      targets: this.promptText,
      alpha: 0.2,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private hideDialogueUI(): void {
    this.portraitBorder.setVisible(false);
    this.portraitImage.setVisible(false);
    this.portraitScanlines.setVisible(false);
    this.portraitFlash.setVisible(false);
    this.tweens.killTweensOf(this.portraitScanlines);
    if (this.talkTimer) {
      this.talkTimer.remove();
      this.talkTimer = undefined;
    }
    this.speakerText.setVisible(false);
    this.dialogueBox.setVisible(false);
    this.dialogueText.setVisible(false);
    this.lineCounterText.setVisible(false);
    this.promptText.setVisible(false);
    this.tweens.killTweensOf(this.promptText);
  }

  // ============================================
  // Stats Panel
  // ============================================

  private createStatsContainer(): void {
    this.statsContainer = this.add.container(0, 0);
    this.statsContainer.setVisible(false);
  }

  private showStatsPanel(): void {
    this.statsContainer.removeAll(true);
    this.statsContainer.setVisible(true);

    const { mission, xpEarned, creditsEarned, kills, shipsLost,
            preMissionSave, updatedSave, levelUpEvents } = this.data_;

    const panelY = 70;
    const cardH = 500;

    // ---- Left card: Mission results ----
    const leftG = this.add.graphics();
    leftG.fillStyle(0x050d20, 0.95);
    leftG.fillRoundedRect(40, panelY, 560, cardH, 8);
    leftG.lineStyle(1, 0x1a3a5a, 1);
    leftG.strokeRoundedRect(40, panelY, 560, cardH, 8);

    const missionLabel = this.add.text(
      320, panelY + 20, 'MISSION RESULTS',
      { fontSize: '20px', fontFamily: 'monospace', color: '#aaddff', fontStyle: 'bold' }
    ).setOrigin(0.5, 0);

    const resultItems = [
      { label: 'ENEMY SHIPS DESTROYED', value: `${kills}` },
      { label: 'SHIPS LOST', value: `${shipsLost}` },
      { label: 'XP EARNED', value: `+${xpEarned}` },
      { label: 'CREDITS EARNED', value: `+${creditsEarned}` },
    ];

    const resultTexts: Phaser.GameObjects.Text[] = [];
    resultItems.forEach((item, i) => {
      const y = panelY + 70 + i * 60;
      const labelText = this.add.text(60, y, item.label, {
        fontSize: '14px', fontFamily: 'monospace', color: '#556677',
      });
      const valueText = this.add.text(585, y, item.value, {
        fontSize: '18px', fontFamily: 'monospace', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(1, 0);
      resultTexts.push(labelText, valueText);
    });

    this.statsContainer.add([leftG, missionLabel, ...resultTexts]);

    // ---- Right card: Pilot XP progress ----
    const rightG = this.add.graphics();
    rightG.fillStyle(0x050d20, 0.95);
    rightG.fillRoundedRect(680, panelY, 560, cardH, 8);
    rightG.lineStyle(1, 0x1a3a5a, 1);
    rightG.strokeRoundedRect(680, panelY, 560, cardH, 8);

    const pilotLabel = this.add.text(
      960, panelY + 20, 'PILOT PROGRESSION',
      { fontSize: '20px', fontFamily: 'monospace', color: '#aaddff', fontStyle: 'bold' }
    ).setOrigin(0.5, 0);

    const pilotTexts: Phaser.GameObjects.GameObject[] = [];
    const pilots = updatedSave.campaignPilots;

    pilots.forEach((pilot, i) => {
      const def = getPilotDefinition(this.data_.factionId, pilot.pilotId);
      const pilotName = def ? (def.callsign ?? def.displayName) : pilot.pilotId.toUpperCase();
      const py = panelY + 75 + i * 140;

      const nameText = this.add.text(700, py, pilotName, {
        fontSize: '15px', fontFamily: 'monospace', color: '#ddeeff', fontStyle: 'bold',
      });

      const skillText = this.add.text(1225, py, `SKILL ${pilot.pilotSkill}`, {
        fontSize: '14px', fontFamily: 'monospace', color: '#aabbcc',
      }).setOrigin(1, 0);

      // Ship thumbnail (44×44) — right side of row
      const shipKey = `ship_${pilot.currentShipId}`;
      const shipThumb = this.textures.exists(shipKey)
        ? this.add.image(1192, py + 8, shipKey).setDisplaySize(44, 44)
        : null;
      const shipBorder = this.add.graphics();
      if (shipThumb) {
        shipBorder.lineStyle(1, 0x1a3a5a, 1);
        shipBorder.strokeRect(1170, py + 2, 44, 44);
      }

      // XP bar background (460px wide — leaves room for ship thumbnail)
      const barBgG = this.add.graphics();
      barBgG.fillStyle(0x111e33, 1);
      barBgG.fillRoundedRect(700, py + 24, 460, 14, 4);

      // XP bar fill — calculate from pre-mission XP
      const prePilot = preMissionSave.campaignPilots.find((p) => p.pilotId === pilot.pilotId);
      const preXp = prePilot?.xp ?? 0;
      const skill = pilot.pilotSkill;
      const levelStart = XP_THRESHOLDS[skill] ?? 0;
      const levelEnd = XP_THRESHOLDS[Math.min(skill + 1, 6)] ?? levelStart;
      const levelRange = levelEnd - levelStart;
      const postXp = pilot.xp;

      const preRatio = levelRange > 0 ? Math.min(1, (preXp - levelStart) / levelRange) : 1;
      const postRatio = levelRange > 0 ? Math.min(1, (postXp - levelStart) / levelRange) : 1;

      const barFillG = this.add.graphics();
      barFillG.fillStyle(0x2266aa, 1);
      barFillG.fillRoundedRect(700, py + 24, 460 * preRatio, 14, 4);

      const xpText = this.add.text(700, py + 44, `${preXp} XP`, {
        fontSize: '12px', fontFamily: 'monospace', color: '#445566',
      });

      const extras: Phaser.GameObjects.GameObject[] = [shipBorder];
      if (shipThumb) extras.push(shipThumb);
      pilotTexts.push(nameText, skillText, barBgG, barFillG, xpText, ...extras);

      // Animate bar fill to post-XP position
      this.tweens.add({
        targets: {},
        from: preRatio,
        to: postRatio,
        duration: 1200,
        ease: 'Cubic.easeOut',
        delay: i * 200,
        onUpdate: (tween) => {
          const ratio = tween.getValue() ?? 0;
          barFillG.clear();
          barFillG.fillStyle(0x2266aa, 1);
          barFillG.fillRoundedRect(700, py + 24, 460 * ratio, 14, 4);
          xpText.setText(`${Math.floor(preXp + (postXp - preXp) * (tween.progress))} XP`);
        },
        onComplete: () => {
          xpText.setText(`${postXp} XP`);
          this.checkLevelUp(pilot, levelUpEvents, py, pilotTexts);
        },
      });
    });

    this.statsContainer.add([rightG, pilotLabel, ...pilotTexts]);

    // CONTINUE button
    const continueBtn = this.add.text(
      640, panelY + cardH + 24, '[ CONTINUE ]',
      {
        fontSize: '18px', fontFamily: 'monospace', color: '#7799bb',
        fontStyle: 'bold',
      }
    ).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });

    continueBtn.on('pointerover', () => continueBtn.setColor('#aaddff'));
    continueBtn.on('pointerout', () => continueBtn.setColor('#7799bb'));
    continueBtn.on('pointerdown', () => {
      if (this.state === 'stats_waiting') {
        this.proceedFromStats();
      }
    });

    this.statsContainer.add(continueBtn);

    // Set state after XP animations complete
    const maxDelay = (pilots.length - 1) * 200 + 1400;
    this.time.delayedCall(maxDelay, () => {
      this.state = 'stats_waiting';
    });
  }

  private checkLevelUp(
    pilot: CampaignPilotState,
    levelUpEvents: LevelUpEvent[],
    rowY: number,
    container: Phaser.GameObjects.GameObject[]
  ): void {
    const events = levelUpEvents.filter((e) => e.pilotId === pilot.pilotId);
    if (events.length === 0) return;

    const levelUpText = this.add.text(
      700, rowY + 62,
      `★ LEVEL UP!  Skill ${pilot.pilotSkill}  —  New: ${events.map((e) => e.newAbilityId.replace(/_/g, ' ').toUpperCase()).join(', ')}`,
      { fontSize: '13px', fontFamily: 'monospace', color: '#ffcc00', fontStyle: 'bold' }
    );

    container.push(levelUpText);
    this.statsContainer.add(levelUpText);

    this.tweens.add({
      targets: levelUpText,
      alpha: 0.4,
      duration: 700,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
    });
  }

  // ============================================
  // Evolution Panel
  // ============================================

  private createEvolutionContainer(): void {
    this.evolutionContainer = this.add.container(0, 0);
    this.evolutionContainer.setVisible(false);
  }

  private showEvolutionPanel(): void {
    this.statsContainer.setVisible(false);
    this.evolutionContainer.removeAll(true);
    this.evolutionContainer.setVisible(true);

    const { mission, updatedSave } = this.data_;
    const choice = mission.evolutionChoice!;
    const factionColor = FACTION_COLORS[this.data_.factionId] ?? 0x334466;

    // Dim background overlay
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, this.scale.width, this.scale.height);

    // Title
    const titleText = this.add.text(
      640, 40, 'CHOOSE YOUR DESTINY',
      { fontSize: '24px', fontFamily: 'monospace', color: '#aaddff', fontStyle: 'bold' }
    ).setOrigin(0.5, 0);

    const promptTxt = this.add.text(
      640, 82, choice.promptText,
      { fontSize: '14px', fontFamily: 'monospace', color: '#778899', wordWrap: { width: 900 } }
    ).setOrigin(0.5, 0);

    const warningText = this.add.text(
      640, 680, '⚠ THIS CHOICE IS PERMANENT',
      { fontSize: '13px', fontFamily: 'monospace', color: '#aa4444' }
    ).setOrigin(0.5, 0.5);

    this.evolutionContainer.add([overlay, titleText, promptTxt, warningText]);

    // Two option cards
    const optionA = choice.optionA;
    const optionB = choice.optionB;

    this.addEvolutionCard(optionA, 60, 140, factionColor, updatedSave);
    this.addEvolutionCard(optionB, 680, 140, factionColor, updatedSave);
  }

  private addEvolutionCard(
    option: EvolutionOption,
    x: number,
    y: number,
    factionColor: number,
    save: CampaignSaveData
  ): void {
    const cardW = 540;
    const cardH = 460;

    const cardG = this.add.graphics();
    cardG.fillStyle(0x050d20, 0.97);
    cardG.fillRoundedRect(x, y, cardW, cardH, 10);
    cardG.lineStyle(2, factionColor, 0.6);
    cardG.strokeRoundedRect(x, y, cardW, cardH, 10);

    const headerG = this.add.graphics();
    headerG.fillStyle(factionColor, 0.25);
    headerG.fillRoundedRect(x, y, cardW, 48, { tl: 10, tr: 10, bl: 0, br: 0 });

    const labelText = this.add.text(
      x + cardW / 2, y + 24, option.label,
      { fontSize: '18px', fontFamily: 'monospace', color: '#ffffff', fontStyle: 'bold' }
    ).setOrigin(0.5, 0.5);

    const descText = this.add.text(
      x + 20, y + 60, option.description,
      { fontSize: '14px', fontFamily: 'monospace', color: '#99bbdd', wordWrap: { width: cardW - 40 }, lineSpacing: 3 }
    );

    const bonusList = Object.entries(option.statBonuses)
      .filter(([, v]) => v !== undefined && v !== 0)
      .map(([k, v]) => `  +${v} ${k.toUpperCase()}`)
      .join('\n');
    const bonusText = this.add.text(
      x + 20, y + 160,
      bonusList.length > 0 ? `STAT BONUSES:\n${bonusList}` : 'STAT BONUSES: None',
      { fontSize: '13px', fontFamily: 'monospace', color: '#66cc88', lineSpacing: 4 }
    );

    const abilityLabel = this.add.text(
      x + 20, y + 270,
      `GRANTS ABILITY:\n  ${option.grantAbilityId.replace(/_/g, ' ').toUpperCase()}`,
      { fontSize: '13px', fontFamily: 'monospace', color: '#ffcc44', lineSpacing: 4 }
    );

    const flavorText = this.add.text(
      x + 20, y + 340,
      option.flavorText,
      {
        fontSize: '12px', fontFamily: 'monospace', color: '#445566',
        wordWrap: { width: cardW - 40 }, fontStyle: 'italic',
      }
    );

    const chooseBtn = this.add.text(
      x + cardW / 2, y + cardH - 28, '[ SELECT ]',
      { fontSize: '16px', fontFamily: 'monospace', color: '#7799bb', fontStyle: 'bold' }
    ).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });

    chooseBtn.on('pointerover', () => {
      chooseBtn.setColor('#aaddff');
      this.tweens.add({ targets: cardG, alpha: 0.95, duration: 100 });
    });
    chooseBtn.on('pointerout', () => {
      chooseBtn.setColor('#7799bb');
    });
    chooseBtn.on('pointerdown', () => {
      if (this.state !== 'evolution') return;
      this.applyEvolutionChoice(option, save);
    });

    this.evolutionContainer.add([cardG, headerG, labelText, descText, bonusText, abilityLabel, flavorText, chooseBtn]);
  }

  private applyEvolutionChoice(option: EvolutionOption, save: CampaignSaveData): void {
    this.state = 'transitioning';

    // Find protagonist and apply evolution
    const updatedPilots = save.campaignPilots.map((pilot) => {
      const def = getPilotDefinition(this.data_.factionId, pilot.pilotId);
      if (def?.role === 'protagonist') {
        return applyEvolution(pilot, option);
      }
      return pilot;
    });

    const finalSave = CampaignSaveManager.applyEvolutionChoice(save, updatedPilots);
    void finalSave; // save is applied to localStorage by applyEvolutionChoice

    this.transitionToCampaign();
  }

  // ============================================
  // Flow Control
  // ============================================

  private proceedFromStats(): void {
    const { mission, updatedSave } = this.data_;
    const hasEvolution = !!mission.evolutionChoice;
    const alreadyChosen = updatedSave.campaignPilots.some((p) =>
      mission.evolutionChoice
        ? p.evolutionChoiceIds.includes(mission.evolutionChoice.optionA.id) ||
          p.evolutionChoiceIds.includes(mission.evolutionChoice.optionB.id)
        : false
    );

    if (hasEvolution && !alreadyChosen) {
      this.state = 'evolution';
      this.showEvolutionPanel();
    } else {
      this.state = 'transitioning';
      this.transitionToCampaign();
    }
  }

  private transitionToCampaign(): void {
    this.cameras.main.fade(600, 0, 0, 0, false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress === 1) {
        this.scene.start('CampaignScene', { factionId: this.data_.factionId });
      }
    });
  }
}
