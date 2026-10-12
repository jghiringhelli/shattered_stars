# Shattered Stars — MVP Playtest Guide

Purpose: verify the Skirmish MVP is fun, correct, and shippable. Run through this
checklist before every merge to `master` and before each release build.

**Scope:** Sections 2–11 walk through Skirmish (Terran Hegemony vs. Free
Confederation, 200-point squads) in depth. Every other mode (Survival, Epic
Format, Boss Raid, Dogfight, Ace Duel, Campaign, Flight School) is open in the
alpha: give each a short pass using sections 10 and 12. Known problems are
listed in [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

---

## How to use this doc

1. Boot dev server: `npm run dev` (or test a production build: `npm run build && npm run preview`)
2. Open `http://localhost:3000/` (dev) or the URL `vite preview` prints
3. Walk through each section in order
4. Mark each item PASS / FAIL / SKIP
5. File any FAIL as a GitHub issue with the section header as the label

Expected total run time: **~15 minutes** for a full pass.

---

## 1. Boot & Main Menu

- [ ] Page loads with no console errors (open DevTools before nav)
- [ ] Title splash renders within 3 seconds
- [ ] Main menu shows the correct number of items for the MVP scope
- [ ] Keyboard navigation (arrow keys + Enter) works
- [ ] Mouse click on each menu item lights it up

**FAIL if:** any red text in console, missing menu item, unresponsive input.

---

## 2. Squad Builder

- [ ] SKIRMISH opens the squad builder in `arcade` mode, 200pt limit
- [ ] Two squads visible: player (Terran Hegemony) + AI (Free Confederation)
- [ ] AUTO-FILL fills both squads to 3 ships each, under 200pt
- [ ] Manual ship swap: pick a ship → replace with another → point total updates
- [ ] Cannot select a huge (capital-class) ship — huge ships hidden in MVP
- [ ] START BATTLE transitions to ArcadeBattleScene within 2 seconds

**FAIL if:** points miscalculated, ship count wrong, huge ship reachable.

---

## 3. Battle — Golden Path (win)

- [ ] 6 ships spawn: 1 player, 2 AI wingmen, 3 enemies
- [ ] Ships spawn within ~1200px of player (visible on radar/screen)
- [ ] Camera follows player smoothly, no jump on wraparound
- [ ] Hold ArrowUp toward an enemy: primary lasers fire on their own in arc and range; enemies react
- [ ] Land a kill: SCORE increases by 100; "KILL!" floating text appears
- [ ] Kill all enemies: VICTORY! screen shows within 1 second
- [ ] RETRY button restarts battle; MAIN MENU button returns to menu

**FAIL if:** enemies don't move, player can't fire, victory screen never appears.

---

## 4. Battle — Golden Path (loss)

- [ ] Do nothing except drift: enemies converge and open fire
- [ ] Player hull decreases when hit (shields go first if present)
- [ ] Damage numbers appear on hit (if enabled)
- [ ] Player dies: DEFEATED screen shows
- [ ] Score is preserved and shown

**FAIL if:** enemies don't engage, hit registration missing, defeat screen fails.

---

## 5. Flee detection

- [ ] Boost away from all enemies for 10 seconds
- [ ] Warning HUD appears at top-center: `⚠ RETURN TO COMBAT — battle ends in X.Xs`
- [ ] Countdown ticks down every frame
- [ ] Fly back toward enemies within combat range → warning disappears
- [ ] Alternative: keep fleeing 5 more seconds → DEFEATED screen (fled = loss)
- [ ] Landing a hit while warning is active also clears the warning

**FAIL if:** warning doesn't appear, doesn't clear on re-engage, or countdown wrong.

---

## 6. Torus wraparound

- [ ] Fly to the north edge → player position wraps to south edge continuously
- [ ] Camera does NOT jump on wrap (smooth follow)
- [ ] Repeat for east, south, west edges
- [ ] Enemies pursue across the wrap seam (they take the short path)
- [ ] Laser bolt fired near the seam hits a target on the other side

**FAIL if:** camera jerks on wrap, enemies "go the long way" around the map,
projectiles disappear at seam without hitting.

---

## 7. Controls & special moves

- [ ] ArrowLeft / ArrowRight steer the ship
- [ ] ArrowUp accelerates; speed cap enforced
- [ ] Primary weapon fires automatically at targets in arc and range
- [ ] Shift + Space fires the selected secondary (if equipped); Tab cycles it
- [ ] Gamepad: A boost, LB/RB hard turns, right-stick flick ↓ K-turn, LT/RT Tallon, D-pad ←/→ Segnor, right-stick flick ←/→ barrel roll, X secondary, D-pad ↓ cycle, commander orders LT/RT/D-pad ←/→ (capitals)
- [ ] K-turn triggers on the correct key; ship flips 180°; cooldown enforced
- [ ] Boost triggers; visible speed jump; stress increases
- [ ] Barrel roll triggers; brief invulnerability window; cooldown enforced
- [ ] Cloak (C) triggers; alpha drops; damage halved while cloaked
- [ ] Cloak breaks on firing or being hit

**FAIL if:** any key unresponsive, cooldown missing, effect not visible.

---

## 8. HUD

- [ ] Hull, Shields, Speed, Cooldown text visible top-left
- [ ] Score visible top-right
- [ ] Team status panel visible right side; every ship listed with hull bar
- [ ] Instructions line visible bottom (dimmed)
- [ ] Flee warning (when active) does not overlap any other HUD text
- [ ] Text scales sensibly at 1366×768 AND 1920×1080

**FAIL if:** any HUD element overlaps another at either resolution.

---

## 9. Audio

- [ ] SFX: laser fire, hull hit, shield hit, explosion all audible
- [ ] SFX pan left/right based on source position relative to player
- [ ] Music: at battle start, either the mp3 for the faction plays OR the
      procedural fallback plays (no silence, no crash)
- [ ] Volume sliders in settings actually adjust volume
- [ ] Mute toggle silences everything

**FAIL if:** any SFX missing, music crashes on missing file, mute doesn't work.

---

## 10. Pause / resume

- [ ] ESC pauses the battle; overlay appears; ship stops moving
- [ ] ESC again resumes; no state drift or jitter
- [ ] ↑/↓ + Enter (or D-pad + A) reach every pause button
- [ ] SETTINGS opens on top of the battle; clicks don't reach the pause menu; ESC returns to the pause menu
- [ ] QUIT TO MENU: the dialog focuses CANCEL; Enter/ESC/B cancel and the battle stays paused; ← + Enter (or D-pad ← + A) quits
- [ ] Pause during flee warning: warning HUD hides; resume shows it again

**FAIL if:** pause doesn't stop simulation, resume causes visual glitch.

---

## 11. Performance

- [ ] 6 ships, 60 FPS on mid-range hardware (visual smoothness)
- [ ] 5-minute continuous play, no crash, no visible memory leak
      (Chrome DevTools → Performance → Memory tab, curve stays flat)
- [ ] `debug=1` URL query enables telemetry with < 5% FPS impact

**FAIL if:** dropped frames, memory grows unbounded, telemetry noticeably lags.

---

## 12. Cross-browser

- [ ] Full playthrough on Chrome (latest)
- [ ] Full playthrough on Firefox (latest)
- [ ] Full playthrough on Edge (latest)

**Optional:** Safari (macOS), mobile Chrome (Android).

**FAIL if:** any browser shows behavior differences from Chrome baseline.

---

## Shipping gate

**Block the release if ANY of these fail:**

- [ ] All automated unit + e2e tests green (`npm test -- --run` + `npx playwright test`)
- [ ] Section 1 (Boot), 3 (Win), 4 (Loss), 8 (HUD) all PASS on Chrome
- [ ] Section 12 shows no browser-specific regressions

Everything else can ship with a documented known-issue if the fix isn't ready.

---

## Change log

| Date | Version | Notes |
|------|---------|-------|
| 2026-07-28 | v0.1 | Initial MVP playtest guide |

---

## 12. Release build checks

- [ ] Main-menu corner shows `vX.Y.Z ALPHA · <sha> · <date>` matching the commit
- [ ] REPORT A BUG opens a GitHub issue pre-filled with build, settings and recent events
- [ ] DevTools › Network: the main menu appears after < 10 MB transferred; entering a mode shows a LOADING bar while its art downloads
- [ ] Boot with storage blocked (Chrome: Settings › Privacy › Block all cookies) → menu loads, the "won't be saved" banner shows, a battle plays
- [ ] Credits scroll shows the AI-content disclosure and the non-affiliation disclaimer

**FAIL if:** black screen, missing version tag, or the first menu needs more than ~10 MB.