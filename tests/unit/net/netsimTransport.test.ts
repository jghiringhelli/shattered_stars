import { describe, expect, it } from "vitest";
import {
  netsimTransport,
  parseNetsim,
} from "../../../src/net/transport/NetsimTransport";
import type {
  TransportFactory,
  TransportHandlers,
} from "../../../src/net/transport/Transport";
import { VirtualScheduler } from "../../../src/net/sim/VirtualScheduler";

describe("parseNetsim", () => {
  it("reads latency, jitter and loss from the query value", () => {
    expect(parseNetsim("40,10,0.02")).toEqual({
      latencyMs: 40,
      jitterMs: 10,
      lossRate: 0.02,
      lossMode: "retransmit",
    });
    expect(parseNetsim("25")).toMatchObject({ latencyMs: 25, jitterMs: 0 });
  });

  it("ignores missing or malformed values", () => {
    expect(parseNetsim(null)).toBeNull();
    expect(parseNetsim("fast")).toBeNull();
    expect(parseNetsim("-5")).toBeNull();
  });
});

describe("netsimTransport", () => {
  function fakeSocket() {
    const sent: string[] = [];
    let handlers: TransportHandlers | null = null;
    const base: TransportFactory = (_url, h) => {
      handlers = h;
      return { send: (text) => sent.push(text), close: () => undefined };
    };
    return { base, sent, server: () => handlers! };
  }

  it("delays both directions by the one-way latency, in order", () => {
    const clock = new VirtualScheduler();
    const socket = fakeSocket();
    const received: string[] = [];
    const factory = netsimTransport(socket.base, {
      scheduler: clock,
      conditions: parseNetsim("30")!,
      random: () => 0.5,
    });
    const transport = factory("ws://x", {
      onOpen: () => undefined,
      onMessage: (text) => received.push(text),
      onClose: () => undefined,
    });
    transport.send("up-1");
    transport.send("up-2");
    socket.server().onMessage("down-1");
    clock.advance(29);
    expect(socket.sent).toEqual([]);
    expect(received).toEqual([]);
    clock.advance(1);
    expect(socket.sent).toEqual(["up-1", "up-2"]);
    expect(received).toEqual(["down-1"]);
  });

  it("delivers nothing in flight after the socket closes", () => {
    const clock = new VirtualScheduler();
    const socket = fakeSocket();
    const received: string[] = [];
    let closed = 0;
    const factory = netsimTransport(socket.base, {
      scheduler: clock,
      conditions: parseNetsim("30")!,
      random: () => 0.5,
    });
    factory("ws://x", {
      onOpen: () => undefined,
      onMessage: (text) => received.push(text),
      onClose: () => closed++,
    });
    socket.server().onMessage("late");
    socket.server().onClose(1006, "");
    clock.advance(100);
    expect(received).toEqual([]);
    expect(closed).toBe(1);
  });
});
