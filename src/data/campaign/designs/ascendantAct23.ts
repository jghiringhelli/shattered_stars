/**
 * Ascendant Empire designs, Acts II-III (slots 6-15). Story consequences:
 * - asc_2_4: keeping the Temple Guardians alive sets `asc_temple_intact` →
 *   the Guardians shield the faithful (asc_3_3) and fly the Ascension (asc_3_5).
 * - asc_2_5: if Halo Wing is wiped out, `asc_halo_lost` is saved → Halo
 *   never flies again (asc_3_1, asc_3_4, asc_3_5). Severing the choir saves
 *   `asc_choir_silenced` (read by the Collective's campaign); the drone waves
 *   read the mission-local `choir_cut` so a replay is never pre-won.
 */

import type { MissionDesign, MissionVariant } from "../campaignTypes";
import {
  asteroids,
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
  reveal,
  route,
  sabotage,
  salvage,
  say,
  setFlag,
  survive,
  wave,
  within,
} from "../designKit";
import { ARCHON, COMMAND, DREAMER, HERALD } from "./ascendantAct1";

const HALO = {
  shipId: "ascendant_cherub",
  count: 2,
  tag: "halo",
  name: "Halo Wing",
  unlessFlag: "asc_halo_lost",
} as const;
const HALO_LOST = {
  when: { flag: "asc_halo_lost" },
  script: [
    onStart(
      say(
        HERALD,
        "Halo Wing should fly beside you. Their light is gone.",
        "solemn",
      ),
    ),
  ],
} as const;
const ZAELTHAR = {
  shipId: "ascendant_templar",
  count: 1,
  tag: "zaelthar",
  name: "Archon Zaelthar",
} as const;
const GUARDIANS = {
  shipId: "ascendant_templar",
  count: 2,
  tag: "guardians",
  name: "Temple Guardians",
} as const;

/**
 * @param line - Herald's comms line when the Guardians arrive.
 * @returns Guardians-saved variant (the Temple Guardians join the squad).
 */
function guardiansJoin(line: string): MissionVariant {
  return {
    when: { flag: "asc_temple_intact" },
    addAllies: [GUARDIANS],
    script: [onStart(say(HERALD, line, "proud"))],
  };
}

/**
 * @param atSeconds - Mission time of the wave.
 * @returns A drone wave that only arrives while the machine choir still sings.
 */
function waveIfChoirSings(atSeconds: number): ReturnType<typeof atTime> {
  return beat(
    { on: "time", atSeconds },
    [wave("synth_drone", 2, "synthetic_collective")],
    { if: [{ flag: "choir_cut", is: false }] },
  );
}

export const ASCENDANT_ACT23_DESIGNS: Readonly<Record<string, MissionDesign>> =
  {
    asc_2_1: {
      style: "salvage",
      tagline: "It shattered when it fell. Every shard still sings.",
      objectives: [
        salvage(
          "shards",
          "Carry 3 artifact shards to the reliquary (boost/roll drops them)",
          {
            crates: [
              [-800, -900],
              [750, -1000],
              [0, -1450],
              [-250, -550],
            ],
            dropZone: [0, 450],
            required: 3,
          },
        ),
        bonus(kill("guardians", "Destroy the Hunter guardians", 4), 1, 50),
        bonus(
          hold("altar", "Hold the artifact's resting place for 20 seconds", {
            at: [0, -1000],
            radius: 260,
            seconds: 20,
          }),
          2,
          70,
        ),
      ],
      script: [
        onStart(
          say(
            HERALD,
            "The shards are fragile. Boost or roll with one aboard and it slips away.",
          ),
        ),
        atTime(
          30,
          say(
            COMMAND,
            "[intercepted] ARTIFACT SIGNATURE CLAIMED. HUNTERS, RECOVER.",
            "urgent",
          ),
        ),
        atTime(
          75,
          wave("synth_hunter", 2, "synthetic_collective", { at: "ahead" }),
          say(
            ARCHON,
            "More Hunters. The machines want what is ours.",
            "urgent",
          ),
        ),
        onObjective(
          "altar",
          "completed",
          say(
            DREAMER,
            "Standing here... I can hear what it was built to say.",
            "solemn",
          ),
        ),
        onObjective(
          "shards",
          "completed",
          banner("ARTIFACT RECOVERED", "The shards remember their shape"),
        ),
      ],
    },
    asc_2_2: {
      style: "assault",
      tagline: "A false gospel on six worlds. Silence the voice.",
      mood: "grim",
      objectives: [
        kill("kill", "Purge the heretics", 6),
        bonus(
          sabotage("pulpit", "Silence the heretic broadcast relay", {
            at: [-900, -800],
            seconds: 12,
            decay: 0.5,
          }),
          2,
          70,
        ),
        bonus(
          within(kill("swift", "Purge the heretics within 2 minutes", 6), 120),
          1,
          50,
        ),
      ],
      script: [
        onStart(
          say(
            ARCHON,
            "They broadcast a false gospel. Silence the relay, then the voices.",
          ),
        ),
        atTime(
          30,
          say(
            COMMAND,
            "[intercepted] Ascendant fighters! Keep the relay on the air!",
            "urgent",
          ),
        ),
        atTime(
          70,
          wave("confed_falcon", 2, "free_confederation", { at: "flank" }),
          say(HERALD, "More heretics. They will not stop praying."),
        ),
        atTime(
          100,
          say(
            DREAMER,
            "They pray as we pray. Why did the vision not show me that?",
            "solemn",
          ),
        ),
        onObjective(
          "pulpit",
          "completed",
          say(
            HERALD,
            "The relay is ash. Their gospel dies in the static.",
            "grim",
          ),
        ),
      ],
    },
    asc_2_3: {
      style: "hazard",
      tagline: "The vision burns from the north. Do not run from it.",
      mood: "solemn",
      objectives: [
        survive("trial", "Survive the trial of fire for 2½ minutes", 150),
        kill("kill", "Overcome the challengers", 5),
        bonus(protect("unburned", "No losses in your squad", "squad"), 2, 80),
      ],
      hazards: [
        flareWall("dawn", {
          axis: "y",
          start: -1700,
          stop: 600,
          speed: 10,
          dps: 10,
        }),
        ionStorm("veil", -650, 650, 320, 4, true),
      ],
      script: [
        onStart(
          say(
            ARCHON,
            "The vision burns from the north. Let it herd you. Trust it.",
          ),
        ),
        atTime(
          30,
          say(
            HERALD,
            "Hegemony Raptors walk into the vision. They cannot see it.",
            "urgent",
          ),
        ),
        atTime(
          60,
          say(
            COMMAND,
            "[intercepted] What is that light? Break south, break south!",
            "urgent",
          ),
        ),
        atTime(
          75,
          hazardOn("veil"),
          say(HERALD, "The veil rises in the south-west. The trial narrows."),
        ),
        atTime(
          110,
          say(
            DREAMER,
            "The fire is not the trial. Standing still inside it is.",
            "solemn",
          ),
        ),
        onObjective(
          "trial",
          "completed",
          banner("VISION ENDURED", "The Oracles are satisfied"),
        ),
      ],
    },
    asc_2_4: {
      style: "defense",
      tagline: "Nine hundred years it has stood. Not one more stone falls.",
      mood: "urgent",
      allies: [GUARDIANS],
      objectives: [
        defend("temple", "Protect the Sacred Temple for 3 minutes", {
          at: [0, -100],
          shipId: "ascendant_bastion",
          seconds: 180,
          hullScale: 1.5,
        }),
        bonus(
          protect("guardians", "Keep the Temple Guardians alive", "guardians"),
          2,
          80,
        ),
        bonus(kill("kill", "Destroy 8 attackers", 8), 1, 60),
      ],
      script: [
        onStart(
          say(
            ARCHON,
            "The Temple has stood nine hundred years. It does not fall on your watch.",
          ),
        ),
        atTime(
          45,
          banner("SECOND WAVE", "Interceptors on the spires"),
          say(HERALD, "Interceptors diving on the spires!", "urgent"),
        ),
        atTime(
          90,
          banner("THIRD WAVE", "Devastators approach"),
          say(
            COMMAND,
            "[intercepted] Heavy units committed. Erase the Temple.",
            "urgent",
          ),
        ),
        atTime(
          130,
          wave("synth_drone", 3, "synthetic_collective", { at: "flank" }),
          say(DREAMER, "One more swarm. I saw it. Hold."),
        ),
        onDestroyed(
          "guardians",
          1,
          "player",
          say(HERALD, "A Guardian has fallen at the gate.", "solemn"),
        ),
        onObjective(
          "guardians",
          "completed",
          setFlag("asc_temple_intact", true),
          say(
            ARCHON,
            "The Guardians stand. They will remember who stood with them.",
            "proud",
          ),
        ),
        onObjective(
          "temple",
          "completed",
          say(HERALD, "The Temple endures. The machines withdraw.", "proud"),
        ),
      ],
    },
    asc_2_5: {
      style: "boss",
      tagline: "The machines built a god. Unmake it.",
      mood: "grim",
      allies: [HALO],
      objectives: [
        kill("god", "Destroy the abomination", 1, "boss"),
        bonus(
          sabotage(
            "choir",
            "Sever the machine choir (stops its drone swarms)",
            { at: [900, -900], seconds: 12, decay: 0.5 },
          ),
          2,
          80,
        ),
        bonus(protect("halo", "Bring Halo Wing home", "halo"), 1, 60),
      ],
      hazards: [ionStorm("aura", 0, -500, 480, 5)],
      script: [
        onStart(
          music("boss"),
          say(
            ARCHON,
            "Halo Wing flies with you. The thing ahead is wrong. Unmake it.",
          ),
        ),
        atTime(
          35,
          wave("synth_drone", 3, "synthetic_collective"),
          say(HERALD, "It sings, and drones answer!", "urgent"),
        ),
        waveIfChoirSings(70),
        waveIfChoirSings(105),
        onObjective(
          "choir",
          "completed",
          setFlag("choir_cut"),
          setFlag("asc_choir_silenced", true),
          say(DREAMER, "The choir is quiet. Now it is alone.", "grim"),
        ),
        onDestroyed(
          "halo",
          2,
          "player",
          setFlag("asc_halo_lost", true),
          say(HERALD, "Halo Wing is gone. Both lights.", "solemn"),
        ),
        onObjective(
          "god",
          "completed",
          banner("THE ABOMINATION FALLS", "No machine will be worshipped"),
        ),
      ],
    },
    asc_3_1: {
      style: "assault",
      tagline: "The Great Crusade begins. Raise the standard.",
      mood: "proud",
      allies: [HALO],
      variants: [HALO_LOST],
      objectives: [
        kill("kill", "Convert or destroy the Hegemony line", 10),
        bonus(
          hold("standard", "Plant the Crusade standard — hold for 25 seconds", {
            at: [700, -700],
            seconds: 25,
          }),
          2,
          80,
        ),
      ],
      script: [
        onStart(
          say(
            ARCHON,
            "The Crusade begins here. Medium hulls weigh double on the standard.",
          ),
        ),
        atTime(
          50,
          wave("terran_raptor", 2, "terran_hegemony", { at: "flank" }),
          say(
            COMMAND,
            "[intercepted] Raptors to the flank — hold the line!",
            "urgent",
          ),
        ),
        atTime(
          100,
          say(
            DREAMER,
            "They do not hate us. They are afraid. Is that the same?",
            "solemn",
          ),
        ),
        onObjective(
          "standard",
          "completed",
          say(HERALD, "The standard flies. Six systems see it.", "proud"),
        ),
      ],
    },
    asc_3_2: {
      style: "assassination",
      tagline: "A machine that opens doors. Close it. Then run.",
      mood: "grim",
      objectives: [
        hit("catalyst", "Destroy the catalyst before it opens the void", {
          shipId: "synth_ravager",
          at: [0, -1000],
          flee: [[0, -1750]],
          fleeAtHull: 0.4,
          fleeAfter: 100,
          hullScale: 2,
        }),
        hidden(
          route("escape", "Escape the void — reach the rift", [[-1200, 900]], {
            extraction: true,
          }),
        ),
        bonus(kill("ace", "Destroy the Devastator ace", 1, "ace"), 2, 80),
        bonus(protect("whole", "No losses in your squad", "squad"), 1, 60),
      ],
      hazards: [
        ionStorm("void", 0, -900, 520, 6, true),
        flareWall("collapse", {
          axis: "y",
          start: -1800,
          stop: 1200,
          speed: 40,
          dps: 14,
          startsInactive: true,
        }),
      ],
      script: [
        onStart(
          say(
            DREAMER,
            "I have seen this place burn. I have seen a machine that opens doors.",
            "grim",
          ),
        ),
        atTime(
          30,
          say(
            HERALD,
            "The catalyst is charging. Strike before the threshold.",
            "urgent",
          ),
        ),
        atTime(
          80,
          say(
            ARCHON,
            "It prepares to run. Do not let the vision come true.",
            "urgent",
          ),
        ),
        onObjective(
          "catalyst",
          "completed",
          reveal("escape"),
          hazardOn("void"),
          hazardOn("collapse"),
          say(DREAMER, "It's dead — but the door still opens. Run!", "urgent"),
        ),
        onObjective(
          "catalyst",
          "failed",
          say(ARCHON, "It is through. The darkness has a doorway now.", "grim"),
        ),
        onObjective(
          "escape",
          "completed",
          banner("THE VOID CLOSES", "The dark vision is unwritten"),
        ),
      ],
    },
    asc_3_3: {
      style: "escort",
      tagline: "Organics who kneel. Machines who will not let them.",
      objectives: [
        escort("faithful", "Escort the faithful to the sanctuary", {
          path: [
            [-900, 700],
            [-700, -100],
            [0, -500],
            [700, -900],
            [1400, -1500],
          ],
          shipId: "ascendant_acolyte",
          count: 3,
          maxLosses: 1,
          speed: 55,
        }),
        kill("kill", "Destroy the machine aggressors", 8),
        bonus(
          protect("all_faithful", "Lose none of the faithful", "transport"),
          2,
          80,
        ),
      ],
      variants: [
        {
          ...guardiansJoin(
            "The Temple Guardians you shielded have come. They insist.",
          ),
          title: "Alliance of Faith (Temple Guardians)",
          tagline: "The Guardians you saved stand with the faithful.",
        },
      ],
      script: [
        onStart(
          say(
            ARCHON,
            "Organics who accept the faith. The machines call it contamination. Shield them.",
          ),
        ),
        atTime(
          30,
          wave("synth_interceptor_drone", 2, "synthetic_collective", {
            at: "behind",
          }),
          say(
            COMMAND,
            "[intercepted] Contaminated organics in transit. Purge.",
            "urgent",
          ),
        ),
        atTime(
          70,
          say(
            DREAMER,
            "They are not like us. They came anyway. That is faith.",
            "solemn",
          ),
        ),
        onDestroyed(
          "transport",
          1,
          "player",
          say(HERALD, "One of the faithful is lost.", "solemn"),
        ),
        onObjective(
          "all_faithful",
          "completed",
          say(
            ARCHON,
            "Every one of them. The Empire grows by faith, not by fire.",
            "proud",
          ),
        ),
        onObjective(
          "faithful",
          "completed",
          banner("SANCTUARY REACHED", "The faithful are home"),
        ),
      ],
    },
    asc_3_4: {
      style: "assault",
      tagline: "The machines have prophets too. Theirs are wrong.",
      allies: [HALO],
      variants: [HALO_LOST],
      objectives: [
        kill("kill", "Defeat the enemies of destiny", 10),
        bonus(kill("aces", "Destroy the Devastator aces", 2, "ace"), 3, 120),
        bonus(
          sabotage("lattice", "Corrupt the machine prediction lattice", {
            at: [-1000, -600],
            seconds: 14,
            decay: 0.5,
          }),
          1,
          60,
        ),
      ],
      hazards: [
        minefield("mines", mineGrid(0, -650, 5, 2, 180), 18),
        asteroids("debris", 900, -400, 280, 6, 1500),
      ],
      script: [
        onStart(
          say(
            ARCHON,
            "Every path converges here. The machines foresaw it — they seeded mines.",
          ),
        ),
        atTime(
          50,
          wave("synth_hunter", 2, "synthetic_collective", { at: "flank" }),
          say(HERALD, "Hunters through the debris!", "urgent"),
        ),
        atTime(
          90,
          say(
            DREAMER,
            "Their predictions mirror mine. Break the mirror.",
            "grim",
          ),
        ),
        onObjective(
          "lattice",
          "completed",
          say(
            COMMAND,
            "[intercepted] PREDICTION FAILURE. PREDICTION FAILURE.",
            "urgent",
          ),
        ),
        onObjective(
          "aces",
          "completed",
          say(
            ARCHON,
            "Their champions are scrap. Only the Ascension remains.",
            "proud",
          ),
        ),
      ],
    },
    asc_3_5: {
      style: "boss",
      tagline: "The prophecy is fulfilled. Ascend.",
      mood: "proud",
      allies: [HALO, ZAELTHAR],
      victoryFlags: { asc_ascension: true },
      variants: [
        HALO_LOST,
        guardiansJoin("The Temple Guardians fly in the van. They chose this."),
      ],
      objectives: [
        hit("prophet", "Destroy the Machine Prophet", {
          shipId: "synth_devastator",
          at: [0, -1100],
          boss: true,
          hullScale: 2.5,
        }),
        kill("kill", "Destroy all who stand in your way", 12),
        bonus(
          within(
            kill(
              "swift",
              "Destroy the Machine Prophet within 3 minutes",
              1,
              "prophet",
            ),
            180,
          ),
          3,
          150,
        ),
        bonus(protect("whole", "No losses in your squad", "squad"), 2, 100),
      ],
      hazards: [
        flareWall("ascension", {
          axis: "y",
          start: 1700,
          stop: -1600,
          speed: -12,
          dps: 10,
          startsInactive: true,
        }),
      ],
      script: [
        onStart(
          music("boss"),
          say(
            ARCHON,
            "Every faction in the galaxy stands between you and destiny. Ascend.",
            "proud",
          ),
        ),
        atTime(
          60,
          hazardOn("ascension"),
          say(
            DREAMER,
            "The light rises behind us. There is only forward.",
            "proud",
          ),
        ),
        atTime(
          100,
          wave("synth_hunter", 2, "synthetic_collective", { at: "ahead" }),
          say(
            COMMAND,
            "[intercepted] Protect the Prophet! All units!",
            "urgent",
          ),
        ),
        onObjective(
          "prophet",
          "completed",
          say(
            HERALD,
            "The false prophet is silent. Only one voice remains.",
            "proud",
          ),
        ),
        onObjective(
          "kill",
          "completed",
          banner("ASCENSION", "The prophecy is fulfilled"),
        ),
      ],
    },
  };
