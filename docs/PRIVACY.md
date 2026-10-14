# Privacy

Shattered Stars is a free browser game. It has **no accounts, no cookies, no ads and no analytics**. This page says exactly what the game stores and what leaves your machine.

## Short version

- Your progress, settings and statistics stay in **your browser's local storage**. They never leave your device unless you choose to send them.
- The game never uploads telemetry. "Telemetry" in this game means a **local event log** on your device that you can read, export or clear.
- **Send feedback** creates a file **only when you press a button**. Nothing is sent automatically. You attach the file yourself.
- Online play connects to a small relay server. It keeps rooms in memory while you play and stores nothing afterwards.

## What the game stores on your device

Everything below is in your browser's `localStorage`, except the online resume token (`sessionStorage`). Clearing site data removes all of it.

| Key | What it holds |
|---|---|
| `shattered_stars_settings` | Your settings: audio, key and gamepad bindings, accessibility, difficulty, the telemetry switch |
| `shattered_stars_profiles` | Player profile: XP, unlocks, per-ship statistics |
| `shattered_stars_campaign_<faction>` | One campaign save per faction |
| `shattered_stars_chronicle` | Campaign story flags and your ending |
| `shattered_stars_survival_run`, `_meta`, `_daily` | The current Survival run, meta-progression and daily-challenge results |
| `shattered_stars_ace_duel` | Ace Duel choices |
| `ss_flight_school_v1` | Flight School progress |
| `ss_reinforcements_v1` | Your reinforcement-battle preferences |
| `ss_telemetry_v1` | The local event log (see below) |
| `ss_beta_welcome_v1` | Remembers that you saw the tester welcome |
| `shattered_stars_device_notice_dismissed` | Remembers that you dismissed the "phones are not supported" notice |
| `ss_online_name_v1` | The pilot name you chose for online play |
| `ss_online_server_v1` | A custom relay address, if you set one |
| `ss_online_session_v1` (`sessionStorage`) | A random token that lets you resume an online seat after a page reload; it disappears when you close the tab |

If your browser blocks storage (private window, "block all cookies"), the game still runs and keeps everything in memory for the session. A banner tells you.

## The local event log ("Local telemetry")

Settings › Advanced › **Local Telemetry** (on by default) records a short list of events **on your device only**: session start and end, mode started and ended, deaths, Flight School steps, one summary of combat statistics per match (shots, hits, damage, duration) and uncaught errors. It keeps the last few hundred events. It has no name, no account and no IP address. You can:

- turn it off (nothing is recorded),
- **View stats** to read it in the game,
- **Export log (JSON)** to save it,
- **Clear log** to delete it.

## Send feedback

**SEND FEEDBACK** (main-menu footer, pause menu, Settings › Advanced) does two things, both only after you click:

1. Saves a **feedback bundle** (`shattered-stars-feedback-*.json`) to your downloads: the game version and build, your settings, the last 100 local events and your last 10 match summaries (empty if Local Telemetry is off), browser, screen size, graphics renderer / GPU name and current FPS, the scene you were in, and the note you typed. Anything that looks like a password, token, key or e-mail address is removed. The bundle is capped at 128 KiB.
2. Opens a prefilled GitHub issue in a new tab (or the form set in `VITE_FEEDBACK_URL`). Attaching the file is up to you, and so is whether to submit.

You can open the file in any text editor before you attach it. GitHub issues are public: do not put private information in your note.

## Online play

Online matches go through a relay server (Node, WebSocket). When you open the Online screen your browser connects and sends your pilot name, the game build and protocol version, and (in a room) your ship choices, game inputs and chat. Other players in the room see your pilot name, ship and ping.

- Rooms, queues and matches live **in the server's memory only**. When a room closes or the server restarts they are gone. There is no database, no chat history and no account.
- The relay's log (JSON lines on stdout) records server start/stop, room codes with mode and number of seats when a match starts and ends, the number of desync detections, and socket errors. It does **not** log pilot names, chat, game inputs or IP addresses. Session open/close lines exist only at debug level, which is off by default.
- The relay uses your connection's address in memory only, to apply connection limits. The hosting platform (Fly.io or Render) sees connections like any web host and may keep its own access logs; see their privacy policies.
- You never have to use it: every mode except Online works with no server.

## Hosting and third parties

- The game is a static site on GitHub Pages. GitHub, like any web host, may log requests (including your IP address) under its own privacy policy.
- The game loads **no third-party scripts, fonts, analytics or trackers**. All art, audio and code come from the same site.
- Music files are fetched from the same site after your first click or key press.

## Contact and deletion

Everything is on your device, so you delete it yourself: clear this site's data in your browser. To ask a question, open an issue at <https://github.com/jghiringhelli/shattered_stars/issues>.

_This describes build `v0.1.0 BETA`. If a later build changes what is stored or sent, this page changes in the same release._
