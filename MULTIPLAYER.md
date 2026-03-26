# Multiplayer Setup Guide

Shattered Stars now supports peer-to-peer multiplayer battles! One player (the **host**) runs the server, and others connect as clients.

## Quick Start

### Host Setup (Player 1)

1. **Start the P2P server:**
   ```bash
   npx tsx scripts/p2p_server.ts --port 8080 --verbose
   ```
   - Server listens on `ws://localhost:8080`
   - `--verbose` shows all player actions (optional)

2. **Find your IP address:**
   - **Windows**: `ipconfig` → look for "IPv4 Address"
   - **macOS/Linux**: `ifconfig` → look for "inet"
   - Example: `192.168.1.100`

3. **Share the connection URL with other players:**
   ```
   ws://192.168.1.100:8080
   ```

### Client Setup (Players 2–4)

1. **Launch the game normally:**
   ```bash
   npm run dev
   ```
   - Vite runs on http://localhost:3003 as usual

2. **In the lobby:**
   - Don't create a new room — instead, there should be a **"Connect to Server"** option
   - Enter the host's connection URL: `ws://192.168.1.100:8080`
   - Join the room created by the host

3. **Wait for host to start the battle**

## How It Works

### Deterministic RNG for Multiplayer
- All clients receive the same **battle seed** from the server when the game starts
- `BattleSimulator` uses `seedrandom(seed)` instead of `Math.random()`
- Every client simulates the exact same battle state → no desync issues
- All clients see identical outcomes for dice rolls, maneuvers, etc.

### Server State Management

The P2P server (`scripts/p2p_server.ts`) tracks:
- **Rooms**: One active battle per room
- **Players**: Faction selection, ready status, latency
- **Battle Seed**: Distributed to all clients at game start (ensures determinism)
- **Game Actions**: Broadcast to all players in real-time

### Message Flow

```
Client                           Server                          Other Clients
------                           ------                          -----

select_faction()  ─────────────→  store faction
                                  broadcast room_update  ←────── receive update

setReady(true)    ─────────────→  check if all ready
                                  broadcast game_start(seed)  ←── receive seed + start

game_action()     ─────────────→  broadcast game_action  ←────── receive action
```

## Architecture

### Files Modified
- **`src/services/NetworkService.ts`**: Added battle seed tracking
- **`src/simulation/BattleSimulator.ts`**: Integrated `seedrandom` for deterministic battles
- **`scripts/p2p_server.ts`**: New P2P WebSocket server (lightweight, ~300 lines)

### Launch Requirements
- **Host**: Server must stay running for the duration of the battle session
- **Clients**: Can disconnect after battle ends; server cleans up empty rooms
- **Network**: All players must be on same LAN or use port forwarding for internet play

## Configuration

### Server Options
```bash
npx tsx scripts/p2p_server.ts [options]

Options:
  --port 8080      Port to listen on (default: 8080)
  --verbose        Log all messages (default: silent)
```

### Game Modes
- **turn_based**: Traditional X-Wing Miniatures style
- **continuous**: Real-time arcade-style

## Known Limitations

1. **No persistence**: Disconnecting clients lose progress (session-scoped)
2. **No account system**: Players identified by random ID, not persistent usernames
3. **No chat system**: Game actions only (future feature)
4. **LAN-only by default**: Requires port forwarding for internet play
5. **One room at a time**: A single server instance manages one active battle (multiple rooms future)

## Troubleshooting

### "Cannot connect to server"
- ✓ Verify host is running `p2p_server.ts`
- ✓ Check firewall allows port 8080
- ✓ Verify correct IP address (not `localhost` from other machines!)
- ✓ Test with LAN first before attempting internet via port forwarding

### "Battle desyncs between clients"
- ✓ Confirm all clients received the same `seed` from `game_start` message
- ✓ Check console for errors on clients
- ✓ Verify no modifications to `Math.random()` in any battle code

### "Server crashes when X happens"
- ✓ Run with `--verbose` flag to see full error logs
- ✓ Check Node.js console output for stack traces
- ✓ Report issues with reproduction steps

## Testing Without Network

To test locally with server + 2 clients on same machine:

**Terminal 1 (Server):**
```bash
npx tsx scripts/p2p_server.ts --port 8080 --verbose
```

**Terminal 2 (Game #1 - Host connects to server):**
```bash
PORT=3003 npm run dev   # Connect to ws://localhost:8080
```

**Terminal 3 (Game #2 - Another client):**
```bash
PORT=3004 npm run dev   # Same connection ws://localhost:8080
```

Both games connect to the same server instance and share battle state.

## Performance Notes

- **Bandwidth**: ~100 bytes/action (very light)
- **Latency tolerance**: Turn-based allows 100–500ms latency comfortably
- **Concurrent players**: Server tested with 4 players per room; max 10 recommended
- **Battle simulation**: Deterministic RNG removes need for lockstep consensus

## Next Steps (Future)

- [ ] Persistent player accounts + rankings
- [ ] Match-making lobbies with multiple simultaneous battles
- [ ] Replay recording (deterministic = easy to replay from seed + action log)
- [ ] Ranked ladder with Elo ratings
- [ ] Spectator mode for watching battles
- [ ] WebRTC for direct P2P without server (for LAN)
