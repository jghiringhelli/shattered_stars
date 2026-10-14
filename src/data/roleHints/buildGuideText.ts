/**
 * buildGuideText — the small, fixed phrase tables the quick-build guide is
 * assembled from: one tactic / counter / opener per play style and one
 * handling tip per upgrade slot. Nothing here is per build — every build's
 * guide mixes these phrases with its own real pilot, cards and hull stats.
 *
 * Pure data.
 */

import type { UpgradeSlotType } from "../../core/upgradeTypes";
import type { Playstyle } from "./playstyleCatalog";

/** How to fly a style (imperative, one line). */
export const STYLE_TACTIC: Readonly<Record<Playstyle, string>> = {
  striker: "Hold the front arc on one target and trade shots; Focus every cycle.",
  flanker:
    "Circle wide, attack from the target's rear arc and roll away before its escorts answer.",
  marksman:
    "Stay calm: avoid red maneuvers, line up one clean shot per cycle and let the dice work.",
  brawler: "Close to range 1 and stay there; wounded or stressed, you hit harder.",
  hunter:
    "Let the squad strip shields, then finish the wounded target for the kill bonus.",
  interceptor:
    "Use speed and Barrel Rolls to stay outside arcs; chase stragglers and bombers.",
  tank: "Take the enemy's fire at the front while wingmen flank; keep shields up between passes.",
  wingman:
    "Fly within range of a partner and shoot the squad's marked target (R) together.",
  support:
    "Stay inside the squad, keep allies in your aura and coordinate their actions.",
  bomber:
    "Target Lock, launch ordnance from range 2-3, then reload behind your escorts.",
  gunner:
    "Fly past enemies so the turret covers your tail; rotate its arc toward the nearest threat.",
  suppressor:
    "Stress the enemy's best ship, then let hunters pounce while it cannot maneuver.",
  ghost: "Cloak to cross the line, decloak behind the target and strike its rear arc.",
  salvager: "Pick off weakened ships; each kill pays you back, so stay near the fight.",
  commander:
    "Keep the hero alive and close to the wing — its talents multiply their shots.",
};

/** What beats a style. */
export const STYLE_COUNTER: Readonly<Record<Playstyle, string>> = {
  striker: "Evasive flankers that never give it a front arc.",
  flanker: "Turret ships and wingmen who cover the rear arc.",
  marksman: "Stress effects and fast brawlers that break its calm.",
  brawler: "Ranged shooters that never let it reach range 1.",
  hunter: "Squads that stay healthy — it needs wounded prey.",
  interceptor: "Turrets, tanks and bombs that punish a fast, fragile hull.",
  tank: "Focus fire on a marked target, and fast flankers it cannot catch.",
  wingman: "Aces that split the pair — it is weak when alone.",
  support: "Hunters that kill the support ship first.",
  bomber: "Interceptors that run it down before it fires.",
  gunner: "Brawlers that stay inside the turret's blind spot.",
  suppressor: "Stress-relief cards and fast ships that leave its range.",
  ghost: "Sensors and turrets that cover a cloaked flank.",
  salvager: "Squads that kill it before its first kill lands.",
  commander: "Squads that focus the hero first.",
};

/** How a build of this style opens a fight (follows the pilot's name). */
export const STYLE_OPENER: Readonly<Record<Playstyle, string>> = {
  striker: "points the nose at the nearest enemy and trades shots with Focus up",
  flanker: "swings wide behind the target and shoots its rear arc",
  marksman: "holds a green maneuver and takes one clean long shot per cycle",
  brawler: "dives to range 1 and keeps shooting a wounded target",
  hunter: "waits for the squad to strip shields, then finishes the wounded one",
  interceptor: "runs down a straggler and barrel-rolls out of the escorts' arcs",
  tank: "leads the charge and soaks the first volley",
  wingman: "flies tight on its partner and shoots the marked target",
  support: "sits inside the squad and keeps the wing supplied",
  bomber: "locks a target and lets ordnance fly from range 2-3",
  gunner: "flies past and lets the turret cover the tail",
  suppressor: "stresses the enemy ace so its dial locks up",
  ghost: "cloaks across the line and strikes from behind",
  salvager: "picks off the weakened and profits from each kill",
  commander: "leads from the middle and buffs the wing",
};

/** One handling tip per upgrade slot (follows the card's name). */
export const SLOT_TIP: Readonly<Record<UpgradeSlotType, string>> = {
  talent: "build your approach around this trick",
  missile: "lock first, fire from range 2-3, then break away",
  torpedo: "lock first and save it for big or shielded targets",
  cannon: "keep the target in the front arc every cycle",
  turret: "rotate its arc toward the nearest enemy",
  bomb: "drop it astern while retreating through the enemy's path",
  crew: "keep your wing close so the crew ability reaches them",
  gunner: "cover the extra gun's arc while you fly away",
  astromech: "disengage briefly so the rigger can repair",
  sensor: "start the lock earlier than the enemy can answer",
  tech: "check the card text for its tradeoff",
  modification: "just fly — the bonus is always on",
  illicit: "plan around its drawback",
  title: "it reshapes the hull — use the extra slots",
  configuration: "play to the configuration's tradeoff",
  force_power: "use it to steady allies or rattle the target",
};
