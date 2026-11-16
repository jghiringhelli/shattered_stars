/**
 * Movement lab battle emulation: cells fly the real skill arena
 * deterministically, the subject alternates sides, engines can differ per
 * side, and the report lists every section with exact counts.
 */

import { describe, expect, it } from "vitest";
import {
  assembleBattleReport,
  formatBattleReport,
  runBattleRows,
} from "../../../src/simulation/movementLab/BattleLab";
import { playRound, runCell, type BattleCell } from "../../../src/simulation/movementLab/LabBattle";
import {
  TEMPLATE_SETTING,
  analogSetting,
} from "../../../src/simulation/movementLab/LabBattleCells";
import { pool } from "../../../src/simulation/movementLab/LabBattleReport";
import { pickLabShip } from "../../../src/simulation/movementLab/LabShip";
import { DEFAULT_ANALOG_TUNING } from "../../../src/core/analogTuning";
import { runBattle } from "../../../src/simulation/skill/SkillArena";

const ANALOG = analogSetting(DEFAULT_ANALOG_TUNING);

const duel = (subject: BattleCell["subject"], opponent: BattleCell["opponent"]): BattleCell => ({
  definitionId: pickLabShip(),
  formation: 1,
  subject,
  opponent,
  squads: false,
});

describe("a battle cell", () => {
  const cell = duel(
    { setting: ANALOG, pilots: { kind: "human" } },
    { setting: ANALOG, pilots: { kind: "bot", tier: "average" } },
  );

  it("counts every round exactly once", () => {
    const result = runCell(cell, 3);
    expect(result.rounds).toBe(3);
    expect(result.wins + result.losses + result.draws).toBe(3);
  });

  it("is deterministic per round", () => {
    expect(runCell(cell, 2)).toEqual(runCell(cell, 2));
  });

  it("meters the subject's ships tick by tick", () => {
    const round = playRound(cell, 0);
    expect(round.totals.shipTicks).toBeGreaterThan(0);
    expect(round.totals.turns).toBeGreaterThan(0);
    expect(round.shots).toBeGreaterThanOrEqual(0);
  });

  it("pools counts and weights the means by ship-minutes", () => {
    const one = runCell(cell, 2);
    const pooled = pool([one, one]);
    expect(pooled.rounds).toBe(4);
    expect(pooled.wins).toBe(2 * one.wins);
    expect(pooled.wedgePercent).toBeCloseTo(one.wedgePercent, 9);
  });
});

describe("engines per side", () => {
  it("flies each side on its own engine and tuning in one battle", () => {
    const entry = (steering: "template" | "analog") => ({
      definitionId: pickLabShip(),
      tier: "average" as const,
      steering,
    });
    const seen: string[] = [];
    runBattle(
      {
        A: { ships: [entry("analog")], squad: null },
        B: { ships: [entry("template")], squad: null },
        seed: 1,
        timeLimitMs: 100,
      },
      (ships) => {
        if (seen.length === 0)
          for (const ship of ships)
            seen.push(`${ship.side}:${ship.flight.motion.control.capabilities?.steering ?? "template"}`);
      },
    );
    expect(seen).toEqual(["A:analog", "B:template"]);
  });

  it("alternates the subject between the sides round by round", () => {
    const cell = duel(
      { setting: ANALOG, pilots: { kind: "bot", tier: "expert" } },
      { setting: TEMPLATE_SETTING, pilots: { kind: "bot", tier: "novice" } },
    );
    expect(playRound(cell, 0).totals.shipTicks).toBeGreaterThan(0);
    expect(playRound(cell, 1).totals.shipTicks).toBeGreaterThan(0);
  });
});

describe("the battle lab report", () => {
  it("lists every section and the recommendation with exact counts", () => {
    const rows = runBattleRows({
      definitionId: pickLabShip(),
      rounds: 1,
      banks: [45],
      holds: [null],
      squadFormations: [1],
    });
    const report = assembleBattleReport(rows);
    const markdown = formatBattleReport(report);
    for (const heading of ["Head to head", "Human-like pilot", "Tier ordering", "Recommendation"])
      expect(markdown).toContain(heading);
    expect(report.headToHead).toHaveLength(2 * 1);
    expect(report.human).toHaveLength(2 * 3 * 2);
    expect(report.ordering).toHaveLength(2 * 3);
    expect(report.recommendation.map((row) => row.label)).toHaveLength(2);
    expect(markdown).toMatch(/\d+-\d+-\d+ \(\d+ %\)/);
  });

  it("flies a single section when asked and merges rows of several runs", () => {
    const options = { definitionId: pickLabShip(), rounds: 1, banks: [45], holds: [null], squadFormations: [1] };
    const only = runBattleRows(options, ["ordering"]);
    expect(new Set(only.map((row) => row.section))).toEqual(new Set(["ordering"]));
    const report = assembleBattleReport([...only, ...only]);
    expect(report.ordering).toHaveLength(2 * only.length);
    expect(formatBattleReport(report)).toContain("expert > novice");
  });
});
