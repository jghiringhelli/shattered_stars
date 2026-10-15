/**
 * crossovers — the Chronicle's data (docs/lore/campaign_arc.md §3-§6): the
 * 15 crossover battles (which missions witness each, the flags they write,
 * which flags exclude each other), the one-way echoes, the unity flags, the
 * faction keys and the Coalition missions. Plain data; the rules live in
 * src/campaign/chronicle.
 */

import type { FactionId } from "../../config";

/** One faction's mission(s) at a crossover. */
export interface CrossoverSide {
  readonly faction: FactionId;
  /** Alternative missions of the slot (a branch pair lists both). */
  readonly missionIds: readonly string[];
}

/** A battle seen from two or three campaigns. */
export interface CrossoverDefinition {
  readonly id: string;
  readonly name: string;
  /** Story day of the battle. */
  readonly day: number;
  readonly sides: readonly CrossoverSide[];
  /** Flags the witnesses write (shared canon). */
  readonly flags: readonly string[];
}

const HEG: FactionId = "terran_hegemony";
const CON: FactionId = "free_confederation";
const SYN: FactionId = "synthetic_collective";
const COR: FactionId = "void_corsairs";
const ASC: FactionId = "ascendant_empire";

const side = (faction: FactionId, ...missionIds: string[]): CrossoverSide => ({
  faction,
  missionIds,
});

/** X1–X15, in story order. */
export const CROSSOVERS: readonly CrossoverDefinition[] = [
  {
    id: "X1",
    name: "Kessa Lane",
    day: 19,
    sides: [side(HEG, "heg_1_4"), side(CON, "conf_1_3")],
    flags: ["x1_phoenix_wounded", "x1_census_burned"],
  },
  {
    id: "X3",
    name: "Cinder Gate",
    day: 34,
    sides: [side(ASC, "asc_1_5"), side(COR, "cors_1_4")],
    flags: ["x3_shard_taken"],
  },
  {
    id: "X2",
    name: "Tessaly Junction",
    day: 38,
    sides: [side(HEG, "heg_1_5"), side(SYN, "synth_1_5")],
    flags: ["heg_relay_held", "x2_junction_collective"],
  },
  {
    id: "X4",
    name: "Convoy Alpha",
    day: 52,
    sides: [side(HEG, "heg_2_1"), side(COR, "cors_2_4")],
    flags: ["heg_convoy_intact", "x4_convoy_gutted"],
  },
  {
    id: "X5",
    name: "Gallows Hulk",
    day: 63,
    sides: [side(CON, "conf_2_2"), side(COR, "cors_2_3")],
    flags: ["conf_prisoners_freed", "cors_crew_rescued"],
  },
  {
    id: "X6",
    name: "The Witness",
    day: 74,
    sides: [side(CON, "conf_2_4"), side(HEG, "heg_2_3", "heg_2_3b")],
    flags: ["x6_vance_orders", "heg_phoenix_defected"],
  },
  {
    id: "X7",
    name: "The Fall of Prometheus",
    day: 90,
    sides: [side(HEG, "heg_2_4"), side(SYN, "synth_2_1"), side(ASC, "asc_2_1")],
    flags: ["x7_omega_held", "x7_nexus_data", "x7_shards_saved"],
  },
  {
    id: "X8",
    name: "Node Kel-9",
    day: 104,
    sides: [side(HEG, "heg_2_5"), side(SYN, "synth_2_4")],
    flags: ["relay_down", "x8_node_preserved"],
  },
  {
    id: "X9",
    name: "Hale's Run",
    day: 112,
    sides: [side(SYN, "synth_2_5"), side(COR, "cors_2_5")],
    flags: ["x9_hale_down", "x9_hale_escaped"],
  },
  {
    id: "X10",
    name: "Halden Orbit",
    day: 141,
    sides: [side(HEG, "heg_3_1"), side(CON, "conf_3_2")],
    flags: ["x10_chen_held_fire"],
  },
  {
    id: "X11",
    name: "The Broken Alliance",
    day: 158,
    sides: [side(HEG, "heg_3_3", "heg_3_3b"), side(ASC, "asc_3_1")],
    flags: ["x11_betrayal_averted"],
  },
  {
    id: "X12",
    name: "The Rendezvous",
    day: 171,
    sides: [side(SYN, "synth_3_3"), side(ASC, "asc_3_3")],
    flags: ["x12_rendezvous_denied", "x12_sanctuary_reached"],
  },
  {
    id: "X13",
    name: "The Catalyst",
    day: 186,
    sides: [side(ASC, "asc_3_2"), side(SYN, "synth_3_4")],
    flags: ["x13_catalyst_destroyed", "x13_door_opened"],
  },
  {
    id: "X14",
    name: "Brannoc Gate",
    day: 199,
    sides: [side(HEG, "heg_3_5"), side(CON, "conf_3_4")],
    flags: ["x14_ceasefire_called"],
  },
  {
    id: "X15",
    name: "The Breach",
    day: 200,
    sides: [
      side(HEG, "heg_3_5"),
      side(CON, "conf_3_5"),
      side(SYN, "synth_3_5"),
      side(COR, "cors_3_5"),
      side(ASC, "asc_3_5"),
    ],
    flags: [
      "x15_breach_witnessed_hegemony",
      "x15_breach_witnessed_confederation",
      "x15_breach_witnessed_synthetic",
      "x15_breach_witnessed_corsairs",
      "x15_breach_witnessed_ascendant",
    ],
  },
];

/** Flags that exclude each other: the first witness's flag wins the canon. */
export const EXCLUSIVE_FLAG_GROUPS: readonly (readonly string[])[] = [
  ["heg_relay_held", "x2_junction_collective"],
  ["heg_convoy_intact", "x4_convoy_gutted"],
  ["x9_hale_down", "x9_hale_escaped"],
  ["x13_catalyst_destroyed", "x13_door_opened"],
];

/** A one-way echo: a flag one campaign writes and another reads. */
export interface EchoDefinition {
  readonly id: string;
  readonly flag: string;
  readonly writerMissionId: string;
  readonly readerMissionId: string;
}

/** E1–E7. */
export const ECHOES: readonly EchoDefinition[] = [
  {
    id: "E1",
    flag: "cors_crew_rescued",
    writerMissionId: "cors_2_3",
    readerMissionId: "conf_2_3",
  },
  {
    id: "E2",
    flag: "conf_corsair_pact",
    writerMissionId: "conf_2_3",
    readerMissionId: "cors_3_3",
  },
  {
    id: "E3",
    flag: "x_zero_rechassised",
    writerMissionId: "asc_1_4",
    readerMissionId: "synth_2_4",
  },
  {
    id: "E4",
    flag: "cors_kappa_ledger",
    writerMissionId: "cors_3_2",
    readerMissionId: "heg_3_4",
  },
  {
    id: "E5",
    flag: "asc_heretics_spared",
    writerMissionId: "asc_2_2",
    readerMissionId: "conf_3_1",
  },
  {
    id: "E6",
    flag: "synth_gate_virus",
    writerMissionId: "synth_3_2",
    readerMissionId: "heg_3_5",
  },
  {
    id: "E7",
    flag: "asc_choir_silenced",
    writerMissionId: "asc_2_5",
    readerMissionId: "synth_3_5",
  },
];

/** The 12 unity flags (campaign_arc §6): each counts toward the Act V ending. */
export const UNITY_FLAGS: readonly string[] = [
  "x5_joint_breakout",
  "heg_phoenix_defected",
  "x7_shards_saved",
  "x8_node_preserved",
  "x10_chen_held_fire",
  "x11_betrayal_averted",
  "x12_sanctuary_reached",
  "x13_catalyst_destroyed",
  "x14_ceasefire_called",
  "conf_corsair_pact",
  "asc_temple_intact",
  "x3_shard_taken",
];

/** A faction key and what earns it (any of `earnedBy`). */
export interface FactionKey {
  readonly flag: string;
  readonly faction: FactionId;
  readonly earnedBy: readonly string[];
}

/** The five keys of the true ending. */
export const FACTION_KEYS: readonly FactionKey[] = [
  {
    flag: "key_heg_witness",
    faction: HEG,
    earnedBy: ["heg_phoenix_defected", "x11_betrayal_averted"],
  },
  { flag: "key_conf_pact", faction: CON, earnedBy: ["conf_corsair_pact"] },
  { flag: "key_synth_dissent", faction: SYN, earnedBy: ["key_synth_dissent"] },
  { flag: "key_cors_loyalty", faction: COR, earnedBy: ["cors_crew_rescued"] },
  {
    flag: "key_asc_mercy",
    faction: ASC,
    earnedBy: ["asc_heretics_spared", "key_asc_mercy"],
  },
];

/** Derived (never authored twice) flags: `flag` holds when any source holds. */
export const DERIVED_FLAGS: readonly {
  readonly flag: string;
  readonly allOf?: readonly string[];
  readonly anyOf?: readonly string[];
}[] = [
  {
    flag: "x5_joint_breakout",
    allOf: ["conf_prisoners_freed", "cors_crew_rescued"],
  },
  ...FACTION_KEYS.map((k) => ({ flag: k.flag, anyOf: k.earnedBy })),
];

/** Faction flags other campaigns read besides the crossover flags above. */
const SHARED_EXTRA_FLAGS: readonly string[] = [
  "asc_temple_intact",
  "asc_heretics_spared",
  "x_zero_rechassised",
  "cors_kappa_ledger",
  "cors_gate_codes",
  "synth_gate_virus",
  "asc_choir_silenced",
  "conf_corsair_pact",
  "heg_vance_captured",
];

/** Every flag that lives in the shared Chronicle (not only in one faction's save). */
export const CHRONICLE_FLAGS: ReadonlySet<string> = new Set([
  ...CROSSOVERS.flatMap((c) => c.flags),
  ...ECHOES.map((e) => e.flag),
  ...UNITY_FLAGS,
  ...FACTION_KEYS.map((k) => k.flag),
  ...SHARED_EXTRA_FLAGS,
]);

/** The four Act V endings. */
export type EndingId = "answer" | "sever" | "seal" | "quiet";

/** Story days of the crisis (Act boundaries), for the timeline. */
export const STORY_ACT_DAYS: readonly {
  readonly act: number;
  readonly name: string;
  readonly fromDay: number;
  readonly toDay: number;
}[] = [
  { act: 1, name: "The Fracture", fromDay: 0, toDay: 40 },
  { act: 2, name: "Escalation", fromDay: 41, toDay: 120 },
  { act: 3, name: "Revelation", fromDay: 121, toDay: 200 },
  { act: 4, name: "The Coalition", fromDay: 201, toDay: 260 },
  { act: 5, name: "Shattered Stars", fromDay: 261, toDay: 300 },
];

/**
 * @param missionId - A mission id.
 * @returns The crossovers it witnesses (a finale can witness two).
 */
export function crossoversOfMission(missionId: string): CrossoverDefinition[] {
  return CROSSOVERS.filter((c) =>
    c.sides.some((s) => s.missionIds.includes(missionId)),
  );
}
