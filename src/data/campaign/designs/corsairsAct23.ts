/**
 * Void Corsairs designs, Acts II-III (slots 6-15). Story consequences:
 * - cors_2_2: if Bloodfang's Wolves are wiped out, `cors_wolves_lost` is
 *   saved → the Wolves never fly again (cors_3_1, cors_3_5).
 * - cors_2_3: losing no escape shuttle sets `cors_crew_rescued` → the
 *   rescued crew flies with Kira for the throne (cors_3_5).
 */

import type { MissionDesign } from "../campaignTypes";
import {
  asteroids,
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
  onArea,
  onDestroyed,
  onObjective,
  onStart,
  protect,
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
import { ADMIRAL, BLOODFANG, COMMAND, KIRA } from "./corsairsAct1";

const WOLVES = {
  shipId: "corsair_fang",
  count: 2,
  tag: "wolves",
  name: "Bloodfang's Wolves",
  unlessFlag: "cors_wolves_lost",
} as const;
const WOLVES_LOST = {
  when: { flag: "cors_wolves_lost" },
  script: [
    onStart(
      say(
        BLOODFANG,
        "My Wolves should be howling on this one. Howl for them.",
        "solemn",
      ),
    ),
  ],
} as const;
const RAID_CIRCUIT: [number, number][] = [
  [-1200, -600],
  [-400, -1500],
  [900, -1300],
  [1300, -200],
];

export const CORSAIR_ACT23_DESIGNS: Readonly<Record<string, MissionDesign>> = {
  cors_2_1: {
    style: "salvage",
    tagline: "Silk, jewels and nobles. Shake the liner loose.",
    objectives: [
      hit("liner", "Disable the luxury liner before it jumps", {
        shipId: "terran_sentinel",
        at: [200, -900],
        flee: [[1500, -1600]],
        fleeAtHull: 0.5,
        fleeAfter: 100,
        hullScale: 1.5,
      }),
      hidden(
        salvage(
          "ransom",
          "Haul 3 noble strongboxes home (boost/roll drops them)",
          {
            crates: [
              [250, -1000],
              [750, -1250],
              [1150, -1500],
              [-250, -800],
            ],
            dropZone: [0, 500],
            required: 3,
          },
        ),
      ),
      bonus(
        within(
          kill("escorts", "Destroy the Raptor escorts within 90 seconds", 4),
          90,
        ),
        2,
        80,
      ),
    ],
    script: [
      onStart(
        say(
          ADMIRAL,
          "Liner Aurelia. Nobles, jewels, strongboxes. Cripple her and she spills the lot.",
        ),
      ),
      atTime(
        40,
        say(
          COMMAND,
          "Aurelia to escort: pirates closing! Spool the jump drive!",
          "urgent",
        ),
      ),
      atTime(
        85,
        say(
          BLOODFANG,
          "She's turning for the lane. Bite now or go home hungry!",
          "urgent",
        ),
      ),
      onObjective(
        "liner",
        "completed",
        reveal("ransom"),
        say(
          KIRA,
          "Liner's cracked open. Strongboxes everywhere. Scoop and fly smooth.",
          "proud",
        ),
      ),
      onObjective(
        "liner",
        "failed",
        say(
          ADMIRAL,
          "She jumped. Somewhere a duchess is laughing at us.",
          "grim",
        ),
      ),
      onObjective(
        "ransom",
        "completed",
        banner("RICH PICKINGS", "The ransom notes write themselves"),
      ),
    ],
  },
  cors_2_2: {
    style: "hazard",
    tagline: "Rustjaw mined his doorstep. Kick it in.",
    mood: "grim",
    allies: [WOLVES],
    objectives: [
      kill("kill", "Destroy Rustjaw's crew", 6),
      bonus(
        sabotage(
          "depot",
          "Blow Rustjaw's fuel depot — hold inside for 10 seconds",
          { at: [-1000, -1000], seconds: 10, decay: 0.5 },
        ),
        2,
        80,
      ),
      bonus(
        protect("wolves", "Bring Bloodfang's Wolves home", "wolves"),
        1,
        60,
      ),
    ],
    hazards: [
      minefield("mines", mineGrid(0, -650, 5, 2, 180), 20),
      asteroids("scrap", 900, -900, 320, 6, 1500),
    ],
    script: [
      onStart(
        say(
          BLOODFANG,
          "My Wolves ride with you. Rustjaw mined his front door — go around, not through.",
        ),
      ),
      atTime(
        45,
        wave("corsair_talon", 2, "void_corsairs", { at: "behind" }),
        say(COMMAND, "Rustjaw to all blades: hit them from behind!", "urgent"),
      ),
      atTime(
        90,
        say(
          ADMIRAL,
          "His fuel depot sits west of the field. Burn it and he never comes back.",
        ),
      ),
      onDestroyed(
        "wolves",
        2,
        "player",
        setFlag("cors_wolves_lost", true),
        say(
          BLOODFANG,
          "My Wolves... both of them. Rustjaw dies slow.",
          "solemn",
        ),
      ),
      onObjective(
        "depot",
        "completed",
        say(
          KIRA,
          "Depot's a fireball. Rustjaw's crew is walking home.",
          "proud",
        ),
      ),
    ],
  },
  cors_2_3: {
    style: "escort",
    tagline: "Our crew in their cells. Break the locks.",
    mood: "urgent",
    objectives: [
      escort("shuttles", "Escort the escape shuttles to the rendezvous", {
        path: [
          [400, -600],
          [0, 0],
          [-700, 700],
          [-1400, 1300],
        ],
        shipId: "corsair_tender",
        count: 3,
        maxLosses: 2,
        speed: 60,
      }),
      kill("guards", "Destroy the prison guards", 5),
      bonus(protect("all_shuttles", "Lose no shuttles", "transport"), 2, 80),
    ],
    script: [
      onStart(
        say(
          ADMIRAL,
          "Shuttles are off the prison hulk. Our own people aboard. Stay between them and the guns.",
          "urgent",
        ),
      ),
      atTime(
        35,
        wave("terran_viper", 2, "terran_hegemony", { at: "behind" }),
        say(BLOODFANG, "Vipers on the shuttles' tail!", "urgent"),
      ),
      atTime(
        70,
        say(
          COMMAND,
          "Warden to gunships: no pirate leaves this lane alive.",
          "grim",
        ),
      ),
      onDestroyed(
        "transport",
        1,
        "player",
        say(KIRA, "Shuttle down. Those were our people.", "solemn"),
      ),
      onObjective(
        "all_shuttles",
        "completed",
        setFlag("cors_crew_rescued", true),
        say(
          ADMIRAL,
          "Every shuttle home. That crew owes you their lives, Kira.",
          "proud",
        ),
      ),
      onObjective(
        "shuttles",
        "completed",
        banner("JAILBREAK", "The cells are empty"),
      ),
    ],
  },
  cors_2_4: {
    style: "stealth",
    tagline: "Go dark in the storm. Let the prey come.",
    mood: "grim",
    objectives: [
      kill("kill", "Destroy the convoy and its escorts", 7),
      bonus(
        stealth(
          "dark",
          "Stay clear of the convoy's scout pickets",
          [
            [-650, -700],
            [650, -700],
          ],
          { radius: 340, grace: 3 },
        ),
        2,
        80,
      ),
      bonus(
        within(kill("fast", "Gut the convoy within 2 minutes", 7), 120),
        1,
        60,
      ),
    ],
    hazards: [ionStorm("cloud", 0, -100, 420, 3)],
    script: [
      onStart(
        say(
          ADMIRAL,
          "Sit dark inside the ion cloud. Shields bleed, but their sensors go blind.",
        ),
      ),
      atTime(
        30,
        say(BLOODFANG, "Convoy's in the jaws. Now — teeth out!", "urgent"),
      ),
      onObjective(
        "dark",
        "failed",
        wave("terran_raptor", 2, "terran_hegemony", { at: "ahead" }),
        say(
          COMMAND,
          "Picket alert! Pirates in the cloud! Weapons free!",
          "urgent",
        ),
      ),
      atTime(
        80,
        say(KIRA, "Don't let a single hauler limp out. Every crate is ours."),
      ),
      onObjective(
        "kill",
        "completed",
        banner("AMBUSH SPRUNG", "The convoy never reached port"),
      ),
    ],
  },
  cors_2_5: {
    style: "assassination",
    tagline: "Blackmaw's grudge. Kronos' man. Cut him down.",
    mood: "grim",
    objectives: [
      hit("commander", "Kill Kronos' escort commander before he runs", {
        shipId: "terran_gladius",
        at: [0, -900],
        flee: [[-1500, -1700]],
        fleeAtHull: 0.4,
        fleeAfter: 110,
        hullScale: 2,
      }),
      bonus(kill("guardship", "Destroy the escort gunship", 1, "boss"), 2, 80),
      bonus(
        within(
          kill("screen", "Destroy the Raptor screen within 80 seconds", 3),
          80,
        ),
        1,
        60,
      ),
    ],
    script: [
      onStart(
        music("tension"),
        say(
          ADMIRAL,
          "Kronos' escort commander gutted Blackmaw's old crew. He runs when he bleeds.",
        ),
      ),
      atTime(
        40,
        say(
          COMMAND,
          "Escort Lead to Admiral Kronos: pirate strike group. Holding the line.",
          "urgent",
        ),
      ),
      atTime(
        90,
        say(
          BLOODFANG,
          "He's turning for the jump lane! Stay on him!",
          "urgent",
        ),
      ),
      onObjective(
        "commander",
        "completed",
        banner("GRUDGE SETTLED", "Blackmaw drinks tonight"),
      ),
      onObjective(
        "commander",
        "failed",
        say(
          ADMIRAL,
          "He jumped. Blackmaw won't forget. Neither will Kronos.",
          "grim",
        ),
      ),
    ],
  },
  cors_3_1: {
    style: "assault",
    tagline: "Bend the knee or burn with the ship.",
    allies: [WOLVES],
    variants: [WOLVES_LOST],
    objectives: [
      kill("kill", "Defeat the rival clan leaders", 8),
      bonus(
        hold(
          "moot",
          "Plant Blackmaw's banner on the clan moot for 25 seconds (medium hulls count double)",
          { at: [0, -800], radius: 300, seconds: 25 },
        ),
        2,
        80,
      ),
      bonus(kill("ace", "Destroy the Skarn clan's ace", 1, "ace"), 2, 80),
    ],
    script: [
      onStart(
        say(
          ADMIRAL,
          "Every clan at the moot. Those who kneel, sail with us. The rest burn.",
        ),
      ),
      atTime(
        50,
        wave("corsair_blade", 2, "void_corsairs", { at: "flank" }),
        say(
          COMMAND,
          "Skarn to holdouts: hit their flank! No Blackmaw throne!",
          "urgent",
        ),
      ),
      atTime(
        95,
        say(
          BLOODFANG,
          "Their Reaver's the Skarn ace. Drop him and the clans fold.",
        ),
      ),
      onObjective(
        "moot",
        "completed",
        say(
          KIRA,
          "Banner's flying. Every clan can see who rules this sky.",
          "proud",
        ),
      ),
      onObjective(
        "kill",
        "completed",
        banner("ARMADA UNITED", "The clans sail under one flag"),
      ),
    ],
  },
  cors_3_2: {
    style: "assault",
    tagline: "They burned our home. Return the favour.",
    mood: "grim",
    objectives: [
      sabotage(
        "reactor",
        "Overload the station reactor — hold inside for 15 seconds",
        { at: [0, -1100], seconds: 15, decay: 0.5 },
      ),
      kill("defenses", "Destroy the station defenses", 8),
      bonus(protect("crew", "No losses in your squad", "squad"), 2, 100),
    ],
    hazards: [
      flareWall("blast", {
        axis: "y",
        start: -1600,
        stop: 1500,
        speed: 22,
        dps: 12,
        startsInactive: true,
      }),
    ],
    script: [
      onStart(
        music("combat"),
        say(
          ADMIRAL,
          "They burned the Rookery with our families aboard. Their station burns next.",
          "grim",
        ),
      ),
      atTime(
        60,
        wave("terran_viper", 2, "terran_hegemony", { at: "flank" }),
        say(
          COMMAND,
          "Station Kappa to patrols: pirates at the reactor ring!",
          "urgent",
        ),
      ),
      atTime(
        110,
        say(
          BLOODFANG,
          "Bulwarks are slow. Leave them for last, hit the reactor!",
        ),
      ),
      onObjective(
        "reactor",
        "completed",
        hazardOn("blast"),
        say(
          KIRA,
          "Reactor's going critical — flare front from the north! Finish it and run!",
          "urgent",
        ),
      ),
      onObjective(
        "defenses",
        "completed",
        banner("PAYBACK", "Station Kappa lights the sky"),
      ),
    ],
  },
  cors_3_3: {
    style: "race",
    tagline: "Four wars. Four paydays. No loyalty.",
    objectives: [
      route("circuit", "Raid all four war fronts", RAID_CIRCUIT, {
        radius: 200,
      }),
      kill("loot", "Raid 10 ships from any side", 10),
      bonus(
        route("blitz", "Hit all four fronts within 2½ minutes", RAID_CIRCUIT, {
          radius: 200,
          seconds: 150,
        }),
        2,
        100,
      ),
    ],
    hazards: [
      ionStorm("front_storm", -400, -1500, 300, 4),
      asteroids("front_rocks", 1300, -200, 260, 5, 1600),
    ],
    script: [
      onStart(
        say(
          ADMIRAL,
          "Everyone's at war, nobody's watching the cargo. Four fronts, four paydays.",
        ),
      ),
      {
        ...onArea(
          -1200,
          -600,
          250,
          wave("confed_kestrel", 1, "free_confederation", { at: "ahead" }),
          say(
            COMMAND,
            "Confederation picket: pirates! Who let them in?",
            "urgent",
          ),
        ),
        // The Confederation pact waves the Corsairs through this checkpoint.
        if: [{ flag: "conf_corsair_pact", is: false }],
      },
      onArea(
        -400,
        -1500,
        250,
        wave("synth_drone", 2, "synthetic_collective", { at: "ahead" }),
        say(BLOODFANG, "Drones in the storm. Bad loot, good target practice."),
      ),
      onArea(
        900,
        -1300,
        250,
        say(
          KIRA,
          "Ascendant pickets. Pretty ships. Prettier salvage.",
          "proud",
        ),
      ),
      atTime(
        120,
        say(
          ADMIRAL,
          "Every side's calling us thieves. Means we're doing it right.",
        ),
      ),
      onObjective(
        "circuit",
        "completed",
        banner("WAR PROFITS", "Every side paid in full"),
      ),
    ],
  },
  cors_3_4: {
    style: "heist",
    tagline: "The Hegemony treasury. The heist of the age.",
    objectives: [
      sabotage(
        "vault",
        "Crack the treasury vault — hold inside for 18 seconds",
        { at: [0, -1100], seconds: 18, decay: 0.5 },
      ),
      hidden(
        salvage(
          "bullion",
          "Haul 2 bullion crates home (boost/roll drops them)",
          {
            crates: [
              [-200, -1150],
              [200, -1150],
              [0, -1300],
            ],
            dropZone: [0, 500],
            required: 2,
          },
        ),
      ),
      hidden(
        route(
          "getaway",
          "Make the getaway through the jump point",
          [[-1600, 1500]],
          { extraction: true },
        ),
      ),
      bonus(kill("guards", "Destroy 4 of the heavy escort", 4), 2, 100),
      bonus(protect("crew", "No losses in your squad", "squad"), 2, 100),
    ],
    hazards: [
      minefield(
        "vault_mines",
        [
          ...mineGrid(-550, -1100, 2, 3, 150),
          ...mineGrid(550, -1100, 2, 3, 150),
        ],
        22,
      ),
    ],
    script: [
      onStart(
        say(
          ADMIRAL,
          "Treasury ship. Mines flank the vault. Go in straight, crack it, take the gold.",
        ),
      ),
      atTime(
        60,
        wave("terran_viper", 2, "terran_hegemony", { at: "ahead" }),
        say(
          COMMAND,
          "Treasury Actual: vault breach alarm! All fighters, converge!",
          "urgent",
        ),
      ),
      onObjective(
        "vault",
        "completed",
        reveal("bullion"),
        say(
          KIRA,
          "Vault's open. Bullion's loose. Fly smooth or you drop it.",
          "proud",
        ),
      ),
      onObjective(
        "bullion",
        "completed",
        reveal("getaway"),
        say(BLOODFANG, "Gold's aboard! Run for the jump point!", "urgent"),
      ),
      onObjective(
        "getaway",
        "completed",
        banner("GRAND HEIST", "The richest crew in the void"),
      ),
    ],
  },
  cors_3_5: {
    style: "boss",
    tagline: "Blackmaw is dead. Take his throne.",
    mood: "proud",
    allies: [WOLVES],
    victoryFlags: { cors_pirate_king: true },
    objectives: [
      hit("pretender", "Destroy Vosk the Pretender's war galley", {
        shipId: "corsair_ravager",
        at: [0, -1000],
        boss: true,
        hullScale: 2.5,
      }),
      kill("rivals", "Defeat the rival captains", 8),
      bonus(kill("aces", "Destroy 3 of Vosk's Reaver aces", 3, "ace"), 3, 150),
    ],
    hazards: [
      asteroids("throne_rocks", -900, -700, 320, 6, 1500),
      ionStorm("throne_storm", 900, -700, 300, 4),
    ],
    variants: [
      {
        when: { flag: "cors_crew_rescued" },
        title: "Pirate King (Rescued Crew)",
        tagline: "The crew you broke out came to crown you.",
        addAllies: [
          {
            shipId: "corsair_marauder",
            count: 2,
            tag: "rescued",
            name: "Rescued Crew",
          },
        ],
        script: [
          onStart(
            say(
              ADMIRAL,
              "The crew you pulled off that prison hulk — they're here. For you, Kira.",
              "proud",
            ),
          ),
        ],
      },
      WOLVES_LOST,
    ],
    script: [
      onStart(
        music("boss"),
        say(
          KIRA,
          "Blackmaw's dead. Vosk wants his chair. Over his burning galley.",
          "proud",
        ),
      ),
      atTime(
        45,
        say(
          BLOODFANG,
          "Vosk's Reavers are aces. Kill them and his crew starts doubting.",
        ),
      ),
      atTime(
        90,
        wave("corsair_blade", 2, "void_corsairs", { at: "flank" }),
        say(COMMAND, "Vosk to all captains: gold for Kira's head!", "urgent"),
      ),
      beat(
        { on: "time", atSeconds: 25 },
        [say(KIRA, "Rescued crew, form on me. Let's show Vosk who saved you.")],
        { if: [{ flag: "cors_crew_rescued" }] },
      ),
      onObjective(
        "pretender",
        "completed",
        banner("PIRATE KING", "The void bows to Kira"),
      ),
    ],
  },
};
