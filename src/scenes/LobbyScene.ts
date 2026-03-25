/**
 * Multiplayer Lobby Scene
 *
 * Allows players to:
 * - Create or join game rooms
 * - See connected players
 * - Configure game settings
 * - Ready up and start match
 */

import Phaser from 'phaser';
import { createHoverButton } from '../ui/ButtonFactory';
import type { FactionId } from '../config';
import { FACTION_COLORS } from '../config';

interface Player {
  id: string;
  name: string;
  factionId: FactionId | null;
  isReady: boolean;
  isHost: boolean;
}

interface Room {
  id: string;
  name: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  gameMode: 'turn_based' | 'continuous';
}

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

  // Room browser state
  private rooms: Room[] = [];
  private roomListContainer!: Phaser.GameObjects.Container;

  // Current room state
  private currentRoom: Room | null = null;
  private players: Player[] = [];
  private localPlayerId: string = '';
  private playerListContainer!: Phaser.GameObjects.Container;

  // UI
  private statusText!: Phaser.GameObjects.Text;
  private headerText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'LobbyScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0a0a1a);

    // Generate a random player ID for now (would come from auth in real implementation)
    this.localPlayerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.createHeader();
    this.createRoomBrowser();
    this.createRoomView();
    this.setupInput();

    // Start in browser view
    this.showBrowserView();

    // Simulate some test rooms
    this.simulateTestRooms();
  }

  private createHeader(): void {
    const centerX = this.scale.width / 2;

    this.headerText = this.add
      .text(centerX, 30, 'MULTIPLAYER LOBBY', {
        font: 'bold 36px Arial',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Back button
    const backBtn = this.createButton(100, 30, 'BACK', () => {
      if (this.currentView === 'room') {
        this.leaveRoom();
      } else {
        this.scene.start('MainMenuScene');
      }
    });
    backBtn.setScrollFactor(0);

    this.statusText = this.add
      .text(centerX, this.scale.height - 30, 'Connecting to server...', {
        font: '16px Arial',
        color: '#888888',
      })
      .setOrigin(0.5);

    // Simulate connection
    this.time.delayedCall(1000, () => {
      this.statusText.setText('Connected | Players online: 42');
      this.statusText.setColor('#44ff44');
    });
  }

  // ==========================================
  // ROOM BROWSER VIEW
  // ==========================================

  private createRoomBrowser(): void {
    this.roomListContainer = this.add.container(0, 0);

    // Title
    this.roomListContainer.add(
      this.add
        .text(this.scale.width / 2, 80, 'Available Games', {
          font: 'bold 24px Arial',
          color: '#aaaaaa',
        })
        .setOrigin(0.5)
    );

    // Create room button
    const createBtn = this.createButton(this.scale.width / 2, 120, 'CREATE GAME', () => {
      this.createRoom();
    });
    this.roomListContainer.add(createBtn);

    // Refresh button
    const refreshBtn = this.createButton(this.scale.width / 2 + 200, 120, 'REFRESH', () => {
      this.refreshRoomList();
    });
    this.roomListContainer.add(refreshBtn);

    // Room list area
    const listBg = this.add.graphics();
    listBg.fillStyle(0x1a1a2a, 0.8);
    listBg.fillRoundedRect(100, 160, this.scale.width - 200, 450, 10);
    listBg.lineStyle(2, 0x333366, 1);
    listBg.strokeRoundedRect(100, 160, this.scale.width - 200, 450, 10);
    this.roomListContainer.add(listBg);

    // Column headers
    const headerY = 175;
    this.roomListContainer.add(
      this.add.text(130, headerY, 'Room Name', { font: 'bold 16px Arial', color: '#666666' })
    );
    this.roomListContainer.add(
      this.add.text(450, headerY, 'Host', { font: 'bold 16px Arial', color: '#666666' })
    );
    this.roomListContainer.add(
      this.add.text(700, headerY, 'Players', { font: 'bold 16px Arial', color: '#666666' })
    );
    this.roomListContainer.add(
      this.add.text(850, headerY, 'Mode', { font: 'bold 16px Arial', color: '#666666' })
    );
    this.roomListContainer.add(
      this.add.text(1000, headerY, 'Action', { font: 'bold 16px Arial', color: '#666666' })
    );
  }

  private updateRoomList(): void {
    // Remove old room entries (keep headers and background)
    const toRemove: Phaser.GameObjects.GameObject[] = [];
    this.roomListContainer.each((child: Phaser.GameObjects.GameObject) => {
      if (child.getData('isRoomEntry')) {
        toRemove.push(child);
      }
    });
    toRemove.forEach((child) => child.destroy());

    // Add room entries
    const startY = 210;
    const rowHeight = 50;

    if (this.rooms.length === 0) {
      const noRoomsText = this.add
        .text(this.scale.width / 2, 350, 'No games available. Create one!', {
          font: '20px Arial',
          color: '#666666',
        })
        .setOrigin(0.5)
        .setData('isRoomEntry', true);
      this.roomListContainer.add(noRoomsText);
      return;
    }

    this.rooms.forEach((room, index) => {
      const y = startY + index * rowHeight;

      // Row background
      const rowBg = this.add.graphics();
      rowBg.fillStyle(index % 2 === 0 ? 0x222233 : 0x1a1a2a, 0.8);
      rowBg.fillRect(110, y - 15, this.scale.width - 220, rowHeight - 5);
      rowBg.setData('isRoomEntry', true);
      this.roomListContainer.add(rowBg);

      // Room name
      const nameText = this.add
        .text(130, y, room.name, {
          font: '18px Arial',
          color: '#ffffff',
        })
        .setData('isRoomEntry', true);
      this.roomListContainer.add(nameText);

      // Host name
      const hostText = this.add
        .text(450, y, room.hostName, {
          font: '16px Arial',
          color: '#aaaaaa',
        })
        .setData('isRoomEntry', true);
      this.roomListContainer.add(hostText);

      // Player count
      const countColor = room.playerCount >= room.maxPlayers ? '#ff4444' : '#44ff44';
      const countText = this.add
        .text(700, y, `${room.playerCount}/${room.maxPlayers}`, {
          font: 'bold 18px Arial',
          color: countColor,
        })
        .setData('isRoomEntry', true);
      this.roomListContainer.add(countText);

      // Game mode
      const modeText = this.add
        .text(850, y, room.gameMode === 'continuous' ? 'Continuous' : 'Turn-Based', {
          font: '16px Arial',
          color: '#888888',
        })
        .setData('isRoomEntry', true);
      this.roomListContainer.add(modeText);

      // Join button
      if (room.playerCount < room.maxPlayers) {
        const joinBtn = this.createSmallButton(1050, y, 'JOIN', () => {
          this.joinRoom(room.id);
        });
        joinBtn.setData('isRoomEntry', true);
        this.roomListContainer.add(joinBtn);
      }
    });
  }

  private simulateTestRooms(): void {
    this.rooms = [
      {
        id: 'room_1',
        name: 'Casual Game',
        hostName: 'SpacePilot42',
        playerCount: 1,
        maxPlayers: 4,
        gameMode: 'continuous',
      },
      {
        id: 'room_2',
        name: 'Ranked Match',
        hostName: 'CommanderX',
        playerCount: 3,
        maxPlayers: 4,
        gameMode: 'turn_based',
      },
      {
        id: 'room_3',
        name: 'Beginners Welcome',
        hostName: 'NewbHelper',
        playerCount: 2,
        maxPlayers: 6,
        gameMode: 'continuous',
      },
    ];

    this.updateRoomList();
  }

  private refreshRoomList(): void {
    this.statusText.setText('Refreshing room list...');
    this.statusText.setColor('#ffff44');

    // Simulate refresh
    this.time.delayedCall(500, () => {
      this.simulateTestRooms();
      this.statusText.setText('Room list updated');
      this.statusText.setColor('#44ff44');
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
    // Clear existing
    this.playerListContainer.removeAll(true);

    if (!this.currentRoom) return;

    const centerX = this.scale.width / 2;

    // Room title
    this.playerListContainer.add(
      this.add
        .text(centerX, 80, this.currentRoom.name, {
          font: 'bold 28px Arial',
          color: '#ffffff',
        })
        .setOrigin(0.5)
    );

    // Game mode
    this.playerListContainer.add(
      this.add
        .text(centerX, 115, `Mode: ${this.currentRoom.gameMode === 'continuous' ? 'Continuous' : 'Turn-Based'}`, {
          font: '18px Arial',
          color: '#888888',
        })
        .setOrigin(0.5)
    );

    // Player list area
    const listBg = this.add.graphics();
    listBg.fillStyle(0x1a1a2a, 0.8);
    listBg.fillRoundedRect(200, 150, this.scale.width - 400, 350, 10);
    listBg.lineStyle(2, 0x333366, 1);
    listBg.strokeRoundedRect(200, 150, this.scale.width - 400, 350, 10);
    this.playerListContainer.add(listBg);

    // Player slots
    const startY = 180;
    const slotHeight = 70;

    for (let i = 0; i < (this.currentRoom.maxPlayers || 4); i++) {
      const y = startY + i * slotHeight;
      const player = this.players[i];

      this.createPlayerSlot(centerX, y, i, player);
    }

    // Ready button (only for non-hosts)
    const localPlayer = this.players.find((p) => p.id === this.localPlayerId);
    if (localPlayer && !localPlayer.isHost) {
      const readyBtn = this.createButton(centerX - 100, 550, localPlayer.isReady ? 'NOT READY' : 'READY', () => {
        this.toggleReady();
      });
      this.playerListContainer.add(readyBtn);
    }

    // Start button (only for host when all ready)
    if (localPlayer?.isHost) {
      const allReady = this.players.length >= 2 && this.players.every((p) => p.isReady || p.isHost);
      const startBtn = this.createButton(centerX + 100, 550, 'START GAME', () => {
        if (allReady) {
          this.startMultiplayerGame();
        }
      });

      if (!allReady) {
        // Dim the button if not all ready
        startBtn.setAlpha(0.5);
      }

      this.playerListContainer.add(startBtn);
    }

    // Chat area placeholder
    this.playerListContainer.add(
      this.add
        .text(centerX, 630, 'Chat coming soon...', {
          font: '14px Arial',
          color: '#444444',
        })
        .setOrigin(0.5)
    );
  }

  private createPlayerSlot(x: number, y: number, index: number, player?: Player): void {
    const slotWidth = this.scale.width - 440;
    const slotX = x - slotWidth / 2;

    // Slot background
    const slotBg = this.add.graphics();
    if (player) {
      const factionColor = player.factionId ? FACTION_COLORS[player.factionId] : 0x333333;
      slotBg.fillStyle(0x222233, 0.9);
      slotBg.fillRoundedRect(slotX, y, slotWidth, 55, 8);
      slotBg.lineStyle(2, factionColor, 0.8);
      slotBg.strokeRoundedRect(slotX, y, slotWidth, 55, 8);
    } else {
      slotBg.fillStyle(0x111122, 0.5);
      slotBg.fillRoundedRect(slotX, y, slotWidth, 55, 8);
      slotBg.lineStyle(1, 0x333344, 0.5);
      slotBg.strokeRoundedRect(slotX, y, slotWidth, 55, 8);
    }
    this.playerListContainer.add(slotBg);

    // Slot number
    this.playerListContainer.add(
      this.add
        .text(slotX + 20, y + 27, `${index + 1}`, {
          font: 'bold 20px Arial',
          color: '#444444',
        })
        .setOrigin(0, 0.5)
    );

    if (player) {
      // Player name
      const nameColor = player.id === this.localPlayerId ? '#44ffaa' : '#ffffff';
      this.playerListContainer.add(
        this.add
          .text(slotX + 60, y + 15, player.name + (player.isHost ? ' (Host)' : ''), {
            font: 'bold 18px Arial',
            color: nameColor,
          })
          .setOrigin(0, 0.5)
      );

      // Faction
      const factionName = player.factionId ? FACTION_NAMES[player.factionId] : 'No faction';
      const factionColor = player.factionId ? FACTION_COLORS[player.factionId] : 0x666666;
      this.playerListContainer.add(
        this.add
          .text(slotX + 60, y + 40, factionName, {
            font: '14px Arial',
            color: `#${factionColor.toString(16).padStart(6, '0')}`,
          })
          .setOrigin(0, 0.5)
      );

      // Ready status
      const readyText = player.isHost ? 'HOST' : player.isReady ? 'READY' : 'NOT READY';
      const readyColor = player.isHost ? '#ffaa44' : player.isReady ? '#44ff44' : '#ff4444';
      this.playerListContainer.add(
        this.add
          .text(slotX + slotWidth - 30, y + 27, readyText, {
            font: 'bold 16px Arial',
            color: readyColor,
          })
          .setOrigin(1, 0.5)
      );

      // Faction change button (only for local player)
      if (player.id === this.localPlayerId) {
        const factionBtn = this.createSmallButton(slotX + 350, y + 27, 'Change', () => {
          this.cycleFaction();
        });
        this.playerListContainer.add(factionBtn);
      }
    } else {
      // Empty slot
      this.playerListContainer.add(
        this.add
          .text(slotX + slotWidth / 2, y + 27, 'Waiting for player...', {
            font: '16px Arial',
            color: '#444444',
          })
          .setOrigin(0.5)
      );
    }
  }

  // ==========================================
  // ROOM ACTIONS
  // ==========================================

  private createRoom(): void {
    // Create a new room with local player as host
    this.currentRoom = {
      id: `room_${Date.now()}`,
      name: `Game ${Math.floor(Math.random() * 1000)}`,
      hostName: 'You',
      playerCount: 1,
      maxPlayers: 4,
      gameMode: 'continuous',
    };

    this.players = [
      {
        id: this.localPlayerId,
        name: 'You',
        factionId: 'free_confederation',
        isReady: false,
        isHost: true,
      },
    ];

    this.showRoomView();
    this.statusText.setText('Room created. Waiting for players...');

    // Simulate other players joining
    this.time.delayedCall(2000, () => {
      if (this.currentRoom) {
        this.players.push({
          id: 'ai_1',
          name: 'AIPlayer1',
          factionId: 'terran_hegemony',
          isReady: false,
          isHost: false,
        });
        this.updateRoomView();
        this.statusText.setText('A player joined!');
      }
    });

    this.time.delayedCall(4000, () => {
      if (this.currentRoom) {
        const aiPlayer = this.players.find((p) => p.id === 'ai_1');
        if (aiPlayer) {
          aiPlayer.isReady = true;
          this.updateRoomView();
          this.statusText.setText('AIPlayer1 is ready!');
        }
      }
    });
  }

  private joinRoom(roomId: string): void {
    const room = this.rooms.find((r) => r.id === roomId);
    if (!room) return;

    this.currentRoom = room;

    // Simulate existing players
    this.players = [
      {
        id: 'host_player',
        name: room.hostName,
        factionId: 'terran_hegemony',
        isReady: false,
        isHost: true,
      },
      {
        id: this.localPlayerId,
        name: 'You',
        factionId: 'free_confederation',
        isReady: false,
        isHost: false,
      },
    ];

    // Add other existing players
    for (let i = 1; i < room.playerCount - 1; i++) {
      this.players.push({
        id: `other_${i}`,
        name: `Player${i}`,
        factionId: ALL_FACTIONS[i % ALL_FACTIONS.length] as FactionId,
        isReady: true,
        isHost: false,
      });
    }

    this.showRoomView();
    this.statusText.setText(`Joined ${room.name}`);
  }

  private leaveRoom(): void {
    this.currentRoom = null;
    this.players = [];
    this.showBrowserView();
    this.statusText.setText('Left room');
  }

  private toggleReady(): void {
    const player = this.players.find((p) => p.id === this.localPlayerId);
    if (player) {
      player.isReady = !player.isReady;
      this.updateRoomView();
      this.statusText.setText(player.isReady ? 'You are ready!' : 'You are not ready');
    }
  }

  private cycleFaction(): void {
    const player = this.players.find((p) => p.id === this.localPlayerId);
    if (!player) return;

    const currentIndex = player.factionId ? ALL_FACTIONS.indexOf(player.factionId) : -1;
    const nextIndex = (currentIndex + 1) % ALL_FACTIONS.length;
    player.factionId = ALL_FACTIONS[nextIndex] as FactionId;

    this.updateRoomView();
  }

  private startMultiplayerGame(): void {
    if (!this.currentRoom) return;

    // Store multiplayer config
    this.registry.set('multiplayerConfig', {
      roomId: this.currentRoom.id,
      gameMode: this.currentRoom.gameMode,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        factionId: p.factionId,
        isHost: p.isHost,
        isLocal: p.id === this.localPlayerId,
      })),
    });

    // For now, start a local battle with the configured players
    // In real implementation, this would start networked game
    this.registry.set('battleConfig', {
      factions: this.players.map((p) => ({
        factionId: p.factionId,
        controller: p.id === this.localPlayerId ? 'player' : 'ai',
        ships: this.getDefaultShipsForFaction(p.factionId),
      })),
      gameMode: this.currentRoom.gameMode,
      pointLimit: 200,
    });

    // Start appropriate battle scene
    if (this.currentRoom.gameMode === 'turn_based') {
      this.scene.start('TurnBasedBattleScene');
    } else {
      this.scene.start('ContinuousTacticalScene');
    }
  }

  private getDefaultShipsForFaction(factionId: FactionId | null): string[] {
    if (!factionId) return [];

    // Return default ship loadout per faction
    const defaultShips: Record<FactionId, string[]> = {
      terran_hegemony: ['terran_gladius', 'terran_viper', 'terran_viper'],
      free_confederation: ['confed_falcon', 'confed_sparrow', 'confed_sparrow'],
      synthetic_collective: ['synth_drone', 'synth_drone', 'synth_drone', 'synth_drone'],
      void_corsairs: ['corsair_raider', 'corsair_raider', 'corsair_cutlass'],
      ascendant_empire: ['ascendant_seraph', 'ascendant_seraph'],
    };

    return defaultShips[factionId] || [];
  }

  // ==========================================
  // VIEW MANAGEMENT
  // ==========================================

  private showBrowserView(): void {
    this.currentView = 'browser';
    this.headerText.setText('MULTIPLAYER LOBBY');
    this.roomListContainer.setVisible(true);
    this.playerListContainer.setVisible(false);
    this.updateRoomList();
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
    bg.fillRoundedRect(-35, -12, 70, 24, 4);
    container.add(bg);

    const text = this.add
      .text(0, 0, label, {
        font: '12px Arial',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);
    container.add(text);

    container.setInteractive(new Phaser.Geom.Rectangle(-35, -12, 70, 24), Phaser.Geom.Rectangle.Contains);

    container.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x3a3a5a, 1);
      bg.fillRoundedRect(-35, -12, 70, 24, 4);
      text.setColor('#ffffff');
    });

    container.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x2a2a3a, 1);
      bg.fillRoundedRect(-35, -12, 70, 24, 4);
      text.setColor('#aaaaaa');
    });

    container.on('pointerdown', onClick);

    return container;
  }

  private setupInput(): void {
    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.currentView === 'room') {
        this.leaveRoom();
      } else {
        this.scene.start('MainMenuScene');
      }
    });
  }
}
