import { describe, expect, it } from "vitest";
import {
  decodePilotInput,
  EDGE_ACTIONS,
  EDGE_MASK,
  encodePilotInput,
  HELD_ACTIONS,
  PILOT_COMMANDS,
} from "../../../src/net/input/PilotInputCodec";
import { INPUT_AI_CONTROL } from "../../../src/net/protocol";
import {
  normalizeServerUrl,
  resolveServerUrl,
  saveServerOverride,
  SERVER_OVERRIDE_KEY,
} from "../../../src/net/onlineConfig";
import { createMemoryStore } from "../../../src/systems/keyValueStore";

describe("PilotInputCodec", () => {
  it("packs buttons-only input into a single word", () => {
    const input = encodePilotInput({
      held: new Set(["STEER_LEFT"]),
      edges: new Set(["BOOST"]),
    });
    expect(typeof input).toBe("number");
    const decoded = decodePilotInput(input);
    expect([...decoded.held]).toEqual(["STEER_LEFT"]);
    expect([...decoded.edges]).toEqual(["BOOST"]);
    expect(decoded.aiControl).toBe(false);
  });

  it("round-trips every held action and press", () => {
    const decoded = decodePilotInput(
      encodePilotInput({
        held: new Set(HELD_ACTIONS),
        edges: new Set(EDGE_ACTIONS),
      }),
    );
    expect([...decoded.held]).toEqual([...HELD_ACTIONS]);
    expect([...decoded.edges]).toEqual([...EDGE_ACTIONS]);
  });

  it("keeps presses inside the edge mask and held actions outside it", () => {
    const pressOnly = encodePilotInput({
      held: new Set(),
      edges: new Set(EDGE_ACTIONS),
    }) as number;
    const heldOnly = encodePilotInput({
      held: new Set(HELD_ACTIONS),
      edges: new Set(),
    }) as number;
    expect(pressOnly & ~EDGE_MASK).toBe(0);
    expect(heldOnly & EDGE_MASK).toBe(0);
    expect(EDGE_MASK & INPUT_AI_CONTROL).toBe(0);
  });

  it("carries the gamepad roll buttons and the commander orders", () => {
    const presses = [
      "BARREL_ROLL_LEFT",
      "BARREL_ROLL_RIGHT",
      "COMMANDER_ORDER_1",
      "COMMANDER_ORDER_4",
    ] as const;
    const decoded = decodePilotInput(
      encodePilotInput({ held: new Set(), edges: new Set(presses) }),
    );
    expect([...decoded.edges]).toEqual([...presses]);
  });

  it("keeps every button below the relay's AI-control bit", () => {
    const all = encodePilotInput({
      held: new Set(HELD_ACTIONS),
      edges: new Set(EDGE_ACTIONS),
    }) as number;
    expect(all).toBeGreaterThan(0);
    expect(all).toBeLessThan(INPUT_AI_CONTROL);
  });

  it("carries turret aim to 1/65536 of a turn", () => {
    const decoded = decodePilotInput(
      encodePilotInput({ held: new Set(), edges: new Set(), aimRad: 1.234 }),
    );
    expect(decoded.aimRad).toBeCloseTo(1.234, 3);
  });

  it("carries a command and its argument", () => {
    const decoded = decodePilotInput(
      encodePilotInput({
        held: new Set(),
        edges: new Set(),
        command: { op: PILOT_COMMANDS.deployReserve, arg: 2 },
      }),
    );
    expect(decoded.command).toEqual({
      op: PILOT_COMMANDS.deployReserve,
      arg: 2,
    });
  });

  it("flags the relay's AI-control fill", () => {
    expect(decodePilotInput(INPUT_AI_CONTROL).aiControl).toBe(true);
  });
});

describe("server URL", () => {
  it("normalizes hosts and http(s) URLs to the relay WebSocket path", () => {
    expect(normalizeServerUrl("shattered-stars-relay.fly.dev")).toBe(
      "wss://shattered-stars-relay.fly.dev/ws",
    );
    expect(normalizeServerUrl("https://relay.onrender.com/")).toBe(
      "wss://relay.onrender.com/ws",
    );
    expect(normalizeServerUrl("http://localhost:8080")).toBe(
      "ws://localhost:8080/ws",
    );
    expect(normalizeServerUrl("ws://10.0.0.5:9000/custom/")).toBe(
      "ws://10.0.0.5:9000/custom",
    );
    expect(normalizeServerUrl("ftp://nope")).toBeNull();
    expect(normalizeServerUrl("  ")).toBeNull();
  });

  it("prefers the page query, then the settings override, then the build default", () => {
    const base = {
      query: null,
      override: null,
      buildDefault: undefined,
      isDev: false,
    };
    expect(resolveServerUrl({ ...base, buildDefault: "a.fly.dev" })).toEqual({
      url: "wss://a.fly.dev/ws",
      source: "build",
    });
    expect(
      resolveServerUrl({
        ...base,
        buildDefault: "a.fly.dev",
        override: "b.example",
      }).source,
    ).toBe("settings");
    expect(
      resolveServerUrl({ ...base, override: "b.example", query: "c.example" })
        .source,
    ).toBe("query");
  });

  it("falls back to the local relay only in dev builds", () => {
    const base = { query: null, override: null, buildDefault: undefined };
    expect(resolveServerUrl({ ...base, isDev: true }).source).toBe("dev");
    expect(resolveServerUrl({ ...base, isDev: false })).toEqual({
      url: null,
      source: "none",
    });
  });

  it("stores a valid override and clears it with an empty value", () => {
    const store = createMemoryStore();
    expect(saveServerOverride(store, "relay.example")).toBe(
      "wss://relay.example/ws",
    );
    expect(store.getItem(SERVER_OVERRIDE_KEY)).toBe("wss://relay.example/ws");
    saveServerOverride(store, "");
    expect(store.getItem(SERVER_OVERRIDE_KEY)).toBeNull();
  });
});
