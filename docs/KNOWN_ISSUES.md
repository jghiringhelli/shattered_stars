# Known issues (alpha)

Shattered Stars is a free-to-play **alpha**. These are the problems we already know about. If you hit something not listed, use **REPORT A BUG** (main menu or pause menu). It opens a pre-filled GitHub issue that includes your build and recent events.

## Saves and settings

- Progress, settings and campaign saves live in your browser's local storage. Clearing site data, or using another browser or device, starts you fresh. There are no cloud saves.
- The campaign Chronicle (shared story flags, crossover canon, act completion, your ending) is one more local-storage record. Resetting a faction campaign does not clear it; the Chronicle tab\u0027s FREE ORDER switch lifts the "complete Act N−1 in N factions" locks if you want to play out of order.
- In private windows, or with storage blocked ("block all cookies"), the game still runs, but nothing is saved after you close the tab. A banner tells you when this happens.

## Loading

- Art downloads the first time a mode needs it, and a LOADING bar shows while it does. On slow connections the first battle of each mode can take a few seconds.
- A ship that joins mid-battle (survival waves, reinforcements) can show a plain faction-coloured placeholder for a moment until its art arrives.

## Controls

- Gamepad commander orders (capital ships) share LT / RT / D-pad ← / → with Knife and Hook. Capital ships can't fly those, so pressing an order may also flash a "NOT ON DIAL" note. Rebind them in **Settings › Gamepad** if you prefer.
- Gamepad barrel roll is a right-stick flick ← / →, and Snap turn is a right-stick flick ↓. Barrel roll, boost and the other specials work only if the ship has them on its dial or action bar, and only while the pilot isn't stressed.
- The Boss Raid setup screen ("Capital Assault") ignores ESC; use its BACK button.

## Gameplay and balance

- Balance is still being tuned: role pricing, difficulty steps (Normal → Hard is a cliff, Brutal is about the same as Hard) and some Ace Duel presets.
- Some pilots and upgrade cards are not reachable yet, and a few card texts don't match their real-time effect.
- There are no collisions, obstacles or critical hits in any mode. This is a design decision for now.

## Online

- Online play is an alpha feature and needs the relay server to be up. See [MULTIPLAYER.md](../MULTIPLAYER.md).

## Audio

- If a music track isn't available yet, a short synthesized drone plays in its place.

## Cosmetic

- Long ship names are cut off with "…" on squad-builder cards.
- Restarting a scene can log a harmless "Texture key already in use" console warning.

## Campaign

- The Coalition (Acts IV-V) is led by one hero chosen when it opens; only that hero\u0027s two powers are on the bar. The other heroes fly as allied squads.
- Briefing/dialogue beats cannot play after a mission is won, so a few "after the fight" lines (for example the Brannoc ceasefire call) fire at a late kill instead; the rest are in the debrief.
- A few named characters (Ironwing Chen, Kronos, Ilsandre, Blackmaw, Vosk) borrow a generic portrait until their art exists.
- Music cues for the Broadcast click-tone and the three-note Tide motif use the "tension" cue until dedicated cues exist.