/**
 * Free Confederation designs, Acts II-III (slots 6-15). Story consequences:
 * - conf_1_4: holding the crash site (`conf_crash_data`) → conf_2_1 knows the
 *   convoy schedule.
 * - conf_2_2: losing no escape pod sets `conf_prisoners_freed` → the freed
 *   pilots fly with the uprising (conf_3_1) and salute the end (conf_3_5).
 * - conf_2_3: keeping the Corsair captain alive sets `conf_corsair_pact` →
 *   Corsair raiders join the breakout (conf_3_3).
 * - conf_2_5: if Wildfire Squadron is wiped out, `conf_wildfire_lost` is
 *   saved → Wildfire never flies again (conf_3_2, conf_3_4).
 */

import type { MissionDesign } from "../campaignTypes";
import {
  atTime,
  banner,
  beat,
  bonus,
  escort,
  flareWall,
  hazardOn,
  hidden,
  hit,
  hold,
  ionStorm,
  kill,
  minefield,
  mineGrid,
  music,
  onDestroyed,
  onObjective,
  onStart,
  protect,
  reveal,
  route,
  sabotage,
  say,
  setFlag,
  stealth,
  survive,
  wave,
  within,
} from "../designKit";
import { COMMAND, PHOENIX, SANTOS, VASQUEZ } from "./confederationAct1";

const WILDFIRE = {
  shipId: "confed_hawk",
  count: 2,
  tag: "wildfire",
  name: "Wildfire Squadron",
  unlessFlag: "conf_wildfire_lost",
} as const;
const WILDFIRE_LOST = {
  when: { flag: "conf_wildfire_lost" },
  script: [
    onStart(
      say(
        PHOENIX,
        "Wildfire should be flying this one. Fly it for them.",
        "solemn",
      ),
    ),
  ],
} as const;

export const CONFEDERATION_ACT23_DESIGNS: Readonly<
  Record<string, MissionDesign>
> = {
  conf_2_1: {
    style: "assassination",
    tagline: "The hauler feeds their garrison. Starve it.",
    objectives: [
      hit("hauler", "Disable the cargo hauler before it jumps", {
        shipId: "terran_sentinel",
        at: [300, -900],
        flee: [[1600, -1700]],
        fleeAtHull: 0.4,
        fleeAfter: 90,
        hullScale: 1.5,
      }),
      kill("escorts", "Destroy the convoy escorts", 4),
      bonus(
        within(kill("fast", "Destroy the escorts within 75 seconds", 4), 75),
        2,
        60,
      ),
    ],
    variants: [
      {
        when: { flag: "conf_crash_data" },
        script: [
          onStart(
            say(
              VASQUEZ,
              "Crash logs say the hauler's drive needs 90 seconds to spool. Use them.",
            ),
          ),
        ],
      },
    ],
    script: [
      onStart(
        say(
          COMMAND,
          "Hegemony hauler, four Viper escorts. Its cargo feeds three garrisons.",
        ),
      ),
      atTime(
        30,
        say(
          PHOENIX,
          "Hauler's spooling its jump drive. Mark it, Libre One.",
          "urgent",
        ),
      ),
      atTime(
        70,
        say(SANTOS, "It's turning for the lane. Now or never.", "urgent"),
      ),
      onObjective(
        "hauler",
        "failed",
        say(VASQUEZ, "It jumped. Somewhere a garrison eats tonight.", "grim"),
      ),
      onObjective(
        "hauler",
        "completed",
        say(SANTOS, "Hauler's dead in space. Strip it.", "proud"),
      ),
    ],
  },
  conf_2_2: {
    style: "escort",
    tagline: "Our people in their cages. Not for long.",
    mood: "urgent",
    objectives: [
      escort("pods", "Escort the escape pods to the rendezvous", {
        path: [
          [600, -500],
          [100, 100],
          [-600, 700],
          [-1300, 1300],
        ],
        shipId: "confed_crane",
        count: 3,
        maxLosses: 2,
        speed: 60,
      }),
      kill("defenses", "Destroy the prison station defenses", 5),
      bonus(protect("all_pods", "Lose no escape pods", "transport"), 2, 80),
    ],
    script: [
      onStart(
        say(
          PHOENIX,
          "Pods are launching. Bastions will hunt them. Stay between.",
          "urgent",
        ),
      ),
      atTime(
        35,
        wave("terran_viper", 2, "terran_hegemony", { at: "behind" }),
        say(SANTOS, "Vipers on the pods' tail!", "urgent"),
      ),
      onDestroyed(
        "transport",
        1,
        "player",
        say(VASQUEZ, "Pod down. Those were our people.", "solemn"),
      ),
      onObjective(
        "all_pods",
        "completed",
        setFlag("conf_prisoners_freed", true),
        say(PHOENIX, "Every pod home. They'll want to fly with us.", "proud"),
      ),
      onObjective(
        "pods",
        "completed",
        banner("PRISONERS RECOVERED", "The cages are empty"),
      ),
    ],
  },
  conf_2_3: {
    style: "hazard",
    tagline: "Pirates in a storm. Trust no one.",
    mood: "grim",
    allies: [
      {
        shipId: "corsair_marauder",
        count: 1,
        tag: "captain",
        name: "Captain Kira",
      },
    ],
    objectives: [
      survive("meeting", "Survive the meeting in the storm", 120),
      kill("ambush", "Destroy the Hegemony ambush", 6),
      bonus(
        protect("captain", "Keep the Corsair captain alive", "captain"),
        2,
        80,
      ),
    ],
    hazards: [ionStorm("storm", 0, -300, 600, 4)],
    script: [
      onStart(
        say(
          SANTOS,
          "Corsairs picked a nice ion storm for the meet. Shields will bleed. Stay sharp.",
        ),
      ),
      atTime(
        25,
        say(
          PHOENIX,
          "Contacts behind the storm wall. Not Corsair signatures.",
          "urgent",
        ),
      ),
      atTime(30, banner("AMBUSH", "Hegemony Raptors and Bastions")),
      onObjective(
        "captain",
        "failed",
        say(VASQUEZ, "The captain's dead. So is the alliance.", "grim"),
      ),
      onObjective(
        "captain",
        "completed",
        setFlag("conf_corsair_pact", true),
        say(SANTOS, "Captain lives. The Corsairs owe us now.", "proud"),
      ),
    ],
  },
  conf_2_4: {
    style: "heist",
    tagline: "Their secrets in a relay. Take them quietly.",
    objectives: [
      sabotage("hack", "Hack the relay — stay within range for 15 seconds", {
        at: [0, -900],
        seconds: 15,
        decay: 0.5,
      }),
      hidden(
        route(
          "exfil",
          "Escape with the data through the jump point",
          [[-1500, 1000]],
          { extraction: true },
        ),
      ),
      bonus(
        stealth(
          "quiet",
          "Stay clear of the relay's sensor towers",
          [
            [-550, -950],
            [550, -950],
          ],
          { radius: 300, grace: 3 },
        ),
        2,
        80,
      ),
    ],
    script: [
      onStart(
        say(
          VASQUEZ,
          "Park inside the relay's dish range. Fifteen seconds and the data's ours.",
        ),
      ),
      atTime(
        45,
        say(COMMAND, "Raptors scrambling from the relay hangar.", "urgent"),
      ),
      onObjective(
        "quiet",
        "failed",
        wave("terran_raptor", 2, "terran_hegemony", { at: "ahead" }),
        say(PHOENIX, "Towers saw us! More Raptors!", "urgent"),
      ),
      onObjective(
        "hack",
        "completed",
        reveal("exfil"),
        say(VASQUEZ, "Got it — fleet movements, all of it. Get out!", "urgent"),
      ),
    ],
  },
  conf_2_5: {
    style: "boss",
    tagline: "A battlecruiser over our worlds. Bring it down.",
    mood: "grim",
    allies: [WILDFIRE],
    objectives: [
      kill("cruiser", "Destroy the Battlecruiser", 1, "boss"),
      bonus(
        within(
          kill("screen", "Destroy the Viper screen within 90 seconds", 4),
          90,
        ),
        2,
        80,
      ),
      bonus(
        protect("wildfire", "Bring Wildfire Squadron home", "wildfire"),
        1,
        60,
      ),
    ],
    script: [
      onStart(
        music("boss"),
        say(
          SANTOS,
          "Wildfire flies with us. Strip the screen, then gut the cruiser.",
        ),
      ),
      atTime(
        40,
        wave("terran_viper", 2, "terran_hegemony", { at: "flank" }),
        say(PHOENIX, "It's launching more Vipers!", "urgent"),
      ),
      atTime(
        80,
        say(VASQUEZ, "Its shields are cycling. Hit it from the stern."),
      ),
      onDestroyed(
        "wildfire",
        2,
        "player",
        setFlag("conf_wildfire_lost", true),
        say(PHOENIX, "Wildfire's gone. Both of them.", "solemn"),
      ),
      onObjective(
        "cruiser",
        "completed",
        banner("BATTLECRUISER DOWN", "The sector breathes"),
      ),
    ],
  },
  conf_3_1: {
    style: "assault",
    tagline: "The people rise. Give them a sky.",
    mood: "proud",
    objectives: [
      kill("kill", "Destroy the oppressors", 10),
      bonus(
        hold("beacon", "Hold the uprising beacon for 25 seconds", {
          at: [-800, -500],
          seconds: 25,
        }),
        2,
        80,
      ),
    ],
    variants: [
      {
        when: { flag: "conf_prisoners_freed" },
        title: "Revolution Rising (Freed Pilots)",
        tagline: "The ones we freed fly beside us.",
        addAllies: [
          {
            shipId: "confed_falcon",
            count: 2,
            tag: "freed",
            name: "Freed Pilots",
          },
        ],
        script: [
          onStart(
            say(
              PHOENIX,
              "The pilots we pulled from that prison — they asked for this fight.",
              "proud",
            ),
          ),
        ],
      },
    ],
    script: [
      onStart(
        say(
          COMMAND,
          "Uprisings on six worlds. Clear the orbitals so the people can broadcast.",
        ),
      ),
      atTime(
        50,
        wave("terran_raptor", 2, "terran_hegemony", { at: "flank" }),
        say(SANTOS, "Reinforcements, flanking!", "urgent"),
      ),
      onObjective(
        "beacon",
        "completed",
        say(VASQUEZ, "Beacon's live. Every world hears the call.", "proud"),
      ),
    ],
  },
  conf_3_2: {
    style: "assault",
    tagline: "The capital in chains. Break the orbit.",
    allies: [WILDFIRE],
    variants: [WILDFIRE_LOST],
    objectives: [
      hold("orbit", "Secure orbital control for 30 seconds", {
        at: [0, -800],
        radius: 300,
        seconds: 30,
      }),
      kill("garrison", "Destroy the garrison", 8),
      bonus(protect("clean", "No losses in your squad", "squad"), 2, 100),
    ],
    script: [
      onStart(
        say(
          SANTOS,
          "Orbital control. Medium hulls count double on the zone. Pelican, park on it.",
        ),
      ),
      atTime(
        45,
        say(
          PHOENIX,
          "Bastions rolling in to contest. Push them off!",
          "urgent",
        ),
      ),
      onObjective(
        "orbit",
        "completed",
        say(COMMAND, "Orbit is ours. The capital is free.", "proud"),
      ),
    ],
  },
  conf_3_3: {
    style: "hazard",
    tagline: "The Admiral closed the net. Mines are the knots.",
    mood: "grim",
    objectives: [
      route(
        "breakout",
        "Break through the blockade",
        [
          [-700, -200],
          [-1000, -1300],
        ],
        { extraction: true },
      ),
      kill("blockade", "Destroy blockaders to open the escape route", 6),
      bonus(protect("clean", "No losses in your squad", "squad"), 2, 100),
    ],
    hazards: [
      minefield("mines", mineGrid(0, -700, 6, 2, 170), 20),
      minefield("flank_mines", mineGrid(1000, -400, 2, 4, 160), 20),
    ],
    variants: [
      {
        when: { flag: "conf_corsair_pact" },
        addAllies: [
          {
            shipId: "corsair_blade",
            count: 2,
            tag: "corsairs",
            name: "Corsair Raiders",
          },
        ],
        script: [
          onStart(
            say(
              SANTOS,
              "Corsair raiders on our wing. The captain pays his debts.",
              "proud",
            ),
          ),
        ],
      },
    ],
    script: [
      onStart(
        say(
          PHOENIX,
          "Encircled. Mines ahead, Bulwarks behind. The west edge is thin.",
          "urgent",
        ),
      ),
      atTime(
        40,
        say(
          VASQUEZ,
          "They're herding us into the minefield. Don't take the bait.",
        ),
      ),
      atTime(
        75,
        wave("terran_viper", 2, "terran_hegemony", { at: "behind" }),
        say(COMMAND, "The Admiral's closing the gap!", "urgent"),
      ),
    ],
  },
  conf_3_4: {
    style: "assault",
    tagline: "High Command. Their aces. Our everything.",
    allies: [WILDFIRE],
    variants: [WILDFIRE_LOST],
    objectives: [
      kill("fleet", "Destroy the High Command defense fleet", 10),
      bonus(kill("aces", "Destroy the High Command aces", 2, "ace"), 3, 120),
    ],
    hazards: [ionStorm("screen", 0, -700, 500, 5, true)],
    script: [
      onStart(
        say(
          COMMAND,
          "Final offensive. Every cell, every ship. Break the defense fleet.",
        ),
      ),
      atTime(
        60,
        hazardOn("screen"),
        say(
          VASQUEZ,
          "They've lit an ion screen around High Command. Shields will drain.",
          "urgent",
        ),
      ),
      atTime(100, wave("terran_raptor", 2, "terran_hegemony", { at: "flank" })),
      onObjective(
        "aces",
        "completed",
        say(PHOENIX, "Their aces are falling. Their nerve goes next.", "proud"),
      ),
    ],
  },
  conf_3_5: {
    style: "boss",
    tagline: "Kronos' flagship. The last chain. Break it.",
    mood: "proud",
    victoryFlags: { conf_independence: true },
    objectives: [
      kill("flagship", "Destroy Admiral Kronos' flagship", 1, "boss"),
      kill("escorts", "Destroy the escorts", 6),
      bonus(
        within(
          kill("fast", "Destroy the flagship within 3 minutes", 1, "boss"),
          180,
        ),
        3,
        150,
      ),
    ],
    hazards: [
      flareWall("flare", {
        axis: "y",
        start: -1600,
        stop: 1400,
        speed: 12,
        dps: 10,
        startsInactive: true,
      }),
    ],
    script: [
      onStart(
        music("boss"),
        say(
          SANTOS,
          "Libre One to all ships. This is the dawn. Make it count.",
          "proud",
        ),
      ),
      atTime(
        70,
        hazardOn("flare"),
        say(
          VASQUEZ,
          "Kronos is venting his reactor at us — flare front from the north!",
          "urgent",
        ),
      ),
      beat(
        { on: "time", atSeconds: 20 },
        [
          say(
            PHOENIX,
            "Freed pilots checking in. They want Kronos too.",
            "proud",
          ),
        ],
        { if: [{ flag: "conf_prisoners_freed" }] },
      ),
      onObjective(
        "flagship",
        "completed",
        banner("FREEDOM'S DAWN", "The Hegemony falls"),
      ),
    ],
  },
};
