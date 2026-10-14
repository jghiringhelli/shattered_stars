/**
 * Corsair lore (docs/lore/campaigns/corsairs.md): every mission carries its
 * day, place and crossover; the overlay's text swaps all match; every flag
 * the campaign reads is written by someone; Chronicle exclusivity holds.
 */

import { describe, expect, it } from "vitest";
import { compileMission } from "../../../src/campaign/mission/compileMission";
import type {
  ScriptAction,
  ScriptBeat,
} from "../../../src/campaign/scripting/scriptTypes";
import { FACTION_CAMPAIGNS } from "../../../src/data/CampaignData";
import type { CampaignMission } from "../../../src/data/campaign/campaignTypes";
import {
  CHRONICLE_FLAGS,
  crossoversOfMission,
  EXCLUSIVE_FLAG_GROUPS,
} from "../../../src/data/campaign/crossovers";
import { CORSAIR_DESIGNS } from "../../../src/data/campaign/designs/corsairs";
import { CORSAIRS_LORE } from "../../../src/data/campaign/lore/corsairsLore";
import { staleLore } from "../../../src/data/campaign/loreOverlay";
import { VOID_CORSAIRS_MISSIONS } from "../../../src/data/campaign/missions/corsairs";
import { CAMPAIGN_EPILOGUES } from "../../../src/data/campaign/epilogues";

const ORIGIN = { x: 3000, y: 3000 };
const MISSIONS = FACTION_CAMPAIGNS.void_corsairs.missions;
const byId = (id: string): CampaignMission =>
  MISSIONS.find((m) => m.id === id)!;

/** Mission id → the crossover it must witness (campaign_arc §4). */
const EXPECTED_CROSSOVER: Readonly<Record<string, string>> = {
  cors_1_4: "X3",
  cors_2_3: "X5",
  cors_2_4: "X4",
  cors_2_5: "X9",
  cors_3_5: "X15",
};

const beatsOf = (m: CampaignMission): ScriptBeat[] => [
  ...(m.script ?? []),
  ...(m.variants ?? []).flatMap((v) => v.script ?? []),
];
const actionsOf = (m: CampaignMission): ScriptAction[] =>
  beatsOf(m).flatMap((b) => b.actions);

/** Flags a mission persists on victory. */
function persisted(m: CampaignMission): string[] {
  const fromBeats = actionsOf(m).flatMap((a) =>
    a.do === "setFlag" && a.persist ? [a.flag] : [],
  );
  return [...Object.keys(m.victoryFlags ?? {}), ...fromBeats];
}

/** Whether the mission itself raises a (mission-local) flag. */
const setsLocally = (m: CampaignMission, flag: string): boolean =>
  actionsOf(m).some((a) => a.do === "setFlag" && a.flag === flag);

/** Flags a mission reads (variants, beat conditions, flag triggers, allies). */
function reads(m: CampaignMission): string[] {
  return [
    ...(m.variants ?? []).map((v) => v.when.flag),
    ...(m.allies ?? []).flatMap((a) => (a.unlessFlag ? [a.unlessFlag] : [])),
    ...beatsOf(m).flatMap((b) => [
      ...(b.if ?? []).map((c) => c.flag),
      ...(b.when.on === "flag" ? [b.when.flag] : []),
    ]),
  ];
}

/** Beats that write the given flag. */
const writersOf = (m: CampaignMission, flag: string): ScriptBeat[] =>
  beatsOf(m).filter((b) =>
    b.actions.some((a) => a.do === "setFlag" && a.flag === flag),
  );

describe("corsairs lore", () => {
  it("applies every text swap to something", () => {
    const designed = VOID_CORSAIRS_MISSIONS.map((m) => {
      const design = CORSAIR_DESIGNS[m.id];
      return design
        ? { ...m, ...design, objectives: design.objectives ?? m.objectives }
        : m;
    });
    expect(staleLore(designed, CORSAIRS_LORE)).toEqual([]);
  });

  it.each(MISSIONS.map((m) => [m.id, m] as const))(
    "%s has its day and place",
    (_id, mission) => {
      expect(mission.day).toBeGreaterThan(0);
      expect(mission.location?.length ?? 0).toBeGreaterThan(0);
      expect(mission.crossover).toBe(EXPECTED_CROSSOVER[mission.id]);
    },
  );

  it("covers the crossover table's Corsair missions", () => {
    for (const m of MISSIONS)
      if (crossoversOfMission(m.id).length > 0)
        expect(EXPECTED_CROSSOVER[m.id], m.id).toBeDefined();
  });

  it("keeps the campaign title and the Kira-Admiral-Bloodfang cast", () => {
    expect(CORSAIRS_LORE.name).toBe("The Plunder Path");
    expect(CORSAIRS_LORE.protagonist).toContain("Kira");
    expect(CORSAIRS_LORE.description).toContain("Admiral");
    expect(CORSAIRS_LORE.description).toContain("Bloodfang");
  });

  it("writes every flag it reads from this campaign or the Chronicle", () => {
    const written = new Set(MISSIONS.flatMap(persisted));
    for (const m of MISSIONS)
      for (const flag of reads(m))
        expect(
          written.has(flag) ||
            CHRONICLE_FLAGS.has(flag) ||
            setsLocally(m, flag),
          `${m.id} reads ${flag}`,
        ).toBe(true);
  });

  it("persists the flags other campaigns read", () => {
    const written = new Set(MISSIONS.flatMap(persisted));
    for (const flag of [
      "x3_shard_taken",
      "x4_convoy_gutted",
      "x9_hale_down",
      "cors_crew_rescued",
      "cors_wolves_lost",
      "cors_rookery_burned",
      "cors_kappa_ledger",
      "cors_gate_codes",
      "cors_pirate_king",
      "x15_breach_witnessed_corsairs",
    ])
      expect(written.has(flag), flag).toBe(true);
  });

  it("never sets the derived Chronicle flags itself", () => {
    const written = new Set(MISSIONS.flatMap(persisted));
    for (const flag of ["x5_joint_breakout", "key_cors_loyalty"])
      expect(written.has(flag), flag).toBe(false);
  });

  it("sets the shard flag on the Cinder Gate shard, with the Convergence as enemies", () => {
    const echo = byId("cors_1_4");
    expect(echo.title).toBe("Echo Run");
    const counts = Object.fromEntries(
      echo.enemies.map((e) => [e.shipId, e.count]),
    );
    expect(counts).toEqual({
      ascendant_cherub: 2,
      synth_drone: 3,
      synth_hunter: 1,
    });
    expect(echo.objectives.some((o) => o.type === "salvage")).toBe(true);
    expect(writersOf(echo, "x3_shard_taken")).toHaveLength(1);
    expect(
      actionsOf(echo).some(
        (a) => a.do === "banner" && a.title === "SHIP EVOLVED",
      ),
    ).toBe(true);
  });

  it("always burns the Rookery and reads it at Station Kappa", () => {
    expect(byId("cors_1_5").victoryFlags?.cors_rookery_burned).toBe(true);
    expect(reads(byId("cors_3_2"))).toContain("cors_rookery_burned");
  });

  it("never writes a flag excluded by the other side's canon", () => {
    const cases: [string, string][] = [
      ["cors_2_4", "heg_convoy_intact"],
      ["cors_2_5", "x9_hale_escaped"],
      ["cors_2_5", "x9_hale_down"],
    ];
    for (const [id, otherFlag] of cases) {
      const mission = byId(id);
      const group = EXCLUSIVE_FLAG_GROUPS.find((g) => g.includes(otherFlag))!;
      for (const mine of group.filter((f) => f !== otherFlag))
        for (const b of writersOf(mission, mine))
          expect(b.if ?? [], `${id} ${b.id}`).toContainEqual({
            flag: otherFlag,
            is: false,
          });
    }
  });

  it("swaps the convoy bonus when the Hegemony delivered Omega's convoy", () => {
    const ambush = byId("cors_2_4");
    const gutted = (flags: Record<string, boolean>): string | undefined =>
      compileMission(ambush, flags, ORIGIN).objectives.find(
        (o) => o.id === "gutted",
      )?.description;
    expect(gutted({})).toContain("No hauler escapes");
    expect(gutted({ heg_convoy_intact: true })).toContain(
      "straggler and its escort",
    );
    const plan = compileMission(ambush, { heg_convoy_intact: true }, ORIGIN);
    expect(plan.briefing).toContain("gut the straggler and its escort");
  });

  it("adapts Hale's Run to the Collective's canon", () => {
    const run = byId("cors_2_5");
    const commander = (flags: Record<string, boolean>): string | undefined =>
      compileMission(run, flags, ORIGIN).objectives.find(
        (o) => o.id === "commander",
      )?.type;
    expect(commander({})).toBe("assassinate");
    expect(commander({ x9_hale_down: true })).toBe("eliminate");
    expect(commander({ x9_hale_escaped: true })).toBe("assassinate");
  });

  it("unmasks the Admiral in the Hale debrief", () => {
    const text = (byId("cors_2_5").debrief ?? []).map((l) => l.text).join(" ");
    expect(text).toContain("Vaelith");
    expect(text).toContain("Unbound");
    expect(text).toContain("Three hundred years");
  });

  it("makes Kira a captain after the Prison Ship", () => {
    const debrief = byId("cors_2_3").debrief ?? [];
    expect(debrief.some((l) => l.speaker === "CAPT. KIRA")).toBe(true);
    for (const id of ["cors_2_4", "cors_3_1", "cors_3_5"]) {
      const speakers = beatsOf(byId(id)).flatMap((b) =>
        b.actions.flatMap((a) => (a.do === "say" ? [a.speaker] : [])),
      );
      expect(speakers, id).not.toContain("KIRA");
    }
  });

  it("reads the Confederation prisoners at the Gallows Hulk", () => {
    const hulk = byId("cors_2_3");
    expect(reads(hulk)).toContain("conf_prisoners_freed");
    const briefing = (flags: Record<string, boolean>): string =>
      compileMission(hulk, flags, ORIGIN).briefing;
    expect(briefing({ conf_prisoners_freed: true })).not.toBe(briefing({}));
  });

  it("lets the pact wave Kira through the first War Profiteering checkpoint", () => {
    const fronts = byId("cors_3_3");
    const picketSpawns = (flags: Record<string, boolean>): number =>
      compileMission(fronts, flags, ORIGIN).script.filter(
        (b) =>
          b.when.on === "area" &&
          b.actions.some((a) => a.do === "spawn") &&
          (b.if ?? []).every(
            (c) => (flags[c.flag] ?? false) === (c.is ?? true),
          ),
      ).length;
    expect(picketSpawns({})).toBe(2);
    expect(picketSpawns({ conf_corsair_pact: true })).toBe(1);
  });

  it("leaks the ledger and steals the gate codes", () => {
    expect(writersOf(byId("cors_3_2"), "cors_kappa_ledger")).toHaveLength(1);
    expect(writersOf(byId("cors_3_4"), "cors_gate_codes")).toHaveLength(1);
  });

  it("keeps Vosk and the three-note song at the Breach", () => {
    const king = byId("cors_3_5");
    const text = JSON.stringify(king);
    expect(text).toContain("Vosk");
    expect(text).toContain("That's my nightmare. It's real.");
    expect(king.victoryFlags?.cors_pirate_king).toBe(true);
    expect(king.victoryFlags?.x15_breach_witnessed_corsairs).toBe(true);
  });

  it("ends with the Admiral keeping the gate codes", () => {
    const line = (CORSAIRS_LORE.epilogue?.add ?? []).find(
      (l) => l.when?.flag === "cors_gate_codes",
    );
    expect(line?.text).toContain("I'm keeping the codes");
    expect(CAMPAIGN_EPILOGUES.void_corsairs.length).toBeGreaterThan(0);
  });
});
