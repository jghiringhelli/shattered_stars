# Online play — relay server, deploy and operations

Shattered Stars online = the static game (GitHub Pages) + **one small relay server**
(Node, WebSocket) that hosts rooms, quick match and the lockstep input relay. Players never
type an address: the relay URL is baked into the build. Design and measurements:
[ADR-0005](adr/ADR-0005-online-netcode.md).

```
 browser (GitHub Pages)  ──wss://<relay>/ws──►  relay (Fly.io or Render)
   LobbyScene / OnlineSession / NetClient          RelayCore: sessions, rooms, matchmaker
   LockstepSession (battle scenes)                 MatchRelay: input relay, AI fill, hashes, resync
```

## What the relay does

- **Handshake + version check.** The first message must be `hello` with the protocol
  version; a mismatched client is refused (`version_mismatch`, close 4001) and told to
  reload. Players are only seated with the same game build (`VITE_GAME_BUILD`).
- **Rooms by code** (5 characters, no look-alikes, e.g. `K7Q2X`) and **quick match**
  (pairs the two oldest players waiting on the same mode and build; 20 s ready check).
- **Modes:** Dogfight 1v1 · Skirmish up to 2v2 · Scenario 1v1 · Reinforcements 1v1.
  A side is a **team**, never a faction: any seat may fly any faction, so mirror matches
  (Hegemony vs Hegemony) and mixed-faction teams start like any other room.
  Seat → team is canonical (the room's team, `team_<n>` in the battle config).
- **The relay owns the match definition (protocol 5).** Mode is fixed when the room opens;
  seed, map theme (derived from the seed), point limit (200), scenario (always a known one),
  seat order and team layout (fixed by seat in duel modes; Skirmish teams capped at 2 per
  side) are decided by the relay and sent in `match_start`. Clients only pick their own
  loadout, and the relay checks it against the game's squad rules (`src/net/rules/squadRules.ts`:
  known faction and ships of that faction, no capital/huge hulls, ship count, hull points
  within the limit) — an illegal squad is refused with a readable `invalid_loadout` error.
  The host only convenience-edits the scenario; the relay validates every option change.
- **Ready check + countdown** (3 s) → `match_start` with one seed, canonical seats and the
  input delay sized from everyone's ping.
- **Heartbeat** (WebSocket ping every 5 s, drop after 15 s silence; clients ping every 2 s
  and report RTT + jitter, shown as ping in the room).
- **Reconnection window** (30 s): a dropped player keeps their seat and resumes with the
  token kept in `sessionStorage` (also across a page reload). Mid-match the AI flies their
  ship meanwhile; on return they jump in through a snapshot.
- **Abuse limits:** origin allowlist, connection caps (server and per address), 600 KB
  frames, strict schema validation of every message, token-bucket rate limits per message
  type (inputs 160/s, chat 1/s, …), repeat offenders closed (4008).
- **Health:** `GET /healthz` → `{"status":"ok","protocol":5,"uptimeS":…,"sessions":…,"connected":…,"rooms":…,"matches":…,"queued":…,"desyncs":…}`.

## Online battles (how a match plays)

- The lobby starts the battle scene with the relay's match (canonical seats, seed, input
  delay): DogfightScene for duels, ArcadeBattleScene for Skirmish / Scenario /
  Reinforcements. Seat 0's team is the simulation's "player" side on every client; the
  camera, HUD, colours (ally/enemy by team) and end screen show each client its own seat.
- Every client simulates every seat at 60 Hz from the same inputs (`OnlineBattleLink` →
  `LockstepSession`). Each seat's pilot (flight, weapon keys, squad mark, crew stations)
  flies from its input stream. The input word (`src/net/input/PilotInputCodec.ts`) carries
  five held actions — steer left/right, throttle up/down and the **MANEUVER** key — then the
  one-shot presses; the double-tap barrel roll (←← / →→) and the maneuver key's Snap Turn /
  Hook Loop / Knife Roll are recognised from the held bits on the simulation clock, so every
  client reads the same gesture (protocol 4 added the MANEUVER bit). Reinforcements: pools and field caps are per team; every
  seat's squad keeps its own sub-reserve and **every human seat has its own picker**,
  driven by its own input stream (a pick travels as that seat's input command; the 5 s
  auto-accept runs on the simulation clock). A seat whose ship is lost flies the
  replacement its own picker deploys. Hashes and snapshots carry every ship's team.
- A player who drops or leaves is flown by the same bot on every client (the relay's
  AI-control fill); a notice says so, and they rejoin through a snapshot (ONLINE again
  after a reload, within the 30 s window). Nobody can pause a shared battle: PAUSE offers
  to leave the match.
- Every tick each client hashes its state; every 30 ticks the hashes go to the relay. A
  mismatch triggers a resync: the authority's snapshot (StateGraph of the simulation
  objects, LZ77-packed) replaces the diverged client's state.
- Results are reported by team; the relay ends the match and the room returns to the lobby
  (REMATCH = a server-side vote: after a finished match the room stays open for
  `REMATCH_WINDOW_MS`; the room's READY button reads REMATCH and starts a new match with the same
  squads and teams once everyone present voted yes. A quick-match room dissolves when the window
  closes unused). A player offline at match end gets the result when they resume.
- Online battles always use the **ship-identity rule** for specials, whatever the local
  Settings say (`lockTrickRuleToIdentity`, set by the online link / seat models).
- The relay survives a failing handler (logged, the socket stays), abandons a match whose
  authority never answers a resync after 3 × 10 s, rate-limits desync resyncs (2 s) and takes the
  winner most seats report.

## Configuration

Relay (environment variables; full table in `server/src/config.ts`):

| Variable | Default | Notes |
|---|---|---|
| `PORT` | 8080 | Fly and Render inject/expect it |
| `ALLOWED_ORIGINS` | `*` (dev only) | **Required when `NODE_ENV=production`** (the Docker image): the game's origin, e.g. `https://jghiringhelli.github.io`. `*` in production needs the explicit opt-in `ALLOW_ANY_ORIGIN=true` |
| `RECONNECT_WINDOW_MS` | 30000 | Seat kept for a dropped player |
| `MAX_CONNECTIONS` / `MAX_CONNECTIONS_PER_ADDRESS` | 500 / 8 | |
| `MAX_ROOMS` | 200 | |
| `HEARTBEAT_INTERVAL_MS` / `HEARTBEAT_TIMEOUT_MS` | 5000 / 15000 | |
| `QUICK_MATCH_READY_MS`, `START_COUNTDOWN_MS`, `LOAD_TIMEOUT_MS` | 20000, 3000, 30000 | |
| `REMATCH_WINDOW_MS` | 60000 | How long the rematch vote stays open after a finished match |
| `TRUST_PROXY` | false | Client address from `X-Forwarded-For`; set `true` only behind a proxy you control (`fly.toml` and `render.yaml` do) |
| `LOG_LEVEL` | info | JSON lines on stdout/stderr |

Game (build time, Vite):

| Variable | Where | Notes |
|---|---|---|
| `VITE_ONLINE_URL` | GitHub → Settings → Secrets and variables → Actions → **Variables** | e.g. `wss://shattered-stars-relay.fly.dev` (`/ws` is added automatically; `https://` also works) |
| `VITE_GAME_BUILD` | set by `pages.yml` to the commit SHA | only identical builds are matched |

Server override for players and testers (no rebuild): ONLINE → **SERVER** button in the
lobby (stored locally; empty = default), or append `?server=wss://host` to the page URL.
Dev builds without `VITE_ONLINE_URL` use `ws://localhost:8080/ws`.

## Deploy on Fly.io

1. Install `flyctl` and sign in: `fly auth login`.
2. From the repository root, create the app from the committed config (edit `app` in
   `fly.toml` first if `shattered-stars-relay` is taken, and `primary_region` to the region
   nearest most players):
   ```sh
   fly launch --no-deploy --copy-config
   ```
3. Deploy: `fly deploy` (builds `server/Dockerfile` with the repo root as context).
4. Check: `curl https://shattered-stars-relay.fly.dev/healthz`.
5. Keep **one** machine: `fly scale count 1` (rooms live in memory; `fly.toml` already
   disables auto-stop).
6. Point the game at it: set the repo variable `VITE_ONLINE_URL =
   wss://shattered-stars-relay.fly.dev`, then run the **Deploy to GitHub Pages** workflow.

Change settings with `fly secrets set ALLOWED_ORIGINS=https://…` or `[env]` in `fly.toml`.
Logs: `fly logs`.

## Deploy on Render

1. Render dashboard → **New → Blueprint** → select this repository. `render.yaml` defines
   one Docker web service (`server/Dockerfile`, context = repo root, health check
   `/healthz`, one instance).
2. Apply. The URL is `https://shattered-stars-relay.onrender.com` (or similar).
3. Check `https://<service>.onrender.com/healthz`.
4. Set the repo variable `VITE_ONLINE_URL = wss://<service>.onrender.com` and run the
   Pages workflow.

Note: Render's **free** plan sleeps after 15 idle minutes (the first player waits ~30 s
for a cold start and running rooms are dropped); the Blueprint uses `starter`.

## Run locally

```sh
npm run start:server        # relay on ws://localhost:8080/ws (tsx, uses .env-style vars)
npm run dev                 # game; dev builds connect to localhost:8080 by default
```

Open two browser windows (or one normal + one private, so they get separate sessions),
choose ONLINE, then QUICK MATCH in both, or CREATE ROOM + JOIN BY CODE.

Simulate a real network between two local windows with `?netsim=latency,jitter,loss`
(one-way client↔relay, ms / ms / 0–1), e.g. `/?netsim=40,15` or `/?netsim=60,25,0.01`.

Container check (needs Docker running):
```sh
docker build -f server/Dockerfile -t ss-relay .
docker run --rm -p 8080:8080 -e ALLOWED_ORIGINS=http://localhost:3000 ss-relay
```

`npm run build:server` produces the same single-file bundle (`server/dist/server.cjs`).

## Tests and measurements

- Unit: `npx vitest run tests/unit/server tests/unit/net` — protocol validation, rooms,
  matchmaking, the match relay, the lockstep session, and full matches over simulated
  networks (latency, jitter, TCP retransmits, outright loss, desync injection, disconnect,
  page reload).
- Integration (real sockets): `npx vitest run tests/integration/relay_server.test.ts`.
- E2E (two browser contexts against an in-process relay): `npx playwright test tests/e2e/online-lobby.spec.ts`.
- Battles, e2e: `npx playwright test tests/e2e/online-battle.spec.ts` — two browsers behind
  `?netsim=40,15` play a minute of Dogfight, Skirmish and Reinforcements and must hash
  identically on every common tick; a deliberately corrupted client must be caught by the
  hashes and healed by the authority's snapshot.
- Netcode measurements behind ADR-0005: `npm run measure:net`.

## Operations

- **Deploys drop running matches** (in-memory rooms). Clients get `shutdown`, reconnect,
  and land back in the lobby. Deploy between play sessions.
- **Protocol bump** (`src/net/protocol/version.ts`): deploy the relay and the game together;
  old cached clients are refused with "Game version out of date — reload the page".
- **Desyncs** are counted in `/healthz` (`desyncs`) and logged per match end. A rising count
  means a determinism bug in a battle scene (see ADR-0005 consequences).
- Capacity: a match costs ~5 KB/s per player each way; one shared-cpu machine handles
  hundreds of players.

## Troubleshooting

| Symptom (lobby status line) | Cause / fix |
|---|---|
| "No online server configured" | `VITE_ONLINE_URL` was empty at build time; set the variable and rebuild, or use SERVER |
| "Server unreachable" | Relay down/asleep, wrong URL, or the origin is not in `ALLOWED_ORIGINS` (browser shows a 403 on the upgrade). The lobby explains this in plain words, offers RECONNECT and **PLAY OFFLINE INSTEAD** |
| "The server is full — try again shortly" | `MAX_CONNECTIONS` reached (refusal `server_full`) |
| "That room is full." / "That match already started." / "No room with code …" | Room errors shown in red under the lobby; join another room or create one |
| "Game version out of date — reload the page" | Client and relay protocol differ; hard-reload |
| "That room runs a different game version" | Friends on different builds (one has a cached page); both reload |
| "Connection lost — reconnecting…" | Network blip; the seat is kept for 30 s |
