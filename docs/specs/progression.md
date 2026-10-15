# Player Progression — XP-Gated Ship & Faction Unlocks

<!-- GS spec | domain: progression | code: src/data/ProgressionData.ts, src/systems/PlayerProfile.ts -->

## Purpose

Introduce the game gradually. A new player starts with a small, legible roster and earns
access to more complex ships and factions by playing. This layers a **global** player
profile (spanning all modes) on top of the existing per-faction `CampaignSaveManager`
(which stays as-is for campaign-scoped state).

Design intent (owner): "start with a workhorse and a turret, then an ace, then an ordnance
loadout, support, large…" — treated as a *rhythm*, not a literal order. Each faction has
its own unlock cadence reflecting its playstyle.

## Model

- A **PlayerProfile** holds `totalXp`, an `unlockAll` dev flag, explicitly `unlockedFactionIds`
  and `unlockedShipIds`, and lifetime `stats`. Multiple named profiles coexist; one is active.
- Ship availability is a pure function of the profile (see `isShipUnlocked`). No I/O in the
  decision — the store only persists the profile.
- Two unlock axes:
  1. **Faction axis** — some factions are available from XP 0; others unlock at an XP threshold.
  2. **Role axis** — within an available faction, ship *roles* unlock on a per-faction XP ladder.
- A ship is unlocked when: `unlockAll` is set, OR its `id` is in `unlockedShipIds`, OR its
  faction is available AND its role is unlocked for that faction at the profile's XP.

## Rules

- **PRG-1 (MUST)** — `STARTING_FACTIONS` MUST be available at `totalXp = 0`.
- **PRG-2 (MUST)** — A non-starting faction MUST become available once `totalXp` reaches its
  `FACTION_UNLOCK_XP` threshold (or it is in `unlockedFactionIds`).
- **PRG-3 (MUST)** — Within an available faction, a role MUST be unlocked iff some tier in that
  faction's ladder with `minXp ≤ totalXp` grants it (cumulative).
- **PRG-4 (MUST)** — Every faction's tier-0 (`minXp = 0`) MUST grant at least one flyable role
  so a just-unlocked faction is immediately playable.
- **PRG-5 (MUST)** — `unlockAll` profiles MUST treat every ship as unlocked (dev/testing).
- **PRG-6 (MUST)** — XP is awarded once per finished match in every mode (online included) via
  `XP_REWARDS` / `MODE_XP_RULES` (see "XP awards"); XP only ever increases, except an explicit
  progress reset.
- **PRG-7 (SHOULD)** — Locked ships SHOULD surface a human requirement string (faction unlock
  XP or role-tier XP) so the picker can explain *why* and *when*.
- **PRG-8 (MUST)** — A player's store MUST hold exactly one fresh default profile; the dev
  `unlockAll` profile and the graded progression-test profiles (novice/veteran/admiral) MUST exist
  only in dev builds or with `?debug=1`.

## Starting configuration (see ProgressionData.ts for exact numbers)

- **Starting factions**: `terran_hegemony` (balanced teacher), `free_confederation`
  (versatile), `void_corsairs` (fast raiders — fun early).
- **Unlocked by XP**: `synthetic_collective` (swarm, mechanically complex) and
  `ascendant_empire` (support/heavy) — the two most advanced archetypes come later.
- **Role ladder** is per-faction and theme-driven: raiders lead with interceptors, the
  swarm faction leads with light fighters, the balanced faction follows the base ladder.

## Persistence

`localStorage` key `shattered_stars_profiles` = `{ activeId, profiles: PlayerProfile[] }`,
versioned. Independent of `shattered_stars_campaign_*`.

## XP awards

XP is paid **once per match that ends with a result** (victory, defeat or draw), in every mode,
online matches included. The hook is the match recorder (`matchStats` → `onResult` →
`awardMatchXp`, `src/systems/matchXp.ts`); a quit, a restart or a rematch that replaces an
unfinished match pays nothing, and finishing an already finished match again is a no-op, so
nothing is double-awarded. Rules per mode (`src/data/ModeXp.ts`, constants in `XP_REWARDS`):

| Mode (`mode` id) | Victory | Defeat / draw | Per hostile kill |
|---|---|---|---|
| Skirmish `skirmish`, Continuous `continuous`, Dogfight `dogfight`, Ace Duel `ace_duel` | 100 | 20 | 10 |
| Boss Raid `boss_raid`, Campaign `campaign` (per mission) | 150 | 20 | 10 |
| Survival `survival` (per node; a defeat ends the run) | 50 | 20 | 10 |
| Survival run won (`runWon`) | +150 on the final node | — | — |

Kills past 60 in one match earn nothing more (anti-farm). Flight School pays nothing. Because
every mode pays, nobody is locked out of the picker's roster by never playing Skirmish.

## Profiles

A player has **one** profile (`player-default`, "Commander"). The dev / test profiles
(`dev-unlock-all`, `test-novice` 0 XP, `test-veteran` 3000 XP, `test-admiral` 8000 XP) exist only
in dev builds (`import.meta.env.DEV`) or when the page is opened with `?debug=1`; a player's
store that still carries them loses them on the next read (progress on `player-default` is kept).
Select one with `?profile=<id>` (ignored when the profile does not exist).

The **PROFILE** link in the main-menu footer (and Settings › Advanced › PROFILE & PROGRESS) opens
the progress panel: pilot name, level (`XP_PER_LEVEL` = 500), XP into the level, ships / factions
unlocked, the battle record, and RESET PROGRESS behind a confirmation (clears XP, stats and
unlocks; the profile stays).