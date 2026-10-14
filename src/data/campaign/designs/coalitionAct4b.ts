/**
 * Coalition design, Act IV (Day 238): the Hollow Man (assassinate Vance).
 * Story consequences: victory sets `coal_vance_stopped` and, with the case
 * recovered, `coal_codes_recovered`.
 */

import type { MissionDesign } from "../campaignTypes";
import {
  atTime,
  bonus,
  hit,
  kill,
  mineGrid,
  minefield,
  onObjective,
  onStart,
  salvage,
  say,
  setFlag,
  wave,
  within,
} from "../designKit";
import {
  ADMIRAL,
  AT,
  CHEN,
  COALITION,
  LOYALIST_FACTION,
  MERCENARY_FACTION,
  STRIKER,
  VANCE,
  WHISPER,
  heroSays,
} from "./coalitionShared";

export const COALITION_ACT4B_DESIGNS: Readonly<Record<string, MissionDesign>> =
  {
    coal_4_3: {
      style: "assassination",
      tagline: "Vance walked out with the gate codes. Run him down.",
      mood: "grim",
      prerequisites: [1],
      objectives: [
        hit("vance", "Destroy Vance before he reaches the Spine gate", {
          shipId: "terran_praetorian",
          at: [300, -1000],
          flee: [
            [900, -1200],
            [1700, -1800],
          ],
          fleeAtHull: 0.6,
          fleeAfter: 75,
          hullScale: 2,
        }),
        bonus(
          within(kill("screen", "Break his screen within 90 seconds", 3, "screen"), 90),
          2,
          80,
        ),
        bonus(
          salvage("case", "Recover the gate-code case from his wake", {
            crates: [[300, -1000]],
            dropZone: [-300, 500],
            required: 1,
          }),
          2,
          120,
        ),
      ],
      victoryFlags: { coal_vance_stopped: true },
      hazards: [minefield("gate_mines", mineGrid(1000, -1300, 4, 3, 170), 18)],
      variants: [
        {
          when: { flag: "heg_vance_captured" },
          briefing:
            "Chen had Vance in a cell, and someone opened it. He left with the Hegemony's half of the gate codes and a screen of loyalists, and he is running for the Spine gate. If he opens it, the Tide does not need the Breach. Run him down.",
        },
        {
          when: { flag: "heg_vance_captured", is: false },
          briefing:
            "Vance was never taken. He slipped the net with the Hegemony's half of the gate codes and a screen of loyalists, and he is running for the Spine gate. If he opens it, the Tide does not need the Breach. Run him down.",
        },
        {
          when: { flag: "cors_gate_codes" },
          script: [
            onStart(
              say(
                ADMIRAL,
                "The vault half sits in my hold, on Kira's orders. He carries the Spine override. Either half opens a lane, and both together open a gate.",
              ),
            ),
          ],
        },
        {
          when: { flag: "cors_kappa_ledger" },
          script: [
            onStart(
              say(
                WHISPER,
                "Kira's ledger names every officer on Vance's payroll. Fleet Intelligence has no more friends to spend, so he is alone out there.",
              ),
            ),
          ],
        },
      ],
      script: [
        onStart(
          say(
            COALITION,
            "Vance carries the Hegemony's half of the gate codes. He's running for the Spine gate. Mark him and stay on him.",
          ),
          wave("terran_vindicator", 1, LOYALIST_FACTION, {
            at: "ahead",
            tag: "screen",
          }),
          wave("confed_hawk", 2, MERCENARY_FACTION, {
            at: "flank",
            tag: "screen",
          }),
        ),
        heroSays(
          "terran_hegemony",
          AT(6),
          CHEN,
          "He taught me to read a battle, and he's reading this one to the end. Don't let him choose the ground.",
          "grim",
        ),
        atTime(
          45,
          say(
            VANCE,
            "Admiral Chen, or whoever they sent. Don't follow me to the gate. It is only asking for quiet.",
            "solemn",
          ),
        ),
        atTime(
          70,
          wave("terran_centurion", 2, LOYALIST_FACTION, { at: "behind" }),
          say(STRIKER, "More of his loyalists, behind us. They'd die for him.", "urgent"),
        ),
        atTime(
          95,
          say(
            WHISPER,
            "He's making for the gate relay. Whatever he carries is on that hull.",
            "urgent",
          ),
        ),
        onObjective(
          "case",
          "completed",
          setFlag("coal_codes_recovered", true),
          say(
            WHISPER,
            "The case. The Hegemony half of the codes is ours again.",
            "proud",
          ),
        ),
        onObjective(
          "vance",
          "completed",
          say(STRIKER, "Vance is down. The gate is still shut.", "solemn"),
        ),
        onObjective(
          "vance",
          "failed",
          say(COALITION, "He's at the gate. Pull back, pull back.", "grim"),
        ),
      ],
    },
  };

