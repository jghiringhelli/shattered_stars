/**
 * SquadBuilderScene — multi-team squad configuration screen.
 *
 * Players configure teams, squads, and ships before battle.
 * Supports 1v1, 2v2, FFA, and asymmetric formats depending on game mode.
 */

import Phaser from 'phaser';
import { createHoverButton } from '../ui/ButtonFactory';
import type { FactionId } from '../config';
import { SHIP_DEFINITIONS } from '../data/ShipDefinitions';
import {
  type GameMode, type TeamEntry, type FormatPreset, type SquadEntry,
  FORMAT_PRESETS, makeSquad, makeTeam, MULTI_TEAM_MODES,
} from '../core/squadTypes';
import type { AIDifficultyLevel } from '../ai/AIDifficulty';
import { FormatPanel } from '../ui/squad/FormatPanel';
import type { FormatPanelState } from '../ui/squad/FormatPanel';
import { TeamPanel } from '../ui/squad/TeamPanel';

type ShipsPickedEvent = {
  slotIndex: number;
  ships: string[];
  loadoutChoices?: Record<string, string>;
};

export class SquadBuilderScene extends Phaser.Scene {
  /** Exposed for E2E tests */
  public gameMode: GameMode = 'arcade';
  /** Exposed for E2E tests */
  public pointLimit = 200;

  private teams: TeamEntry[] = [];
  private aiDifficulty: AIDifficultyLevel = 'normal';
  private activePresetId = '1v1';
  /** teamIdx + squadIdx for the slot currently open in ShipPickerScene */
  private editTarget: { teamIdx: number; squadIdx: number } | null = null;
  private formatPanel!: FormatPanel;
  private teamPanel!: TeamPanel;
  private instructionText!: Phaser.GameObjects.Text;

  constructor() { super({ key: 'SquadBuilderScene' }); }

  /** Exposed for E2E tests — flat list of all squads across all teams */
  public get numFactions(): number { return this.factionSlots.length; }

  /** Exposed for E2E tests */
  public get factionSlots(): SquadEntry[] {
    return this.teams.flatMap((t) => t.squads);
  }

  init(data: Record<string, unknown>): void {
    const allowed: GameMode[] = ['arcade', 'turn_based', 'continuous', 'survival', 'online', 'epic'];
    if (allowed.includes(data?.initialMode as GameMode)) {
      this.gameMode = data.initialMode as GameMode;
    }
    this.pointLimit = this.gameMode === 'epic' ? 400 : 200;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x080c14);
    this.buildDefaultTeams();
    this.createTitle();
    this.createBackButton();
    this.buildPanels();
    this.createBottomBar();
    this.setupInput();
    this.listenForShipsPicked();
  }

  private buildDefaultTeams(): void {
    this.teams = this.teamsFromPreset(FORMAT_PRESETS.find((p) => p.id === '1v1')!);
    // autoFillAll() is called in buildPanels() after TeamPanel is constructed
  }

  private teamsFromPreset(preset: FormatPreset): TeamEntry[] {
    return preset.squadsPerTeam.map((count, teamIdx) =>
      makeTeam(teamIdx, Array.from({ length: count }, (_, squadIdx) =>
        makeSquad(teamIdx * 4 + squadIdx, teamIdx === 0 ? 'player' : 'ai'),
      )),
    );
  }

  private autoFillAll(): void {
    this.teamPanel?.autoFillAll();
  }

  private buildPanels(): void {
    const formatState: FormatPanelState = {
      gameMode: this.gameMode,
      pointLimit: this.pointLimit,
      aiDifficulty: this.aiDifficulty,
      activePreset: this.activePresetId as FormatPanelState['activePreset'],
    };
    this.formatPanel = new FormatPanel(this, formatState);
    this.formatPanel.on('modeChanged', (mode: GameMode) => {
      this.gameMode = mode;
      this.onFormatChange();
    });
    this.formatPanel.on('pointsChanged', (pts: number) => {
      this.pointLimit = pts;
      this.teamPanel.update({ pointLimit: pts });
      this.teamPanel.autoFillAll();
      this.teamPanel.render();
    });
    this.formatPanel.on('difficultyChanged', (d: AIDifficultyLevel) => { this.aiDifficulty = d; });
    this.formatPanel.on('formatChanged', (p: FormatPreset) => {
      this.activePresetId = p.id;
      this.teams = this.teamsFromPreset(p);
      this.teamPanel.update({ teams: this.teams });
      this.teamPanel.autoFillAll();
      this.teamPanel.render();
    });
    this.formatPanel.render();

    this.teamPanel = new TeamPanel(this, {
      teams: this.teams,
      gameMode: this.gameMode,
      pointLimit: this.pointLimit,
      sceneWidth: this.scale.width,
    });
    this.teamPanel.on('squadChanged', () => this.teamPanel.render());
    this.teamPanel.on('editShips', (e: { teamIdx: number; squadIdx: number }) => {
      this.editTarget = e;
      this.openShipPicker(e.teamIdx, e.squadIdx);
    });
    this.teamPanel.on('addSquad', (teamIdx: number) => {
      const idx = this.teams[teamIdx]!.squads.length;
      const squad = this.teamPanel.buildNewSquad(teamIdx, idx);
      this.teams[teamIdx]!.squads.push(squad);
      this.teamPanel.render();
    });
    this.teamPanel.on('removeSquad', (e: { teamIdx: number; squadIdx: number }) => {
      this.teams[e.teamIdx]!.squads.splice(e.squadIdx, 1);
      this.teamPanel.render();
    });
    this.teamPanel.on('addTeam', () => {
      const idx = this.teams.length;
      const squad = this.teamPanel.buildNewSquad(idx, 0);
      this.teams.push(makeTeam(idx, [squad]));
      this.teamPanel.update({ teams: this.teams });
      this.teamPanel.render();
    });
    this.teamPanel.on('removeTeam', (teamIdx: number) => {
      if (this.teams.length <= 2) return;
      this.teams.splice(teamIdx, 1);
      this.teamPanel.update({ teams: this.teams });
      this.teamPanel.render();
    });
    this.teamPanel.autoFillAll();
    this.teamPanel.render();
  }

  private onFormatChange(): void {
    this.formatPanel.setState({ gameMode: this.gameMode });
    this.teamPanel.update({ gameMode: this.gameMode });
    this.teamPanel.render();
  }

  private createTitle(): void {
    this.add.text(this.scale.width / 2, 36, 'SQUAD BUILDER', {
      font: 'bold 28px Arial', color: '#ffffff',
    }).setOrigin(0.5);
    this.instructionText = this.add.text(this.scale.width / 2, this.scale.height - 22,
      'Auto-Fill generates squads automatically · Click a squad header to expand ship list', {
        font: '12px Arial', color: '#334455',
      }).setOrigin(0.5);
  }

  private createBackButton(): void {
    this.add.text(18, 36, '< BACK', { font: '14px Arial', color: '#445566' })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('MainMenuScene'))
      .on('pointerover', function (this: Phaser.GameObjects.Text) { this.setColor('#6688aa'); })
      .on('pointerout',  function (this: Phaser.GameObjects.Text) { this.setColor('#445566'); });
  }

  private createBottomBar(): void {
    const cx = this.scale.width / 2;
    const y = this.scale.height - 52;
    createHoverButton(this, cx - 175, y, {
      width: 150, height: 38, color: 0x1a3322, hoverColor: 0x2a5533,
      label: 'AUTO-FILL ALL', font: '13px Arial', textColor: '#77cc88',
    }, () => { this.teamPanel.autoFillAll(); this.teamPanel.render(); });
    createHoverButton(this, cx, y, {
      width: 130, height: 38, color: 0x2a1a33, hoverColor: 0x4a2a55,
      label: 'RANDOMIZE', font: '13px Arial', textColor: '#aa77cc',
    }, () => this.randomizeAll());
    createHoverButton(this, cx + 165, y, {
      width: 150, height: 38, color: 0x1a3311, hoverColor: 0x2a5522,
      label: 'START BATTLE', font: 'bold 14px Arial', textColor: '#88ee88',
    }, () => this.startBattle());
  }

  private setupInput(): void {
    this.input.keyboard!.on('keydown-ESC', () => this.scene.start('MainMenuScene'));
  }

  private randomizeAll(): void {
    const factions: FactionId[] = [
      'terran_hegemony', 'free_confederation', 'synthetic_collective',
      'void_corsairs', 'ascendant_empire',
    ];
    this.factionSlots.forEach((squad) => {
      squad.factionId = factions[Math.floor(Math.random() * factions.length)] as FactionId;
    });
    this.teamPanel.autoFillAll();
    this.teamPanel.render();
  }

  private openShipPicker(teamIdx: number, squadIdx: number): void {
    const squad = this.teams[teamIdx]?.squads[squadIdx];
    if (!squad?.factionId) return;
    const allSquads = this.factionSlots;
    const globalIdx = this.teams.slice(0, teamIdx)
      .reduce((n, t) => n + t.squads.length, squadIdx);
    this.scene.launch('ShipPickerScene', {
      slotIndex: globalIdx,
      factionId: squad.factionId,
      selectedShips: [...squad.ships],
      pointLimit: this.pointLimit,
    });
  }

  private listenForShipsPicked(): void {
    this.game.events.on('shipsPicked', (data: ShipsPickedEvent) => {
      if (!this.editTarget) return;
      const squad = this.teams[this.editTarget.teamIdx]?.squads[this.editTarget.squadIdx];
      if (!squad) return;
      squad.ships = data.ships;
      squad.loadoutChoices = data.loadoutChoices ?? {};
      squad.pointsUsed = data.ships.reduce(
        (sum, id) => sum + (SHIP_DEFINITIONS[id]?.baseStats.pointCost ?? 0), 0,
      );
      this.editTarget = null;
      this.teamPanel.render();
    });
  }

  /** Exposed for E2E tests */
  public startBattle(): void {
    const squads = this.factionSlots;
    if (squads.some((s) => !s.factionId || s.ships.length === 0)) {
      this.instructionText.setText('All squads must have ships before starting!');
      this.instructionText.setColor('#ff5544');
      return;
    }
    const factions = this.teams.flatMap((team) =>
      team.squads.map((squad) => ({
        factionId: squad.factionId,
        controller: squad.controller,
        ships: squad.ships,
        loadoutChoices: squad.loadoutChoices,
        teamId: team.id,
      })),
    );
    this.registry.set('battleConfig', {
      factions, gameMode: this.gameMode,
      pointLimit: this.pointLimit, aiDifficulty: this.aiDifficulty,
    });
    this.navigateToBattle();
  }

  private navigateToBattle(): void {
    if (this.gameMode === 'turn_based' || this.gameMode === 'epic') {
      this.scene.start('TurnBasedBattleScene');
    } else if (this.gameMode === 'arcade') {
      this.scene.start('ArcadeBattleScene');
    } else if (this.gameMode === 'survival') {
      const player = this.factionSlots.find((s) => s.controller === 'player');
      this.scene.start('SurvivalScene', { factionId: player?.factionId ?? 'free_confederation' });
    } else if (this.gameMode === 'online') {
      const player = this.factionSlots.find((s) => s.controller === 'player');
      this.registry.set('onlineSquad', player?.ships ?? []);
      this.registry.set('onlineFaction', player?.factionId ?? 'free_confederation');
      this.registry.set('onlinePointLimit', this.pointLimit);
      this.scene.start('LobbyScene');
    } else {
      this.scene.start('ContinuousTacticalScene');
    }
  }
}
