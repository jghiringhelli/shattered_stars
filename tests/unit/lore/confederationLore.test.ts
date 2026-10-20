/**
 * Confederation lore (docs/lore/campaigns/confederation.md): every mission
 * carries its day, place and crossover; the overlay's text swaps all match;
 * every flag the campaign reads is written by someone; the Chronicle flags
 * the campaign owns are persisted; derived keys are never set directly.
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
import { CONFEDERATION_DESIGNS } from "../../../src/data/campaign/designs/confederation";
import { CONFEDERATION_LORE } from "../../../src/data/campaign/lore/confederationLore";
import { staleLore } from "../../../src/data/campaign/loreOverlay";
import { FREE_CONFEDERATION_MISSIONS } from "../../../src/data/campaign/missions/confederation";

const ORIGIN = { x: 3000, y: 3000 };
const MISSIONS = FACTION_CAMPAIGNS.free_confederation.missions;
const mission = (id: string): CampaignMission =>
  MISSIONS.find((m) => m.id === id)!;

/** Mission id → the crossover it must witness (campaign_arc §4). */
const EXPECTED_CROSSOVER: Readonly<Record<string, string>> = {
  conf_1_3: "X1",
  conf_2_2: "X5",
  conf_2_4: "X6",
  conf_3_2: "X10",
  conf_3_4: "X14",
  conf_3_5: "X15",
};
/** Flags the Chronicle derives; a mission must never set them. */
const DERIVED = ["key_conf_pact", "x5_joint_breakout"];

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

const speechOf = (m: CampaignMission): string[] =>
  actionsOf(m).flatMap((a) => (a.do === "say" ? [a.text] : []));

describe("confederation lore", () => {
  it("applies every text swap to something", () => {
    const designed = FREE_CONFEDERATION_MISSIONS.map((m) => {
      const design = CONFEDERATION_DESIGNS[m.id];
      return design
        ? { ...m, ...design, objectives: design.objectives ?? m.objectives }
        : m;
    });
    expect(staleLore(designed, CONFEDERATION_LORE)).toEqual([]);
  });

  it("titles the campaign Libre with its three leads", () => {
    expect(CONFEDERATION_LORE.name).toBe("Libre");
    expect(CONFEDERATION_LORE.protagonist).toMatch(/Santos/);
    expect(CONFEDERATION_LORE.protagonist).toMatch(/Phoenix One/);
    expect(CONFEDERATION_LORE.protagonist).toMatch(/Vasquez/);
    expect(CONFEDERATION_LORE.description?.length ?? 0).toBeGreaterThan(0);
  });

  it.each(MISSIONS.map((m) => [m.id, m] as const))(
    "%s has its day and place",
    (_id, m) => {
      expect(m.day).toBeGreaterThan(0);
      expect(m.location?.length ?? 0).toBeGreaterThan(0);
      expect(m.crossover).toBe(EXPECTED_CROSSOVER[m.id]);
    },
  );

  it("keeps the story days in order", () => {
    const days = MISSIONS.map((m) => m.day ?? 0);
    expect([...days].sort((a, b) => a - b)).toEqual(days);
  });

  it("covers the crossover table's Confederation missions", () => {
    for (const m of MISSIONS)
      if (crossoversOfMission(m.id).length > 0)
        expect(EXPECTED_CROSSOVER[m.id], m.id).toBeDefined();
  });

  it("writes every flag it reads from this campaign or the Chronicle", () => {
    const written = new Set(MISSIONS.flatMap(persisted));
    for (const m of MISSIONS)
      for (const flag of reads(m))
        expect(
          written.has(flag) || CHRONICLE_FLAGS.has(flag) || setsLocally(m, flag),
          `${m.id} reads ${flag}`,
        ).toBe(true);
  });

  it("persists the flags other campaigns read", () => {
    const written = new Set(MISSIONS.flatMap(persisted));
    for (const flag of [
      "x1_census_burned",
      "conf_prisoners_freed",
      "conf_corsair_pact",
      "x6_vance_orders",
      "x14_ceasefire_called",
      "x15_breach_witnessed_confederation",
      "conf_independence",
      "conf_crash_data",
      "conf_nest_evacuated",
    ])
      expect(written.has(flag), flag).toBe(true);
  });

  it("never sets a flag the Chronicle derives", () => {
    for (const m of MISSIONS)
      for (const flag of DERIVED)
        expect(persisted(m), `${m.id} ${flag}`).not.toContain(flag);
  });

  it("owns no flag of an exclusive Chronicle group", () => {
    const exclusive = new Set(EXCLUSIVE_FLAG_GROUPS.flat());
    for (const m of MISSIONS)
      for (const flag of persisted(m))
        expect(exclusive.has(flag), `${m.id} ${flag}`).toBe(false);
  });

  it("reads the Chronicle flags the bible assigns", () => {
    const readBy = (id: string): string[] => reads(mission(id));
    expect(readBy("conf_1_3")).toContain("x1_phoenix_wounded");
    expect(readBy("conf_2_2")).toContain("cors_crew_rescued");
    expect(readBy("conf_2_3")).toContain("cors_crew_rescued");
    expect(readBy("conf_2_4")).toContain("heg_phoenix_defected");
    expect(readBy("conf_3_1")).toContain("asc_heretics_spared");
    expect(readBy("conf_3_2")).toContain("x10_chen_held_fire");
    expect(readBy("conf_3_3")).toContain("conf_corsair_pact");
    expect(readBy("conf_3_4")).toContain("x14_ceasefire_called");
  });

  it("burns the census cores on the convoy kill and not before", () => {
    const m = mission("conf_1_3");
    const beat = beatsOf(m).find((b) =>
      b.actions.some((a) => a.do === "setFlag" && a.flag === "x1_census_burned"),
    )!;
    expect(beat.when).toEqual({
      on: "objective",
      objectiveId: "convoy",
      status: "completed",
    });
  });

  it("sends Chen's Raptors, not Vipers, when the buoys trip", () => {
    const wave = mission("conf_1_3")
      .script!.flatMap((b) => b.actions)
      .find((a) => a.do === "spawn" && a.group.faction === "terran_hegemony");
    expect(wave?.do === "spawn" && wave.group.shipId).toBe("terran_raptor");
    expect(speechOf(mission("conf_1_3")).join(" ")).toContain(
      "Chen's squadron",
    );
  });

  it("flies the Gallows Hulk with Corsair cover once their crew is out", () => {
    const m = mission("conf_2_2");
    const tags = (flags: Record<string, boolean>): string[] =>
      compileMission(m, flags, ORIGIN).allies.map((a) => a.tag);
    expect(tags({})).not.toContain("corsair_cover");
    expect(tags({ cors_crew_rescued: true })).toContain("corsair_cover");
  });

  it("makes Captain Kira a named ally whose loss ends the deal", () => {
    const m = mission("conf_2_3");
    const plan = compileMission(m, {}, ORIGIN);
    expect(plan.allies.find((a) => a.tag === "captain")?.name).toBe(
      "Captain Kira",
    );
    expect(speechOf(m)).toContain("Kira's out. So is the deal.");
    const wing = compileMission(m, { cors_crew_rescued: true }, ORIGIN).allies;
    expect(wing.map((a) => a.tag)).toContain("kira_wing");
  });

  it("copies the relay's orders into the x6 flag on the hack", () => {
    const m = mission("conf_2_4");
    const beat = beatsOf(m).find((b) =>
      b.actions.some((a) => a.do === "setFlag" && a.flag === "x6_vance_orders"),
    )!;
    expect(beat.when).toMatchObject({ objectiveId: "hack", status: "completed" });
    const lines = (flags: Record<string, boolean>): string[] =>
      compileMission(m, flags, ORIGIN).script.flatMap((b) =>
        b.actions.flatMap((a) => (a.do === "say" ? [a.text] : [])),
      );
    expect(lines({}).join(" ")).not.toContain("Chen listened");
    expect(lines({ heg_phoenix_defected: true }).join(" ")).toContain(
      "Chen listened",
    );
  });

  it("adds the Unbound chorus to the uprising when the heretics were spared", () => {
    const lines = (flags: Record<string, boolean>): string =>
      compileMission(mission("conf_3_1"), flags, ORIGIN)
        .script.flatMap((b) =>
          b.actions.flatMap((a) => (a.do === "say" ? [a.text] : [])),
        )
        .join(" ");
    expect(lines({})).not.toContain("Unbound");
    expect(lines({ asc_heretics_spared: true })).toContain("Unbound");
  });

  it("shows Iron Fist holding fire over Halden only when Chen did", () => {
    const m = mission("conf_3_2");
    const plain = compileMission(m, {}, ORIGIN);
    const held = compileMission(m, { x10_chen_held_fire: true }, ORIGIN);
    expect(plain.allies.map((a) => a.tag)).not.toContain("lifters");
    expect(held.allies.map((a) => a.tag)).toContain("lifters");
    const said = held.script
      .flatMap((b) => b.actions)
      .flatMap((a) => (a.do === "say" ? [a.text] : []));
    expect(said).toContain("Iron Fist is holding fire on the lifters. Why?");
  });

  it("answers Chen's ceasefire at Brannoc and persists the flag", () => {
    const m = mission("conf_3_4");
    expect(m.victoryFlags).toMatchObject({ x14_ceasefire_called: true });
    const said = speechOf(m).join(" ");
    expect(said).toContain("Libre One, this is Iron Actual");
    expect(said).toContain("Hold fire. All cells, hold fire.");
    const callOrder = beatsOf(m)
      .filter((b) => b.when.on === "victory")
      .flatMap((b) => b.actions)
      .flatMap((a) => (a.do === "say" ? [a.text] : []));
    expect(callOrder.findIndex((t) => t.includes("Iron Actual"))).toBeLessThan(
      callOrder.findIndex((t) => t.includes("Hold fire")),
    );
    expect(callOrder.findIndex((t) => t.includes("Iron Actual"))).toBe(0);
  });

  it("ends on Kronos's fall, the witnessed breach and the Prometheus signal", () => {
    const m = mission("conf_3_5");
    expect(m.victoryFlags).toMatchObject({
      conf_independence: true,
      x15_breach_witnessed_confederation: true,
    });
    expect(m.briefing).toContain("Kronos falls. Halden is free.");
    const banners = actionsOf(m).flatMap((a) =>
      a.do === "banner" ? [a.subtitle] : [],
    );
    expect(banners).toContain("Kronos falls. Halden is free");
    const debrief = (m.debrief ?? []).map((l) => l.text).join(" ");
    expect(debrief).toContain("That's the sound from Prometheus. It's here.");
    expect(speechOf(m).join(" ")).toContain("does not recognise a ceasefire");
  });

  it("adds the Nest and ceasefire epilogue lines behind their flags", () => {
    const added = CONFEDERATION_LORE.epilogue?.add ?? [];
    const byFlag = (flag: string): string | undefined =>
      added.find((l) => l.when?.flag === flag)?.text;
    expect(byFlag("x14_ceasefire_called")).toBe(
      "Chen kept his word. So will we.",
    );
    expect(byFlag("conf_nest_evacuated")).toContain("Nest");
  });
  it("keeps all 15 slots", () => {
    expect(MISSIONS).toHaveLength(15);
  });
});
