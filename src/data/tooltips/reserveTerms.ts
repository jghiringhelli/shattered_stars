/**
 * reserveTerms — tooltip terms of the reserve editor and the squad
 * builder's reinforcement controls: pool, on-field cap, flown cost, category
 * quotas, deploy order and the four reserve strategies. Pure data.
 */

import { term } from "./termTypes";

export const RESERVE_TERMS = {
  "reserve.pool": term(
    "Pool",
    "The total points your team can spend on ships over the whole battle, the opening squad included. A side whose pool is empty cannot send more ships.",
    "Pool 1000 with a 200 pt opening squad leaves 800 pt: about five more 150 pt ships.",
    "Cheap ships stretch the pool; expensive ships win the first fight but run it dry.",
    "points",
  ),
  "reserve.field_cap": term(
    "On-field cap",
    "The most flown points your team may have alive on the battlefield at once. Ships beyond the cap wait in reserve until one dies.",
    "Cap 250 allows your 200 pt squad plus one 50 pt fighter, not three more heavies.",
    "A reserve ship deploys as soon as there is room under the cap.",
    "points",
  ),
  "reserve.flown_cost": term(
    "Flown cost",
    "What a ship costs as it flies: hull, pilot and cards. This is what the pool pays and the cap counts.",
    "A Kestrel on a pilot build can read 58 PTS although its bare hull is cheaper.",
    "Compare rows by flown cost, not by hull.",
    "points",
  ),
  "reserve.quota": term(
    "Category quotas",
    "Limits that keep every field mixed: bombers, aces (unique pilots) and capital ships each have a maximum on the field and per match.",
    "Skirmish: at most 2 bombers and 1 ace on the field, 3 aces per match, no capital ships.",
    "A reserve ship that would break a quota waits until a slot frees up.",
  ),
  "reserve.order": term(
    "Deploy order",
    "The list is the order reinforcements arrive: the first row deploys first when there is room. AI wingmen take it automatically; your picker offers it first.",
    "Put a bomber on row 1 and it flies in as soon as the first ship dies.",
    "Move rows with the up and down arrows.",
  ),
  "reserve.row_remove": term(
    "Remove row",
    "Takes this ship out of the reserve. The pool keeps the points, so you can add another ship instead.",
    "Remove a bomber and add an interceptor to react faster.",
  ),
  "reserve.add": term(
    "Add a ship",
    "Cycle through your faction's quick builds with the arrows and add one to the end of the reserve. The list holds up to 24 ships.",
    "Add a second interceptor build for a quicker top-up.",
  ),
  "reserve.page": term(
    "Page",
    "The reserve shows nine rows at a time. Page through the rest with the arrows.",
    "PAGE 2 / 3 shows rows 10 to 18.",
  ),
  "reserve.summary": term(
    "Reserve summary",
    "How many ships and flown points wait in reserve, next to the pool and on-field cap of this battle format.",
    "9 ships, 612 pt in reserve; pool 1000; cap 250.",
    "If the reserve is worth less than the pool, the pool never empties: add more ships.",
    "points",
  ),
  "reserve.strategy_balanced": term(
    "Balanced strategy",
    "Curated mixed squads: a bit of everything, in a proven order.",
    "An interceptor, a gunship, a bomber, then another fighter pair.",
    "A safe default when you do not know the enemy.",
  ),
  "reserve.strategy_swarm": term(
    "Swarm strategy",
    "Many cheap fighters. You deploy often and keep the field full.",
    "Eight cheap light fighters instead of two gunships.",
    "Good against bombers and slow capital ships; weak against area weapons.",
  ),
  "reserve.strategy_aces": term(
    "Aces strategy",
    "Named pilots with escorts. Quotas allow one ace on the field at a time, three per match in Skirmish.",
    "Poison Fang on the Fang Raider build, then two escorts.",
    "Strong abilities, but losing an ace costs a lot of pool.",
  ),
  "reserve.strategy_heavy": term(
    "Heavy-Bombers strategy",
    "Bombers and gunships with a few fighters as escorts. High damage, slow top-ups.",
    "A torpedo bomber escorted by two heavy fighters.",
    "Quotas cap bombers at two on the field, so escorts fill the rest.",
  ),
  "reserve.edit_close": term(
    "Close editor",
    "Returns to the squad builder. Every edit is already saved as you make it.",
    "Press DONE or Esc after reordering your reserve.",
  ),
} as const;
