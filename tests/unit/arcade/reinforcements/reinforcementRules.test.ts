import { describe, expect, it } from "vitest";
import {
  DEFAULT_FIELD_CAP_POINTS,
  DEFAULT_POOL_POINTS,
  EPIC_FIELD_CAP_POINTS,
  EPIC_POOL_POINTS,
  REINFORCED_TIME_LIMIT_MS,
  PICKER_AUTO_ACCEPT_MS,
  ARRIVAL_PROTECTION_MS,
  rulesFor,
  quotaFor,
} from "../../../../src/arcade/reinforcements/reinforcementRules";
import { CYCLE_DURATION_MS } from "../../../../src/config";

describe("reinforcement match rules", () => {
  it("skirmish defaults to a 1000-point pool with 250 points on the field", () => {
    const rules = rulesFor("skirmish");
    expect(DEFAULT_POOL_POINTS).toBe(1000);
    expect(DEFAULT_FIELD_CAP_POINTS).toBe(250);
    expect(rules.poolPoints).toBe(1000);
    expect(rules.fieldCapPoints).toBe(250);
    expect(rules.choice).toBe("open");
  });

  it("epic doubles the cap for its bigger ships and enlarges the pool", () => {
    const rules = rulesFor("epic");
    expect(rules.poolPoints).toBe(EPIC_POOL_POINTS);
    expect(rules.fieldCapPoints).toBe(EPIC_FIELD_CAP_POINTS);
    expect(EPIC_FIELD_CAP_POINTS).toBe(2 * DEFAULT_FIELD_CAP_POINTS);
    expect(EPIC_POOL_POINTS).toBeGreaterThan(DEFAULT_POOL_POINTS);
    expect(EPIC_POOL_POINTS).toBeGreaterThan(EPIC_FIELD_CAP_POINTS * 2);
  });

  it("scenarios restrict the picker to the pre-planned reserve", () => {
    expect(rulesFor("scenario").choice).toBe("planned");
  });

  it("every format plays to a 3-minute limit", () => {
    expect(REINFORCED_TIME_LIMIT_MS).toBe(180_000);
    for (const format of ["skirmish", "epic", "scenario"] as const)
      expect(rulesFor(format).timeLimitMs).toBe(REINFORCED_TIME_LIMIT_MS);
  });

  it("arrival protection lasts one maneuver cycle; the picker waits 5 s", () => {
    expect(ARRIVAL_PROTECTION_MS).toBe(CYCLE_DURATION_MS);
    expect(PICKER_AUTO_ACCEPT_MS).toBe(5000);
  });

  it("capital ships are forbidden outside Epic and limited in Epic", () => {
    expect(quotaFor(rulesFor("skirmish"), "capital")?.maxOnField).toBe(0);
    const epic = quotaFor(rulesFor("epic"), "capital");
    expect(epic?.maxOnField).toBeGreaterThanOrEqual(1);
    expect(epic?.maxPerMatch).toBeLessThan(Infinity);
  });

  it("bombers and aces have field quotas in every format", () => {
    for (const format of ["skirmish", "epic", "scenario"] as const) {
      const rules = rulesFor(format);
      expect(quotaFor(rules, "bomber")?.maxOnField).toBeLessThan(Infinity);
      expect(quotaFor(rules, "ace")?.maxPerMatch).toBeLessThan(Infinity);
    }
  });

  it("overrides replace the pool and cap but keep the rest", () => {
    const rules = rulesFor("skirmish", {
      poolPoints: 400,
      fieldCapPoints: 120,
    });
    expect(rules.poolPoints).toBe(400);
    expect(rules.fieldCapPoints).toBe(120);
    expect(rules.quotas).toEqual(rulesFor("skirmish").quotas);
  });

  it("rejects non-positive pool or cap overrides", () => {
    expect(rulesFor("skirmish", { poolPoints: 0 }).poolPoints).toBe(1000);
    expect(rulesFor("skirmish", { fieldCapPoints: -5 }).fieldCapPoints).toBe(
      250,
    );
  });
});
