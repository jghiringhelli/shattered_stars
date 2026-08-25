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
- **PRG-6 (MUST)** — XP is awarded from battle outcomes across all modes via `XP_REWARDS`
  (`perKill`, `win`, `loss`, `missionComplete`); XP only ever increases.
- **PRG-7 (SHOULD)** — Locked ships SHOULD surface a human requirement string (faction unlock
  XP or role-tier XP) so the picker can explain *why* and *when*.
- **PRG-8 (MUST)** — Seed profiles MUST include a fresh player profile, a dev `unlockAll`
  profile, and graded progression-test profiles (novice/veteran/admiral).

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
