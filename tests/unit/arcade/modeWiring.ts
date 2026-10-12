/**
 * Mode wiring — which source files make up each battle mode, and the shared
 * consumers (by function name, any alternative) every mode must call so the
 * cards and pilot abilities it equips act on its ships.
 */

/** Battle modes → the scene / glue files that run their combat. */
export const MODE_WIRING: Readonly<Record<string, readonly string[]>> = {
  "Skirmish / Scenarios / reinforcements": [
    "src/scenes/ArcadeBattleScene.ts",
    "src/scenes/arcadeBattle/arcadeShipFactory.ts",
  ],
  "Epic format": ["src/scenes/EpicBattleScene.ts"],
  Dogfight: ["src/scenes/DogfightScene.ts"],
  "Ace Duel": ["src/scenes/AceDuelScene.ts"],
  "Continuous Tactical / Boss Raid": ["src/scenes/ContinuousBaseScene.ts"],
  Survival: ["src/scenes/SurvivalScene.ts"],
  Campaign: ["src/scenes/CampaignBattleScene.ts"],
};

/** Shared consumers → the call names that satisfy them (any one). */
export const MODE_CONSUMERS: Readonly<Record<string, readonly string[]>> = {
  "loadout stats + modifier sheet": [
    "equipQuickBuild(",
    "resolveLoadoutModifiers(",
  ],
  "action recharges / top speed": ["equipFlight(", "applyControlModifiers("],
  "maneuver stress": ["stressModifiersOf(", "stressRateMultiplier"],
  "laser shots (damage, conditions, mitigation, stress on hit)": [
    "resolveDiceAttack(",
  ],
  "secondary weapons (ordnance, turrets, cloak)": ["BattleWeapons"],
  "own shield regen / hull repair": ["selfRepair("],
  "faction auras incl. pilot sheets": ["applyAllyAuraRepairs(", "auraFactsOf("],
  "kill rewards": ["rewardKill("],
  "death blasts": ["deathBlastTargets("],
};
