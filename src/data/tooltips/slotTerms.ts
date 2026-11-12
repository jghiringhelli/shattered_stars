/**
 * slotTerms — tooltip terms for the 16 upgrade slot types (crew, rigger,
 * torpedo, missile, bomb, turret, cannon, modification, talent, illicit,
 * psychic power…). Pure data.
 */

import type { UpgradeSlotType } from "../../core/upgradeTypes";
import { term, type TermEntry } from "./termTypes";

/** Term id of an upgrade slot. */
export type SlotTermId = `slot.${UpgradeSlotType}`;

export const SLOT_TERMS: Readonly<Record<SlotTermId, TermEntry>> = {
  "slot.talent": term(
    "Talent slot",
    "A pilot skill card: a trick the pilot has learned, such as extra damage from behind or a free evade after a boost.",
    "Elusive keeps a barrel-rolling pilot out of stress; Predator rewards the chase.",
    "Talents are cheap and fit every hull with the slot. Pick one that matches how you fly.",
  ),
  "slot.missile": term(
    "Missile slot",
    "A guided missile: needs a target lock and a target in front, flies in homing curves and hits hard once.",
    "Burst Missile: lock a fighter at range 2, fire, then fly away while it homes in.",
    "Ordnance damage is multiplied in this game, so one hit hurts. Missiles recharge over time.",
  ),
  "slot.torpedo": term(
    "Torpedo slot",
    "A heavy guided warhead: slower and stronger than a missile, best against big or shielded targets.",
    "Fusion Torpedoes: lock a gunship at range 2-3 and the torpedo strips a big chunk of hull.",
    "Torpedo ships want a lock first, so they pair with Target Lock and an escort.",
  ),
  "slot.cannon": term(
    "Cannon slot",
    "A forward cannon that modifies your primary laser — more damage, range or a special effect.",
    "Ion Cannon adds stress on hit so a pursuer cannot keep the chase.",
    "Cannons act every cycle with the laser, so they reward steady front-arc shooting.",
  ),
  "slot.turret": term(
    "Turret slot",
    "A weapon that can aim around the ship instead of only forward, rotating its arc to the nearest target.",
    "A turret on a gunship covers the rear while it flies away from a pack.",
    "Turrets cover blind angles; they do not replace the main laser.",
  ),
  "slot.bomb": term(
    "Bomb / mine slot",
    "A device dropped behind the ship that arms and detonates when enemies (or friends) get close.",
    "Drop a proximity mine in the wake of a retreating bomber; a chasing fighter flies into it.",
    "Devices are dropped astern, so they favour ships that run, and they hurt allies too.",
  ),
  "slot.crew": term(
    "Crew slot",
    "A crew member aboard the ship: a gunner, a mechanic or a coordinator. A coordinator card makes the ship project its faction's aura to the wingmen around it.",
    "A tactical coordinator gives the whole wing a better chance to hit the squad's marked target.",
    "Crew are the support backbone of the Free Confederation.",
  ),
  "slot.gunner": term(
    "Gunner slot",
    "A dedicated gunner who fires an extra attack or covers a rear arc on larger ships.",
    "A tail gunner shoots the interceptor that thinks it is safe behind you.",
    "Gunners add damage but not durability, so keep them behind a screen.",
  ),
  "slot.astromech": term(
    "Rigger slot",
    "A non-sentient copilot robot (a Rigger) bolted into a fighter socket: it repairs, patches shields or helps lock targets.",
    "A Repair Rigger restores shields between passes; a Targeting Rigger speeds target locks.",
    "Riggers are capped by law, so each hull carries at most one or two.",
  ),
  "slot.sensor": term(
    "Sensor slot",
    "A sensor suite that improves targeting: longer reach, faster locks or a better read of the enemy.",
    "A long-range sensor lets a marksman begin shooting before the enemy can answer.",
    "Sensors suit slow, steady shooters rather than brawlers.",
  ),
  "slot.tech": term(
    "Tech slot",
    "Advanced technology: experimental gear with a strong effect and often a tradeoff.",
    "A tech module can trade a few seconds of cooldown for a burst of speed.",
    "Look at the card text — tech is rarely a plain stat upgrade.",
  ),
  "slot.modification": term(
    "Modification slot",
    "A hull modification: permanent stat boosts such as +1 hull, extra shields or faster engines.",
    "Hull Upgrade adds one hull point to anything that has the slot.",
    "Modifications are the cheapest way to make any build sturdier or faster.",
  ),
  "slot.illicit": term(
    "Illicit slot",
    "Black-market gear: a strong bonus paired with a drawback. Void Corsair territory.",
    "Overcharged Capacitors: +1 laser damage, but maneuver stress builds 25% faster.",
    "Plan around the drawback; used right, illicit cards beat anything else for the price.",
  ),
  "slot.title": term(
    "Title slot",
    "A ship title: unique name and equipment bolted to one specific hull, often adding slots or special rules.",
    "A title can convert a plain gunship into a flying gun platform with an extra weapon slot.",
    "Titles are tied to one hull and are usually one-of-a-kind in a squad.",
  ),
  "slot.configuration": term(
    "Configuration slot",
    "A ship configuration: a tradeoff that reshapes the hull for a different job.",
    "An attack configuration raises offence at the cost of durability.",
    "Pick it when you want a clear specialist, not a generalist.",
  ),
  "slot.force_power": term(
    "Psychic power slot",
    "A psychic power card: an ability fuelled by the pilot's mind, used by Ascendant Empire psions.",
    "A psychic power can steady a wingman's shots or rattle an enemy pilot into stress.",
    "Only psion pilots can use them, and they are the Ascendant Empire's signature.",
  ),
};
