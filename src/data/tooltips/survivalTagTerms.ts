/**
 * SURVIVAL_TAG_TERMS - tooltip terms of the Survival relic cards: the 20
 * synergy tags, the 5 build archetypes (set bonuses) and the 3 rarities.
 * Typed against the relic model, so a new tag or archetype fails tsc until
 * it is explained here. Pure data.
 */

import type {
  RelicArchetype,
  RelicRarity,
  SynergyTag,
} from "../survival/relics";
import { term, type TermEntry } from "./termTypes";

/** Synergy tags: shared tags between relics hint at combos. */
const SYNERGY_TAG_TERMS: Readonly<Record<`survival.tag.${SynergyTag}`, TermEntry>> = {
  "survival.tag.red-maneuver": term(
    "Tag: red-maneuver",
    "Relics with this tag pay off when you fly red dial maneuvers (hard turns and Snap Turns), the ones that add stress at once.",
    "Adrenal Injector: after a red maneuver, +1 damage for 3 s.",
    "Take two of them and fly aggressive: red maneuvers become attacks instead of mistakes.",
  ),
  "survival.tag.barrel-roll": term(
    "Tag: barrel-roll",
    "Relics that react to your Barrel Roll (the sideways dodge, 3 s recharge).",
    "Slipstream Vanes: when you Barrel Roll, take 50 % less damage for 1.5 s.",
  ),
  "survival.tag.boost": term(
    "Tag: boost",
    "Relics that react to your Boost, the forward dash (4.5 s recharge).",
    "Afterburn Capacitor: after a Boost, +15 % hit chance for 2.5 s.",
  ),
  "survival.tag.k-turn": term(
    "Tag: snap-turn",
    "Relics that react to your Snap Turn (the full reversal, 5 s recharge, adds stress at once).",
    "Snap Gyro: Snap Turns recharge 35 % faster and give +2 damage for 2 s.",
  ),
  "survival.tag.stress": term(
    "Tag: stress",
    "Relics that change how much stress your maneuvers add or how much you can bear.",
    "Daredevil Harness: +1 damage while your pilot is stressed.",
    "A stressed pilot is refused red maneuvers and every action: stress relics keep you flying.",
  ),
  "survival.tag.mark": term(
    "Tag: mark",
    "Relics that boost damage against the squad mark, the one target your side has called (R).",
    "Target Painter: your flagship hits marked targets for +1 damage and +10 % hit chance.",
    "Call a target with R, then let every escort pile on it: mark relics stack with focus fire.",
  ),
  "survival.tag.crit": term(
    "Tag: crit",
    "Relics that raise the chance of a critical hit, which deals extra damage.",
    "Predator Optics: +20 % crit chance against marked targets.",
  ),
  "survival.tag.rear-arc": term(
    "Tag: rear-arc",
    "Relics that reward shooting an enemy from behind, inside its rear arc (+hit, +damage).",
    "Ambush Doctrine: +2 damage when firing from the target's rear arc.",
  ),
  "survival.tag.bullseye": term(
    "Tag: bullseye",
    "Relics that reward a shot fired with the target dead ahead, in the narrow centre of your firing arc.",
    "Bullseye Scope: +2 damage when the target sits in your bullseye arc.",
    "Steady, head-on flying: line up and hold the line instead of circling.",
  ),
  "survival.tag.unshielded": term(
    "Tag: unshielded",
    "Relics that deal extra damage to targets whose shields are already down.",
    "Executioner Rounds: +1 damage against targets whose shields are down.",
  ),
  "survival.tag.kill": term(
    "Tag: kill",
    "Relics that trigger when your fleet destroys an enemy.",
    "Capacitor Bank: each kill restores 2 shield HP.",
  ),
  "survival.tag.escort": term(
    "Tag: escort",
    "Relics that strengthen or reward the escort ships flying with your flagship.",
    "Pack Tactics: the flagship gets +1 damage per 2 living escorts.",
    "The more escorts you keep alive, the more these relics pay: buy escorts in the shop.",
  ),
  "survival.tag.wingman": term(
    "Tag: wingman",
    "Relics that reward flying close to an escort: formation bonuses.",
    "Wing Link: with a friendly ship nearby, +1 damage and 15 % less damage taken.",
  ),
  "survival.tag.shields": term(
    "Tag: shields",
    "Relics that add, regenerate or protect shields. Shields take hits before the hull and can recharge.",
    "Regen Lattice: +0.04 shield HP per second and +1 shield HP per kill for the fleet.",
  ),
  "survival.tag.hull": term(
    "Tag: hull",
    "Relics that add hull points or reduce hull damage. Hull does not recharge in battle.",
    "Ablative Hull: your flagship takes 10 % less damage.",
  ),
  "survival.tag.repair": term(
    "Tag: repair",
    "Relics that heal the fleet between and during battles.",
    "Nanite Weave: after every cleared battle, repair 10 % of each ship's hull.",
  ),
  "survival.tag.salvage": term(
    "Tag: salvage",
    "Relics that increase the salvage (run currency) you earn from kills and cleared nodes.",
    "Salvage Drones: +2 salvage per kill, on top of 3 per regular enemy.",
  ),
  "survival.tag.shop": term(
    "Tag: shop",
    "Relics that change shop prices or stock.",
    "Black Market Codes: shop prices -25 %, so a 90 salvage relic costs 68.",
  ),
  "survival.tag.reroll": term(
    "Tag: reroll",
    "Relics that give extra rerolls, the charges you spend to redraw a power or relic offer.",
    "Loaded Dice: +2 rerolls at the start of every sector (a run starts with 1).",
  ),
  "survival.tag.elite": term(
    "Tag: elite",
    "Relics that help against elite and boss waves, the hardest fights of a sector.",
    "Bounty Contract: elites and bosses drop +100 % salvage.",
  ),
};

/** Build archetypes: three relics of one archetype activate its set bonus. */
const ARCHETYPE_TERMS: Readonly<Record<`survival.set.${RelicArchetype}`, TermEntry>> = {
  "survival.set.ace": term(
    "Set: Hotshot (ace)",
    "A flagship build. Own 3 ace relics to cut maneuver stress by 30 % for the rest of the run.",
    "Three ace relics, then fly red turns back to back without being refused actions.",
  ),
  "survival.set.hunter": term(
    "Set: Hunter",
    "A focus-fire build. Own 3 hunter relics so the marked target takes +1 damage from the whole fleet.",
    "Mark an elite with R and all your ships hit it for +1 damage each shot.",
  ),
  "survival.set.squadron": term(
    "Set: Squadron",
    "An escort build. Own 3 squadron relics so escorts take 20 % less damage.",
    "Five escorts with 20 % less damage last through a whole sector.",
  ),
  "survival.set.bulwark": term(
    "Set: Bulwark",
    "A defensive build. Own 3 bulwark relics for +0.12 shield HP per second and -15 % damage taken fleet-wide.",
    "Hold the line while shields refill between volleys.",
  ),
  "survival.set.salvager": term(
    "Set: Salvager",
    "An economy build. Own 3 salvager relics for +2 salvage on every kill.",
    "A 12-kill wave pays 24 extra salvage: a rare relic (130) arrives a sector sooner.",
  ),
};

/** Relic rarity: how strong and how expensive a relic is. */
const RARITY_TERMS: Readonly<Record<`survival.rarity.${RelicRarity}`, TermEntry>> = {
  "survival.rarity.common": term(
    "Rarity: common",
    "The most frequent relics: a single clear effect. Shop price 60 salvage.",
    "A common relic is a safe first pick that fills an archetype slot.",
  ),
  "survival.rarity.uncommon": term(
    "Rarity: uncommon",
    "Stronger or more conditional effects than common ones. Shop price 90 salvage.",
    "An uncommon trigger relic that buffs you for a few seconds after a Boost.",
  ),
  "survival.rarity.rare": term(
    "Rarity: rare",
    "Run-defining relics. Elite and boss rewards draw only at this rarity or above. Shop price 130 salvage.",
    "A rare relic can change how you fly for the rest of the run.",
  ),
};

/** Terms of the relic cards. */
export const SURVIVAL_TAG_TERMS = {
  ...SYNERGY_TAG_TERMS,
  ...ARCHETYPE_TERMS,
  ...RARITY_TERMS,
} as const;
