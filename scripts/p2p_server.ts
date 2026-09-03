#!/usr/bin/env node

/**
 * Peer-to-Peer Game Server
 *
 * Minimal WebSocket server for multiplayer X-Wing battles.
 * - One player (host) runs this server
 * - Other players connect via ws://host-ip:8080
 * - Server broadcasts game state and syncs RNG seeds for determinism
 *
 * Usage:
 *   npx tsx scripts/p2p_server.ts [--port 8080] [--verbose]
 */

import WebSocket, { WebSocketServer } from "ws";

// ─── Game State ────────────────────────────────────────────────────────────

interface PlayerState {
  id: string;
  name: string;
  factionId: string | null;
  ships: string[]; // Ship definition IDs selected by this player
  isReady: boolean;
  isHost: boolean;
  latency: number;
  wsInstance?: WebSocket;
}

interface RoomState {
  id: string;
  name: string;
  hostId: string;
  maxPlayers: number;
  players: Map<string, PlayerState>;
  gameMode: "turn_based" | "continuous";
  isStarted: boolean;
  battleSeed: number; // Deterministic RNG seed for all clients
  createdAt: number;
  /** Latest end-of-turn snapshot sent by the host via update_snapshot. */
  snapshot: unknown;
  /** shipId -> id of the player who currently controls it (AI ships claimed mid-battle). */
  claimedShips: Map<string, string>;
}

/** Server-side hard cap for room size, applied even if a client requests more. */
const HARD_MAX_PLAYERS = 8;
/** Maximum accepted message size in bytes (guards against OOM from oversized snapshots). */
const MAX_MESSAGE_BYTES = 256 * 1024;

// ─── Server State ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const PORT = parseInt(
  args.includes("--port")
    ? args[args.indexOf("--port") + 1]
    : (process.env.PORT ?? "8080"),
  10,
);
const VERBOSE = args.includes("--verbose");

const rooms = new Map<string, RoomState>();
const playerToRoom = new Map<string, string>();

function log(msg: string): void {
  if (VERBOSE) {
    console.log(`[P2P] ${new Date().toISOString()} ${msg}`);
  }
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}

// ─── Message Types ────────────────────────────────────────────────────────

interface NetworkMessage {
  type: string;
  payload: unknown;
  timestamp: number;
  senderId?: string;
}

function sendToPlayer(player: PlayerState, message: NetworkMessage): void {
  if (player.wsInstance && player.wsInstance.readyState === WebSocket.OPEN) {
    player.wsInstance.send(JSON.stringify(message));
  }
}

function broadcastToRoom(
  roomId: string,
  message: NetworkMessage,
  excludePlayerId?: string,
): void {
  const room = rooms.get(roomId);
  if (!room) return;

  for (const [playerId, player] of room.players) {
    if (excludePlayerId && playerId === excludePlayerId) continue;
    sendToPlayer(player, message);
  }
}

// ─── Room Management ────────────────────────────────────────────────────────

function createRoom(data: {
  hostId: string;
  hostName: string;
  name: string;
  maxPlayers: number;
  gameMode: string;
}): RoomState {
  const roomId = generateId("room");
  const cappedMax = Math.max(
    2,
    Math.min(HARD_MAX_PLAYERS, data.maxPlayers | 0),
  );
  const room: RoomState = {
    id: roomId,
    name: data.name,
    hostId: data.hostId,
    maxPlayers: cappedMax,
    players: new Map(),
    gameMode: data.gameMode as "turn_based" | "continuous",
    isStarted: false,
    battleSeed: generateSeed(),
    createdAt: Date.now(),
    snapshot: null,
    claimedShips: new Map(),
  };

  rooms.set(roomId, room);
  return room;
}

function joinRoom(
  roomId: string,
  player: PlayerState,
): { ok: true } | { ok: false; reason: string } {
  const room = rooms.get(roomId);
  if (!room) return { ok: false, reason: "Room not found" };
  if (room.players.size >= room.maxPlayers)
    return { ok: false, reason: "Room is full" };
  if (room.players.has(player.id))
    return { ok: false, reason: "Already in room" };

  room.players.set(player.id, player);
  playerToRoom.set(player.id, roomId);
  return { ok: true };
}

function removePlayerFromRoom(playerId: string): RoomState | undefined {
  const roomId = playerToRoom.get(playerId);
  if (!roomId) return undefined;

  const room = rooms.get(roomId);
  if (!room) return undefined;

  room.players.delete(playerId);
  playerToRoom.delete(playerId);

  // Release any ships this player had claimed so others can pick them up
  for (const [shipId, ownerId] of room.claimedShips) {
    if (ownerId === playerId) room.claimedShips.delete(shipId);
  }

  // Clean up empty rooms
  if (room.players.size === 0) {
    rooms.delete(roomId);
    log(`Room ${roomId} destroyed (empty)`);
  }

  return room;
}

function getRoomStatus(room: RoomState): object {
  return {
    id: room.id,
    name: room.name,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    playerCount: room.players.size,
    gameMode: room.gameMode,
    isStarted: room.isStarted,
    players: Array.from(room.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      factionId: p.factionId,
      ships: p.ships,
      isReady: p.isReady,
      isHost: p.isHost,
      latency: p.latency,
    })),
  };
}

// ─── Message Handlers ────────────────────────────────────────────────────────

function handleMessage(player: PlayerState, message: NetworkMessage): void {
  const roomId = playerToRoom.get(player.id);

  switch (message.type) {
    case "create_room": {
      const payload = message.payload as {
        name: string;
        maxPlayers: number;
        gameMode: string;
      };
      const room = createRoom({
        hostId: player.id,
        hostName: player.name,
        name: payload.name,
        maxPlayers: payload.maxPlayers,
        gameMode: payload.gameMode,
      });

      player.isHost = true;
      room.players.set(player.id, player);
      playerToRoom.set(player.id, room.id);

      log(`Room created: ${room.id} by ${player.name}`);

      sendToPlayer(player, {
        type: "room_created",
        payload: { room: getRoomStatus(room) },
        timestamp: Date.now(),
      });

      broadcastToRoom(room.id, {
        type: "room_update",
        payload: getRoomStatus(room),
        timestamp: Date.now(),
      });
      break;
    }

    case "join_room": {
      const payload = message.payload as { roomId: string };
      const result = joinRoom(payload.roomId, player);

      if (!result.ok) {
        sendToPlayer(player, {
          type: "error",
          payload: { message: result.reason },
          timestamp: Date.now(),
        });
        break;
      }

      const room = rooms.get(payload.roomId)!;
      log(`Player ${player.name} joined room ${room.id}`);

      sendToPlayer(player, {
        type: "room_joined",
        payload: { room: getRoomStatus(room) },
        timestamp: Date.now(),
      });

      // Deliver the latest battle state to a player joining a started game
      if (room.isStarted && room.snapshot !== null) {
        sendToPlayer(player, {
          type: "battle_snapshot",
          payload: room.snapshot,
          timestamp: Date.now(),
        });
      }

      broadcastToRoom(room.id, {
        type: "player_joined",
        payload: {
          player: {
            id: player.id,
            name: player.name,
            factionId: player.factionId,
            isReady: player.isReady,
            isHost: player.isHost,
            latency: player.latency,
          },
        },
        timestamp: Date.now(),
      });

      broadcastToRoom(room.id, {
        type: "room_update",
        payload: getRoomStatus(room),
        timestamp: Date.now(),
      });
      break;
    }

    case "leave_room": {
      if (!roomId) break;

      const room = removePlayerFromRoom(player.id);
      if (room) {
        log(`Player ${player.name} left room ${roomId}`);

        broadcastToRoom(roomId, {
          type: "player_left",
          payload: { playerId: player.id },
          timestamp: Date.now(),
        });

        if (room.players.size > 0) {
          broadcastToRoom(roomId, {
            type: "room_update",
            payload: getRoomStatus(room),
            timestamp: Date.now(),
          });
        }
      }
      break;
    }

    case "player_ready": {
      if (!roomId) break;

      const room = rooms.get(roomId);
      if (!room) break;

      const payload = message.payload as { isReady: boolean };
      player.isReady = payload.isReady;

      log(`Player ${player.name} ready=${payload.isReady}`);

      broadcastToRoom(roomId, {
        type: "room_update",
        payload: getRoomStatus(room),
        timestamp: Date.now(),
      });

      // Check if all players are ready
      const allReady = Array.from(room.players.values()).every(
        (p) => p.isReady,
      );
      if (allReady && room.players.size >= 2 && !room.isStarted) {
        room.isStarted = true;
        room.battleSeed = generateSeed();

        log(`Battle starting in room ${roomId} with seed ${room.battleSeed}`);

        broadcastToRoom(roomId, {
          type: "game_start",
          payload: {
            seed: room.battleSeed,
            players: getRoomStatus(room).players,
          },
          timestamp: Date.now(),
        });
      }
      break;
    }

    case "select_faction": {
      if (!roomId) break;

      const room = rooms.get(roomId);
      if (!room || room.isStarted) break;

      const payload = message.payload as {
        factionId: string;
        ships?: string[];
      };
      player.factionId = payload.factionId;
      if (Array.isArray(payload.ships)) {
        player.ships = payload.ships;
      }

      log(
        `Player ${player.name} selected faction ${payload.factionId} (${player.ships.length} ships)`,
      );

      broadcastToRoom(roomId, {
        type: "room_update",
        payload: getRoomStatus(room),
        timestamp: Date.now(),
      });
      break;
    }

    case "game_action": {
      if (!roomId) break;

      const room = rooms.get(roomId);
      if (!room || !room.isStarted) break;

      // Actor validation: any shipId in the action must belong to the sender's squad
      const action = message.payload as { shipId?: string } | null;
      if (
        action &&
        typeof action.shipId === "string" &&
        !player.ships.includes(action.shipId)
      ) {
        log(
          `Rejected game_action from ${player.name}: shipId ${action.shipId} not in their squad`,
        );
        break;
      }

      log(
        `Action from ${player.name}: ${JSON.stringify(message.payload).substring(0, 50)}...`,
      );

      // Relay to all other room members (exclude sender to avoid echo)
      broadcastToRoom(
        roomId,
        {
          type: "game_action",
          payload: message.payload,
          senderId: player.id,
          timestamp: Date.now(),
        },
        player.id,
      );
      break;
    }

    case "ping": {
      sendToPlayer(player, {
        type: "pong",
        payload: {},
        timestamp: Date.now(),
      });
      break;
    }

    case "chat_message": {
      if (!roomId) break;
      const room = rooms.get(roomId);
      if (!room) break;
      const text = String(
        (message.payload as { message?: string }).message ?? "",
      ).slice(0, 200);
      if (!text.trim()) break;
      broadcastToRoom(roomId, {
        type: "chat_message",
        payload: { senderName: player.name, senderId: player.id, text },
        timestamp: Date.now(),
      });
      log(`Chat from ${player.name}: ${text}`);
      break;
    }

    case "update_snapshot": {
      if (!roomId) break;
      const room = rooms.get(roomId);
      if (!room || !room.isStarted) break;

      // Store the latest end-of-turn snapshot for delivery to late joiners
      room.snapshot = message.payload;
      log(`Snapshot stored for room ${roomId}`);
      break;
    }

    case "claim_ship": {
      if (!roomId) break;
      const room = rooms.get(roomId);
      if (!room) break;

      const payload = message.payload as { shipId: string };
      const existingOwner = room.claimedShips.get(payload.shipId);

      // Reject claims on a ship another player already controls — without this
      // check, `player.ships` (used by game_action's actor validation) never
      // actually gets the shipId added, so the claimant could never control
      // the ship they thought they'd claimed, and two players could each
      // believe they own the same ship.
      if (existingOwner && existingOwner !== player.id) {
        sendToPlayer(player, {
          type: "error",
          payload: { message: `Ship ${payload.shipId} is already claimed` },
          timestamp: Date.now(),
        });
        break;
      }

      room.claimedShips.set(payload.shipId, player.id);
      if (!player.ships.includes(payload.shipId)) {
        player.ships.push(payload.shipId);
      }

      log(`Player ${player.name} claimed ship ${payload.shipId}`);

      // Notify all other room members that a ship has been claimed
      broadcastToRoom(
        roomId,
        {
          type: "ship_claimed",
          payload: { playerId: player.id, shipId: payload.shipId },
          timestamp: Date.now(),
        },
        player.id,
      );
      break;
    }
  }
}

// ─── WebSocket Server ────────────────────────────────────────────────────

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws: WebSocket) => {
  const playerId = generateId("player");
  const player: PlayerState = {
    id: playerId,
    name: `Player_${playerId.substring(0, 6)}`,
    factionId: null,
    ships: [],
    isReady: false,
    isHost: false,
    latency: 0,
    wsInstance: ws,
  };

  log(`New connection: ${player.name} (${playerId})`);

  ws.on("message", (rawData: Buffer) => {
    if (rawData.byteLength > MAX_MESSAGE_BYTES) {
      console.error(
        `[P2P] Message from ${player.name} dropped: ${rawData.byteLength} bytes exceeds cap ${MAX_MESSAGE_BYTES}`,
      );
      sendToPlayer(player, {
        type: "error",
        payload: { message: "Message too large" },
        timestamp: Date.now(),
      });
      return;
    }
    try {
      const message = JSON.parse(rawData.toString()) as NetworkMessage;
      handleMessage(player, message);
    } catch (e) {
      console.error(`[P2P] Parse error: ${e}`);
    }
  });

  ws.on("close", () => {
    log(`Connection closed: ${player.name}`);

    const wasHost = player.isHost;
    const previousRoomId = playerToRoom.get(playerId);
    const room = removePlayerFromRoom(playerId);
    if (room) {
      // Promote a new host if the leaving player was the host and others remain
      if (wasHost && room.players.size > 0) {
        const successor = room.players.values().next().value as PlayerState;
        successor.isHost = true;
        room.hostId = successor.id;
        log(
          `Host handoff in room ${room.id}: ${player.name} → ${successor.name}`,
        );
        broadcastToRoom(room.id, {
          type: "room_update",
          payload: getRoomStatus(room),
          timestamp: Date.now(),
        });
      }

      broadcastToRoom(room.id, {
        type: "player_left",
        payload: { playerId },
        timestamp: Date.now(),
      });

      // Notify remaining players that a mid-battle disconnect occurred
      if (room.isStarted && room.players.size > 0) {
        broadcastToRoom(room.id, {
          type: "player_disconnected",
          payload: { playerId, inBattle: true },
          timestamp: Date.now(),
        });
      }

      if (room.players.size > 0) {
        broadcastToRoom(room.id, {
          type: "room_update",
          payload: getRoomStatus(room),
          timestamp: Date.now(),
        });
      }
    } else if (previousRoomId) {
      // Room was destroyed as empty — nothing to broadcast
    }
  });

  ws.on("error", (err) => {
    console.error(`[P2P] WebSocket error: ${err.message}`);
  });
});

console.log(`🎮 P2P Server listening on ws://localhost:${PORT}`);
console.log(`   Share this address with other players to join.`);
if (VERBOSE) console.log(`   (verbose logging enabled)`);
