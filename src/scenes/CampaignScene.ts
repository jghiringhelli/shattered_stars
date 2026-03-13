/**
 * Campaign Scene
 *
 * Faction selection and mission progression for story campaigns.
 * Features:
 * - 5 faction campaigns with unique storylines
 * - Mission map showing progression
 * - Save/load campaign progress
 * - Mission briefing before battles
 */

import Phaser from 'phaser';
import type { FactionId } from '../config';
import { FACTION_COLORS } from '../config';
import { FACTION_CAMPAIGNS, type FactionCampaign, type CampaignMission } from '../data/CampaignData';
import { audioManager } from '../audio/AudioManager';
import { CampaignSaveManager, type CampaignSaveData } from '../systems/CampaignSaveManager';
import { CAMPAIGN_PILOTS } from '../data/PilotData';
import { getPilotDefinition } from '../systems/CampaignPilotManager';

type CampaignPhase = 'faction_select' | 'mission_map' | 'briefing';

export class CampaignScene extends Phaser.Scene {
  private currentPhase: CampaignPhase = 'faction_select';
  private selectedFaction: FactionId | null = null;
  private selectedMission: CampaignMission | null = null;
  private campaignData: FactionCampaign | null = null;
  private saveData: CampaignSaveData | null = null;

  // UI Containers
  private factionSelectContainer!: Phaser.GameObjects.Container;
  private missionMapContainer!: Phaser.GameObjects.Container;
  private briefingContainer!: Phaser.GameObjects.Container;

  // Starfield background
  private starfield!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'CampaignScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x050510);

    audioManager.initialize();
    audioManager.playMusic('menu_theme');

    this.createStarfield();
    this.showFactionSelect();
  }

  update(): void {
    // Slowly rotate starfield
    if (this.starfield) {
      this.starfield.rotation += 0.0001;
    }
  }

  private createStarfield(): void {
    this.starfield = this.add.graphics();

    for (let i = 0; i < 300; i++) {
      const x = Phaser.Math.Between(-640, 1920);
      const y = Phaser.Math.Between(-360, 1080);
      const size = Phaser.Math.FloatBetween(0.5, 2);
      const alpha = Phaser.Math.FloatBetween(0.2, 0.8);

      this.starfield.fillStyle(0xffffff, alpha);
      this.starfield.fillCircle(x, y, size);
    }

    // Nebula effects
    this.starfield.fillStyle(0x224488, 0.05);
    this.starfield.fillCircle(300, 400, 350);
    this.starfield.fillStyle(0x442266, 0.05);
    this.starfield.fillCircle(1000, 300, 300);
    this.starfield.fillStyle(0x662244, 0.04);
    this.starfield.fillCircle(700, 600, 280);
  }

  // ==========================================
  // FACTION SELECT
  // ==========================================

  private showFactionSelect(): void {
    this.currentPhase = 'faction_select';

    if (this.missionMapContainer) {
      this.missionMapContainer.setVisible(false);
    }
    if (this.briefingContainer) {
      this.briefingContainer.setVisible(false);
    }

    this.factionSelectContainer = this.add.container(0, 0);

    const centerX = this.scale.width / 2;

    // Title
    const title = this.add.text(centerX, 50, 'CAMPAIGN', {
      font: 'bold 48px Arial',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.factionSelectContainer.add(title);

    const subtitle = this.add.text(centerX, 95, 'Choose Your Faction', {
      font: '24px Arial',
      color: '#888888',
    }).setOrigin(0.5);
    this.factionSelectContainer.add(subtitle);

    // Faction buttons
    const factions: FactionId[] = ['terran_hegemony', 'free_confederation', 'synthetic_collective', 'void_corsairs', 'ascendant_empire'];
    const startY = 160;
    const spacing = 95;

    factions.forEach((factionId, index) => {
      const campaign = FACTION_CAMPAIGNS[factionId];
      const y = startY + index * spacing;
      this.createFactionButton(centerX, y, campaign);
    });

    // Back button
    const backBtn = this.add.text(50, 50, '< BACK', {
      font: 'bold 20px Arial',
      color: '#aaaaaa',
    }).setInteractive({ useHandCursor: true });

    backBtn.on('pointerover', () => backBtn.setColor('#ffffff'));
    backBtn.on('pointerout', () => backBtn.setColor('#aaaaaa'));
    backBtn.on('pointerdown', () => {
      this.scene.start('MainMenuScene');
    });

    this.factionSelectContainer.add(backBtn);
  }

  private createFactionButton(x: number, y: number, campaign: FactionCampaign): void {
    const container = this.add.container(x, y);
    const color = FACTION_COLORS[campaign.factionId];

    // Load save data to show progress
    const saveData = CampaignSaveManager.load(campaign.factionId);
    const progress = saveData ? `Mission ${saveData.currentMission} / ${campaign.missions.length}` : 'New Campaign';

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x111122, 0.9);
    bg.fillRoundedRect(-350, -38, 700, 76, 10);
    bg.lineStyle(2, color, 0.8);
    bg.strokeRoundedRect(-350, -38, 700, 76, 10);
    container.add(bg);

    // Faction color indicator
    const indicator = this.add.graphics();
    indicator.fillStyle(color, 1);
    indicator.fillCircle(-310, 0, 20);
    container.add(indicator);

    // Campaign name
    const nameText = this.add.text(-270, -12, campaign.name, {
      font: 'bold 22px Arial',
      color: '#ffffff',
    }).setOrigin(0, 0.5);
    container.add(nameText);

    // Description
    const descText = this.add.text(-270, 12, campaign.description, {
      font: '14px Arial',
      color: '#888888',
    }).setOrigin(0, 0.5);
    container.add(descText);

    // Progress
    const progressText = this.add.text(300, 0, progress, {
      font: '16px Arial',
      color: saveData ? '#44ff44' : '#666666',
    }).setOrigin(1, 0.5);
    container.add(progressText);

    // Hit area
    const hitArea = this.add.rectangle(0, 0, 700, 76).setInteractive({ useHandCursor: true });
    container.add(hitArea);

    hitArea.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x222244, 0.95);
      bg.fillRoundedRect(-350, -38, 700, 76, 10);
      bg.lineStyle(3, color, 1);
      bg.strokeRoundedRect(-350, -38, 700, 76, 10);
    });

    hitArea.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x111122, 0.9);
      bg.fillRoundedRect(-350, -38, 700, 76, 10);
      bg.lineStyle(2, color, 0.8);
      bg.strokeRoundedRect(-350, -38, 700, 76, 10);
    });

    hitArea.on('pointerdown', () => {
      this.selectFaction(campaign.factionId);
    });

    this.factionSelectContainer.add(container);
  }

  private selectFaction(factionId: FactionId): void {
    this.selectedFaction = factionId;
    this.campaignData = FACTION_CAMPAIGNS[factionId];
    this.saveData = CampaignSaveManager.load(factionId);

    // Create new save if none exists
    if (!this.saveData) {
      this.saveData = CampaignSaveManager.createNew(factionId);
      CampaignSaveManager.save(this.saveData);
    }

    audioManager.playSound('ui_select', 0.7);
    this.showMissionMap();
  }

  // ==========================================
  // MISSION MAP
  // ==========================================

  private showMissionMap(): void {
    this.currentPhase = 'mission_map';

    if (this.factionSelectContainer) {
      this.factionSelectContainer.setVisible(false);
    }
    if (this.briefingContainer) {
      this.briefingContainer.setVisible(false);
    }

    this.missionMapContainer = this.add.container(0, 0);

    const centerX = this.scale.width / 2;
    const color = FACTION_COLORS[this.selectedFaction!];

    // Title
    const titleText = this.add.text(centerX, 40, this.campaignData!.name.toUpperCase(), {
      font: 'bold 36px Arial',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.missionMapContainer.add(titleText);

    const subtitleText = this.add.text(centerX, 75, `${this.campaignData!.protagonist}`, {
      font: '18px Arial',
      color: '#888888',
    }).setOrigin(0.5);
    this.missionMapContainer.add(subtitleText);

    // Progress bar
    const currentMission = this.saveData!.currentMission;
    const totalMissions = this.campaignData!.missions.length;
    const progressRatio = (currentMission - 1) / totalMissions;

    const progressBg = this.add.graphics();
    progressBg.fillStyle(0x222222, 1);
    progressBg.fillRect(centerX - 300, 100, 600, 20);
    progressBg.fillStyle(color, 1);
    progressBg.fillRect(centerX - 300, 100, 600 * progressRatio, 20);
    progressBg.lineStyle(1, 0x444444, 1);
    progressBg.strokeRect(centerX - 300, 100, 600, 20);
    this.missionMapContainer.add(progressBg);

    const progressLabel = this.add.text(centerX, 130, `Mission ${currentMission} of ${totalMissions}`, {
      font: '14px Arial',
      color: '#aaaaaa',
    }).setOrigin(0.5);
    this.missionMapContainer.add(progressLabel);

    // Mission list (scrollable area simulation - show current act)
    const currentAct = this.campaignData!.missions.find(m => m.missionNumber === currentMission)?.act ?? 1;
    const actMissions = this.campaignData!.missions.filter(m => m.act === currentAct);

    // Act label
    const actNames = ['', 'Act I: The Convergence', 'Act II: Rising Tensions', 'Act III: Galactic War', 'Act IV: Ascendancy'];
    const actLabel = this.add.text(centerX, 165, actNames[currentAct] ?? 'Unknown Act', {
      font: 'bold 24px Arial',
      color: color.toString(16).padStart(6, '0').replace(/^/, '#'),
    }).setOrigin(0.5);
    this.missionMapContainer.add(actLabel);

    // Mission list — group by missionNumber to detect SC2-style branch pairs
    const completedMissions = this.saveData!.completedMissions;
    const missionsByNumber = new Map<number, CampaignMission[]>();
    for (const m of actMissions) {
      const group = missionsByNumber.get(m.missionNumber) ?? [];
      group.push(m);
      missionsByNumber.set(m.missionNumber, group);
    }

    const startY = 210;
    const spacing = 65;
    let yPos = startY;
    const colorHex = '#' + color.toString(16).padStart(6, '0');

    for (const [, missions] of [...missionsByNumber.entries()].sort(([a], [b]) => a - b)) {
      if (missions.length === 1) {
        this.createMissionButton(centerX, yPos, missions[0]!, currentMission, completedMissions);
        yPos += spacing;
      } else {
        // Branch pair — show "CHOOSE YOUR PATH" header
        const chooseLabel = this.add.text(centerX, yPos - 4, '⬡  CHOOSE YOUR PATH  ⬡', {
          font: 'bold 13px Arial',
          color: colorHex,
        }).setOrigin(0.5);
        this.missionMapContainer.add(chooseLabel);

        const vsLabel = this.add.text(centerX, yPos + 32, 'OR', {
          font: 'bold 14px Arial',
          color: '#555566',
        }).setOrigin(0.5);
        this.missionMapContainer.add(vsLabel);

        this.createMissionButton(centerX - 165, yPos + 32, missions[0]!, currentMission, completedMissions, true);
        this.createMissionButton(centerX + 165, yPos + 32, missions[1]!, currentMission, completedMissions, true);
        yPos += spacing + 30;
      }
    }

    // Back button
    const backBtn = this.add.text(50, 50, '< FACTIONS', {
      font: 'bold 20px Arial',
      color: '#aaaaaa',
    }).setInteractive({ useHandCursor: true });

    backBtn.on('pointerover', () => backBtn.setColor('#ffffff'));
    backBtn.on('pointerout', () => backBtn.setColor('#aaaaaa'));
    backBtn.on('pointerdown', () => {
      this.missionMapContainer.destroy();
      this.showFactionSelect();
    });

    this.missionMapContainer.add(backBtn);

    // Stats display
    this.createStatsPanel();
  }

  private createMissionButton(
    x: number,
    y: number,
    mission: CampaignMission,
    currentMission: number,
    completedMissions: string[],
    compact = false
  ): void {
    const container = this.add.container(x, y);
    const color = FACTION_COLORS[this.selectedFaction!];

    const isCompleted = completedMissions.includes(mission.id);
    const isNotTaken = !isCompleted && mission.missionNumber < currentMission;
    const isAvailable = mission.missionNumber === currentMission;
    const isLocked = mission.missionNumber > currentMission;

    // Layout dimensions: compact (branch card ~280px) or full width (600px)
    const halfW = compact ? 140 : 300;
    const cardW = halfW * 2;
    const cardH = compact ? 60 : 50;

    // Background
    const bg = this.add.graphics();
    if (isCompleted) {
      bg.fillStyle(0x113311, 0.9);
      bg.lineStyle(2, 0x44aa44, 0.8);
    } else if (isNotTaken) {
      bg.fillStyle(0x111111, 0.5);
      bg.lineStyle(1, 0x333355, 0.6);
    } else if (isAvailable) {
      bg.fillStyle(0x112233, 0.95);
      bg.lineStyle(2, color, 1);
    } else {
      bg.fillStyle(0x111111, 0.7);
      bg.lineStyle(1, 0x333333, 0.5);
    }
    bg.fillRoundedRect(-halfW, -cardH / 2, cardW, cardH, 8);
    bg.strokeRoundedRect(-halfW, -cardH / 2, cardW, cardH, 8);
    container.add(bg);

    // Branch tag (for compact mode)
    if (compact && mission.branchTag) {
      const tagColor = isCompleted ? '#44aa44' : isAvailable ? '#ffcc44' : '#445566';
      const tag = this.add.text(0, -cardH / 2 + 4, mission.branchTag, {
        font: 'bold 10px Arial',
        color: tagColor,
      }).setOrigin(0.5, 0);
      container.add(tag);
    }

    // Mission number circle
    const circleX = -halfW + (compact ? 26 : 40);
    const numBg = this.add.graphics();
    numBg.fillStyle(isCompleted ? 0x44aa44 : isNotTaken ? 0x333355 : (isAvailable ? color : 0x333333), 1);
    numBg.fillCircle(circleX, 0, 16);
    container.add(numBg);

    const numText = this.add.text(circleX, 0, `${mission.missionNumber}`, {
      font: 'bold 14px Arial',
      color: '#ffffff',
    }).setOrigin(0.5);
    container.add(numText);

    // Mission title
    const titleX = circleX + 24;
    const titleText = this.add.text(titleX, compact ? -8 : -5, mission.title, {
      font: isAvailable ? `bold ${compact ? 14 : 18}px Arial` : `${compact ? 13 : 18}px Arial`,
      color: isLocked || isNotTaken ? '#666666' : '#ffffff',
      ...(compact ? { wordWrap: { width: cardW - 60 } } : {}),
    }).setOrigin(0, 0.5);
    container.add(titleText);

    // Status indicator (right edge, skip for compact if not enough space)
    let statusText: string;
    let statusColor: string;
    if (isCompleted) {
      statusText = '✓';
      statusColor = '#44aa44';
    } else if (isNotTaken) {
      statusText = compact ? '–' : 'NOT TAKEN';
      statusColor = '#445566';
    } else if (isAvailable) {
      statusText = compact ? '▶' : 'AVAILABLE';
      statusColor = '#44aaff';
    } else {
      statusText = compact ? '🔒' : 'LOCKED';
      statusColor = '#666666';
    }

    const status = this.add.text(halfW - 8, 0, statusText, {
      font: `${compact ? 13 : 14}px Arial`,
      color: statusColor,
    }).setOrigin(1, 0.5);
    container.add(status);

    // Make available missions clickable
    if (isAvailable) {
      const hitArea = this.add.rectangle(0, 0, cardW, cardH).setInteractive({ useHandCursor: true });
      container.add(hitArea);

      hitArea.on('pointerover', () => {
        bg.clear();
        bg.fillStyle(0x223344, 1);
        bg.lineStyle(3, color, 1);
        bg.fillRoundedRect(-halfW, -cardH / 2, cardW, cardH, 8);
        bg.strokeRoundedRect(-halfW, -cardH / 2, cardW, cardH, 8);
      });

      hitArea.on('pointerout', () => {
        bg.clear();
        bg.fillStyle(0x112233, 0.95);
        bg.lineStyle(2, color, 1);
        bg.fillRoundedRect(-halfW, -cardH / 2, cardW, cardH, 8);
        bg.strokeRoundedRect(-halfW, -cardH / 2, cardW, cardH, 8);
      });

      hitArea.on('pointerdown', () => {
        this.selectMission(mission);
      });
    }

    this.missionMapContainer.add(container);
  }

  private createStatsPanel(): void {
    const panelX = this.scale.width - 220;
    const panelY = 170;
    const panelW = 200;
    const color  = FACTION_COLORS[this.selectedFaction!];

    const container = this.add.container(panelX, panelY);

    // ── Campaign stats ──────────────────────────────────────────────────────
    const statsH = 120;
    const statsBg = this.add.graphics();
    statsBg.fillStyle(0x111122, 0.9);
    statsBg.fillRoundedRect(0, 0, panelW, statsH, 8);
    statsBg.lineStyle(1, 0x333344, 1);
    statsBg.strokeRoundedRect(0, 0, panelW, statsH, 8);
    container.add(statsBg);

    const statsTitle = this.add.text(panelW / 2, 12, 'STATS', {
      fontSize: '13px', fontFamily: 'monospace', color: '#556677', fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    container.add(statsTitle);

    const statRows = [
      { label: 'XP',      value: this.saveData!.totalXp.toString() },
      { label: 'Credits', value: this.saveData!.credits.toString() },
      { label: 'Kills',   value: this.saveData!.totalKills.toString() },
    ];
    statRows.forEach((row, i) => {
      const y = 30 + i * 26;
      container.add(this.add.text(10, y, row.label,  { fontSize: '12px', fontFamily: 'monospace', color: '#556677' }));
      container.add(this.add.text(panelW - 10, y, row.value, { fontSize: '13px', fontFamily: 'monospace', color: '#ffffff' }).setOrigin(1, 0));
    });

    // ── Pilot squad ─────────────────────────────────────────────────────────
    const pilots = this.saveData!.campaignPilots;
    if (pilots.length > 0) {
      const squadY = statsH + 14;
      const squadH = 20 + pilots.length * 62;

      const squadBg = this.add.graphics();
      squadBg.fillStyle(0x111122, 0.9);
      squadBg.fillRoundedRect(0, squadY, panelW, squadH, 8);
      squadBg.lineStyle(1, 0x333344, 1);
      squadBg.strokeRoundedRect(0, squadY, panelW, squadH, 8);
      container.add(squadBg);

      const squadTitle = this.add.text(panelW / 2, squadY + 8, 'SQUADRON', {
        fontSize: '13px', fontFamily: 'monospace', color: '#556677', fontStyle: 'bold',
      }).setOrigin(0.5, 0);
      container.add(squadTitle);

      pilots.forEach((pilot, i) => {
        const def = getPilotDefinition(this.selectedFaction!, pilot.pilotId);
        const portraitKey = def?.portraitKey ?? 'portrait_command';
        const callsign    = def?.callsign ?? pilot.pilotId.toUpperCase();
        const py = squadY + 28 + i * 62;

        // Portrait thumbnail (38×57, 2:3 ratio)
        const thumbW = 38;
        const thumbH = 57;
        if (this.textures.exists(portraitKey)) {
          const thumb = this.add.image(thumbW / 2 + 6, py + thumbH / 2, portraitKey);
          thumb.setDisplaySize(thumbW, thumbH);
          container.add(thumb);
        }

        // Faction-color border around portrait
        const thumbBorder = this.add.graphics();
        thumbBorder.lineStyle(1, color, 0.8);
        thumbBorder.strokeRect(5, py, thumbW + 2, thumbH + 2);
        container.add(thumbBorder);

        // Callsign
        container.add(this.add.text(thumbW + 14, py + 2, callsign, {
          fontSize: '12px', fontFamily: 'monospace', color: '#ddeeff', fontStyle: 'bold',
        }));

        // Skill level
        const skillColor = pilot.pilotSkill >= 5 ? '#ffcc00' : pilot.pilotSkill >= 3 ? '#44aaff' : '#aabbcc';
        container.add(this.add.text(thumbW + 14, py + 18, `SKILL ${pilot.pilotSkill}`, {
          fontSize: '11px', fontFamily: 'monospace', color: skillColor,
        }));

        // Ship name
        const shipName = pilot.currentShipId.replace(/_/g, ' ').toUpperCase();
        container.add(this.add.text(thumbW + 14, py + 33, shipName, {
          fontSize: '10px', fontFamily: 'monospace', color: '#445566',
          wordWrap: { width: panelW - thumbW - 22 },
        }));
      });
    }

    this.missionMapContainer.add(container);
  }

  private selectMission(mission: CampaignMission): void {
    this.selectedMission = mission;
    audioManager.playSound('ui_select', 0.7);
    this.showBriefing();
  }

  // ==========================================
  // MISSION BRIEFING
  // ==========================================

  private showBriefing(): void {
    this.currentPhase = 'briefing';

    if (this.missionMapContainer) {
      this.missionMapContainer.setVisible(false);
    }

    this.briefingContainer = this.add.container(0, 0);

    const centerX = this.scale.width / 2;
    const color = FACTION_COLORS[this.selectedFaction!];
    const mission = this.selectedMission!;

    // Protagonist portrait (left side of header)
    const pilots = CAMPAIGN_PILOTS[this.selectedFaction!];
    const protagonist = pilots.find((p) => p.role === 'protagonist') ?? pilots[0];
    if (protagonist) {
      const portraitKey = this.textures.exists(protagonist.portraitKey)
        ? protagonist.portraitKey
        : 'portrait_command';
      const pImg = this.add.image(68, 84, portraitKey);
      pImg.setDisplaySize(85, 128);
      const pBorder = this.add.graphics();
      pBorder.lineStyle(2, color, 0.9);
      pBorder.strokeRect(25, 20, 87, 130);
      this.briefingContainer.add([pBorder, pImg]);
    }

    // Title
    const missionLabel = this.add.text(centerX, 40, `MISSION ${mission.missionNumber}`, {
      font: 'bold 20px Arial',
      color: '#888888',
    }).setOrigin(0.5);
    this.briefingContainer.add(missionLabel);

    const titleText = this.add.text(centerX, 75, mission.title.toUpperCase(), {
      font: 'bold 36px Arial',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.briefingContainer.add(titleText);

    // Briefing panel
    const briefingBg = this.add.graphics();
    briefingBg.fillStyle(0x111122, 0.95);
    briefingBg.fillRoundedRect(centerX - 400, 120, 800, 150, 10);
    briefingBg.lineStyle(1, color, 0.5);
    briefingBg.strokeRoundedRect(centerX - 400, 120, 800, 150, 10);
    this.briefingContainer.add(briefingBg);

    const briefingLabel = this.add.text(centerX - 380, 135, 'BRIEFING', {
      font: 'bold 14px Arial',
      color: color.toString(16).padStart(6, '0').replace(/^/, '#'),
    });
    this.briefingContainer.add(briefingLabel);

    const briefingText = this.add.text(centerX, 195, mission.briefing, {
      font: '16px Arial',
      color: '#cccccc',
      wordWrap: { width: 760 },
      align: 'center',
    }).setOrigin(0.5);
    this.briefingContainer.add(briefingText);

    // Objectives panel
    const objBg = this.add.graphics();
    objBg.fillStyle(0x111122, 0.95);
    objBg.fillRoundedRect(centerX - 400, 290, 380, 180, 10);
    objBg.lineStyle(1, 0x444444, 0.5);
    objBg.strokeRoundedRect(centerX - 400, 290, 380, 180, 10);
    this.briefingContainer.add(objBg);

    const objLabel = this.add.text(centerX - 380, 305, 'OBJECTIVES', {
      font: 'bold 14px Arial',
      color: '#ffaa00',
    });
    this.briefingContainer.add(objLabel);

    mission.objectives.forEach((obj, i) => {
      const y = 340 + i * 30;
      const bulletColor = obj.optional ? '#888888' : '#44ff44';
      const bullet = this.add.text(centerX - 380, y, '●', {
        font: '14px Arial',
        color: bulletColor,
      });
      this.briefingContainer.add(bullet);

      const objText = this.add.text(centerX - 360, y, obj.description + (obj.optional ? ' (Optional)' : ''), {
        font: '15px Arial',
        color: obj.optional ? '#888888' : '#ffffff',
      });
      this.briefingContainer.add(objText);
    });

    // Intel panel
    const intelBg = this.add.graphics();
    intelBg.fillStyle(0x111122, 0.95);
    intelBg.fillRoundedRect(centerX + 20, 290, 380, 180, 10);
    intelBg.lineStyle(1, 0x444444, 0.5);
    intelBg.strokeRoundedRect(centerX + 20, 290, 380, 180, 10);
    this.briefingContainer.add(intelBg);

    const intelLabel = this.add.text(centerX + 40, 305, 'ENEMY INTEL', {
      font: 'bold 14px Arial',
      color: '#ff4444',
    });
    this.briefingContainer.add(intelLabel);

    // Enemy count
    const totalEnemies = mission.enemies.reduce((sum, e) => sum + e.count, 0);
    const hasAce = mission.enemies.some(e => e.isAce);
    const hasBoss = mission.enemies.some(e => e.isBoss);

    const intelLines = [
      `Expected hostiles: ${totalEnemies}`,
      hasAce ? 'Warning: Ace pilot detected' : '',
      hasBoss ? 'Warning: Capital ship detected' : '',
    ].filter(l => l);

    intelLines.forEach((line, i) => {
      const y = 340 + i * 25;
      const lineColor = line.includes('Warning') ? '#ff6644' : '#aaaaaa';
      const text = this.add.text(centerX + 40, y, line, {
        font: '14px Arial',
        color: lineColor,
      });
      this.briefingContainer.add(text);
    });

    // Rewards
    const rewardsY = 400;
    const rewardsLabel = this.add.text(centerX + 40, rewardsY, 'Rewards:', {
      font: 'bold 14px Arial',
      color: '#44ff44',
    });
    this.briefingContainer.add(rewardsLabel);

    const rewardsText = this.add.text(centerX + 40, rewardsY + 22, `XP: ${mission.rewards.xp}  Credits: ${mission.rewards.credits}`, {
      font: '14px Arial',
      color: '#aaaaaa',
    });
    this.briefingContainer.add(rewardsText);

    // Available ships
    const shipsBg = this.add.graphics();
    shipsBg.fillStyle(0x111122, 0.95);
    shipsBg.fillRoundedRect(centerX - 400, 490, 800, 60, 10);
    shipsBg.lineStyle(1, 0x444444, 0.5);
    shipsBg.strokeRoundedRect(centerX - 400, 490, 800, 60, 10);
    this.briefingContainer.add(shipsBg);

    const shipsLabel = this.add.text(centerX - 380, 505, 'AVAILABLE SHIPS', {
      font: 'bold 14px Arial',
      color: '#4488ff',
    });
    this.briefingContainer.add(shipsLabel);

    const shipsText = this.add.text(centerX - 380, 528,
      `Squadron size: ${mission.maxSquadSize} ships  |  ${mission.playerShips.join(', ')}`, {
      font: '14px Arial',
      color: '#888888',
    });
    this.briefingContainer.add(shipsText);

    // Buttons
    const launchBtn = this.add.container(centerX + 150, this.scale.height - 70);
    const launchBg = this.add.graphics();
    launchBg.fillStyle(0x227722, 1);
    launchBg.fillRoundedRect(-100, -30, 200, 60, 10);
    launchBtn.add(launchBg);

    const launchText = this.add.text(0, 0, 'LAUNCH MISSION', {
      font: 'bold 22px Arial',
      color: '#ffffff',
    }).setOrigin(0.5);
    launchBtn.add(launchText);

    const launchHit = this.add.rectangle(0, 0, 200, 60).setInteractive({ useHandCursor: true });
    launchBtn.add(launchHit);

    launchHit.on('pointerover', () => {
      launchBg.clear();
      launchBg.fillStyle(0x33aa33, 1);
      launchBg.fillRoundedRect(-100, -30, 200, 60, 10);
    });

    launchHit.on('pointerout', () => {
      launchBg.clear();
      launchBg.fillStyle(0x227722, 1);
      launchBg.fillRoundedRect(-100, -30, 200, 60, 10);
    });

    launchHit.on('pointerdown', () => {
      this.launchMission();
    });

    this.briefingContainer.add(launchBtn);

    // Back button
    const backBtn = this.add.text(centerX - 300, this.scale.height - 70, '< BACK TO MAP', {
      font: 'bold 18px Arial',
      color: '#aaaaaa',
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

    backBtn.on('pointerover', () => backBtn.setColor('#ffffff'));
    backBtn.on('pointerout', () => backBtn.setColor('#aaaaaa'));
    backBtn.on('pointerdown', () => {
      this.briefingContainer.destroy();
      this.showMissionMap();
    });

    this.briefingContainer.add(backBtn);
  }

  private launchMission(): void {
    // Store mission data for the battle scene
    this.scene.start('CampaignBattleScene', {
      factionId: this.selectedFaction,
      mission: this.selectedMission,
      saveData: this.saveData,
    });
  }
}
