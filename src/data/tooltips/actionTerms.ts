/**
 * actionTerms — tooltip terms for the ship action bar (focus, evade, boost,
 * barrel roll…). Keyed by the game's ActionType. Pure data.
 */

import type { ActionType } from "../../core/types";
import { term, type TermEntry } from "./termTypes";

/** Term id of an action. */
export type ActionTermId = `action.${ActionType}`;

export const ACTION_TERMS: Readonly<Record<ActionTermId, TermEntry>> = {
  "action.focus": term(
    "Focus",
    "Gain a focus token: your next attack (or defence) turns its focus results into hits (or evades).",
    "A heavy fighter takes Focus, then its next volley lands one extra hit.",
    "The default action of most hulls. Spend it every cycle you are not dodging.",
  ),
  "action.evade": term(
    "Evade",
    "Gain an evade token: +1 evade result the next time you defend.",
    "A gunship with Agility 1 takes Evade before a head-on pass to cancel one more hit.",
    "Best on durable-but-clumsy ships that expect to be shot at.",
  ),
  "action.target_lock": term(
    "Target Lock",
    "Lock onto an enemy: your shots at it can be re-rolled and lock-based ordnance (missiles, torpedoes) can fire.",
    "Lock a bomber before launching a torpedo — no lock, no launch.",
    "Locks break if the target leaves range, so close in before you commit.",
  ),
  "action.barrel_roll": term(
    "Barrel Roll",
    "A sideways dash that keeps your facing — a short dodge out of an enemy's arc. Recharges in about 3 seconds.",
    "Barrel roll left as a fighter lines up your tail, and its shot passes behind you.",
    "Double-tap ← or → to roll that way. Only available if it is on the ship's action bar.",
  ),
  "action.boost": term(
    "Boost",
    "A short forward burst along the heading. Recharges in about 4.5 seconds and adds stress.",
    "Boost to close the last few pixels to range 1 before a strike.",
    "Gets you out of or into arcs fast; a stressed pilot cannot use it.",
  ),
  "action.coordinate": term(
    "Coordinate",
    "Grant an action to a nearby friendly ship so two ships act as one.",
    "A support ship coordinates a wingman's Focus while its own guns keep firing.",
    "Stay close to your wing; the action only reaches allies inside range.",
  ),
  "action.jam": term(
    "Jam",
    "Strip tokens (focus, evade, locks) from a nearby enemy ship.",
    "Jam an ace right before your squad volleys to take away its evade token.",
    "A support tool: it pays off most when the whole squad shoots the same target.",
  ),
  "action.cloak": term(
    "Cloak",
    "Become much harder to hit for a short time, but you cannot attack while cloaked.",
    "A ghost-style pilot cloaks to slip past the front line, then decloaks behind the bombers.",
    "Cloak duration can be extended by cards; plan the timing of the strike.",
  ),
  "action.slam": term(
    "SLAM",
    "Fly an extra maneuver right after your normal one, at the cost of your attack for that cycle.",
    "SLAM a speed-2 bank to cut the corner on a fleeing target.",
    "Trading a shot for position is worth it when the shot would miss anyway.",
  ),
  "action.calculate": term(
    "Calculate",
    "Gain a calculate token that converts one focus result — a lighter Focus for computer-driven ships.",
    "A synthetic drone calculates every cycle and still keeps its Focus free.",
    "Cheap, steady dice improvement for ships that cannot spare a Focus.",
  ),
  "action.reinforce": term(
    "Reinforce",
    "Add +1 defence result when attacked from one arc — a heavy-armour stance.",
    "A gunship reinforces its front while it charges a gun line.",
    "Great against attackers who must come at you head-on.",
  ),
  "action.rotate_arc": term(
    "Rotate Arc",
    "Turn a turret's firing arc to cover a new direction without turning the ship.",
    "A gunship rotates its arc to the rear to punish the interceptor on its tail.",
    "Turret ships fight in every direction; the arc is what makes it so.",
  ),
  "action.reload": term(
    "Reload",
    "Recover a charge on your weapons or devices.",
    "A bomber reloads a spent torpedo rack after its first strike.",
    "Ordnance is limited, so reloading turns a one-shot bomber into a sustained threat.",
  ),
};
