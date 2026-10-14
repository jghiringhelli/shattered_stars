/**
 * statTerms — tooltip terms for ship statistics, pilot skill, the maneuver
 * dial, stress and the signature maneuvers. Pure data.
 */

import { term } from "./termTypes";

export const STAT_TERMS = {
  "stat.attack": term(
    "Attack",
    "How many attack dice your primary laser rolls each cycle. More dice means more hits, so more damage.",
    "Attack 3 rolls three dice; against an evade-less target about two of them hit.",
    "One attack per cycle. A target inside your front arc and in range is shot automatically.",
    "attack",
  ),
  "stat.agility": term(
    "Agility",
    "How many defence dice you roll when shot. Every evade result cancels one incoming hit.",
    "An interceptor with Agility 3 turns most of a light fighter's volley into misses; a gunship with Agility 1 barely dodges.",
    "Agility is cheap protection for fast ships; slow tanks rely on hull and shields instead.",
    "agility",
  ),
  "stat.hull": term(
    "Hull",
    "Structure points. When shields are gone every hit that gets through removes hull; at zero the ship is destroyed.",
    "Hull 5 survives five unblocked hits once its shields are down.",
    "Hull does not regenerate on its own — only repair drones, riggers and some cards restore it.",
    "hull",
  ),
  "stat.shields": term(
    "Shields",
    "A damage buffer that absorbs hits before the hull. Shields recharge slowly when nothing is hitting you.",
    "Shields 3 lets a fighter absorb three hits, then regrow after a few quiet seconds.",
    "Hit-and-run pilots love shields: break contact, let them recharge, return.",
    "shield",
  ),
  "stat.initiative": term(
    "Initiative (pilot skill)",
    "How good the pilot is, from 1 (rookie) to 6 (legend). Each level above 1 adds a point to the build's price and sharpens how the pilot's ability pays off.",
    "Initiative 5 'Poison Fang' outguns an Initiative 2 cadet in the same hull — and costs 4 more points.",
    "High initiative is worth most on hulls with strong abilities; on a cheap swarm ship it is wasted.",
    "star",
  ),
  "stat.points": term(
    "Points cost",
    "What the ship (or build) costs against your squad's point limit. Hull, pilot and every upgrade card each add to it.",
    "A 43 pt interceptor plus a 6 pt missile and a 4 pt pilot is a 53 pt build.",
    "Spend points where they change fights: focus fire needs 2+ ships, so a cheaper wing often beats one expensive ace.",
    "points",
  ),
  "stat.speed": term(
    "Speed range",
    "The slowest and fastest cruising speed on the ship's dial. A wide, fast range means easy pursuit and escape.",
    "Speed 1-5 on an interceptor can crawl through a dogfight or sprint past a bomber (speed 1-3).",
    "Fast ships choose when to fight; slow ones must make the enemy come to them.",
  ),
  "stat.maneuver": term(
    "Maneuverability",
    "The encyclopedia's combined 1-5 rating of how easily the ship turns and dodges (agility plus its dial).",
    "An interceptor rates 5; a gunship rates 1 or 2.",
  ),
  "stat.defense": term(
    "Defense",
    "The encyclopedia's combined 1-5 rating of how much punishment the ship takes: hull, shields and agility together.",
    "A gunship rates high because of its hull and shields, not its agility.",
  ),
  "stat.payload": term(
    "Payload",
    "The encyclopedia's 1-5 rating of how much extra gear the ship carries: upgrade slots and secondary weapons.",
    "A bomber rates high for its missile, torpedo and bomb slots.",
  ),
  "stat.build_stats": term(
    "Build bonuses",
    "Stat changes the build's cards add on top of the hull, such as +1 HUL, +1 SHD, +1 ATK or +1 AGI.",
    "'+2 HUL +1 ATK' means two more hull points and one more attack die than the bare ship.",
  ),
  "size.tiny": term(
    "Tiny ship",
    "The smallest hull of all: a hard target that turns on the spot, but it has the least hull to lose.",
    "Drones and swarm skiffs are tiny — they die fast but there are many.",
  ),
  "size.small": term(
    "Small ship",
    "The smallest hull class: hardest to hit in a crowd and quickest to turn.",
    "Interceptors and light fighters are small.",
  ),
  "size.medium": term(
    "Medium ship",
    "Mid-sized hulls: more durable than small ships, but easier to hit and slower to turn.",
    "Most heavy fighters and bombers are medium.",
  ),
  "size.large": term(
    "Large ship",
    "Big hulls with a wide turning circle. They carry more slots and can mount turrets.",
    "Gunships and support ships are often large.",
  ),
  "size.huge": term(
    "Huge ship",
    "Capital-class hulls. They cannot barrel roll or snap turn and are only allowed in the Epic format.",
    "A cruiser soaks fire from a whole squad but turns like a wall.",
  ),
  "dial.green": term(
    "Green maneuver",
    "A calm manoeuvre on the dial. Flying it removes stress from the pilot.",
    "A straight 2 or a gentle bank is green: free and stress-reducing.",
    "Chain green moves between red ones to keep the ship clear of stress.",
    "dial_green",
  ),
  "dial.white": term(
    "White maneuver",
    "A standard manoeuvre. It neither adds nor removes stress.",
    "A normal turn at speed 2 is usually white.",
    "White moves are your reliable default — they never cost you anything.",
    "dial_white",
  ),
  "dial.red": term(
    "Red maneuver",
    "A hard or risky manoeuvre. It adds stress to the pilot.",
    "A speed-3 hard turn or a Snap Turn is red.",
    "Red moves let you turn the ship where you want — but a stressed pilot is refused red manoeuvres and actions.",
    "dial_red",
  ),
  "dial.stress": term(
    "Stress",
    "Pressure from red manoeuvres, boosts and hostile effects. While stressed you cannot fly red manoeuvres or take actions; green manoeuvres clear it.",
    "Fly a red hard turn, then try to boost: it is refused until a green move relieves the stress. A Snap Turn adds stress at once.",
    "Plan red moves in pairs with a green one, or give the pilot stress relief from a card or an aura.",
    "stress",
  ),
  "maneuver.snap_turn": term(
    "Snap Turn",
    "A red U-turn: the ship flies straight ahead and flips 180 degrees to face the enemy behind it.",
    "A bomber chased by an interceptor Snap Turns to bring its guns around — and takes stress for it.",
    "Tap the Maneuver key (Z), or double-tap ↓. Recharges in about 5 seconds — use it to break a tail, not as a habit.",
    "dial_red",
  ),
  "maneuver.hook_loop": term(
    "Hook Loop",
    "A red looping turn: bank, then flip around, ending behind where you started with a sideways offset.",
    "Hook Loop right to slide out of a pursuer's arc and reappear on its flank.",
    "Hold the Maneuver key (Z) and press ← or →. Needs the maneuver on the ship's dial — not every hull can do it.",
    "dial_red",
  ),
  "maneuver.knife_roll": term(
    "Knife Roll",
    "A red sideways flip: turn, then roll a further 90 degrees so the ship ends facing back the way it came, shifted sideways.",
    "Knife Roll left to dodge a joust and land with the enemy in your front arc.",
    "Double-tap the Maneuver key (Z), then hold ← or →. Skilled pilots use it to reverse a duel in one move; only some dials have it.",
    "dial_red",
  ),
} as const;
