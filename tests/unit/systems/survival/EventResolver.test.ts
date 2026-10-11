import { describe, it, expect } from "vitest";
import {
  choiceAvailability,
  eventForNode,
  resolveEventChoice,
} from "../../../../src/systems/survival/EventResolver";
import { ALL_EVENTS, getEvent } from "../../../../src/data/survival/events";
import { ALL_FACTIONS } from "../../../../src/data/survival/enemyFactions";
import { RunBuilder, atActiveNode } from "./survivalRunBuilder";

describe("event catalog", () => {
  it("has at least 12 events with 2-3 choices each and unique ids", () => {
    expect(ALL_EVENTS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(ALL_EVENTS.map((e) => e.id)).size).toBe(ALL_EVENTS.length);
    ALL_EVENTS.forEach((e) => {
      expect(e.choices.length).toBeGreaterThanOrEqual(2);
      expect(e.choices.length).toBeLessThanOrEqual(3);
    });
  });

  it("gives every faction at least one faction-only (blue) option", () => {
    for (const faction of ALL_FACTIONS) {
      const blue = ALL_EVENTS.flatMap((e) => e.choices).filter(
        (c) => c.requires?.faction === faction,
      );
      expect(blue.length).toBeGreaterThan(0);
    }
  });

  it("offers a risky gamble in at least five events", () => {
    expect(
      ALL_EVENTS.filter((e) => e.choices.some((c) => c.gamble)).length,
    ).toBeGreaterThanOrEqual(5);
  });
});

describe("eventForNode", () => {
  it("is stable per node and avoids events already seen", () => {
    const run = RunBuilder.aRun().build();
    expect(eventForNode(run, "n1").id).toBe(eventForNode(run, "n1").id);
    const seen = ALL_EVENTS.slice(1).map((e) => e.id);
    expect(eventForNode({ ...run, seenEvents: seen }, "n1").id).toBe(
      ALL_EVENTS[0]!.id,
    );
  });
});

describe("choiceAvailability", () => {
  const toll = getEvent("corsair_toll")!;

  it("locks faction options to that faction's pilots", () => {
    const blue = toll.choices[2]!;
    expect(choiceAvailability(RunBuilder.aRun().build(), blue).enabled).toBe(
      false,
    );
    expect(
      choiceAvailability(
        RunBuilder.aRun().withFaction("void_corsairs").build(),
        blue,
      ).enabled,
    ).toBe(true);
  });

  it("locks options the run cannot pay for", () => {
    const pay = toll.choices[0]!;
    expect(
      choiceAvailability(RunBuilder.aRun().with({ salvage: 10 }).build(), pay),
    ).toEqual({
      enabled: false,
      reason: "Needs 30 salvage",
    });
  });

  it("locks relic-tag options without a matching relic", () => {
    const ping = getEvent("nexus_whisper")!.choices[2]!;
    expect(choiceAvailability(RunBuilder.aRun().build(), ping).enabled).toBe(
      false,
    );
    expect(
      choiceAvailability(
        RunBuilder.aRun()
          .with({ relics: ["target_painter"] })
          .build(),
        ping,
      ).enabled,
    ).toBe(true);
  });
});

describe("resolveEventChoice", () => {
  const eventRun = () => atActiveNode(RunBuilder.aRun().build(), "event");

  it("pays the cost and applies outcomes", () => {
    const run = { ...eventRun(), salvage: 100 };
    const result = resolveEventChoice(run, getEvent("mercenary_wing")!, 0);
    expect(result.run.salvage).toBe(45);
    expect(result.run.escorts).toHaveLength(1);
    expect(result.startsCombat).toBe(false);
  });

  it("turns a fight into a pending battle whose other outcomes are the bonus", () => {
    const result = resolveEventChoice(eventRun(), getEvent("corsair_toll")!, 1);
    expect(result.startsCombat).toBe(true);
    expect(result.run.eventCombat).toEqual({
      elite: true,
      bonus: [{ kind: "salvage", amount: 40 }],
    });
    expect(result.run.salvage).toBe(eventRun().salvage);
  });

  it("resolves gambles deterministically per run and node", () => {
    const event = getEvent("derelict_hulk")!;
    const a = resolveEventChoice(eventRun(), event, 0);
    const b = resolveEventChoice(eventRun(), event, 0);
    expect(a.run.salvage).toBe(b.run.salvage);
    expect(a.run.flagship.hull).toBe(b.run.flagship.hull);
    expect(
      a.run.salvage !== eventRun().salvage || a.run.flagship.hull < 1,
    ).toBe(true);
  });

  it("ignores a locked choice", () => {
    const run = eventRun();
    expect(resolveEventChoice(run, getEvent("corsair_toll")!, 2).run).toBe(run);
  });

  it("queues a free power draft and banks Star Charts", () => {
    const run = eventRun();
    expect(
      resolveEventChoice(run, getEvent("nexus_whisper")!, 0).run.pendingRewards,
    ).toHaveLength(1);
    expect(
      resolveEventChoice(run, getEvent("black_box")!, 0).run.stats.bonusCharts,
    ).toBe(6);
  });
});
