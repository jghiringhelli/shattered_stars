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
- **Health:** `GET /healthz` → `{"status":"ok","protocol":1,"rooms":…,"matches":…,"desyncs":…}`.

## Configuration

Relay (environment variables; full table in `server/src/config.ts`):

| Variable | Default | Notes |
|---|---|---|
| `PORT` | 8080 | Fly and Render inject/expect it |
| `ALLOWED_ORIGINS` | `*` | **Set to the game's origin in production**, e.g. `https://jghiringhelli.github.io` |
| `RECONNECT_WINDOW_MS` | 30000 | Seat kept for a dropped player |
| `MAX_CONNECTIONS` / `MAX_CONNECTIONS_PER_ADDRESS` | 500 / 8 | |
| `MAX_ROOMS` | 200 | |
| `HEARTBEAT_INTERVAL_MS` / `HEARTBEAT_TIMEOUT_MS` | 5000 / 15000 | |
| `QUICK_MATCH_READY_MS`, `START_COUNTDOWN_MS`, `LOAD_TIMEOUT_MS` | 20000, 3000, 30000 | |
| `TRUST_PROXY` | true | Client address from `X-Forwarded-For` (both platforms proxy) |
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
| "Server unreachable" | Relay down/asleep, wrong URL, or the origin is not in `ALLOWED_ORIGINS` (browser shows a 403 on the upgrade) |
| "Game version out of date — reload the page" | Client and relay protocol differ; hard-reload |
| "That room runs a different game version" | Friends on different builds (one has a cached page); both reload |
| "Connection lost — reconnecting…" | Network blip; the seat is kept for 30 s |
