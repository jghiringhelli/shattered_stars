/**
 * Hegemony designs, Acts II-III (slots 6-15). Story consequences:
 * - heg_2_1: losing no transport sets `heg_convoy_intact` → heg_2_4 is
 *   resupplied (an allied gunship joins the station defense).
 * - heg_2_2: if Lance Squadron is wiped out, `heg_lance_lost` is saved →
 *   Lance never flies again (heg_3_1, heg_3_5).
 */

import type { MissionDesign } from "../campaignTypes";
import {
  atTime,
  banner,
  bonus,
  defend,
  hazardOn,
  escort,
  flareWall,
  hit,
  hold,
  ionStorm,
  kill,
  minefield,
  mineGrid,
  onDestroyed,
  onFlag,
  onObjective,
  onStart,
  protect,
  reveal,
  hidden,
  route,
  sabotage,
  salvage,
  say,
  setFlag,
  stealth,
  survive,
  wave,
  within,
} from "../designKit";
import { CHEN, COMMAND, STRIKER, WHISPER } from "./hegemonyAct1";

const LANCE = {
  shipId: "terran_viper",
  count: 2,
  tag: "lance",
  name: "Lance Squadron",
  unlessFlag: "heg_lance_lost",
} as const;

export const HEGEMONY_ACT23_DESIGNS: Readonly<Record<string, MissionDesign>> = {
  heg_2_1: {
    style: "escort",
    tagline: "Three freighters. One lane. Corsairs in the dark.",
    objectives: [
      escort("escort", "Escort the convoy to the jump point", {
        path: [
          [-1200, 600],
          [-300, -100],
          [700, -900],
          [1500, -1500],
        ],
        shipId: "terran_sentinel",
        count: 3,
        maxLosses: 1,
        speed: 55,
      }),
      kill("kill", "Destroy attackers", 5),
      bonus(protect("intact", "Lose no transports", "transport"), 2, 80),
    ],
    script: [
      onStart(
        say(
          COMMAND,
          "Convoy Alpha is yours. Lose two freighters and the run is scrubbed.",
        ),
      ),
      atTime(
        28,
        say(
          WHISPER,
          "Corsair heavies dropping out of the shadow, rear quarter.",
          "urgent",
        ),
      ),
      onObjective(
        "intact",
        "failed",
        say(
          STRIKER,
          "We lost a freighter. Station Omega won't see that cargo.",
          "grim",
        ),
      ),
      {
        ...onObjective(
          "intact",
          "completed",
          setFlag("heg_convoy_intact", true),
          say(CHEN, "Every hull delivered. Omega will remember this.", "proud"),
        ),
        // The Corsairs gutted the straggler first: that canon excludes ours.
        if: [{ flag: "x4_convoy_gutted", is: false }],
      },
    ],
  },
  heg_2_2: {
    style: "defense",
    tagline: "The outpost holds or the sector falls.",
    allies: [LANCE],
    objectives: [
      defend("defend", "Protect Outpost Gamma for 2½ minutes", {
        at: [0, -200],
        shipId: "terran_bulwark",
        seconds: 150,
      }),
      kill("kill", "Destroy the drone swarm", 8),
      bonus(protect("lance", "Bring Lance Squadron home", "lance"), 1, 60),
    ],
    script: [
      onStart(
        say(CHEN, "Lance Squadron flies with us today. Keep them breathing."),
      ),
      atTime(
        45,
        wave("synth_drone", 3, "synthetic_collective", { at: "ahead" }),
        say(WHISPER, "Second swarm inbound.", "urgent"),
      ),
      atTime(
        95,
        wave("synth_interceptor_drone", 2, "synthetic_collective", {
          at: "flank",
        }),
      ),
      onDestroyed(
        "lance",
        2,
        "player",
        setFlag("heg_lance_lost", true),
        say(STRIKER, "Lance is gone. Both of them.", "solemn"),
      ),
    ],
  },
  heg_2_3: {
    style: "assassination",
    tagline: "Commander Phoenix. End the legend.",
    objectives: [
      hit("phoenix", "Destroy Commander Phoenix before she escapes", {
        shipId: "confed_hawk",
        at: [200, -900],
        flee: [[1600, -1800]],
        fleeAtHull: 0.5,
        fleeAfter: 120,
        hullScale: 2,
      }),
      bonus(
        within(kill("escorts", "Destroy her wing within 90 seconds", 3), 90),
        2,
        60,
      ),
    ],
    script: [
      onStart(
        say(
          COMMAND,
          "Phoenix bleeds, she runs. Cut off the lane to the north-east.",
        ),
      ),
      atTime(
        40,
        say(STRIKER, "She's toying with us. Mark her and stay on her."),
      ),
      onObjective(
        "phoenix",
        "failed",
        say(WHISPER, "Phoenix escaped. She'll be back.", "grim"),
      ),
    ],
  },
  heg_2_3b: {
    style: "escort",
    tagline: "The enemy ace wants out. So do we.",
    objectives: [
      escort("phoenix", "Escort Phoenix to the extraction point", {
        path: [
          [0, 200],
          [-400, -600],
          [-1300, -1400],
        ],
        shipId: "confed_hawk",
        count: 1,
        maxLosses: 0,
        speed: 65,
      }),
      kill("kill", "Destroy pursuing loyalists", 4),
      bonus(protect("clean", "No losses in your squad", "squad"), 2, 60),
    ],
    script: [
      onStart(
        say(
          WHISPER,
          "Phoenix is with us. Loyalists will shoot her — and us.",
          "urgent",
        ),
      ),
      atTime(
        35,
        wave("terran_viper", 2, "terran_hegemony", { at: "behind" }),
        say(STRIKER, "More loyalists. Vance wants her dead badly."),
      ),
      onObjective(
        "phoenix",
        "completed",
        setFlag("heg_phoenix_defected", true),
        say(CHEN, "She's out. Now we have a witness.", "proud"),
      ),
    ],
  },
  heg_2_4: {
    style: "defense",
    tagline: "Station Omega. Three waves. No retreat.",
    objectives: [
      defend("defend", "Protect Station Omega for 3 minutes", {
        at: [0, -100],
        shipId: "terran_bulwark",
        seconds: 180,
      }),
      bonus(kill("raiders", "Destroy 8 raiders", 8), 1, 80),
    ],
    variants: [
      {
        when: { flag: "heg_convoy_intact" },
        title: "Station Defense (Resupplied)",
        tagline: "Omega is stocked. A gunship stands with us.",
        addAllies: [
          {
            shipId: "terran_bastion",
            count: 1,
            tag: "relief",
            name: "Gunship Bastion",
          },
        ],
        script: [
          onStart(
            say(
              COMMAND,
              "Convoy cargo armed a gunship. It's on your wing.",
              "proud",
            ),
          ),
        ],
      },
    ],
    script: [
      onStart(
        say(
          CHEN,
          "They time it with our relief rotation. Hold until the next shift arrives.",
        ),
      ),
      atTime(60, banner("SECOND WAVE", "Marauders inbound")),
      atTime(
        120,
        banner("THIRD WAVE", "Phantoms on approach"),
        say(WHISPER, "Phantoms. Cloaked runs on the station.", "urgent"),
      ),
    ],
  },
  heg_2_5: {
    style: "boss",
    tagline: "The Mothership. Cut the relay, then the heart.",
    mood: "grim",
    objectives: [
      kill("kill", "Destroy the Mothership", 1, "boss"),
      bonus(
        sabotage("relay", "Sabotage the drone relay (stops reinforcements)", {
          at: [-900, -900],
          seconds: 12,
          decay: 0.5,
        }),
        2,
        80,
      ),
    ],
    hazards: [ionStorm("storm", 0, -500, 520, 5)],
    script: [
      onStart(
        say(
          WHISPER,
          "Ion storm around the Mothership. Shields will bleed inside it.",
        ),
      ),
      atTime(
        35,
        wave("synth_drone", 3, "synthetic_collective"),
        say(STRIKER, "It's printing drones!", "urgent"),
      ),
      beatIfRelayUp(70),
      beatIfRelayUp(105),
      onObjective(
        "relay",
        "completed",
        setFlag("relay_cut"),
        setFlag("relay_down", true),
        say(WHISPER, "Relay down. No more drones.", "proud"),
      ),
    ],
  },
  heg_3_1: {
    style: "assault",
    tagline: "Fleet against fleet. Take the command buoy.",
    allies: [LANCE],
    objectives: [
      kill("kill", "Destroy the enemy fleet", 10),
      bonus(
        hold("buoy", "Control the command buoy for 25 seconds", {
          at: [800, -700],
          seconds: 25,
          enemyHoldFails: false,
        }),
        2,
        80,
      ),
    ],
    variants: [
      {
        when: { flag: "heg_lance_lost" },
        script: [
          onStart(
            say(STRIKER, "Lance should be here. Fly for them.", "solemn"),
          ),
        ],
      },
    ],
    script: [
      onStart(
        say(
          CHEN,
          "This is the war, Iron Fist. Medium hulls count double on the buoy.",
        ),
      ),
      onFlag(
        "heg_relay_held",
        say(WHISPER, "The border relay we took is feeding us their vectors."),
      ),
      atTime(
        60,
        wave("confed_condor", 2, "free_confederation", { at: "flank" }),
      ),
    ],
  },
  heg_3_2: {
    style: "heist",
    tagline: "Steal their logistics. Leave before the garrison wakes.",
    objectives: [
      salvage(
        "intel",
        "Carry 2 data cores to the drop zone (boost/roll drops them)",
        {
          crates: [
            [-800, -1100],
            [700, -1200],
            [0, -1500],
          ],
          dropZone: [0, 400],
          required: 2,
        },
      ),
      hidden(
        route("exfil", "Extract through the jump point", [[1400, 900]], {
          extraction: true,
        }),
      ),
      bonus(
        stealth(
          "quiet",
          "Stay clear of the depot's sensor towers",
          [[0, -1300]],
          { radius: 300, grace: 3 },
        ),
        2,
        80,
      ),
    ],
    script: [
      onStart(
        say(
          WHISPER,
          "Data cores in the depot. Boost or roll with one aboard and you drop it.",
        ),
      ),
      onObjective(
        "intel",
        "completed",
        reveal("exfil"),
        say(CHEN, "We have it. Extract — now.", "urgent"),
      ),
      onObjective(
        "quiet",
        "failed",
        wave("confed_hawk", 2, "free_confederation", { at: "ahead" }),
        say(STRIKER, "Towers saw us. Hawks scrambling!", "urgent"),
      ),
    ],
  },
  heg_3_3: {
    style: "hazard",
    tagline: "Allies turned. Their mines are already in the water.",
    mood: "grim",
    objectives: [
      survive("survive", "Survive the ambush for 2 minutes", 120),
      kill("kill", "Destroy attackers", 8),
      bonus(protect("clean", "No losses in your squad", "squad"), 2, 80),
    ],
    hazards: [minefield("mines", mineGrid(0, -700, 5, 3, 160), 18)],
    script: [
      onStart(
        say(
          STRIKER,
          "Mines! They seeded the field before we arrived!",
          "urgent",
        ),
      ),
      atTime(
        40,
        say(WHISPER, "Templars are herding us into the mines. Don't follow."),
      ),
      atTime(
        80,
        wave("ascendant_seraph", 2, "ascendant_empire", { at: "behind" }),
      ),
    ],
  },
  heg_3_3b: {
    style: "assault",
    tagline: "Strike Vance's loyalists before they strike us.",
    objectives: [
      kill("kill", "Destroy Vance's loyalist fleet", 8),
      bonus(
        kill("commander", "Eliminate Vance's fleet commander", 1, "boss"),
        3,
        120,
      ),
    ],
    script: [
      onStart(
        say(
          CHEN,
          "Preemptive. Ugly. Necessary. Their Vindicator leads.",
          "grim",
        ),
      ),
      atTime(
        45,
        say(
          WHISPER,
          "Vindicator's shields are rotating. Hit it from the flanks.",
        ),
      ),
      onObjective(
        "commander",
        "completed",
        say(STRIKER, "Commander's down! They're breaking!", "proud"),
      ),
    ],
  },
  heg_3_4: {
    style: "boss",
    tagline: "CNS Freedom. Its reactor is a sun. Don't get burned.",
    objectives: [
      sabotage("shields", "Overload the Dreadnought's shield pylon", {
        at: [-600, -800],
        seconds: 10,
      }),
      kill("kill", "Destroy the Dreadnought", 1, "boss"),
      bonus(
        within(
          kill("fast", "Kill the Dreadnought within 3 minutes", 1, "boss"),
          180,
        ),
        2,
        100,
      ),
    ],
    hazards: [
      flareWall("flare", {
        axis: "y",
        start: 1500,
        stop: -1500,
        speed: -14,
        dps: 10,
        startsInactive: true,
      }),
    ],
    script: [
      onStart(
        say(
          COMMAND,
          "CNS Freedom. Hit the pylon to strip its shields, then gut it.",
        ),
      ),
      onObjective(
        "shields",
        "completed",
        say(
          WHISPER,
          "Pylon down. The reactor is venting — a flare front is coming from the south!",
          "urgent",
        ),
        hazardOn("flare"),
      ),
      atTime(
        90,
        wave("confed_falcon", 2, "free_confederation", { at: "flank" }),
      ),
    ],
  },
  heg_3_5: {
    style: "assault",
    tagline: "The last gate. Everything we have.",
    mood: "proud",
    allies: [LANCE],
    objectives: [
      hold("gate", "Seize the jump gate for 30 seconds", {
        at: [0, -900],
        radius: 300,
        seconds: 30,
      }),
      kill("kill", "Destroy all enemy forces", 12),
      bonus(protect("clean", "No losses in your squad", "squad"), 3, 150),
    ],
    variants: [
      {
        when: { flag: "heg_phoenix_defected" },
        script: [
          onStart(
            say(
              WHISPER,
              "Phoenix sent their codes. Their gate guard is blind.",
              "proud",
            ),
          ),
        ],
      },
    ],
    script: [
      onStart(say(CHEN, "Iron Fist. One more time.", "proud")),
      atTime(
        50,
        wave("confed_albatross", 1, "free_confederation", { at: "ahead" }),
        say(STRIKER, "Bomber run on the gate!", "urgent"),
      ),
      onObjective(
        "gate",
        "completed",
        say(COMMAND, "Gate secure. Finish them."),
      ),
    ],
  },
};

/**
 * @param atSeconds - Wave time.
 * @returns A drone wave that only launches while the relay stands.
 */
function beatIfRelayUp(atSeconds: number): ReturnType<typeof atTime> {
  const b = atTime(atSeconds, wave("synth_drone", 3, "synthetic_collective"));
  return { ...b, if: [{ flag: "relay_cut", is: false }] };
}
