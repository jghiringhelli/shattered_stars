/**
 * Network Service
 *
 * Handles WebSocket communication for multiplayer.
 * Supports both real server connections and local simulation mode.
 */

import Phaser from 'phaser';

// Message types for client-server communication
export type NetworkMessageType =
  | 'join_lobby'
  | 'leave_lobby'
  | 'create_room'
  | 'join_room'
  | 'leave_room'
  | 'room_update'
  | 'player_ready'
  | 'select_faction'
  | 'game_start'
  | 'game_action'
  | 'game_state'
  | 'chat_message'
  | 'player_disconnected'
  | 'error'
  | 'ping'
  | 'pong';

export interface NetworkMessage {
  type: NetworkMessageType;
  payload: unknown;
  timestamp: number;
  senderId?: string;
}

export interface RoomInfo {
  id: string;
  name: string;
  hostId: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  gameMode: 'turn_based' | 'continuous';
  isStarted: boolean;
}

export interface PlayerInfo {
  id: string;
  name: string;
  factionId: string | null;
  isReady: boolean;
  isHost: boolean;
  latency: number;
}

export interface GameAction {
  type: string;
  shipId?: string;
  targetId?: string;
  data?: unknown;
}

type MessageHandler = (message: NetworkMessage) => void;

export class NetworkService extends Phaser.Events.EventEmitter {
  private static instance: NetworkService | null = null;

  private socket: WebSocket | null = null;
  private isConnected = false;
  private playerId: string = '';
  private playerName: string = '';
  private currentRoomId: string | null = null;

  // Local simulation mode
  private isLocalMode = true;
  private localRooms: Map<string, RoomInfo> = new Map();
  private localPlayers: Map<string, PlayerInfo> = new Map();
  private currentBattleSeed: number | null = null; // Seeded RNG for deterministic battles

  // Message handlers
  private handlers: Map<NetworkMessageType, MessageHandler[]> = new Map();

  // Reconnection
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  // Latency tracking
  private lastPingTime = 0;
  private latency = 0;

  private constructor() {
    super();
    this.playerId = this.generatePlayerId();
    this.playerName = `Player_${this.playerId.substring(0, 6)}`;
  }

  static getInstance(): NetworkService {
    if (!NetworkService.instance) {
      NetworkService.instance = new NetworkService();
    }
    return NetworkService.instance;
  }

  // ==========================================
  // CONNECTION MANAGEMENT
  // ==========================================

  async connect(serverUrl?: string): Promise<boolean> {
    if (serverUrl) {
      return this.connectToServer(serverUrl);
    } else {
      // Use local simulation mode
      this.isLocalMode = true;
      this.isConnected = true;
      this.emit('connected', { local: true });
      console.log('[NetworkService] Running in local simulation mode');
      return true;
    }
  }

  private connectToServer(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
          this.isConnected = true;
          this.isLocalMode = false;
          this.reconnectAttempts = 0;
          this.emit('connected', { local: false });
          console.log('[NetworkService] Connected to server');

          // Start ping interval
          this.startPingInterval();

          resolve(true);
        };

        this.socket.onclose = () => {
          this.isConnected = false;
          this.emit('disconnected');
          console.log('[NetworkService] Disconnected from server');

          // Attempt reconnection
          this.attemptReconnect(url);
        };

        this.socket.onerror = (error) => {
          console.error('[NetworkService] WebSocket error:', error);
          this.emit('error', { message: 'Connection error' });
          resolve(false);
        };

        this.socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as NetworkMessage;
            this.handleMessage(message);
          } catch (e) {
            console.error('[NetworkService] Failed to parse message:', e);
          }
        };
      } catch (e) {
        console.error('[NetworkService] Failed to connect:', e);
        resolve(false);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
    this.currentRoomId = null;
    this.emit('disconnected');
  }

  private attemptReconnect(url: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[NetworkService] Max reconnection attempts reached');
      this.emit('reconnect_failed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    console.log(`[NetworkService] Attempting reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connectToServer(url);
    }, delay);
  }

  private startPingInterval(): void {
    setInterval(() => {
      if (this.isConnected && !this.isLocalMode) {
        this.lastPingTime = Date.now();
        this.send({ type: 'ping', payload: {} });
      }
    }, 5000);
  }

  // ==========================================
  // MESSAGE HANDLING
  // ==========================================

  private handleMessage(message: NetworkMessage): void {
    // Handle pong for latency calculation
    if (message.type === 'pong') {
      this.latency = Date.now() - this.lastPingTime;
      this.emit('latency_update', { latency: this.latency });
      return;
    }

    // Store battle seed from game_start for deterministic RNG
    if (message.type === 'game_start') {
      const payload = message.payload as { seed?: number };
      if (payload.seed !== undefined) {
        this.currentBattleSeed = payload.seed;
      }
    }

    // Emit event for this message type
    this.emit(message.type, message.payload);

    // Call registered handlers
    const handlers = this.handlers.get(message.type) || [];
    handlers.forEach((handler) => handler(message));
  }

  on(event: string, fn: (data: unknown) => void, context?: unknown): this {
    return super.on(event, fn, context);
  }

  registerHandler(type: NetworkMessageType, handler: MessageHandler): void {
    const existing = this.handlers.get(type) || [];
    existing.push(handler);
    this.handlers.set(type, existing);
  }

  unregisterHandler(type: NetworkMessageType, handler: MessageHandler): void {
    const existing = this.handlers.get(type) || [];
    const index = existing.indexOf(handler);
    if (index >= 0) {
      existing.splice(index, 1);
    }
  }

  private send(message: Omit<NetworkMessage, 'timestamp'>): void {
    const fullMessage: NetworkMessage = {
      ...message,
      timestamp: Date.now(),
      senderId: this.playerId,
    };

    if (this.isLocalMode) {
      // Process locally
      this.processLocalMessage(fullMessage);
    } else if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(fullMessage));
    }
  }

  // ==========================================
  // LOCAL SIMULATION
  // ==========================================

  private processLocalMessage(message: NetworkMessage): void {
    // Simulate server processing with a small delay
    setTimeout(() => {
      switch (message.type) {
        case 'create_room':
          this.localCreateRoom(message.payload as { name: string; maxPlayers: number; gameMode: string });
          break;
        case 'join_room':
          this.localJoinRoom(message.payload as { roomId: string });
          break;
        case 'leave_room':
          this.localLeaveRoom();
          break;
        case 'player_ready':
          this.localSetReady(message.payload as { isReady: boolean });
          break;
        case 'select_faction':
          this.localSelectFaction(message.payload as { factionId: string });
          break;
        case 'game_action':
          this.localProcessAction(message.payload as GameAction);
          break;
      }
    }, 50);
  }

  private localCreateRoom(data: { name: string; maxPlayers: number; gameMode: string }): void {
    const roomId = `room_${Date.now()}`;
    const room: RoomInfo = {
      id: roomId,
      name: data.name,
      hostId: this.playerId,
      hostName: this.playerName,
      playerCount: 1,
      maxPlayers: data.maxPlayers,
      gameMode: data.gameMode as 'turn_based' | 'continuous',
      isStarted: false,
    };

    this.localRooms.set(roomId, room);
    this.currentRoomId = roomId;

    const player: PlayerInfo = {
      id: this.playerId,
      name: this.playerName,
      factionId: null,
      isReady: false,
      isHost: true,
      latency: 0,
    };
    this.localPlayers.set(this.playerId, player);

    this.emit('room_created', { room });
    this.emit('room_update', { room, players: [player] });

    // Simulate AI players joining
    this.simulateAIPlayers(roomId);
  }

  private localJoinRoom(data: { roomId: string }): void {
    const room = this.localRooms.get(data.roomId);
    if (!room || room.playerCount >= room.maxPlayers) {
      this.emit('error', { message: 'Cannot join room' });
      return;
    }

    room.playerCount++;
    this.currentRoomId = data.roomId;

    const player: PlayerInfo = {
      id: this.playerId,
      name: this.playerName,
      factionId: null,
      isReady: false,
      isHost: false,
      latency: this.latency,
    };
    this.localPlayers.set(this.playerId, player);

    this.emit('room_joined', { room });
    this.broadcastRoomUpdate();
  }

  private localLeaveRoom(): void {
    if (!this.currentRoomId) return;

    const room = this.localRooms.get(this.currentRoomId);
    if (room) {
      room.playerCount--;
      if (room.playerCount <= 0) {
        this.localRooms.delete(this.currentRoomId);
      }
    }

    this.localPlayers.delete(this.playerId);
    this.currentRoomId = null;
    this.emit('room_left', {});
  }

  private localSetReady(data: { isReady: boolean }): void {
    const player = this.localPlayers.get(this.playerId);
    if (player) {
      player.isReady = data.isReady;
      this.broadcastRoomUpdate();
    }
  }

  private localSelectFaction(data: { factionId: string }): void {
    const player = this.localPlayers.get(this.playerId);
    if (player) {
      player.factionId = data.factionId;
      this.broadcastRoomUpdate();
    }
  }

  private localProcessAction(action: GameAction): void {
    // Broadcast action to all players
    this.emit('game_action', { action, senderId: this.playerId });
  }

  private broadcastRoomUpdate(): void {
    if (!this.currentRoomId) return;

    const room = this.localRooms.get(this.currentRoomId);
    if (!room) return;

    const players = Array.from(this.localPlayers.values());
    this.emit('room_update', { room, players });
  }

  private simulateAIPlayers(roomId: string): void {
    // Add simulated AI players after delays
    const aiNames = ['AICommander', 'BotPilot', 'AutoWing'];
    const factions = ['terran_hegemony', 'synthetic_collective', 'void_corsairs'];

    let delay = 2000;
    aiNames.forEach((name, i) => {
      setTimeout(() => {
        const room = this.localRooms.get(roomId);
        if (!room || room.isStarted || room.playerCount >= room.maxPlayers) return;

        const aiId = `ai_${Date.now()}_${i}`;
        const aiPlayer: PlayerInfo = {
          id: aiId,
          name,
          factionId: factions[i] ?? null,
          isReady: false,
          isHost: false,
          latency: Math.floor(Math.random() * 50) + 10,
        };

        this.localPlayers.set(aiId, aiPlayer);
        room.playerCount++;

        this.emit('player_joined', { player: aiPlayer });
        this.broadcastRoomUpdate();

        // AI readies up after a bit
        setTimeout(() => {
          const player = this.localPlayers.get(aiId);
          if (player) {
            player.isReady = true;
            this.broadcastRoomUpdate();
          }
        }, 1500);
      }, delay);
      delay += 3000;
    });
  }

  // ==========================================
  // PUBLIC API
  // ==========================================

  setPlayerName(name: string): void {
    this.playerName = name;
    const player = this.localPlayers.get(this.playerId);
    if (player) {
      player.name = name;
      this.broadcastRoomUpdate();
    }
  }

  getPlayerId(): string {
    return this.playerId;
  }

  getPlayerName(): string {
    return this.playerName;
  }

  getLatency(): number {
    return this.latency;
  }

  getCurrentBattleSeed(): number | null {
    return this.currentBattleSeed;
  }

  isInLocalMode(): boolean {
    return this.isLocalMode;
  }

  isConnectedToServer(): boolean {
    return this.isConnected;
  }

  // Room operations
  createRoom(name: string, maxPlayers: number, gameMode: 'turn_based' | 'continuous'): void {
    this.send({
      type: 'create_room',
      payload: { name, maxPlayers, gameMode },
    });
  }

  joinRoom(roomId: string): void {
    this.send({
      type: 'join_room',
      payload: { roomId },
    });
  }

  leaveRoom(): void {
    this.send({
      type: 'leave_room',
      payload: {},
    });
  }

  setReady(isReady: boolean): void {
    this.send({
      type: 'player_ready',
      payload: { isReady },
    });
  }

  /**
   * Announce faction selection and optional pre-built squad for online battles.
   *
   * @param factionId - The faction this player has chosen.
   * @param ships - Ship definition IDs for the player's squad (online mode only).
   */
  selectFaction(factionId: string, ships: readonly string[] = []): void {
    this.send({
      type: 'select_faction',
      payload: { factionId, ships },
    });
  }

  startGame(): void {
    this.send({
      type: 'game_start',
      payload: {},
    });
  }

  sendGameAction(action: GameAction): void {
    this.send({
      type: 'game_action',
      payload: action,
    });
  }

  sendChatMessage(message: string): void {
    this.send({
      type: 'chat_message',
      payload: { message },
    });
  }

  // Room list (for local mode simulation)
  getRooms(): RoomInfo[] {
    if (this.isLocalMode) {
      return Array.from(this.localRooms.values());
    }
    return [];
  }

  // ==========================================
  // UTILITIES
  // ==========================================

  private generatePlayerId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton export
export const networkService = NetworkService.getInstance();
