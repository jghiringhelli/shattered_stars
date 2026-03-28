/**
 * Multiplayer Lobby Scene
 *
 * Allows players to:
 * - Create or join game rooms
 * - See connected players
 * - Configure game settings
 * - Ready up and start match
 *
 * Networking: driven by NetworkService events (local simulation mode by default;
 * pass a WebSocket URL to connect to a real server in step 2).
 */

import Phaser from 'phaser';
import { createHoverButton } from '../ui/ButtonFactory';
import type { FactionId } from '../config';
import { FACTION_COLORS } from '../config';
import { networkService, type RoomInfo, type PlayerInfo } from '../services/NetworkService';

const FACTION_NAMES: Record<FactionId, string> = {
  terran_hegemony: 'Terran Hegemony',
  free_confederation: 'Free Confederation',
  synthetic_collective: 'Synthetic Collective',
  void_corsairs: 'Void Corsairs',
  ascendant_empire: 'Ascendant Empire',
};

const ALL_FACTIONS: FactionId[] = [
  'terran_hegemony',
  'free_confederation',
  'synthetic_collective',
  'void_corsairs',
  'ascendant_empire',
];

export class LobbyScene extends Phaser.Scene {
  private currentView: 'browser' | 'room' = 'browser';
  private serverUrl: string | null = null;

  // Room browser state
  private rooms: RoomInfo[] = [];
  private roomListContainer!: Phaser.GameObjects.Container;

  // Current room state
  private currentRoom: RoomInfo | null = null;
  private players: PlayerInfo[] = [];
  private playerListContainer!: Phaser.GameObjects.Container;

  // UI
  private statusText!: Phaser.GameObjects.Text;
  private headerText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'LobbyScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0a0a1a);
    this.createHeader();
    this.createRoomBrowser();
    this.createRoomView();
    this.setupInput();

    // Register NetworkService event handlers
    networkService.on('connected',     this.onConnected,     this);
    networkService.on('room_created',  this.onRoomCreated,   this);
    networkService.on('room_joined',   this.onRoomJoined,    this);
    networkService.on('room_left',     this.onRoomLeft,      this);
    networkService.on('room_update',   this.onRoomUpdate,    this);
    networkService.on('player_joined', this.onPlayerJoined,  this);
    networkService.on('game_start',    this.onGameStart,     this);
    networkService.on('error',         this.onNetworkError,  this);

    // Connect in local simulation mode (no URL = no server required)
    networkService.connect();

    this.showBrowserView();
  }

  shutdown(): void {
    networkService.off('connected',     this.onConnected,     this);
    networkService.off('room_created',  this.onRoomCreated,   this);
    networkService.off('room_joined',   this.onRoomJoined,    this);
    networkService.off('room_left',     this.onRoomLeft,      this);
    networkService.off('room_update',   this.onRoomUpdate,    this);
    networkService.off('player_joined', this.onPlayerJoined,  this);
    networkService.off('game_start',    this.onGameStart,     this);
    networkService.off('error',         this.onNetworkError,  this);
    if (this.currentRoom) networkService.leaveRoom();
  }

  // ==========================================
  // NETWORK EVENT HANDLERS
  // ==========================================

  private onConnected(data: unknown): void {
    const { local } = data as { local: boolean };
    const label = local ? 'Local Simulation Mode' : 'Connected to Server';
    this.statusText.setText(label);
    this.statusText.setColor('#44ff44');
    this.loadRooms();
  }

  private onRoomCreated(data: unknown): void {
    const { room } = data as { room: RoomInfo };
    this.currentRoom = room;
    this.showRoomView();
    this.statusText.setText('Room created — waiting for players…');
    this.sendPreselectedFaction();
  }

  private onRoomJoined(data: unknown): void {
    const { room } = data as { room: RoomInfo };
    this.currentRoom = room;
    this.showRoomView();
    this.statusText.setText(`Joined ${room.name}`);
    this.sendPreselectedFaction();
  }

  private onRoomLeft(_data: unknown): void {
    this.currentRoom = null;
    this.players = [];
    this.showBrowserView();
    this.statusText.setText('Left room');
  }

  private onRoomUpdate(data: unknown): void {
    const { room, players } = data as { room: RoomInfo; players: PlayerInfo[] };
    this.currentRoom = room;
    this.players = players;
    this.updateRoomView();
  }

  private onPlayerJoined(data: unknown): void {
    const { player } = data as { player: PlayerInfo };
    this.statusText.setText(`${player.name} joined!`);
  }

  private onNetworkError(data: unknown): void {
    const { message } = data as { message: string };
    this.statusText.setText(`Error: ${message}`);
    this.statusText.setColor('#ff4444');
  }

  /** Server-driven game start: received when all players ready on real P2P server. */
  private onGameStart(data: unknown): void {
    const { seed, players } = data as {
      seed?: number;
      players?: Array<{ id: string; factionId: string | null; ships?: string[] }>;
    };
    this.startMultiplayerGame(seed, players);
  }

  // ==========================================
  // ROOM BROWSER VIEW
  // ==========================================

  private createHeader(): void {
    const centerX = this.scale.width / 2;

    this.headerText = this.add
      .text(centerX, 30, 'MULTIPLAYER LOBBY', {
        font: 'bold 36px Arial',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const backBtn = this.createButton(100, 30, 'BACK', () => {
      if (this.currentView === 'room') {
        networkService.leaveRoom();
      } else {
        this.scene.start('MainMenuScene');
      }
    });
    backBtn.setScrollFactor(0);

    this.statusText = this.add
      .text(centerX, this.scale.height - 30, 'Connecting…', {
        font: '16px Arial',
        color: '#888888',
      })
      .setOrigin(0.5);
  }

  private createRoomBrowser(): void {
    this.roomListContainer = this.add.container(0, 0);

    this.roomListContainer.add(
      this.add
        .text(this.scale.width / 2, 80, 'Available Games', {
          font: 'bold 24px Arial',
          color: '#aaaaaa',
        })
        .setOrigin(0.5)
    );

    const createBtn = this.createButton(this.scale.width / 2, 120, 'CREATE GAME', () => {
      this.createRoom();
    });
    this.roomListContainer.add(createBtn);

    const refreshBtn = this.createButton(this.scale.width / 2 + 200, 120, 'REFRESH', () => {
      this.refreshRoomList();
    });
    this.roomListContainer.add(refreshBtn);

    const onlineBtn = this.createButton(this.scale.width / 2 + 380, 120, 'ONLINE', () => {
      this.promptOnlineConnect();
    });
    this.roomListContainer.add(onlineBtn);

    const listBg = this.add.graphics();
    listBg.fillStyle(0x1a1a2a, 0.8);
    listBg.fillRoundedRect(100, 160, this.scale.width - 200, 450, 10);
    listBg.lineStyle(2, 0x333366, 1);
    listBg.strokeRoundedRect(100, 160, this.scale.width - 200, 450, 10);
    this.roomListContainer.add(listBg);

    const headerY = 175;
    [
      [130, 'Room Name'], [450, 'Host'], [700, 'Players'], [850, 'Mode'], [1000, 'Action'],
    ].forEach(([x, label]) => {
      this.roomListContainer.add(
        this.add.text(x as number, headerY, label as string, { font: 'bold 16px Arial', color: '#666666' })
      );
    });
  }

  private loadRooms(): void {
    this.rooms = networkService.getRooms();
    this.updateRoomList();
  }

  private refreshRoomList(): void {
    this.statusText.setText('Refreshing…');
    this.statusText.setColor('#ffff44');
    this.rooms = networkService.getRooms();
    this.updateRoomList();
    this.statusText.setText('Room list updated');
    this.statusText.setColor('#44ff44');
  }

  private updateRoomList(): void {
    const toRemove: Phaser.GameObjects.GameObject[] = [];
    this.roomListContainer.each((child: Phaser.GameObjects.GameObject) => {
      if (child.getData('isRoomEntry')) toRemove.push(child);
    });
    toRemove.forEach((child) => child.destroy());

    if (this.rooms.length === 0) {
      this.roomListContainer.add(
        this.add
          .text(this.scale.width / 2, 350, 'No games available. Create one!', {
            font: '20px Arial',
            color: '#666666',
          })
          .setOrigin(0.5)
          .setData('isRoomEntry', true)
      );
      return;
    }

    const startY = 210;
    const rowHeight = 50;

    this.rooms.forEach((room, index) => {
      const y = startY + index * rowHeight;

      const rowBg = this.add.graphics();
      rowBg.fillStyle(index % 2 === 0 ? 0x222233 : 0x1a1a2a, 0.8);
      rowBg.fillRect(110, y - 15, this.scale.width - 220, rowHeight - 5);
      rowBg.setData('isRoomEntry', true);
      this.roomListContainer.add(rowBg);

      const roomAlpha = room.isStarted ? 0.4 : 1;
      const addRoomText = (x: number, text: string, color: string) =>
        this.roomListContainer.add(
          this.add.text(x, y, text, { font: '16px Arial', color }).setData('isRoomEntry', true).setAlpha(roomAlpha)
        );

      addRoomText(130, room.name, '#ffffff');
      addRoomText(450, room.hostName, '#aaaaaa');
      const countColor = room.playerCount >= room.maxPlayers ? '#ff4444' : '#44ff44';
      addRoomText(700, `${room.playerCount}/${room.maxPlayers}`, countColor);
      addRoomText(850, room.gameMode === 'continuous' ? 'Continuous' : 'Turn-Based', '#888888');

      if (!room.isStarted && room.playerCount < room.maxPlayers) {
        const joinBtn = this.createSmallButton(1050, y, 'JOIN', () => {
          networkService.joinRoom(room.id);
        });
        joinBtn.setData('isRoomEntry', true);
        this.roomListContainer.add(joinBtn);
      }
    });
  }

  // ==========================================
  // ROOM VIEW
  // ==========================================

  private createRoomView(): void {
    this.playerListContainer = this.add.container(0, 0);
    this.playerListContainer.setVisible(false);
  }

  private updateRoomView(): void {
    this.playerListContainer.removeAll(true);
    if (!this.currentRoom) return;

    const centerX = this.scale.width / 2;

    this.playerListContainer.add(
      this.add
        .text(centerX, 80, this.currentRoom.name, { font: 'bold 28px Arial', color: '#ffffff' })
        .setOrigin(0.5)
    );

    this.playerListContainer.add(
      this.add
        .text(centerX, 115, `Mode: ${this.currentRoom.gameMode === 'continuous' ? 'Continuous' : 'Turn-Based'}`, {
          font: '18px Arial',
          color: '#888888',
        })
        .setOrigin(0.5)
    );

    const listBg = this.add.graphics();
    listBg.fillStyle(0x1a1a2a, 0.8);
    listBg.fillRoundedRect(200, 150, this.scale.width - 400, 350, 10);
    listBg.lineStyle(2, 0x333366, 1);
    listBg.strokeRoundedRect(200, 150, this.scale.width - 400, 350, 10);
    this.playerListContainer.add(listBg);

    const startY = 180;
    const slotHeight = 70;
    for (let i = 0; i < (this.currentRoom.maxPlayers || 4); i++) {
      this.createPlayerSlot(centerX, startY + i * slotHeight, i, this.players[i]);
    }

    const localId = networkService.getPlayerId();
    const localPlayer = this.players.find((p) => p.id === localId);

    if (localPlayer && !localPlayer.isHost) {
      this.playerListContainer.add(
        this.createButton(centerX - 100, 550, localPlayer.isReady ? 'NOT READY' : 'READY', () => {
          networkService.setReady(!localPlayer.isReady);
        })
      );
    }

    if (localPlayer?.isHost) {
      const allReady = this.players.length >= 2 && this.players.every((p) => p.isReady || p.isHost);
      if (networkService.isInLocalMode()) {
        // Local simulation: host directly starts the game
        const startBtn = this.createButton(centerX + 100, 550, 'START GAME', () => {
          if (allReady) this.startMultiplayerGame();
        });
        if (!allReady) startBtn.setAlpha(0.5);
        this.playerListContainer.add(startBtn);
      } else {
        // Online mode: host clicks READY so server can auto-start when all ready
        const readyBtn = this.createButton(centerX + 100, 550, localPlayer.isReady ? 'UNREADY' : 'READY', () => {
          networkService.setReady(!localPlayer.isReady);
        });
        this.playerListContainer.add(readyBtn);
      }
    }

    this.playerListContainer.add(
      this.add
        .text(centerX, 630, 'Chat coming soon…', { font: '14px Arial', color: '#444444' })
        .setOrigin(0.5)
    );
  }

  private createPlayerSlot(x: number, y: number, index: number, player?: PlayerInfo): void {
    const slotWidth = this.scale.width - 440;
    const slotX = x - slotWidth / 2;

    const slotBg = this.add.graphics();
    if (player) {
      const borderColor = player.factionId ? FACTION_COLORS[player.factionId as FactionId] : 0x333333;
      slotBg.fillStyle(0x222233, 0.9);
      slotBg.fillRoundedRect(slotX, y, slotWidth, 55, 8);
      slotBg.lineStyle(2, borderColor, 0.8);
      slotBg.strokeRoundedRect(slotX, y, slotWidth, 55, 8);
    } else {
      slotBg.fillStyle(0x111122, 0.5);
      slotBg.fillRoundedRect(slotX, y, slotWidth, 55, 8);
      slotBg.lineStyle(1, 0x333344, 0.5);
      slotBg.strokeRoundedRect(slotX, y, slotWidth, 55, 8);
    }
    this.playerListContainer.add(slotBg);
    this.playerListContainer.add(
      this.add.text(slotX + 20, y + 27, `${index + 1}`, { font: 'bold 20px Arial', color: '#444444' }).setOrigin(0, 0.5)
    );

    if (!player) {
      this.playerListContainer.add(
        this.add
          .text(slotX + slotWidth / 2, y + 27, 'Waiting for player…', { font: '16px Arial', color: '#444444' })
          .setOrigin(0.5)
      );
      return;
    }

    const localId = networkService.getPlayerId();
    const nameColor = player.id === localId ? '#44ffaa' : '#ffffff';
    const displayName = player.name + (player.isHost ? ' (Host)' : '') + (player.latency > 0 ? ` ${player.latency}ms` : '');
    this.playerListContainer.add(
      this.add.text(slotX + 60, y + 15, displayName, { font: 'bold 18px Arial', color: nameColor }).setOrigin(0, 0.5)
    );

    const factionId = player.factionId as FactionId | null;
    const factionName = factionId ? FACTION_NAMES[factionId] : 'No faction';
    const factionColor = factionId ? FACTION_COLORS[factionId] : 0x666666;
    this.playerListContainer.add(
      this.add
        .text(slotX + 60, y + 40, factionName, {
          font: '14px Arial',
          color: `#${factionColor.toString(16).padStart(6, '0')}`,
        })
        .setOrigin(0, 0.5)
    );

    const readyLabel = player.isHost ? 'HOST' : player.isReady ? 'READY' : 'NOT READY';
    const readyColor = player.isHost ? '#ffaa44' : player.isReady ? '#44ff44' : '#ff4444';
    this.playerListContainer.add(
      this.add
        .text(slotX + slotWidth - 30, y + 27, readyLabel, { font: 'bold 16px Arial', color: readyColor })
        .setOrigin(1, 0.5)
    );

    if (player.id === localId) {
      this.playerListContainer.add(
        this.createSmallButton(slotX + 350, y + 27, 'Change Faction', () => {
          this.cycleFaction();
        })
      );
    }
  }

  // ==========================================
  // ROOM ACTIONS
  // ==========================================

  private createRoom(): void {
    const name = `Game ${Math.floor(Math.random() * 1000)}`;
    networkService.createRoom(name, 4, 'continuous');
  }

  /** Prompt the user for a server URL and reconnect in online mode. */
  private promptOnlineConnect(): void {
    const url = window.prompt(
      'Enter server WebSocket URL:',
      this.serverUrl ?? 'ws://192.168.1.100:8080'
    );
    if (url === null) return; // cancelled
    this.serverUrl = url.trim() || null;
    this.statusText.setText('Connecting to server…');
    this.statusText.setColor('#ffff44');
    networkService.connect(this.serverUrl ?? undefined);
  }

  private cycleFaction(): void {
    const localId = networkService.getPlayerId();
    const player = this.players.find((p) => p.id === localId);
    if (!player) return;

    const currentIndex = player.factionId ? ALL_FACTIONS.indexOf(player.factionId as FactionId) : -1;
    const nextFaction = ALL_FACTIONS[(currentIndex + 1) % ALL_FACTIONS.length] as FactionId;
    const onlineSquad = this.registry.get('onlineSquad') as string[] | undefined;
    networkService.selectFaction(nextFaction, onlineSquad ?? []);
  }

  /**
   * Send the faction + squad pre-selected in SquadBuilderScene to the server.
   * Only fires in real online mode (not local simulation).
   */
  private sendPreselectedFaction(): void {
    if (networkService.isInLocalMode()) return;
    const factionId = this.registry.get('onlineFaction') as string | undefined;
    const ships = this.registry.get('onlineSquad') as string[] | undefined;
    if (factionId) {
      networkService.selectFaction(factionId as FactionId, ships ?? []);
    }
  }

  private startMultiplayerGame(
    seed?: number,
    remotePlayers?: Array<{ id: string; factionId: string | null; ships?: string[] }>,
  ): void {
    if (!this.currentRoom) return;

    const localId = networkService.getPlayerId();
    const isOnlineMode = !networkService.isInLocalMode();
    const sources = remotePlayers ?? this.players.map((p) => ({
      id: p.id,
      factionId: p.factionId,
      ships: undefined as string[] | undefined,
    }));

    const factions = sources.map((p) => ({
      factionId: (p.factionId ?? 'free_confederation') as FactionId,
      controller: (p.id === localId ? 'player' : 'ai') as 'player' | 'ai',
      ships: this.resolveShips(p.factionId, p.ships),
    }));

    const resolvedSeed = seed ?? networkService.getCurrentBattleSeed() ?? undefined;
    this.registry.set('battleConfig', {
      factions,
      gameMode: this.currentRoom.gameMode,
      pointLimit: 200,
      seed: resolvedSeed,
      isOnlineMode,
    });

    this.scene.start('TurnBasedBattleScene');
  }

  /**
   * Resolve ship IDs for a player slot, preferring server-provided data over defaults.
   *
   * @param factionId - The player's chosen faction.
   * @param remoteShips - Ships supplied by the server (empty or absent for local sim).
   * @returns Array of ship definition IDs to spawn.
   */
  private resolveShips(factionId: string | null, remoteShips?: string[]): string[] {
    if (remoteShips && remoteShips.length > 0) return remoteShips;
    return this.getDefaultShipsForFaction(factionId as FactionId | null);
  }

  private getDefaultShipsForFaction(factionId: FactionId | null): string[] {
    if (!factionId) return [];
    const defaults: Record<FactionId, string[]> = {
      terran_hegemony:      ['terran_gladius', 'terran_viper', 'terran_viper'],
      free_confederation:   ['confed_falcon', 'confed_sparrow', 'confed_sparrow'],
      synthetic_collective: ['synth_drone', 'synth_drone', 'synth_drone', 'synth_drone'],
      void_corsairs:        ['corsair_raider', 'corsair_raider', 'corsair_cutlass'],
      ascendant_empire:     ['ascendant_seraph', 'ascendant_seraph'],
    };
    return defaults[factionId] ?? [];
  }

  // ==========================================
  // VIEW MANAGEMENT
  // ==========================================

  private showBrowserView(): void {
    this.currentView = 'browser';
    this.headerText.setText('MULTIPLAYER LOBBY');
    this.roomListContainer.setVisible(true);
    this.playerListContainer.setVisible(false);
    this.loadRooms();
  }

  private showRoomView(): void {
    this.currentView = 'room';
    this.headerText.setText('GAME ROOM');
    this.roomListContainer.setVisible(false);
    this.playerListContainer.setVisible(true);
    this.updateRoomView();
  }

  // ==========================================
  // UI HELPERS
  // ==========================================

  private createButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    return createHoverButton(this, x, y, {
      width: 140, height: 40, color: 0x334455, hoverColor: 0x445566,
      label, font: 'bold 16px Arial',
    }, onClick);
  }

  private createSmallButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(0x2a2a3a, 1);
    bg.fillRoundedRect(-45, -12, 90, 24, 4);
    container.add(bg);
    const text = this.add.text(0, 0, label, { font: '12px Arial', color: '#aaaaaa' }).setOrigin(0.5);
    container.add(text);
    container.setInteractive(new Phaser.Geom.Rectangle(-45, -12, 90, 24), Phaser.Geom.Rectangle.Contains);
    container.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x3a3a5a, 1);
      bg.fillRoundedRect(-45, -12, 90, 24, 4);
      text.setColor('#ffffff');
    });
    container.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x2a2a3a, 1);
      bg.fillRoundedRect(-45, -12, 90, 24, 4);
      text.setColor('#aaaaaa');
    });
    container.on('pointerdown', onClick);
    return container;
  }

  private setupInput(): void {
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.currentView === 'room') {
        networkService.leaveRoom();
      } else {
        this.scene.start('MainMenuScene');
      }
    });
  }
}
