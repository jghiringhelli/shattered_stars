# Known issues (public beta)

Shattered Stars is a **beta** that is free to play for now (it may become a paid game later). These are the problems we already know about, checked against the current build (re-verified 2026-10-20 by code, tests and scripted play in every battle mode). If you hit something not listed, use **SEND FEEDBACK** (main-menu footer, pause menu or Settings › Advanced); see [TESTER_GUIDE.md](TESTER_GUIDE.md). What the game stores and sends is in [PRIVACY.md](PRIVACY.md).

## Browsers and devices

- **Phones and tablets are not supported.** Touch steering and fire work in menus and flight, but squad mark, target and weapon cycling have no touch control and the HUD text is tiny. Touch-only devices see a one-time notice.
- Supported: Chrome and Edge 90+, Firefox 90+, Safari 15+ on desktop, 1280×720 or larger (smaller windows letterbox). Without WebGL the game switches to Canvas ("compatibility mode") and runs slower. Browsers older than those versions show a warning, or a blocking notice if they lack Canvas or required APIs.
- Performance: 60 FPS on an integrated Intel GPU in the largest battles (Epic reinforcements dips to about 30 FPS in the worst 1 % of frames). Weak or old GPUs and software rendering are much slower; Epic is the heaviest mode.
- Switching tabs or minimising the window pauses an offline battle (resume from the pause menu). An online battle cannot pause and keeps running.
- Safari/WebKit builds without Web Audio play silently (the game logs one warning).

## Controls

- **Ship specials follow the hull's identity.** By default a ship flies at most one of barrel roll, Hook Loop or Knife Roll (plus boost and Snap Turn). Settings › Gameplay › Ship Specials = "Full card" lifts that in offline modes; online battles always use the identity rule.
- **Barrel roll is a double-tap of one arrow** (← ← or → →, each tap short, within about a fifth of a second). Alternating ← → is plain steering. If the roll is recharging, you are stressed or the ship lacks it, the double-tap just steers and nothing flashes; watch the ROLL row of the status panel.
- **A lone tap of the Maneuver key (Z / LT) queues its Snap turn about a fifth of a second late**, because a second press would make it a Knife roll. Double-tap **↓↓** for a Snap turn without that wait.
- On a touchscreen the left stick rolls with a double-tap on its left/right half; a slow double-tap (over about a fifth of a second apart) reads as two single taps.

## Saves and settings

- Progress, settings and campaign saves live in your browser's local storage. Clearing site data, or using another browser or device, starts you fresh. There are no cloud saves.
- The campaign Chronicle (shared story flags, crossover canon, act completion, your ending) is one more local record. Resetting a faction campaign does not clear it; the Chronicle tab's FREE ORDER switch lifts the "complete Act N−1 in N factions" locks if you want to play out of order.
- In private windows, or with storage blocked ("block all cookies"), the game still runs, but nothing is saved after you close the tab. A banner tells you.

## Loading

- Art downloads the first time a mode needs it, and a LOADING bar shows while it does. On slow connections the first battle of each mode can take a few seconds.

## Controls

- Gamepad barrel roll is a right-stick flick ← / →, and Snap turn is a right-stick flick ↓. Barrel roll, boost and the other specials work only if the ship has them on its dial or action bar, and only while the pilot isn't stressed.

## Gameplay and balance

- Balance is still being tuned. Squad results put the five factions close together overall, but some matchups are still lopsided (Free Confederation and Synthetic Collective are the weakest in some classic and reinforced pairings; scenario Hard is much harder than Normal). Difficulty steps are Easy ≈ 80 %, Normal ≈ 50 %, Hard ≈ 30 %, Brutal ≈ 15 % win rate for an average bot player. Report anything that feels off with the numbers (SEND FEEDBACK › Balance).
- There are no collisions, obstacles or critical hits in any mode. This is a design decision for now.
- Combat is real time on a 500 ms maneuver cycle with one attack per cycle per ship; fights between equal pilots take about 30–60 s. Survival nodes can feel quick or slow depending on the enemy mix.

## Online

- Online play is a beta feature and needs the relay server to be up. When it isn't, the lobby says so and offers **PLAY OFFLINE INSTEAD**. A server that has been idle can take about 30 s to wake up. See [ONLINE.md](ONLINE.md).
- Players are only matched with the same game build: reload the page if the lobby says your version is out of date.
- Deploys and restarts of the server end running matches (rooms live in memory). Nobody can pause a shared battle: Pause offers to leave the match.
- After an online match the room stays open for 60 s for a REMATCH vote (everyone present must accept), cast from the results screen or the room. The server decides the match setup; the host only changes room options, which the server validates.
- The relay cannot simulate the battle, so a result is only as trustworthy as the clients' majority: a lone modified client can no longer decide a match (a strict majority of the connected human seats must report the same winner; otherwise the match ends as "no result"), but a colluding majority could still report a false result. Fine for a beta; keep online matches casual.

## Audio

- 17 music tracks ship (Suno and ACE-Step). A track that fails to load is replaced by a short synthesized drone. Browsers start audio only after your first click or key press, so the menu is silent until then.

## Campaign

- Campaign difficulty has no headless runner: Act 1-3 `hullScale` 0.7 is only checked by a force-ratio proxy (docs/specs/campaign.md §11), not by win rates with hero powers, Armory and Research.
