# Crew Point Costs (Corsairs System)

> Phase 3 specification. Crew upgrade cards with point costs and restrictions.
>
> **Status**: Not yet implemented. This document defines the target design.

---

## Overview

The Crew system adds named crew members as upgrade cards that occupy **crew slots** on eligible ships. Crew cards modify ship behavior, add abilities, or grant passive bonuses. Point costs are balanced against the base ship cost to maintain competitive equity.

---

## Crew Slot Eligibility

Not all ships have crew slots. Eligibility by ship size:

| Ship Size | Crew Slots | Examples |
|-----------|-----------|---------|
| Small fighter | 0 | X-Wing, TIE Fighter, A-Wing |
| Small transport | 1 | HWK-290, Attack Shuttle, U-Wing |
| Large freighter | 1-2 | YT-1300 (2), YT-2400 (1), VCX-100 (2) |
| Large shuttle | 2 | Lambda Shuttle (2), Upsilon Shuttle (2) |
| Epic ship | 2-4 | CR90 (4), Raider (3), Gozanti (2) |

---

## Crew Card Cost Tiers

### Tier 1: Generic Crew (1-2 pts)

| Crew | Cost | Effect | Faction |
|------|------|--------|---------|
| Gunner | 2 | Reroll 1 blank attack die | Any |
| Navigator | 2 | Change maneuver speed by 1 after revealing | Any |
| Sensor Officer | 1 | Acquire target lock at range 1-3 as free action | Any |
| Weapons Engineer | 2 | Maintain 2 target locks simultaneously | Any |
| Flight Instructor | 1 | Reroll 1 focus result on defense | Any |
| Tactician | 2 | Assign stress to defender at range 2 in arc | Any |

### Tier 2: Named Crew (3-4 pts)

| Crew | Cost | Effect | Faction |
|------|------|--------|---------|
| C-3PO | 3 | Guess number of evade results; if correct, add 1 | Rebel |
| Chewbacca | 4 | When dealt faceup damage card, flip it facedown | Rebel |
| Nien Nunb | 3 | Treat all straight maneuvers as green | Rebel |
| Intelligence Agent | 3 | Look at opponent's dial before activation | Any |
| Mercenary Copilot | 3 | Change 1 hit to crit at range 3 | Any |
| Rebel Captive | 3 | First attacker each round receives stress | Imperial |
| Ysanne Isard | 4 | Free evade token when no shields remain | Imperial |
| Moff Jerjerrod | 4 | Take 1 facedown damage to change maneuver | Imperial |

### Tier 3: Elite Crew (5-6 pts)

| Crew | Cost | Effect | Faction |
|------|------|--------|---------|
| Luke Skywalker | 6 | Change 1 focus to hit on attack | Rebel |
| Han Solo | 5 | May spend target lock to change all dice to hits | Rebel |
| Leia Organa | 5 | Once per round, all friendly ships treat red maneuvers as white | Rebel |
| Darth Vader | 6 | After attacking, spend 2 hull to deal 1 crit | Imperial |
| Emperor Palpatine | 6 | Once per round, change 1 die to any result | Imperial |
| Grand Admiral Thrawn | 5 | After setup, assign 1 facedown dial to opponent ship | Imperial |
| 4-LOM | 5 | Assign 1 stress to attacker when defending | Scum |
| Dengar | 5 | Reroll 1 attack die per round | Scum |

### Tier 4: Legendary Crew (7-8 pts)

Reserved for Phase 4+ expansion. Unique campaign-only crew with powerful effects and heavy point costs.

---

## Crew Restrictions

| Rule | Detail |
|------|--------|
| Unique | Named crew are unique; only 1 copy per squad |
| Faction lock | Most named crew restricted to their faction |
| Dual faction | Some crew (Intelligence Agent, Mercenary Copilot) available to all |
| Crew per slot | 1 crew card per crew slot |
| Pilot conflict | A pilot cannot also equip themselves as crew |

---

## Implementation Notes (Phase 3)

### Data Model
```csharp
public class CrewCard
{
    public string Name { get; }
    public int PointCost { get; }
    public Faction FactionRestriction { get; }
    public bool IsUnique { get; }
    public string AbilityDescription { get; }
    public CrewAbilityType AbilityType { get; }
    public ShipSize MinimumShipSize { get; }
}
```

### Integration Points
- `UpgradeSystem.cs`: Add crew as upgrade type
- `CompleteSquadBuilder.cs`: Show crew slot in ship detail
- `ShipPointValues.cs`: Include crew cost in squad total
- `BaseShipController.cs`: Apply crew effects during gameplay

### Balance Considerations
- Crew + ship total should not create uncounterable combinations
- Epic ship crew stacks must be tested for compounding effects
- Campaign crew should be earnable, not purchasable, to prevent pay-to-win feel
