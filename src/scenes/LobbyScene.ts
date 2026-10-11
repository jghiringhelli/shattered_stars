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
 *
 * Presentation lives in src/ui/lobby (room browser, room view, status chip,
 * dialogs); this scene owns the network wiring and view state.
 */

import Phaser from "phaser";
import type { FactionId } from "../config";
import {
  networkService,
  type RoomInfo,
  type PlayerInfo,
} from "../services/NetworkService";
import type { BattleSnapshot } from "../multiplayer/BattleStateSerializer";
import {
  addBackButton,
  addMenuBackdrop,
  addMenuHeader,
  type MenuHeader,
} from "../ui/menu/MenuScaffold";
import { MenuFocus } from "../ui/menu/MenuFocus";
import { LobbyRoomBrowser } from "../ui/lobby/LobbyRoomBrowser";
import { renderRoomView } from "../ui/lobby/LobbyRoomView";
import { LobbyStatusChip } from "../ui/lobby/LobbyStatusChip";
import { HoloTextPrompt } from "../ui/lobby/HoloTextPrompt";
import { showShipClaimOverlay } from "../ui/lobby/ShipClaimOverlay";
import { gameModeLabel, nextFaction } from "../ui/lobby/lobbyData";
import {
  buildArcadeBattleConfig,
  buildDogfightInit,
  type LaunchContext,
  type PlayerSource,
} from "../ui/lobby/lobbyLaunch";

/** Painted backdrop behind the lobby. */
const BACKDROP_TEXTURE = "nebula_teal";
/** Status chip distance from the bottom edge. */
const STATUS_INSET = 32;
/** Chat history length and input limit. */
const CHAT_HISTORY = 8;
const CHAT_MAX_LENGTH = 80;
/** Caret blink period (ms) for the chat input. */
const CARET_BLINK_MS = 500;
/** Browser header subtitle. */
const BROWSER_SUBTITLE = "Available games";
/** Squad point limit when the squad builder set none. */
const DEFAULT_POINT_LIMIT = 200;

export class LobbyScene extends Phaser.Scene {
  private currentView: "browser" | "room" = "browser";
  private serverUrl: string | null = null;

  // Room browser state
  private rooms: RoomInfo[] = [];
  private roomListContainer!: Phaser.GameObjects.Container;
  private roomBrowser!: LobbyRoomBrowser;
  private browserFocus!: MenuFocus;

  // Current room state
  private currentRoom: RoomInfo | null = null;
  private players: PlayerInfo[] = [];
  private playerListContainer!: Phaser.GameObjects.Container;

  // UI
  private statusChip!: LobbyStatusChip;
  private header!: MenuHeader;
  private textPrompt!: HoloTextPrompt;

  // Chat state (persists across room view rebuilds)
  private chatMessages: Array<{ name: string; text: string }> = [];
  private chatInputBuffer = "";
  private chatFocused = false;
  /** Last chat key handled (Phaser may re-emit one native event). */
  private lastChatKey: KeyboardEvent | null = null;
  /** Last ESC handled (same re-emission guard). */
  private lastEscKey: KeyboardEvent | null = null;

  constructor() {
    super({ key: "LobbyScene" });
  }

  create(): void {
    addMenuBackdrop(this, { textureId: BACKDROP_TEXTURE });
    this.header = addMenuHeader(this, {
      title: "MULTIPLAYER LOBBY",
      subtitle: BROWSER_SUBTITLE,
    });
    addBackButton(this, () => this.goBack());
    this.statusChip = new LobbyStatusChip(
      this,
      { x: this.scale.width / 2, y: this.scale.height - STATUS_INSET },
      "Connecting…",
    );
    this.textPrompt = new HoloTextPrompt(this);
    this.createRoomBrowser();
    this.createRoomView();
    this.setupInput();
    this.setupChatKeyboard();
    this.registerNetworkHandlers();

    // Connect in local simulation mode (no URL = no server required)
    networkService.connect();

    // Expose singleton via registry for E2E test access
    this.game.registry.set("networkService", networkService);

    this.showBrowserView();
  }

  private registerNetworkHandlers(): void {
    networkService.on("connected", this.onConnected, this);
    networkService.on("room_created", this.onRoomCreated, this);
    networkService.on("room_joined", this.onRoomJoined, this);
    networkService.on("room_left", this.onRoomLeft, this);
    networkService.on("room_update", this.onRoomUpdate, this);
    networkService.on("player_joined", this.onPlayerJoined, this);
    networkService.on("game_start", this.onGameStart, this);
    networkService.on("battle_snapshot", this.onBattleSnapshot, this);
    networkService.on("chat_message", this.onChatMessage, this);
    networkService.on("error", this.onNetworkError, this);
  }

  shutdown(): void {
    networkService.off("connected", this.onConnected, this);
    networkService.off("room_created", this.onRoomCreated, this);
    networkService.off("room_joined", this.onRoomJoined, this);
    networkService.off("room_left", this.onRoomLeft, this);
    networkService.off("room_update", this.onRoomUpdate, this);
    networkService.off("player_joined", this.onPlayerJoined, this);
    networkService.off("game_start", this.onGameStart, this);
    networkService.off("battle_snapshot", this.onBattleSnapshot, this);
    networkService.off("chat_message", this.onChatMessage, this);
    networkService.off("error", this.onNetworkError, this);
    if (this.currentRoom) networkService.leaveRoom();
  }

  // ==========================================
  // NETWORK EVENT HANDLERS
  // ==========================================

  private onConnected(data: unknown): void {
    const { local } = data as { local: boolean };
    const label = local ? "Local Simulation Mode" : "Connected to Server";
    this.statusChip.setStatus(label, "success");
    this.loadRooms();
  }

  private onRoomCreated(data: unknown): void {
    const { room } = data as { room: RoomInfo };
    this.currentRoom = room;
    this.showRoomView();
    this.statusChip.setStatus("Room created — waiting for players…");
    this.sendPreselectedFaction();
  }

  private onRoomJoined(data: unknown): void {
    const { room } = data as { room: RoomInfo };
    this.currentRoom = room;
    this.showRoomView();
    this.statusChip.setStatus(`Joined ${room.name}`);
    this.sendPreselectedFaction();
  }

  private onRoomLeft(_data: unknown): void {
    this.currentRoom = null;
    this.players = [];
    this.showBrowserView();
    this.statusChip.setStatus("Left room");
  }

  /**
   * The real p2p server sends `room_update`'s payload as the room's own
   * fields at the top level (with a nested `players` array) — NOT the
   * `{ room, players }` shape local-simulation mode uses. Destructuring
   * `.room` off the real payload silently produced `undefined`, wiping out
   * `currentRoom` right after `room_created` set it (found via live 2-client
   * testing against the real server; local-sim-only testing never caught it
   * since `broadcastRoomUpdate()` always used the wrapped shape).
   */
  private onRoomUpdate(data: unknown): void {
    const payload = data as
      | { room: RoomInfo; players: PlayerInfo[] }
      | (RoomInfo & { players: PlayerInfo[] });
    if ("room" in payload) {
      this.currentRoom = payload.room;
      this.players = payload.players;
    } else {
      this.currentRoom = payload;
      this.players = payload.players;
    }
    this.updateRoomView();
  }

  private onPlayerJoined(data: unknown): void {
    const { player } = data as { player: PlayerInfo };
    this.statusChip.setStatus(`${player.name} joined!`);
  }

  private onNetworkError(data: unknown): void {
    const { message } = data as { message: string };
    this.statusChip.setStatus(`Error: ${message}`, "danger");
  }

  /** Server-driven game start: received when all players ready on real P2P server. */
  private onGameStart(data: unknown): void {
    const { seed, players } = data as {
      seed?: number;
      players?: PlayerSource[];
    };
    this.startMultiplayerGame(seed, players);
  }

  /**
   * Fired when joining a room that already has a battle in progress.
   * Shows an overlay listing AI-controlled ships so the late joiner can claim one.
   */
  private onBattleSnapshot(data: unknown): void {
    const snapshot = data as BattleSnapshot;
    showShipClaimOverlay(this, snapshot, (shipId) =>
      this.claimAndStart(shipId, snapshot),
    );
  }

  private claimAndStart(shipId: string, snapshot: BattleSnapshot): void {
    networkService.claimShip(shipId);
    this.registry.set("lateJoinSnapshot", snapshot);
    this.registry.set("lateJoinShipId", shipId);
    this.startMultiplayerGame();
  }

  private onChatMessage(data: unknown): void {
    const { senderName, text } = data as { senderName: string; text: string };
    this.pushChatMessage(senderName, text);
    if (this.currentView === "room") this.updateRoomView();
  }

  private pushChatMessage(name: string, text: string): void {
    this.chatMessages.push({ name, text });
    if (this.chatMessages.length > CHAT_HISTORY) this.chatMessages.shift();
  }

  /**
   * Captures keyboard input for the chat box. Runs independently of Phaser's
   * key-binding system so all printable characters are captured when focused.
   */
  private setupChatKeyboard(): void {
    this.input.keyboard!.on("keydown", (event: KeyboardEvent) => {
      if (this.currentView !== "room" || !this.chatFocused) return;
      if (this.textPrompt.isOpen || event === this.lastChatKey) return;
      this.lastChatKey = event;
      if (event.key === "Enter") {
        this.sendChatInput();
      } else if (event.key === "Backspace") {
        this.chatInputBuffer = this.chatInputBuffer.slice(0, -1);
      } else if (event.key.length === 1) {
        if (this.chatInputBuffer.length < CHAT_MAX_LENGTH)
          this.chatInputBuffer += event.key;
      }
      this.updateRoomView();
    });
  }

  private sendChatInput(): void {
    const text = this.chatInputBuffer.trim();
    if (!text) return;
    networkService.sendChatMessage(text);
    const localName =
      this.players.find((p) => p.id === networkService.getPlayerId())?.name ??
      "Me";
    this.pushChatMessage(localName, text);
    this.chatInputBuffer = "";
  }

  // ==========================================
  // ROOM BROWSER VIEW
  // ==========================================

  private createRoomBrowser(): void {
    this.roomListContainer = this.add.container(0, 0);
    this.roomBrowser = new LobbyRoomBrowser(this, this.roomListContainer, {
      onDogfight: () => this.createDogfightRoom(),
      onCreate: () => this.createRoom(),
      onRefresh: () => this.refreshRoomList(),
      onJoinCode: () => this.joinByCode(),
      onOnline: () => this.promptOnlineConnect(),
      onJoinRoom: (roomId) => networkService.joinRoom(roomId),
    });
    this.browserFocus = new MenuFocus(this, this.roomBrowser.actionButtons, {
      columns: this.roomBrowser.actionButtons.length,
      isActive: () => this.currentView === "browser" && !this.textPrompt.isOpen,
    });
  }

  private loadRooms(): void {
    this.rooms = networkService.getRooms();
    this.updateRoomList();
  }

  private refreshRoomList(): void {
    this.statusChip.setStatus("Refreshing…", "warning");
    this.rooms = networkService.getRooms();
    this.updateRoomList();
    this.statusChip.setStatus("Room list updated", "success");
  }

  private updateRoomList(): void {
    this.roomBrowser.renderRooms(this.rooms);
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
    this.header.subtitle?.setText(
      `${this.currentRoom.name}  ·  Mode: ${gameModeLabel(this.currentRoom.gameMode)}`,
    );
    renderRoomView(
      this,
      this.playerListContainer,
      {
        room: this.currentRoom,
        players: this.players,
        localPlayerId: networkService.getPlayerId(),
        isLocalMode: networkService.isInLocalMode(),
        chat: {
          messages: this.chatMessages,
          inputBuffer: this.chatInputBuffer,
          focused: this.chatFocused,
          caretVisible: Math.floor(this.time.now / CARET_BLINK_MS) % 2 === 0,
        },
      },
      {
        onToggleReady: () => this.toggleReady(),
        onStartGame: () => this.startMultiplayerGame(),
        onCopyCode: () => this.copyInviteCode(),
        onChangeFaction: () => this.cycleFaction(),
        onFocusChat: () => {
          this.chatFocused = true;
          this.updateRoomView();
        },
      },
    );
  }

  // ==========================================
  // ROOM ACTIONS
  // ==========================================

  private createRoom(): void {
    const name = `Game ${Math.floor(Math.random() * 1000)}`;
    networkService.createRoom(name, 4, "arcade");
  }

  /** Create a dedicated 2-player room for a networked 1v1 Dogfight match. */
  private createDogfightRoom(): void {
    const name = `Duel ${Math.floor(Math.random() * 1000)}`;
    networkService.createRoom(name, 2, "dogfight");
  }

  private toggleReady(): void {
    const local = this.players.find(
      (p) => p.id === networkService.getPlayerId(),
    );
    if (local) networkService.setReady(!local.isReady);
  }

  private copyInviteCode(): void {
    const code = this.buildInviteCode();
    if (code)
      navigator.clipboard
        .writeText(code)
        .catch(() => window.prompt("Copy invite code:", code));
    this.statusChip.setStatus("Invite code copied to clipboard!");
  }

  /** Prompt the user for a server URL and reconnect in online mode. */
  private promptOnlineConnect(): void {
    // Drop keyboard focus so the ENTER that confirms the dialog cannot
    // re-activate the button that opened it.
    this.browserFocus.clear();
    this.textPrompt.open(
      {
        title: "Online play",
        message: "Enter server WebSocket URL:",
        initialValue: this.serverUrl ?? "",
        confirmLabel: "CONNECT",
      },
      (url) => {
        if (url === null) return; // cancelled
        this.serverUrl = url.trim() || null;
        this.statusChip.setStatus("Connecting to server…", "warning");
        networkService.connect(this.serverUrl ?? undefined);
      },
    );
  }

  /**
   * Encode current server URL + room ID into a base64 invite code.
   * @returns Opaque string safe to paste into a chat message or URL.
   */
  private buildInviteCode(): string {
    if (!this.serverUrl || !this.currentRoom) return "";
    return btoa(`${this.serverUrl}|${this.currentRoom.id}`);
  }

  /**
   * Prompt for a previously copied invite code, decode it, then
   * auto-connect to the embedded server URL and join the room.
   */
  private joinByCode(): void {
    this.browserFocus.clear();
    this.textPrompt.open(
      {
        title: "Join by code",
        message: "Paste invite code:",
        confirmLabel: "JOIN",
      },
      (code) => {
        if (code) this.connectWithInviteCode(code);
      },
    );
  }

  private connectWithInviteCode(code: string): void {
    try {
      const decoded = atob(code.trim());
      const pipeIndex = decoded.lastIndexOf("|");
      if (pipeIndex === -1) throw new Error("missing separator");
      const url = decoded.slice(0, pipeIndex);
      const roomId = decoded.slice(pipeIndex + 1);
      if (!url || !roomId) throw new Error("empty parts");
      this.serverUrl = url;
      this.statusChip.setStatus("Connecting…", "warning");
      networkService.once(
        "connected",
        () => networkService.joinRoom(roomId),
        this,
      );
      networkService.connect(url);
    } catch {
      this.statusChip.setStatus(
        "Invalid invite code — ask host to re-copy",
        "danger",
      );
    }
  }

  private cycleFaction(): void {
    const localId = networkService.getPlayerId();
    const player = this.players.find((p) => p.id === localId);
    if (!player) return;
    const onlineSquad = this.registry.get("onlineSquad") as
      string[] | undefined;
    networkService.selectFaction(
      nextFaction(player.factionId),
      onlineSquad ?? [],
    );
  }

  /**
   * Send the faction + squad pre-selected in SquadBuilderScene to the server.
   * Only fires in real online mode (not local simulation).
   */
  private sendPreselectedFaction(): void {
    if (networkService.isInLocalMode()) return;
    const factionId = this.registry.get("onlineFaction") as string | undefined;
    const ships = this.registry.get("onlineSquad") as string[] | undefined;
    if (factionId) {
      networkService.selectFaction(factionId as FactionId, ships ?? []);
    }
  }

  private startMultiplayerGame(
    seed?: number,
    remotePlayers?: PlayerSource[],
  ): void {
    if (!this.currentRoom) return;
    const context: LaunchContext = {
      localId: networkService.getPlayerId(),
      isOnlineMode: !networkService.isInLocalMode(),
      sources:
        remotePlayers ??
        this.players.map((p) => ({
          id: p.id,
          factionId: p.factionId,
          ships: undefined,
        })),
      seed: seed ?? networkService.getCurrentBattleSeed() ?? undefined,
    };

    // A 2-player "dogfight" room routes into DogfightScene's networked mode,
    // which receives its online config directly as scene init data.
    if (this.currentRoom.gameMode === "dogfight") {
      const init = buildDogfightInit(context);
      if (init) this.scene.start("DogfightScene", init);
      return;
    }

    const pointLimit =
      (this.registry.get("onlinePointLimit") as number | undefined) ??
      DEFAULT_POINT_LIMIT;
    this.registry.set(
      "battleConfig",
      buildArcadeBattleConfig(context, this.currentRoom.gameMode, pointLimit),
    );
    this.scene.start("ArcadeBattleScene");
  }

  // ==========================================
  // VIEW MANAGEMENT
  // ==========================================

  private showBrowserView(): void {
    this.currentView = "browser";
    this.header.title.setText("MULTIPLAYER LOBBY");
    this.header.subtitle?.setText(BROWSER_SUBTITLE);
    this.roomListContainer.setVisible(true);
    this.playerListContainer.setVisible(false);
    this.loadRooms();
  }

  private showRoomView(): void {
    this.currentView = "room";
    this.browserFocus.clear();
    this.header.title.setText("GAME ROOM");
    this.roomListContainer.setVisible(false);
    this.playerListContainer.setVisible(true);
    this.updateRoomView();
  }

  private goBack(): void {
    if (this.currentView === "room") {
      networkService.leaveRoom();
    } else {
      this.scene.start("MainMenuScene");
    }
  }

  private setupInput(): void {
    this.input.keyboard!.on("keydown-ESC", (event: KeyboardEvent) => {
      if (this.textPrompt.isOpen || this.textPrompt.handled(event)) return;
      if (event === this.lastEscKey) return;
      this.lastEscKey = event;
      if (this.chatFocused) {
        this.chatFocused = false;
        this.updateRoomView();
        return;
      }
      this.goBack();
    });
  }
}
