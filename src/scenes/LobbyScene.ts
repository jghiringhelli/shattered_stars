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

import Phaser from "phaser";
import { createHoverButton } from "../ui/ButtonFactory";
import type { FactionId } from "../config";
import { FACTION_COLORS } from "../config";
import {
  networkService,
  type RoomInfo,
  type PlayerInfo,
} from "../services/NetworkService";
import type { BattleSnapshot } from "../multiplayer/BattleStateSerializer";

const FACTION_NAMES: Record<FactionId, string> = {
  terran_hegemony: "Terran Hegemony",
  free_confederation: "Free Confederation",
  synthetic_collective: "Synthetic Collective",
  void_corsairs: "Void Corsairs",
  ascendant_empire: "Ascendant Empire",
};

const ALL_FACTIONS: FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];

export class LobbyScene extends Phaser.Scene {
  private currentView: "browser" | "room" = "browser";
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

  // Chat state (persists across room view rebuilds)
  private chatMessages: Array<{ name: string; text: string }> = [];
  private chatInputBuffer = "";
  private chatFocused = false;

  constructor() {
    super({ key: "LobbyScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0a0a1a);
    this.createHeader();
    this.createRoomBrowser();
    this.createRoomView();
    this.setupInput();
    this.setupChatKeyboard();

    // Register NetworkService event handlers
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

    // Connect in local simulation mode (no URL = no server required)
    networkService.connect();

    // Expose singleton via registry for E2E test access
    this.game.registry.set("networkService", networkService);

    this.showBrowserView();
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
    this.statusText.setText(label);
    this.statusText.setColor("#44ff44");
    this.loadRooms();
  }

  private onRoomCreated(data: unknown): void {
    const { room } = data as { room: RoomInfo };
    this.currentRoom = room;
    this.showRoomView();
    this.statusText.setText("Room created — waiting for players…");
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
    this.statusText.setText("Left room");
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
    this.statusText.setColor("#ff4444");
  }

  /** Server-driven game start: received when all players ready on real P2P server. */
  private onGameStart(data: unknown): void {
    const { seed, players } = data as {
      seed?: number;
      players?: Array<{
        id: string;
        factionId: string | null;
        ships?: string[];
      }>;
    };
    this.startMultiplayerGame(seed, players);
  }

  /**
   * Fired when joining a room that already has a battle in progress.
   * Shows an overlay listing AI-controlled ships so the late joiner can claim one.
   */
  private onBattleSnapshot(data: unknown): void {
    const snapshot = data as BattleSnapshot;
    this.showShipClaimOverlay(snapshot);
  }

  private showShipClaimOverlay(snapshot: BattleSnapshot): void {
    const cx = this.scale.width / 2;
    const overlay = this.add.container(0, 0).setDepth(100);

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.85);
    bg.fillRect(0, 0, this.scale.width, this.scale.height);
    overlay.add(bg);

    overlay.add(
      this.add
        .text(cx, 150, "Battle In Progress — Claim a Ship", {
          font: "bold 28px Arial",
          color: "#ffaa44",
        })
        .setOrigin(0.5),
    );
    overlay.add(
      this.add
        .text(cx, 195, "Choose an AI-controlled ship to take over:", {
          font: "18px Arial",
          color: "#aaaaaa",
        })
        .setOrigin(0.5),
    );

    const aiShips = snapshot.ships.filter((s) => s.owner === "ai");
    aiShips.forEach((ship, i) => {
      const btn = this.createButton(cx, 260 + i * 60, ship.id, () => {
        overlay.destroy();
        this.claimAndStart(ship.id, snapshot);
      });
      overlay.add(btn);
    });

    if (aiShips.length === 0) {
      overlay.add(
        this.add
          .text(cx, 280, "No unclaimed ships available.", {
            font: "20px Arial",
            color: "#ff4444",
          })
          .setOrigin(0.5),
      );
    }
  }

  private claimAndStart(shipId: string, snapshot: BattleSnapshot): void {
    networkService.claimShip(shipId);
    this.registry.set("lateJoinSnapshot", snapshot);
    this.registry.set("lateJoinShipId", shipId);
    this.startMultiplayerGame();
  }

  private onChatMessage(data: unknown): void {
    const { senderName, text } = data as { senderName: string; text: string };
    this.chatMessages.push({ name: senderName, text });
    if (this.chatMessages.length > 8) this.chatMessages.shift();
    if (this.currentView === "room") this.updateRoomView();
  }

  /**
   * Captures keyboard input for the chat box. Runs independently of Phaser's
   * key-binding system so all printable characters are captured when focused.
   */
  private setupChatKeyboard(): void {
    this.input.keyboard!.on("keydown", (event: KeyboardEvent) => {
      if (this.currentView !== "room" || !this.chatFocused) return;
      if (event.key === "Enter") {
        const text = this.chatInputBuffer.trim();
        if (text) {
          networkService.sendChatMessage(text);
          const localName =
            this.players.find((p) => p.id === networkService.getPlayerId())
              ?.name ?? "Me";
          this.chatMessages.push({ name: localName, text });
          if (this.chatMessages.length > 8) this.chatMessages.shift();
          this.chatInputBuffer = "";
        }
      } else if (event.key === "Backspace") {
        this.chatInputBuffer = this.chatInputBuffer.slice(0, -1);
      } else if (event.key.length === 1) {
        if (this.chatInputBuffer.length < 80) this.chatInputBuffer += event.key;
      }
      this.updateRoomView();
    });
  }

  // ==========================================
  // ROOM BROWSER VIEW
  // ==========================================

  private createHeader(): void {
    const centerX = this.scale.width / 2;

    this.headerText = this.add
      .text(centerX, 30, "MULTIPLAYER LOBBY", {
        font: "bold 36px Arial",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const backBtn = this.createButton(100, 30, "BACK", () => {
      if (this.currentView === "room") {
        networkService.leaveRoom();
      } else {
        this.scene.start("MainMenuScene");
      }
    });
    backBtn.setScrollFactor(0);

    this.statusText = this.add
      .text(centerX, this.scale.height - 30, "Connecting…", {
        font: "16px Arial",
        color: "#888888",
      })
      .setOrigin(0.5);
  }

  private createRoomBrowser(): void {
    this.roomListContainer = this.add.container(0, 0);

    this.roomListContainer.add(
      this.add
        .text(this.scale.width / 2, 80, "Available Games", {
          font: "bold 24px Arial",
          color: "#aaaaaa",
        })
        .setOrigin(0.5),
    );

    const createBtn = this.createButton(
      this.scale.width / 2 - 240,
      120,
      "CREATE GAME",
      () => {
        this.createRoom();
      },
    );
    this.roomListContainer.add(createBtn);

    const refreshBtn = this.createButton(
      this.scale.width / 2 - 80,
      120,
      "REFRESH",
      () => {
        this.refreshRoomList();
      },
    );
    this.roomListContainer.add(refreshBtn);

    const joinCodeBtn = this.createButton(
      this.scale.width / 2 + 80,
      120,
      "JOIN CODE",
      () => {
        this.joinByCode();
      },
    );
    this.roomListContainer.add(joinCodeBtn);

    const onlineBtn = this.createButton(
      this.scale.width / 2 + 240,
      120,
      "ONLINE",
      () => {
        this.promptOnlineConnect();
      },
    );
    this.roomListContainer.add(onlineBtn);

    const listBg = this.add.graphics();
    listBg.fillStyle(0x1a1a2a, 0.8);
    listBg.fillRoundedRect(100, 160, this.scale.width - 200, 450, 10);
    listBg.lineStyle(2, 0x333366, 1);
    listBg.strokeRoundedRect(100, 160, this.scale.width - 200, 450, 10);
    this.roomListContainer.add(listBg);

    const headerY = 175;
    [
      [130, "Room Name"],
      [450, "Host"],
      [700, "Players"],
      [850, "Mode"],
      [1000, "Action"],
    ].forEach(([x, label]) => {
      this.roomListContainer.add(
        this.add.text(x as number, headerY, label as string, {
          font: "bold 16px Arial",
          color: "#666666",
        }),
      );
    });
  }

  private loadRooms(): void {
    this.rooms = networkService.getRooms();
    this.updateRoomList();
  }

  private refreshRoomList(): void {
    this.statusText.setText("Refreshing…");
    this.statusText.setColor("#ffff44");
    this.rooms = networkService.getRooms();
    this.updateRoomList();
    this.statusText.setText("Room list updated");
    this.statusText.setColor("#44ff44");
  }

  private updateRoomList(): void {
    const toRemove: Phaser.GameObjects.GameObject[] = [];
    this.roomListContainer.each((child: Phaser.GameObjects.GameObject) => {
      if (child.getData("isRoomEntry")) toRemove.push(child);
    });
    toRemove.forEach((child) => child.destroy());

    if (this.rooms.length === 0) {
      this.roomListContainer.add(
        this.add
          .text(this.scale.width / 2, 350, "No games available. Create one!", {
            font: "20px Arial",
            color: "#666666",
          })
          .setOrigin(0.5)
          .setData("isRoomEntry", true),
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
      rowBg.setData("isRoomEntry", true);
      this.roomListContainer.add(rowBg);

      const roomAlpha = room.isStarted ? 0.4 : 1;
      const addRoomText = (x: number, text: string, color: string) =>
        this.roomListContainer.add(
          this.add
            .text(x, y, text, { font: "16px Arial", color })
            .setData("isRoomEntry", true)
            .setAlpha(roomAlpha),
        );

      addRoomText(130, room.name, "#ffffff");
      addRoomText(450, room.hostName, "#aaaaaa");
      const countColor =
        room.playerCount >= room.maxPlayers ? "#ff4444" : "#44ff44";
      addRoomText(700, `${room.playerCount}/${room.maxPlayers}`, countColor);
      addRoomText(850, "Arcade", "#888888");

      if (!room.isStarted && room.playerCount < room.maxPlayers) {
        const joinBtn = this.createSmallButton(1050, y, "JOIN", () => {
          networkService.joinRoom(room.id);
        });
        joinBtn.setData("isRoomEntry", true);
        this.roomListContainer.add(joinBtn);
      } else if (room.isStarted) {
        const lateBtn = this.createSmallButton(1050, y, "LATE JOIN", () => {
          networkService.joinRoom(room.id);
        });
        lateBtn.setData("isRoomEntry", true);
        this.roomListContainer.add(lateBtn);
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
        .text(centerX, 80, this.currentRoom.name, {
          font: "bold 28px Arial",
          color: "#ffffff",
        })
        .setOrigin(0.5),
    );

    this.playerListContainer.add(
      this.add
        .text(centerX, 115, "Mode: Arcade", {
          font: "18px Arial",
          color: "#888888",
        })
        .setOrigin(0.5),
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
      this.createPlayerSlot(
        centerX,
        startY + i * slotHeight,
        i,
        this.players[i],
      );
    }

    const localId = networkService.getPlayerId();
    const localPlayer = this.players.find((p) => p.id === localId);

    if (localPlayer && !localPlayer.isHost) {
      this.playerListContainer.add(
        this.createButton(
          centerX - 100,
          550,
          localPlayer.isReady ? "NOT READY" : "READY",
          () => {
            networkService.setReady(!localPlayer.isReady);
          },
        ),
      );
    }

    if (localPlayer?.isHost) {
      const allReady =
        this.players.length >= 2 &&
        this.players.every((p) => p.isReady || p.isHost);
      if (networkService.isInLocalMode()) {
        // Local simulation: host directly starts the game
        const startBtn = this.createButton(
          centerX + 100,
          550,
          "START GAME",
          () => {
            if (allReady) this.startMultiplayerGame();
          },
        );
        if (!allReady) startBtn.setAlpha(0.5);
        this.playerListContainer.add(startBtn);
      } else {
        // Online mode: host clicks READY so server can auto-start when all ready
        const readyBtn = this.createButton(
          centerX + 100,
          550,
          localPlayer.isReady ? "UNREADY" : "READY",
          () => {
            networkService.setReady(!localPlayer.isReady);
          },
        );
        this.playerListContainer.add(readyBtn);

        const copyBtn = this.createButton(
          centerX - 100,
          550,
          "COPY CODE",
          () => {
            const code = this.buildInviteCode();
            if (code)
              navigator.clipboard
                .writeText(code)
                .catch(() => window.prompt("Copy invite code:", code));
            this.statusText.setText("Invite code copied to clipboard!");
          },
        );
        this.playerListContainer.add(copyBtn);
      }
    }

    this.buildChatSection(centerX, 590);
  }

  /**
   * Builds an interactive chat section inside `playerListContainer`.
   *
   * @param cx - Horizontal center of the panel.
   * @param topY - Y position for the top of the chat section.
   */
  private buildChatSection(cx: number, topY: number): void {
    const panelW = this.scale.width - 400;
    const historyH = 90;
    const inputH = 30;
    const leftX = cx - panelW / 2;

    const histBg = this.add.graphics();
    histBg.fillStyle(0x111122, 0.9);
    histBg.fillRoundedRect(leftX, topY, panelW, historyH, 6);
    histBg.lineStyle(1, this.chatFocused ? 0x445566 : 0x2a2a3a, 1);
    histBg.strokeRoundedRect(leftX, topY, panelW, historyH, 6);
    this.playerListContainer.add(histBg);

    const visibleMessages = this.chatMessages.slice(-5);
    visibleMessages.forEach((msg, i) => {
      this.playerListContainer.add(
        this.add
          .text(leftX + 8, topY + 8 + i * 16, `${msg.name}: ${msg.text}`, {
            font: "13px Arial",
            color: "#aaaaaa",
          })
          .setOrigin(0, 0),
      );
    });

    const inputBg = this.add.graphics();
    inputBg.fillStyle(this.chatFocused ? 0x1e2233 : 0x0f0f1a, 0.95);
    inputBg.fillRoundedRect(leftX, topY + historyH + 4, panelW, inputH, 4);
    inputBg.lineStyle(1, this.chatFocused ? 0x556688 : 0x2a2a3a, 1);
    inputBg.strokeRoundedRect(leftX, topY + historyH + 4, panelW, inputH, 4);
    this.playerListContainer.add(inputBg);

    const cursor =
      this.chatFocused && Math.floor(this.time.now / 500) % 2 === 0 ? "|" : "";
    const placeholder = this.chatFocused ? "" : "Click here to chat…";
    const displayText = this.chatFocused
      ? this.chatInputBuffer + cursor
      : placeholder;
    const textColor = this.chatFocused ? "#dddddd" : "#444444";
    this.playerListContainer.add(
      this.add
        .text(leftX + 8, topY + historyH + 4 + inputH / 2, displayText, {
          font: "13px Arial",
          color: textColor,
        })
        .setOrigin(0, 0.5),
    );

    const inputHitArea = this.add
      .zone(cx, topY + historyH + 4 + inputH / 2, panelW, inputH)
      .setInteractive();
    inputHitArea.on("pointerdown", () => {
      this.chatFocused = true;
      this.updateRoomView();
    });
    this.playerListContainer.add(inputHitArea);
  }

  private createPlayerSlot(
    x: number,
    y: number,
    index: number,
    player?: PlayerInfo,
  ): void {
    const slotWidth = this.scale.width - 440;
    const slotX = x - slotWidth / 2;

    const slotBg = this.add.graphics();
    if (player) {
      const borderColor = player.factionId
        ? FACTION_COLORS[player.factionId as FactionId]
        : 0x333333;
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
      this.add
        .text(slotX + 20, y + 27, `${index + 1}`, {
          font: "bold 20px Arial",
          color: "#444444",
        })
        .setOrigin(0, 0.5),
    );

    if (!player) {
      this.playerListContainer.add(
        this.add
          .text(slotX + slotWidth / 2, y + 27, "Waiting for player…", {
            font: "16px Arial",
            color: "#444444",
          })
          .setOrigin(0.5),
      );
      return;
    }

    const localId = networkService.getPlayerId();
    const nameColor = player.id === localId ? "#44ffaa" : "#ffffff";
    const displayName =
      player.name +
      (player.isHost ? " (Host)" : "") +
      (player.latency > 0 ? ` ${player.latency}ms` : "");
    this.playerListContainer.add(
      this.add
        .text(slotX + 60, y + 15, displayName, {
          font: "bold 18px Arial",
          color: nameColor,
        })
        .setOrigin(0, 0.5),
    );

    const factionId = player.factionId as FactionId | null;
    const factionName = factionId ? FACTION_NAMES[factionId] : "No faction";
    const factionColor = factionId ? FACTION_COLORS[factionId] : 0x666666;
    this.playerListContainer.add(
      this.add
        .text(slotX + 60, y + 40, factionName, {
          font: "14px Arial",
          color: `#${factionColor.toString(16).padStart(6, "0")}`,
        })
        .setOrigin(0, 0.5),
    );

    const readyLabel = player.isHost
      ? "HOST"
      : player.isReady
        ? "READY"
        : "NOT READY";
    const readyColor = player.isHost
      ? "#ffaa44"
      : player.isReady
        ? "#44ff44"
        : "#ff4444";
    this.playerListContainer.add(
      this.add
        .text(slotX + slotWidth - 30, y + 27, readyLabel, {
          font: "bold 16px Arial",
          color: readyColor,
        })
        .setOrigin(1, 0.5),
    );

    if (player.id === localId) {
      this.playerListContainer.add(
        this.createSmallButton(slotX + 350, y + 27, "Change Faction", () => {
          this.cycleFaction();
        }),
      );
    }
  }

  // ==========================================
  // ROOM ACTIONS
  // ==========================================

  private createRoom(): void {
    const name = `Game ${Math.floor(Math.random() * 1000)}`;
    networkService.createRoom(name, 4, "arcade");
  }

  /** Prompt the user for a server URL and reconnect in online mode. */
  private promptOnlineConnect(): void {
    const url = window.prompt(
      "Enter server WebSocket URL:",
      this.serverUrl ?? "",
    );
    if (url === null) return; // cancelled
    this.serverUrl = url.trim() || null;
    this.statusText.setText("Connecting to server…");
    this.statusText.setColor("#ffff44");
    networkService.connect(this.serverUrl ?? undefined);
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
    const code = window.prompt("Paste invite code:");
    if (!code) return;
    try {
      const decoded = atob(code.trim());
      const pipeIndex = decoded.lastIndexOf("|");
      if (pipeIndex === -1) throw new Error("missing separator");
      const url = decoded.slice(0, pipeIndex);
      const roomId = decoded.slice(pipeIndex + 1);
      if (!url || !roomId) throw new Error("empty parts");
      this.serverUrl = url;
      this.statusText.setText("Connecting…");
      this.statusText.setColor("#ffff44");
      networkService.once(
        "connected",
        () => networkService.joinRoom(roomId),
        this,
      );
      networkService.connect(url);
    } catch {
      this.statusText.setText("Invalid invite code — ask host to re-copy");
      this.statusText.setColor("#ff4444");
    }
  }

  private cycleFaction(): void {
    const localId = networkService.getPlayerId();
    const player = this.players.find((p) => p.id === localId);
    if (!player) return;

    const currentIndex = player.factionId
      ? ALL_FACTIONS.indexOf(player.factionId as FactionId)
      : -1;
    const nextFaction = ALL_FACTIONS[
      (currentIndex + 1) % ALL_FACTIONS.length
    ] as FactionId;
    const onlineSquad = this.registry.get("onlineSquad") as
      | string[]
      | undefined;
    networkService.selectFaction(nextFaction, onlineSquad ?? []);
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
    remotePlayers?: Array<{
      id: string;
      factionId: string | null;
      ships?: string[];
    }>,
  ): void {
    if (!this.currentRoom) return;

    const localId = networkService.getPlayerId();
    const isOnlineMode = !networkService.isInLocalMode();
    const sources =
      remotePlayers ??
      this.players.map((p) => ({
        id: p.id,
        factionId: p.factionId,
        ships: undefined as string[] | undefined,
      }));

    const factions = sources.map((p) => ({
      factionId: (p.factionId ?? "free_confederation") as FactionId,
      controller: (p.id === localId ? "player" : "ai") as "player" | "ai",
      ships: this.resolveShips(p.factionId, p.ships),
    }));

    const resolvedSeed =
      seed ?? networkService.getCurrentBattleSeed() ?? undefined;
    this.registry.set("battleConfig", {
      factions,
      gameMode: this.currentRoom.gameMode,
      pointLimit:
        (this.registry.get("onlinePointLimit") as number | undefined) ?? 200,
      seed: resolvedSeed,
      isOnlineMode,
    });

    this.scene.start("ArcadeBattleScene");
  }

  /**
   * Resolve ship IDs for a player slot, preferring server-provided data over defaults.
   *
   * @param factionId - The player's chosen faction.
   * @param remoteShips - Ships supplied by the server (empty or absent for local sim).
   * @returns Array of ship definition IDs to spawn.
   */
  private resolveShips(
    factionId: string | null,
    remoteShips?: string[],
  ): string[] {
    if (remoteShips && remoteShips.length > 0) return remoteShips;
    return this.getDefaultShipsForFaction(factionId as FactionId | null);
  }

  private getDefaultShipsForFaction(factionId: FactionId | null): string[] {
    if (!factionId) return [];
    const defaults: Record<FactionId, string[]> = {
      terran_hegemony: ["terran_gladius", "terran_viper", "terran_viper"],
      free_confederation: ["confed_falcon", "confed_sparrow", "confed_sparrow"],
      synthetic_collective: [
        "synth_drone",
        "synth_drone",
        "synth_drone",
        "synth_drone",
      ],
      void_corsairs: ["corsair_raider", "corsair_raider", "corsair_cutlass"],
      ascendant_empire: ["ascendant_seraph", "ascendant_seraph"],
    };
    return defaults[factionId] ?? [];
  }

  // ==========================================
  // VIEW MANAGEMENT
  // ==========================================

  private showBrowserView(): void {
    this.currentView = "browser";
    this.headerText.setText("MULTIPLAYER LOBBY");
    this.roomListContainer.setVisible(true);
    this.playerListContainer.setVisible(false);
    this.loadRooms();
  }

  private showRoomView(): void {
    this.currentView = "room";
    this.headerText.setText("GAME ROOM");
    this.roomListContainer.setVisible(false);
    this.playerListContainer.setVisible(true);
    this.updateRoomView();
  }

  // ==========================================
  // UI HELPERS
  // ==========================================

  private createButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    return createHoverButton(
      this,
      x,
      y,
      {
        width: 140,
        height: 40,
        color: 0x334455,
        hoverColor: 0x445566,
        label,
        font: "bold 16px Arial",
      },
      onClick,
    );
  }

  private createSmallButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(0x2a2a3a, 1);
    bg.fillRoundedRect(-45, -12, 90, 24, 4);
    container.add(bg);
    const text = this.add
      .text(0, 0, label, { font: "12px Arial", color: "#aaaaaa" })
      .setOrigin(0.5);
    container.add(text);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-45, -12, 90, 24),
      Phaser.Geom.Rectangle.Contains,
    );
    container.on("pointerover", () => {
      bg.clear();
      bg.fillStyle(0x3a3a5a, 1);
      bg.fillRoundedRect(-45, -12, 90, 24, 4);
      text.setColor("#ffffff");
    });
    container.on("pointerout", () => {
      bg.clear();
      bg.fillStyle(0x2a2a3a, 1);
      bg.fillRoundedRect(-45, -12, 90, 24, 4);
      text.setColor("#aaaaaa");
    });
    container.on("pointerdown", onClick);
    return container;
  }

  private setupInput(): void {
    this.input.keyboard!.on("keydown-ESC", () => {
      if (this.chatFocused) {
        this.chatFocused = false;
        this.updateRoomView();
        return;
      }
      if (this.currentView === "room") {
        networkService.leaveRoom();
      } else {
        this.scene.start("MainMenuScene");
      }
    });
  }
}
