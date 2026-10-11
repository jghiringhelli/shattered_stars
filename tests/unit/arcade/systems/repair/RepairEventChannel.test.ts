import { describe, it, expect } from "vitest";
import {
  RepairEventChannel,
  REPAIR_PULSE_INTERVAL_MS,
} from "../../../../../src/arcade/systems/repair/RepairEventChannel";
import type { RepairEvent } from "../../../../../src/arcade/systems/repair/RepairEvents";

/**
 * A shield trickle event.
 * @param amount - Shield points restored.
 * @param over - Field overrides.
 * @returns A repair event.
 */
function trickle(amount: number, over: Partial<RepairEvent> = {}): RepairEvent {
  return {
    shipId: "ally",
    kind: "shield",
    amount,
    sourceShipId: null,
    sourceKind: "astromech",
    ...over,
  };
}

/**
 * A channel with a recording subscriber.
 * @returns The channel and the events it delivered.
 */
function recordingChannel(): {
  channel: RepairEventChannel;
  seen: RepairEvent[];
} {
  const channel = new RepairEventChannel();
  const seen: RepairEvent[] = [];
  channel.subscribe((event) => seen.push({ ...event }));
  return { channel, seen };
}

describe("RepairEventChannel", () => {
  it("delivers the first trickle of a repair immediately", () => {
    const { channel, seen } = recordingChannel();
    channel.report(trickle(0.02));
    expect(seen).toEqual([trickle(0.02)]);
  });

  it("folds per-frame trickles into one pulse per interval", () => {
    const { channel, seen } = recordingChannel();
    channel.report(trickle(0.02));
    for (let frame = 0; frame < 10; frame++) {
      channel.tick(16);
      channel.report(trickle(0.03));
    }
    expect(seen).toHaveLength(1);
    channel.tick(REPAIR_PULSE_INTERVAL_MS);
    expect(seen).toHaveLength(2);
    expect(seen[1]?.amount).toBeCloseTo(0.3, 10);
  });

  it("keeps pulses for different sources apart", () => {
    const { channel, seen } = recordingChannel();
    channel.report(trickle(0.1));
    channel.report(trickle(0.1, { sourceKind: "aura", sourceShipId: "cap" }));
    channel.report(trickle(0.1, { kind: "hull", sourceKind: "mechanic_crew" }));
    expect(seen.map((e) => e.sourceKind)).toEqual([
      "astromech",
      "aura",
      "mechanic_crew",
    ]);
  });

  it("publishes a discrete repair at once, bypassing the pulse timer", () => {
    const { channel, seen } = recordingChannel();
    channel.report(trickle(0.1));
    channel.publish(trickle(12, { sourceKind: "damage_control" }));
    expect(seen).toHaveLength(2);
    expect(seen[1]?.amount).toBe(12);
  });

  it("stops delivering to an unsubscribed listener", () => {
    const channel = new RepairEventChannel();
    const seen: RepairEvent[] = [];
    const unsubscribe = channel.subscribe((event) => seen.push(event));
    unsubscribe();
    channel.report(trickle(1));
    expect(seen).toEqual([]);
  });

  it("drops pending pulses of a forgotten ship", () => {
    const { channel, seen } = recordingChannel();
    channel.report(trickle(0.1));
    channel.report(trickle(0.1));
    channel.forget("ally");
    channel.tick(REPAIR_PULSE_INTERVAL_MS);
    expect(seen).toHaveLength(1);
  });

  it("observes value changes and reports the detected repairs", () => {
    const { channel, seen } = recordingChannel();
    channel.observe({
      shipId: "ally",
      previous: { hull: 5, shields: 0 },
      current: { hull: 6, shields: 0 },
      source: { kind: "aura", sourceShipId: "carrier" },
    });
    expect(seen).toEqual([
      {
        shipId: "ally",
        kind: "hull",
        amount: 1,
        sourceShipId: "carrier",
        sourceKind: "aura",
      },
    ]);
  });
});
