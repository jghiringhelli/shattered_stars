# Archive — superseded design documents

Everything here describes the **pre-pivot, turn-based** design (maneuver dials resolved
turn by turn, ship evolution trees, fusion / symbiotic hulls, faction mechanics tables) or is
an untouched template. The shipped game is **real time** (500 ms maneuver cycle, see
`CLAUDE.md`, `docs/specs/` and `docs/adr/`); none of these systems exist in code
(`rg -il symbiot src` finds nothing). Read them for lore and ideas only — never build from them.

| File | What it was | Status |
|---|---|---|
| `advanced_mechanics.md`, `mechanical_changes.md`, `special_abilities_distribution.md`, `aura_abilities_system.md` | Turn-based combat, ability and aura tables | Superseded by `docs/specs/*` (upgrades, factions, flight controls) |
| `evolution_mechanics.md`, `evolution_branching_paths.md`, `progression_systems.md` | Ship evolution / role-change trees and mastery | Never built; progression is `docs/specs/progression.md` |
| `fusion_symbiotic_ships.md` | Fusion / symbiotic hulls | Never built (items only use the word "fusion") |
| `PRD.md`, `TechSpec.md` | Empty project templates ("My Project") | Placeholders |
| `specs/evolution_*.md`, `specs/fusion_symbiotic_ships.md` | Older copies (2026-03-02) of the three design docs above | Superseded by the copies in this folder |

The remaining pre-pivot files in the top-level `specs/` folder and `DEVELOPMENT_PROMPTS.md`
carry the same caveat: the removed turn-based engine (BattleManager / TurnSystem) they describe
no longer exists.
