# Tester guide

Thanks for testing Shattered Stars. This build is a public **beta**: it is playable end to end, but expect bugs, rough edges and unbalanced content. Your feedback decides what gets fixed first.

- Play in a desktop browser with a keyboard (or a gamepad). Phones and tablets are not supported yet.
- Use a current Chrome, Edge, Firefox or Safari (Chrome/Edge/Firefox 90+, Safari 15+). Chrome or Edge give the smoothest frame rate.
- Known problems are listed in [KNOWN_ISSUES.md](KNOWN_ISSUES.md). Privacy details are in [PRIVACY.md](PRIVACY.md).
- Your progress is saved in your browser only. Another browser or device starts fresh.

## How to give feedback

Use **SEND FEEDBACK**: in the main-menu footer, the pause menu (during a battle) or Settings › Advanced.

1. Pick the kind (bug, balance, UI/UX, idea) and, if you like, write a note.
2. Press **SEND**. The game saves `shattered-stars-feedback-….json` and opens a prefilled GitHub issue.
3. Drag the file into the issue, describe what happened and submit. No GitHub account? Press **DOWNLOAD ONLY** and send the file to whoever invited you.

Nothing is sent automatically; the file holds no personal data (see [PRIVACY.md](PRIVACY.md)). Open it in a text editor if you want to check.

### What feedback helps most

1. **Bugs with a way to repeat them**: what you did, what happened, what you expected. The file adds the build, settings and recent events.
2. **Where you got stuck or confused**: a screen you did not understand, a control that did not respond, a moment you wanted to quit.
3. **Balance, with numbers**: which ship, pilot, upgrade or difficulty, what you fought, how long the fight took and how often you won.
4. **Performance**: your browser, graphics card and the mode where the frame rate dropped. SEND FEEDBACK records browser, GPU and FPS for you.
5. **Fun**: what you would play again, and what felt like a chore.

## What to try in each mode

| Mode | Try this | Look for |
|---|---|---|
| **Flight School** (press F on the menu) | Finish all lessons | Lessons that do not detect your input, unclear prompts, wrong key names |
| **Skirmish** | A default squad on Normal, then change difficulty or factions | Wingmen behaviour, whether focus fire (R, mark target) matters, fights that drag or end too fast |
| **Survival** | One full run: pick upgrades, visit a shop, meet an elite or boss | Node pacing, relic and shop prices, the daily challenge, run save after a reload |
| **Epic Format** | A reinforcement battle with a big fleet | Frame rate, the reinforcement picker, readability of the radar and roster |
| **Boss Raid** | Take down a capital ship | Firing arcs, whether the boss feels fair |
| **Dogfight** | A best-of-three duel | Turn feel, boost and barrel roll, the stress system |
| **Ace Duel** | A named-pilot matchup | Ability clarity, lopsided pairings |
| **Campaign** | The first mission of any faction, then the hub | Story clarity, hero powers (V/B), debrief, saving and resuming |
| **Online** | Quick match or a room with a friend | Connection messages, lag, anything that looks different on the two screens |
| **Settings** | Rebind a key, change the colour palette, try a gamepad | Rebinding that does not stick, unreadable colours |
| **Encyclopedia / Controls** | Search a ship, read your bindings | Missing or wrong information |

## 20-minute guided test

Do these in order. Note anything odd as you go; send one feedback bundle at the end, or one per problem.

| Min | Step |
|---|---|
| 0–2 | Open the game. Read the welcome panel (TESTER INFO in the footer reopens it). Check the version tag, bottom right. Skim Settings (audio, colour palette). |
| 2–7 | **Flight School**: finish the course. Rebind one key in Settings › Controls and use it in a lesson. |
| 7–12 | **Skirmish**, Normal difficulty: build or quick-build a squad and fight one full battle. Use boost, barrel roll and the squad mark (R). Pause (Esc) and open Settings from the pause menu, then resume. |
| 12–15 | **Survival**: start a run, play one node, then pick a reward. Close the tab and reopen: continue the run. |
| 15–18 | **Campaign**: play the first mission of a faction. Notice the briefing, the hero power bar and the debrief. |
| 18–20 | Settings › Advanced › **SEND FEEDBACK**: type a note about what you liked and what bothered you, press SEND. |

Optional extras: try a gamepad; resize the browser window mid-battle; try **Online** with a friend (quick match, or one creates a room and the other joins by code).

## Reading the results of your own session

Settings › Advanced › **View stats** shows the local event log. It lists your matches, deaths and errors, so you can see what you actually played.
