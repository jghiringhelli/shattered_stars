/**
 * Lore consistency — the Chronicle's data matches the shipped missions: every
 * flag a mission or epilogue reads is written somewhere (or is derived or
 * mission-local), every crossover pair and echo references real missions that
 * set / read the right flags, and every mission carries its day and place.
 */

import { describe, expect, it } from "vitest";
import { CAMPAIGN_EPILOGUES } from "../../../src/data/campaign/epilogues";
import { ENDING_EPILOGUES } from "../../../src/data/campaign/coalitionEpilogues";
import {
  CAMPAIGN_LORE,
  COALITION_CAMPAIGN,
  FACTION_CAMPAIGNS,
} from "../../../src/data/CampaignData";
import type { CampaignMission } from "../../../src/data/campaign/campaignTypes";
import {
  CHRONICLE_FLAGS,
  CROSSOVERS,
  DERIVED_FLAGS,
  ECHOES,
  EXCLUSIVE_FLAG_GROUPS,
  FACTION_KEYS,
  UNITY_FLAGS,
  crossoversOfMission,
} from "../../../src/data/campaign/crossovers";
import type {
  ScriptAction,
  ScriptBeat,
} from "../../../src/campaign/scripting/scriptTypes";

const FACTION_MISSIONS = Object.values(FACTION_CAMPAIGNS).flatMap(
  (c) => c.missions,
);
const ALL_MISSIONS = [...FACTION_MISSIONS, ...COALITION_CAMPAIGN.missions];
const BY_ID = new Map(ALL_MISSIONS.map((m) => [m.id, m]));
const DERIVED = new Set(DERIVED_FLAGS.map((d) => d.flag));
const LEAD = /^lead_/;

const beatsOf = (m: CampaignMission): ScriptBeat[] => [
  ...(m.script ?? []),
  ...(m.variants ?? []).flatMap((v) => v.script ?? []),
];
const actionsOf = (m: CampaignMission): ScriptAction[] =>
  beatsOf(m).flatMap((b) => b.actions);

/** Flags a mission writes into the story (persisted) or only for itself. */
function writes(m: CampaignMission): {
  persisted: Set<string>;
  local: Set<string>;
} {
  const persisted = new Set(Object.keys(m.victoryFlags ?? {}));
  const local = new Set<string>();
  for (const a of actionsOf(m)) {
    if (a.do !== "setFlag") continue;
    (a.persist ? persisted : local).add(a.flag);
  }
  return { persisted, local };
}

/** Flags a mission reads. */
function reads(m: CampaignMission): Set<string> {
  const out = new Set<string>();
  for (const v of m.variants ?? []) out.add(v.when.flag);
  for (const a of m.allies ?? []) if (a.unlessFlag) out.add(a.unlessFlag);
  for (const b of beatsOf(m)) {
    for (const c of b.if ?? []) out.add(c.flag);
    if (b.when.on === "flag") out.add(b.when.flag);
  }
  return out;
}

const PERSISTED_ANYWHERE = new Set(
  ALL_MISSIONS.flatMap((m) => [...writes(m).persisted]),
);

describe("flag consistency", () => {
  it.each(ALL_MISSIONS.map((m) => [m.id, m] as const))(
    "%s reads only flags that are written somewhere",
    (_id, mission) => {
      const { local } = writes(mission);
      for (const flag of reads(mission)) {
        const known =
          PERSISTED_ANYWHERE.has(flag) ||
          local.has(flag) ||
          DERIVED.has(flag) ||
          LEAD.test(flag);
        expect(known, `${mission.id} reads ${flag}`).toBe(true);
      }
    },
  );

  it("every epilogue line reads a flag that is written somewhere", () => {
    const lines = [
      ...Object.values(CAMPAIGN_EPILOGUES).flat(),
      ...Object.values(ENDING_EPILOGUES).flat(),
      ...Object.values(CAMPAIGN_LORE).flatMap((l) => l.epilogue?.add ?? []),
    ];
    for (const line of lines.filter((l) => l.when)) {
      const flag = line.when!.flag;
      expect(PERSISTED_ANYWHERE.has(flag) || DERIVED.has(flag), flag).toBe(
        true,
      );
    }
  });

  it("every Chronicle flag is written by some mission or derived", () => {
    for (const flag of CHRONICLE_FLAGS)
      expect(PERSISTED_ANYWHERE.has(flag) || DERIVED.has(flag), flag).toBe(
        true,
      );
  });

  it("every unity flag and key source can be earned", () => {
    for (const flag of UNITY_FLAGS)
      expect(PERSISTED_ANYWHERE.has(flag) || DERIVED.has(flag), flag).toBe(
        true,
      );
    for (const key of FACTION_KEYS)
      expect(
        key.earnedBy.some((f) => PERSISTED_ANYWHERE.has(f) || DERIVED.has(f)),
        key.flag,
      ).toBe(true);
  });

  it("a mission writing both flags of an exclusive group guards each write", () => {
    for (const mission of ALL_MISSIONS) {
      const { persisted } = writes(mission);
      for (const group of EXCLUSIVE_FLAG_GROUPS) {
        if (group.filter((f) => persisted.has(f)).length < 2) continue;
        for (const flag of group) {
          expect(
            mission.victoryFlags?.[flag],
            `${mission.id} victoryFlags`,
          ).toBeUndefined();
          const others = group.filter((f) => f !== flag);
          for (const b of beatsOf(mission).filter((beat) =>
            beat.actions.some((a) => a.do === "setFlag" && a.flag === flag),
          ))
            expect(
              (b.if ?? []).some(
                (c) => others.includes(c.flag) && c.is === false,
              ),
              `${mission.id} ${flag}`,
            ).toBe(true);
        }
      }
    }
  });
});
describe("crossovers and echoes", () => {
  it("lists 15 crossovers whose missions exist and name them", () => {
    expect(CROSSOVERS).toHaveLength(15);
    for (const crossover of CROSSOVERS) {
      expect(crossover.sides.length).toBeGreaterThanOrEqual(1);
      for (const side of crossover.sides)
        for (const id of side.missionIds) {
          const mission = BY_ID.get(id);
          expect(mission, `${crossover.id} → ${id}`).toBeDefined();
          expect(mission!.id.startsWith(prefixOf(side.faction))).toBe(true);
          expect(
            crossoversOfMission(id).map((c) => c.id),
            id,
          ).toContain(mission!.crossover);
        }
    }
  });

  it("every crossover mission carries its crossover id and a nearby day", () => {
    for (const crossover of CROSSOVERS)
      for (const side of crossover.sides)
        for (const id of side.missionIds) {
          const mission = BY_ID.get(id)!;
          expect(mission.crossover, id).toBeDefined();
          expect(
            Math.abs((mission.day ?? 0) - crossover.day),
            id,
          ).toBeLessThanOrEqual(10);
        }
  });

  it("every crossover flag is written by one of its missions or derived", () => {
    for (const crossover of CROSSOVERS)
      for (const flag of crossover.flags) {
        const writers = crossover.sides
          .flatMap((s) => s.missionIds)
          .some((id) => writes(BY_ID.get(id)!).persisted.has(flag));
        expect(
          writers || DERIVED.has(flag) || PERSISTED_ANYWHERE.has(flag),
          flag,
        ).toBe(true);
      }
  });

  it("each echo's writer sets the flag and its reader reads it", () => {
    for (const echo of ECHOES) {
      const writer = BY_ID.get(echo.writerMissionId);
      const reader = BY_ID.get(echo.readerMissionId);
      expect(writer, echo.id).toBeDefined();
      expect(reader, echo.id).toBeDefined();
      expect(
        writes(writer!).persisted.has(echo.flag),
        `${echo.id} writer`,
      ).toBe(true);
      expect(reads(reader!).has(echo.flag), `${echo.id} reader`).toBe(true);
    }
  });

  it("every second witness has a variant for the first witness's exclusive flag", () => {
    for (const group of EXCLUSIVE_FLAG_GROUPS)
      for (const flag of group) {
        const writers = ALL_MISSIONS.filter((m) =>
          writes(m).persisted.has(flag),
        );
        for (const writer of writers) {
          const other = group.find((f) => f !== flag)!;
          const guarded =
            reads(writer).has(other) ||
            beatsOf(writer).some((b) =>
              (b.if ?? []).some((c) => c.flag === other),
            );
          expect(guarded, `${writer.id} writes ${flag}`).toBe(true);
        }
      }
  });
});

describe("day and place", () => {
  it.each(ALL_MISSIONS.map((m) => [m.id, m] as const))(
    "%s has a story day and a location",
    (_id, mission) => {
      expect(mission.day).toBeGreaterThanOrEqual(0);
      expect(mission.day).toBeLessThanOrEqual(300);
      expect((mission.location ?? "").length).toBeGreaterThan(0);
    },
  );
});

/** @param faction - A faction id. @returns Its mission id prefix. */
function prefixOf(faction: string): string {
  return (
    {
      terran_hegemony: "heg_",
      free_confederation: "conf_",
      synthetic_collective: "synth_",
      void_corsairs: "cors_",
      ascendant_empire: "asc_",
    } as Record<string, string>
  )[faction]!;
}
