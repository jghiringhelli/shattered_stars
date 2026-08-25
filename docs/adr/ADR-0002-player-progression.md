# ADR-0002 — Global player progression layered over campaign saves

- **Status:** Accepted
- **Date:** 2026-03-30
- **Deciders:** Project owner (jghiringhelli)
- **Related:** [docs/specs/progression.md](../specs/progression.md)

## Context

The game already has `CampaignSaveManager` (per-faction `localStorage`, tracks campaign
`totalXp`, `unlockedShips`, pilots). But there is no *global* sense of player progress that
spans arcade, tactical, and campaign, and no gating that introduces ships/factions
gradually. The owner wants a new player to begin with a small legible roster (a workhorse
and a turret) and earn access to aces, ordnance, support, large ships, and additional
factions by playing — with a developer profile that unlocks everything for testing and
graded profiles to exercise the progression curve.

Options considered:

1. **Extend `CampaignSaveManager`** to also drive arcade gating. Rejected: it is
   faction-scoped and campaign-shaped; overloading it couples campaign state to global
   unlock logic and violates single-responsibility.
2. **New global `PlayerProfile` layer** with pure unlock rules in a separate data module.
   Chosen.

## Decision

1. Add `src/data/ProgressionData.ts` — **pure** data + query helpers (no I/O): starting
   factions, per-faction XP thresholds, per-faction role-unlock ladders, XP rewards, and
   `isShipUnlocked(def, state)`. Depends only on ship/faction types.
2. Add `src/systems/PlayerProfile.ts` — the `localStorage`-backed store for multiple named
   profiles (key `shattered_stars_profiles`), including seeded dev/test profiles. It holds
   state and delegates all unlock decisions to `ProgressionData` (dependency inversion).
3. Keep `CampaignSaveManager` unchanged. Campaign state stays campaign-scoped; the global
   profile is an additive layer read by the squad/ship-picker UI.
4. Gating is enforced at the UI boundary (ship picker); the domain rules stay pure and
   unit-tested against the PRG-1…PRG-8 gates in `progression.md`.

## Consequences

- New player experience is tunable in one data file without touching UI or campaign code.
- Unlock logic is pure → trivially testable, no mocks.
- The `unlockAll` dev profile and graded test profiles make progression QA reproducible.
- Two persistence namespaces coexist; migrations are independent.
