import { describe, expect, it } from "vitest";
import {
  decodePilotInput,
  encodePilotInput,
  PILOT_COMMANDS,
  type EdgeAction,
  type HeldAction,
} from "../../../src/net/input/PilotInputCodec";
import { SeatInput } from "../../../src/net/battle/SeatInput";
import { LocalPilotSampler } from "../../../src/net/battle/LocalPilotSampler";
import { LocalInputSampler } from "../../../src/net/lockstep/LocalInputSampler";
import { EDGE_MASK } from "../../../src/net/input/PilotInputCodec";
import { INPUT_AI_CONTROL } from "../../../src/net/protocol";
import type { InputEvent } from "../../../src/input/InputTypes";

const tick = (
  held: readonly HeldAction[],
  edges: readonly EdgeAction[] = [],
): ReturnType<typeof decodePilotInput> =>
  decodePilotInput(
    encodePilotInput({ held: new Set(held), edges: new Set(edges) }),
  );

describe("SeatInput", () => {
  it("reports held actions and consumes each press once", () => {
    const seat = new SeatInput();
    seat.feed(tick(["STEER_LEFT"], ["KTURN"]));
    expect(seat.isHeld("STEER_LEFT")).toBe(true);
    expect(seat.isHeld("STEER_RIGHT")).toBe(false);
    expect(seat.consume("KTURN")).toBe(true);
    expect(seat.consume("KTURN")).toBe(false);
  });

  it("treats a throttle tap shorter than a tick as held for that tick", () => {
    const seat = new SeatInput();
    seat.feed(tick([], ["THRUST_UP"]));
    expect(seat.isHeld("THRUST_UP")).toBe(true);
    seat.feed(tick([]));
    expect(seat.isHeld("THRUST_UP")).toBe(false);
  });

  it("delivers the tick's presses to subscribers, like InputManager.onAny", () => {
    const seat = new SeatInput();
    const seen: string[] = [];
    const id = seat.onAny((event: InputEvent) => seen.push(event.intent));
    seat.feed(tick([], ["BOOST", "FIRE_SECONDARY"]));
    seat.off(id);
    seat.feed(tick([], ["KTURN"]));
    expect(seen).toEqual(["BOOST", "FIRE_SECONDARY"]);
  });

  it("carries the AI-control flag and a command", () => {
    const seat = new SeatInput();
    seat.feed(decodePilotInput(INPUT_AI_CONTROL));
    expect(seat.aiControl).toBe(true);
    seat.feed(
      decodePilotInput(
        encodePilotInput({
          held: new Set(),
          edges: new Set(),
          command: { op: PILOT_COMMANDS.deployReserve, arg: 3 },
        }),
      ),
    );
    expect(seat.aiControl).toBe(false);
    expect(seat.takeCommand()).toEqual({
      op: PILOT_COMMANDS.deployReserve,
      arg: 3,
    });
    expect(seat.takeCommand()).toBeNull();
  });
});

/** A fake InputManager. */
class FakeIntents {
  held = new Set<string>();
  private readonly subs = new Map<number, (e: InputEvent) => void>();
  private next = 1;
  isHeld(intent: string): boolean {
    return this.held.has(intent);
  }
  onAny(callback: (e: InputEvent) => void): number {
    this.subs.set(this.next, callback);
    return this.next++;
  }
  off(id: number): boolean {
    return this.subs.delete(id);
  }
  press(intent: string): void {
    for (const cb of this.subs.values())
      cb({ intent, timestamp: 0, source: "keyboard", value: 1 } as InputEvent);
  }
}

describe("LocalPilotSampler", () => {
  it("samples held actions and the presses since the last sample", () => {
    const intents = new FakeIntents();
    const sampler = new LocalPilotSampler(intents);
    sampler.attach();
    intents.held.add("STEER_RIGHT");
    intents.press("BOOST");
    intents.press("STEER_RIGHT");
    const frame = decodePilotInput(sampler.sample());
    expect([...frame.held]).toEqual(["STEER_RIGHT"]);
    expect([...frame.edges]).toEqual(["BOOST"]);
    expect([...decodePilotInput(sampler.sample()).edges]).toEqual([]);
  });

  it("turns a throttle key going down into one press", () => {
    const intents = new FakeIntents();
    const sampler = new LocalPilotSampler(intents);
    sampler.attach();
    intents.held.add("THRUST_UP");
    expect([...decodePilotInput(sampler.sample()).edges]).toEqual([
      "THRUST_UP",
    ]);
    expect([...decodePilotInput(sampler.sample()).edges]).toEqual([]);
  });

  it("sends a queued command once", () => {
    const sampler = new LocalPilotSampler(new FakeIntents());
    sampler.queueCommand({ op: PILOT_COMMANDS.deployReserve, arg: 1 });
    expect(decodePilotInput(sampler.sample()).command?.arg).toBe(1);
    expect(decodePilotInput(sampler.sample()).command).toBeUndefined();
  });

  it("stops listening when detached", () => {
    const intents = new FakeIntents();
    const sampler = new LocalPilotSampler(intents);
    sampler.attach();
    sampler.detach();
    intents.press("KTURN");
    expect([...decodePilotInput(sampler.sample()).edges]).toEqual([]);
  });
});

describe("LocalInputSampler commands", () => {
  const withCommand = encodePilotInput({
    held: new Set(),
    edges: new Set(),
    command: { op: PILOT_COMMANDS.deployReserve, arg: 2 },
  });

  it("schedules a command on exactly one tick", () => {
    const sampler = new LocalInputSampler(EDGE_MASK);
    sampler.sample(withCommand);
    sampler.sample(0);
    expect(decodePilotInput(sampler.held()).command).toBeUndefined();
    expect(decodePilotInput(sampler.take()).command?.arg).toBe(2);
    expect(decodePilotInput(sampler.take()).command).toBeUndefined();
  });
});
