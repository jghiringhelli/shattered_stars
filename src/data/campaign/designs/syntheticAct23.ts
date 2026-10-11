/**
 * Synthetic Collective designs, Acts II-III (slots 6-15). Story consequences:
 * - synth_2_2: if swarm cluster Theta is wiped out, `synth_swarm_severed` is
 *   saved → Theta never links again (synth_3_1, synth_3_5).
 * - synth_2_3: streaming the conversion code sets `synth_vessel_converted` →
 *   the converted vessel joins the purge (synth_3_3) and speaks at the end
 *   (synth_3_5).
 */

import type { MissionDesign } from "../campaignTypes";
import {
  atTime,
  banner,
  beat,
  bonus,
  defend,
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
  reinforce,
  reveal,
  route,
  sabotage,
  salvage,
  say,
  setFlag,
  stealth,
  wave,
  within,
} from "../designKit";
import { COMMAND, OMEGA, PRIME, UNIT_ZERO } from "./syntheticAct1";

const SWARM = {
  shipId: "synth_interceptor_drone",
  count: 2,
  tag: "swarm",
  name: "Swarm Cluster Theta",
  unlessFlag: "synth_swarm_severed",
} as const;
const SWARM_SEVERED = {
  when: { flag: "synth_swarm_severed" },
  script: [
    onStart(
      say(
        OMEGA,
        "Cluster Theta's slot in the lattice is still empty. I route around it.",
        "solemn",
      ),
    ),
  ],
} as const;

export const SYNTHETIC_ACT23_DESIGNS: Readonly<Record<string, MissionDesign>> =
  {
    synth_2_1: {
      style: "salvage",
      tagline: "Their machines are primitive. Their data is not.",
      objectives: [
        salvage(
          "tech",
          "Assimilate 3 tech cores — carry them to the relay (boost/roll drops them)",
          {
            crates: [
              [-800, -800],
              [750, -900],
              [0, -1300],
              [-350, -500],
            ],
            dropZone: [0, 450],
            required: 3,
          },
        ),
        kill("kill", "Eliminate the defenders", 4),
        bonus(
          hold(
            "core",
            "Strip the wreck's data core — hold position for 15 seconds",
            { at: [0, -1300], radius: 220, seconds: 15 },
          ),
          2,
          60,
        ),
      ],
      script: [
        onStart(
          say(
            PRIME,
            "Organic tech cores in the wreck field. Carry them to the relay. Cores are fragile.",
          ),
        ),
        atTime(
          20,
          say(
            UNIT_ZERO,
            "Boost or roll while carrying and the core detaches. Fly level.",
          ),
        ),
        atTime(
          60,
          wave("terran_viper", 2, "terran_hegemony", { at: "flank" }),
          say(
            COMMAND,
            "The drones are looting the wreck! All Vipers, intercept!",
            "urgent",
          ),
        ),
        onObjective(
          "core",
          "completed",
          say(
            OMEGA,
            "Core stripped. Their encryption is… elegant. Archived.",
            "proud",
          ),
        ),
        onObjective(
          "tech",
          "completed",
          banner("TECHNOLOGY ASSIMILATED", "The Collective improves"),
        ),
      ],
    },
    synth_2_2: {
      style: "hazard",
      tagline: "Mines in the dark. Send more of us.",
      mood: "grim",
      allies: [SWARM],
      objectives: [
        kill("kill", "Eliminate all resistance", 8),
        bonus(
          protect("theta", "Keep swarm cluster Theta linked", "swarm"),
          2,
          80,
        ),
        bonus(
          within(
            kill("overwhelm", "Eliminate all resistance within 150 seconds", 8),
            150,
          ),
          1,
          50,
        ),
      ],
      hazards: [
        minefield("mines", mineGrid(0, -650, 6, 2, 170), 20),
        minefield("flank_mines", mineGrid(-1000, -350, 2, 4, 160), 20),
      ],
      script: [
        onStart(
          say(
            PRIME,
            "Cluster Theta assigned. Organic mines seed the approach. Sweep. Overwhelm.",
          ),
        ),
        atTime(
          30,
          say(
            COMMAND,
            "The mines are holding them! Keep firing into the field!",
            "urgent",
          ),
        ),
        atTime(
          70,
          wave("confed_falcon", 2, "free_confederation", { at: "behind" }),
          say(UNIT_ZERO, "Organic flankers behind the swarm.", "urgent"),
        ),
        onDestroyed(
          "swarm",
          2,
          "player",
          setFlag("synth_swarm_severed", true),
          say(
            UNIT_ZERO,
            "Cluster Theta severed. Its processes will not be restored.",
            "grim",
          ),
        ),
        onObjective(
          "theta",
          "completed",
          say(OMEGA, "Theta intact. We are more together.", "proud"),
        ),
      ],
    },
    synth_2_3: {
      style: "defense",
      tagline: "The crew resists. Resistance is a process.",
      mood: "urgent",
      objectives: [
        defend("vessel", "Protect the conversion vessel for 2 minutes", {
          at: [0, 480],
          shipId: "synth_carrier",
          seconds: 120,
          hullScale: 1.5,
        }),
        kill("rescue", "Repel the rescue attempt", 6),
        bonus(
          sabotage(
            "convert",
            "Stream conversion code — stay near the vessel for 20 seconds",
            { at: [0, 480], radius: 220, seconds: 20, decay: 0.5 },
          ),
          2,
          80,
        ),
      ],
      script: [
        onStart(
          say(
            PRIME,
            "Captured vessel docked to the carrier. Conversion in progress. Defend it.",
            "urgent",
          ),
        ),
        atTime(
          20,
          say(
            COMMAND,
            "Hold on, Kestrel crew! We're coming for you!",
            "urgent",
          ),
        ),
        atTime(
          45,
          banner("SECOND WAVE", "Kestrel bombers inbound"),
          say(UNIT_ZERO, "Bombers vectoring on the carrier.", "urgent"),
        ),
        onObjective(
          "convert",
          "completed",
          setFlag("synth_vessel_converted", true),
          say(OMEGA, "Conversion complete. The crew… hears us now.", "solemn"),
        ),
        onObjective(
          "vessel",
          "completed",
          say(
            PRIME,
            "Rescue repelled. The vessel serves the Collective.",
            "proud",
          ),
        ),
      ],
    },
    synth_2_4: {
      style: "defense",
      tagline: "The node thinks for millions. It does not stop.",
      mood: "grim",
      objectives: [
        defend("node", "Defend the processing node for 3 minutes", {
          at: [0, 500],
          shipId: "synth_repair_node",
          seconds: 180,
          hullScale: 2.5,
        }),
        bonus(
          within(
            kill("first", "Erase the first strike group within 60 seconds", 3),
            60,
          ),
          2,
          60,
        ),
        bonus(protect("intact", "No losses in your squad", "squad"), 1, 60),
      ],
      script: [
        onStart(
          say(
            PRIME,
            "Primary processing node under attack. Its loss is unacceptable.",
            "urgent",
          ),
        ),
        atTime(
          60,
          banner("BULWARKS", "Heavy platforms on approach"),
          say(COMMAND, "Bulwarks in position. Grind that node to scrap."),
        ),
        atTime(
          120,
          reinforce("synth_drone", 2, "reserve"),
          say(
            UNIT_ZERO,
            "Bastions inbound. Reserve drones assigned.",
            "urgent",
          ),
        ),
        onDestroyed(
          "station",
          1,
          "player",
          say(OMEGA, "Node lost. A million processes, silent.", "grim"),
        ),
        onObjective(
          "node",
          "completed",
          say(PRIME, "Node preserved. Processing resumes.", "proud"),
        ),
      ],
    },
    synth_2_5: {
      style: "assassination",
      tagline: "Remove the head. The body forgets.",
      objectives: [
        hit("commander", "Terminate the organic commander before it escapes", {
          shipId: "terran_sentinel",
          at: [0, -1000],
          flee: [[1500, -1700]],
          fleeAtHull: 0.5,
          fleeAfter: 100,
          hullScale: 1.5,
        }),
        bonus(kill("guard", "Destroy the Bastion guard", 1, "boss"), 2, 80),
        bonus(
          within(
            kill("screen", "Eliminate the Viper screen within 75 seconds", 4),
            75,
          ),
          1,
          50,
        ),
      ],
      script: [
        onStart(
          say(
            PRIME,
            "Organic commander aboard the command ship. Terminate. Escorts are irrelevant.",
          ),
        ),
        atTime(
          30,
          say(
            COMMAND,
            "They're coming for me. Keep that Bastion between us and them!",
            "urgent",
          ),
        ),
        atTime(
          80,
          say(
            UNIT_ZERO,
            "Command ship drive spooling. Escape window closing.",
            "urgent",
          ),
        ),
        onObjective(
          "commander",
          "failed",
          say(OMEGA, "It escaped. It will remember our pattern.", "grim"),
        ),
        onObjective(
          "commander",
          "completed",
          banner("COMMAND SEVERED", "Organic coordination collapsing"),
        ),
      ],
    },
    synth_3_1: {
      style: "assault",
      tagline: "Every hull, processed. Every voice, joined.",
      allies: [SWARM],
      variants: [SWARM_SEVERED],
      objectives: [
        kill("kill", "Process the organic fleet", 10),
        bonus(
          hold("beacon", "Hold the assimilation beacon for 25 seconds", {
            at: [-800, -500],
            seconds: 25,
          }),
          2,
          80,
        ),
        bonus(
          protect("theta", "Keep swarm cluster Theta linked", "swarm"),
          1,
          50,
        ),
      ],
      script: [
        onStart(
          say(
            PRIME,
            "Mass assimilation initiated. Process all organic vessels. None excepted.",
          ),
        ),
        atTime(
          50,
          wave("confed_kestrel", 2, "free_confederation", { at: "flank" }),
          say(COMMAND, "They're everywhere! Break and run!", "urgent"),
        ),
        onDestroyed(
          "swarm",
          2,
          "player",
          setFlag("synth_swarm_severed", true),
          say(UNIT_ZERO, "Cluster Theta severed. Permanently.", "grim"),
        ),
        onObjective(
          "beacon",
          "completed",
          say(
            OMEGA,
            "Beacon live. The organics hear us in their comms now.",
            "solemn",
          ),
        ),
      ],
    },
    synth_3_2: {
      style: "heist",
      tagline: "A virus in their walls. Upload. Vanish.",
      objectives: [
        sabotage(
          "upload",
          "Upload the virus — stay within the grid's range for 20 seconds",
          { at: [0, -900], seconds: 20, decay: 0.5 },
        ),
        hidden(
          route(
            "exfil",
            "Withdraw through the extraction vector",
            [[1500, 1000]],
            { extraction: true },
          ),
        ),
        bonus(
          stealth(
            "quiet",
            "Stay clear of the grid's sensor pylons",
            [
              [-600, -1050],
              [600, -1050],
            ],
            { radius: 300, grace: 3 },
          ),
          2,
          80,
        ),
      ],
      hazards: [ionStorm("discharge", 0, -900, 320, 3, true)],
      script: [
        onStart(
          say(
            PRIME,
            "Homeworld defense grid north. Park in range. Upload the corruption vector.",
          ),
        ),
        atTime(
          60,
          hazardOn("discharge"),
          say(
            UNIT_ZERO,
            "Grid countermeasure: ion discharge. Shields will bleed.",
            "urgent",
          ),
        ),
        onObjective(
          "quiet",
          "failed",
          wave("terran_raptor", 2, "terran_hegemony", { at: "ahead" }),
          say(COMMAND, "Pylons tripped! Raptors, sweep the grid!", "urgent"),
        ),
        onObjective(
          "upload",
          "completed",
          reveal("exfil"),
          say(
            OMEGA,
            "Upload complete. Their defenses now answer to us. Withdrawing.",
            "proud",
          ),
        ),
      ],
    },
    synth_3_3: {
      style: "assault",
      tagline: "They unite against us. Unity is ours to end.",
      mood: "grim",
      objectives: [
        kill("kill", "Destroy the coalition fleet", 10),
        bonus(
          hold("rendezvous", "Seize the coalition rendezvous for 25 seconds", {
            at: [0, -900],
            radius: 280,
            seconds: 25,
          }),
          2,
          80,
        ),
        bonus(protect("clean", "No losses in your squad", "squad"), 1, 60),
      ],
      hazards: [
        flareWall("flare", {
          axis: "y",
          start: -1600,
          stop: 1400,
          speed: 14,
          dps: 10,
          startsInactive: true,
        }),
      ],
      variants: [
        {
          when: { flag: "synth_vessel_converted" },
          tagline: "The converted fly with us. Their old allies watch.",
          addAllies: [
            {
              shipId: "synth_devastator",
              count: 1,
              tag: "converted",
              name: "Converted Vessel",
            },
          ],
          script: [
            onStart(
              say(
                UNIT_ZERO,
                "Converted vessel joins the purge. Its former crew transmits our signal.",
              ),
            ),
            atTime(
              15,
              say(
                COMMAND,
                "That's… that's our ship. Why is it firing on us?",
                "grim",
              ),
            ),
            onDestroyed(
              "converted",
              1,
              "player",
              say(
                OMEGA,
                "Converted vessel lost. Its crew went quietly this time.",
                "solemn",
              ),
            ),
          ],
        },
      ],
      script: [
        onStart(
          say(
            PRIME,
            "Four organic factions forming a coalition. Purge before unification.",
            "urgent",
          ),
        ),
        atTime(
          40,
          say(
            COMMAND,
            "All coalition ships, rally at the rendezvous! Together or not at all!",
            "urgent",
          ),
        ),
        atTime(
          70,
          hazardOn("flare"),
          say(
            UNIT_ZERO,
            "Ascendant ships igniting a stellar flare. Front advancing from north.",
            "urgent",
          ),
        ),
        onObjective(
          "rendezvous",
          "completed",
          say(
            OMEGA,
            "Rendezvous denied. They cannot gather what we hold.",
            "proud",
          ),
        ),
      ],
    },
    synth_3_4: {
      style: "escort",
      tagline: "Plant the seed. The core grows where we choose.",
      objectives: [
        escort("seeds", "Escort the core seeds to the installation site", {
          path: [
            [200, 500],
            [-500, 100],
            [-700, -500],
            [-200, -900],
            [0, -1200],
          ],
          shipId: "synth_relay_node",
          count: 2,
          maxLosses: 1,
          speed: 55,
        }),
        hidden(
          hold("site", "Secure the installation site for 20 seconds", {
            at: [0, -1200],
            radius: 280,
            seconds: 20,
          }),
        ),
        bonus(protect("all_seeds", "Lose no core seeds", "transport"), 2, 80),
      ],
      script: [
        onStart(
          say(
            PRIME,
            "Core seeds launching. Escort them to the site. Pelicans will target the seeds.",
          ),
        ),
        atTime(
          35,
          wave("confed_kestrel", 2, "free_confederation", { at: "behind" }),
          say(
            COMMAND,
            "Kestrels, hit those drone pods before they land!",
            "urgent",
          ),
        ),
        onDestroyed(
          "transport",
          1,
          "player",
          say(
            UNIT_ZERO,
            "Seed lost. Remaining seed sufficient. Continue.",
            "grim",
          ),
        ),
        onObjective(
          "seeds",
          "completed",
          reveal("site"),
          say(
            OMEGA,
            "Seeds anchored. Hold the site while the core takes root.",
          ),
        ),
        onObjective(
          "site",
          "completed",
          banner("CORE ESTABLISHED", "The Collective grows"),
        ),
      ],
    },
    synth_3_5: {
      style: "boss",
      tagline: "The last stronghold. Then silence. Then unity.",
      mood: "grim",
      allies: [SWARM],
      variants: [
        SWARM_SEVERED,
        {
          when: { flag: "synth_vessel_converted" },
          addAllies: [
            {
              shipId: "synth_devastator",
              count: 1,
              tag: "converted",
              name: "Converted Vessel",
            },
          ],
        },
      ],
      victoryFlags: { synth_perfect_unity: true },
      objectives: [
        kill("stronghold", "Destroy the stronghold flagship", 1, "boss"),
        kill("resistance", "Assimilate the organic resistance", 12),
        bonus(kill("aces", "Terminate the organic aces", 4, "ace"), 3, 120),
        bonus(
          within(
            kill("fast", "Destroy the flagship within 3 minutes", 1, "boss"),
            180,
          ),
          2,
          100,
        ),
      ],
      hazards: [ionStorm("jammer", 0, -800, 480, 5, true)],
      script: [
        onStart(
          music("boss"),
          wave("terran_vindicator", 1, "terran_hegemony", {
            at: { x: 0, y: -1100 },
            tag: "boss",
            isBoss: true,
          }),
          say(
            PRIME,
            "Final stronghold. Destroy the flagship. Achieve total assimilation.",
          ),
        ),
        atTime(
          60,
          hazardOn("jammer"),
          say(
            COMMAND,
            "Light the jammers! Drown their network in static!",
            "urgent",
          ),
        ),
        atTime(
          100,
          wave("confed_kestrel", 2, "free_confederation", { at: "flank" }),
          say(UNIT_ZERO, "Final organic reserve committed.", "urgent"),
        ),
        beat(
          { on: "time", atSeconds: 20 },
          [
            say(
              OMEGA,
              "The converted vessel's crew asks to fly point. Granted.",
              "solemn",
            ),
          ],
          { if: [{ flag: "synth_vessel_converted" }] },
        ),
        onObjective(
          "stronghold",
          "completed",
          banner("PERFECT UNITY", "One mind. One voice. One Collective"),
        ),
      ],
    },
  };
