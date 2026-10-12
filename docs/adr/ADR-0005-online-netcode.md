# ADR-0005 — Online play: deterministic input lockstep through an authoritative relay

- **Status:** Accepted (Phase 1 built: relay, net layer, lobby; Phase 2: battle-scene integration)
- **Date:** 2026-10-11
- **Deciders:** Project owner (jghiringhelli)
- **Related:** [docs/ONLINE.md](../ONLINE.md) (deploy + operations), `src/net/`, `server/src/`,
  `scripts/net_measure.ts` (the measurements below)

## Context

The alpha ships as a static site (GitHub Pages) plus one small relay on Fly.io or Render.
The previous online mode did not work (alpha audit): players ran a P2P server themselves and
typed its address; online "Arcade" rooms ran a separate battle on each client with the other
human as AI (the same ship was up to **5,667 px** apart); online Dogfight exchanged maneuvers
and combat results but drifted up to **355 px** in 10 s.

Constraints:

- The simulation is pure TypeScript with a seeded RNG (Mulberry32). `ArcadeBattleScene`
  already runs a fixed 60 Hz `tickLogic`; pilot input is a small struct
  (`applyPilotFlightInput`: held steer/throttle + one-shot presses).
- Real time on a 500 ms maneuver cycle: a pilot's choice already takes effect on a cycle
  boundary, so tens of milliseconds of input delay are largely hidden.
- Team battles run many AI ships (wingmen, reinforcements) and projectiles.
- Browsers give us WebSocket (TCP); WebRTC DataChannels would need STUN/TURN.

## Options

1. **Deterministic lockstep on input commands per tick** — every client simulates the same
   battle from the same seed; only inputs travel.
2. **Host-authoritative snapshots + client prediction / interpolation** — one client
   simulates, the others render its snapshots.
3. **Rollback (GGPO)** — lockstep without input delay, re-simulating on late inputs.
   Rejected up front: it needs a cheap save/restore of the whole battle every tick, which
   the Phaser scenes (sprites, particles, AI memory, weapon runtimes) cannot offer.

## Measurements

`npx tsx scripts/net_measure.ts` (60 s per run; real `LockstepSession`s talking to the real
`RelayCore` over simulated links; jitter is uniform per message; loss is TCP-like: the lost
message and everything behind it arrive one fast-retransmit later). Reference duel ships fly
at 769 px/s on average.

**Lockstep (chosen)**

| Profile (one-way client↔relay, both clients) | Delay start→end | Stall time | Longest stall | Up / down | Identical ticks |
|---|---|---|---|---|---|
| LAN (2±1 ms) | 3 t (50 ms) | 0.11 % | 18 ms | 3.8 / 3.9 KB/s | 100 % |
| Regional (20±8 / 30±10 ms) | 7 t (117 ms) | 0.00 % | 0 ms | 4.4 / 4.5 KB/s | 100 % |
| Cross-country (35±15 / 45±15 ms) | 10 t (167 ms) | 0.00 % | 0 ms | 4.8 / 4.9 KB/s | 100 % |
| Intercontinental (60±25 / 90±30 ms, 1 % loss) | 16→18 t (300 ms) | 15.1 % | 257 ms | 5.7 / 5.6 KB/s | 100 % |
| Bad Wi-Fi (25±60 / 30±20 ms, 3 % / 1 % loss) | 11→15 t (250 ms) | 6.0 % | 187 ms | 5.2 / 5.1 KB/s | 100 % |
| 4-player Skirmish, Regional | 8 t | 0.11 % | — | 13.7 KB/s down | 100 % |

**Snapshot interpolation (alternative, 20 Hz, 100 ms buffer, same trajectories)**

| Profile | Opponent drawn off its true position p50 / p95 | Guest's own-ship input latency (no prediction) |
|---|---|---|
| LAN | 92 / 115 px | 108 ms |
| Regional | 92 / 115 px | 200 ms |
| Cross-country | 95 / 122 px | 260 ms |
| Intercontinental | 158 / 194 px | 400 ms |

Snapshot bandwidth (24 replicated fields per ship, 7 per projectile): duel 10.6 KB/s,
12-ship team battle **63.8 KB/s per client** (the host uploads that times each peer).

Findings that shaped the design:

- Lockstep keeps every client bit-identical (100 % of ~3,500 compared ticks in every
  profile, including 5 % outright message loss in the unit tests). Snapshots always draw the
  opponent ~100 px behind where it is — the same order as the drift players saw — and need
  lag compensation for hits.
- **Input delay must cover the one-way path**: a lockstep match cannot run faster than
  delay ÷ latency. With the delay capped at 200 ms over a 180 ms path the match stalled 37 %
  of the time; the cap is now 300 ms (18 ticks) and clients report jitter-inclusive RTTs.
- Loss on TCP shows up as head-of-line stalls no reasonable delay hides; raising the delay
  on long stalls only added latency (Bad Wi-Fi got worse). So the adaptive delay reacts only
  to *repeated short* stalls (a steady deficit).
- Lockstep bandwidth is flat in the number of AI ships (inputs only): ~5 KB/s per player.

## Decision

**Deterministic input lockstep at the simulation tick (60 Hz, `TICK_MS = 1000/60`), relayed
and arbitrated by the server, with hash-based desync detection and snapshot resync.**

- **Inputs.** Each client samples its input every frame (held bits take the latest sample,
  one-shot presses accumulate until a tick takes them) and schedules it `inputDelay` ticks
  ahead. Input words: `src/net/input/PilotInputCodec.ts` (buttons, optional turret aim,
  optional command). Ticks before the delay are neutral for every seat by rule.
- **Delay.** The relay sizes it at match start from the players' jitter-inclusive pings
  (half of the two largest, +10 %, +2 ticks; 2–18 ticks). Each client may raise its own
  delay on repeated short stalls and lowers it back after 5 s of calm — a purely local
  choice, because inputs address absolute ticks and the relay only needs a contiguous stream.
- **Pacing.** The match clock starts one-way-latency into tick 0 on every client, and a
  client running more than half a tick ahead of the slowest peer slows by up to 15 %.
- **Relay (authoritative).** Accepts each seat's stream only in order, caps how far a seat
  runs ahead (10 s), resends every recipient what it has not acknowledged (redundant resend
  survives message loss and reconnects), and **fills absent seats** (disconnected, left,
  never loaded) with an AI-control input so the remaining players never stall: every client
  hands that ship to the same deterministic AI on the same tick.
- **Desync.** Every 30 ticks clients report a FNV-1a hash of their state (floats quantized
  to 1/1024). On disagreement the relay sets a barrier tick past every relayed input, asks
  the authority seat (lowest present seat, initially the host) for a snapshot at that tick,
  and the out-of-sync clients wait at the barrier and jump to it. Rejoining players (socket
  drop or page reload, within the 30 s reconnection window) use the same mechanism.
- **Lobby/match config is canonical.** The battle is built in seat order, never from the
  local player's point of view; only presentation (camera, HUD, which input is sampled) may
  read `localSeat`.
- **Transport.** WebSocket (`/ws`), JSON frames, behind a `Transport` interface so a WebRTC
  DataChannel (unordered, unreliable — removes TCP head-of-line stalls) can be added later
  without touching the session.

## Consequences

- Online battles require a deterministic simulation. Phase 2 must make the battle scenes
  obey the `LockstepSimulation` contract: advance only in `step(tick, inputs)` at `TICK_MS`;
  no `Math.random`, `Date.now`, `scene.time.now` or frame `delta` inside simulation code
  (use the tick clock and the seeded `DeterministicRng`, whose state goes in snapshots);
  no simulation decision may depend on the local seat; and the scenes must implement
  `hash`, `snapshot`, `restore`.
- Cross-browser floating point: JS arithmetic is IEEE-identical everywhere; `Math.sin/cos/
  atan2` are not guaranteed identical across engines (V8 and SpiderMonkey use fdlibm, JSC
  the system libm). Quantized hashes plus snapshot resync bound the damage: a drift is
  corrected within ~0.5 s. If resyncs show up in telemetry, route trig through a portable
  implementation.
- Input latency is felt: 50 ms on LAN, ~117 ms regional, up to 300 ms intercontinental.
  The 500 ms maneuver cycle hides most of it; aim/steer still feel it.
- Lossy or intercontinental links stall (6–15 % of the time in the measured profiles)
  rather than desync. Mitigations later: a relay region per continent, DataChannel transport.
- One relay instance holds all rooms in memory: deploys drop running matches (clients are
  told to reconnect; the reconnection window covers a quick restart but not lost room state).
