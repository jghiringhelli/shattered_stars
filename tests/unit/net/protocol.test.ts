import { describe, expect, it } from "vitest";
import {
  decodeClientMessage,
  decodeServerMessage,
  encodeMessage,
  isRoomCode,
  MODE_RULES,
  NET_LIMITS,
  normalizeRoomCode,
  validateClientMessage,
} from "../../../src/net/protocol";

const hello = { t: "hello", protocol: 1, build: "0.1.0", name: "Ace" };

describe("validateClientMessage", () => {
  it("accepts a well-formed hello", () => {
    expect(validateClientMessage(hello)).toEqual({ ok: true, value: hello });
  });

  it("strips control characters and caps display names", () => {
    const result = validateClientMessage({
      ...hello,
      name: "\u0007Red\nLeader-with-a-very-long-name",
    });
    expect(result.ok && result.value.t === "hello" && result.value.name).toBe(
      "RedLeader-with-a-ver".slice(0, NET_LIMITS.nameMaxLength),
    );
  });

  it("falls back to a default name when the name is blank", () => {
    const result = validateClientMessage({ ...hello, name: "   " });
    expect(result.ok && result.value.t === "hello" && result.value.name).toBe(
      "Pilot",
    );
  });

  it("rejects unknown types, non-objects and missing types", () => {
    expect(validateClientMessage({ t: "drop_tables" }).ok).toBe(false);
    expect(validateClientMessage([hello]).ok).toBe(false);
    expect(validateClientMessage({ protocol: 1 }).ok).toBe(false);
  });

  it("rejects a hello without a numeric protocol", () => {
    expect(validateClientMessage({ ...hello, protocol: "1" }).ok).toBe(false);
  });

  it("normalizes room codes and rejects ambiguous characters", () => {
    expect(validateClientMessage({ t: "join_room", code: " abc de " })).toEqual(
      {
        ok: true,
        value: { t: "join_room", code: "ABCDE" },
      },
    );
    expect(validateClientMessage({ t: "join_room", code: "ABCD0" }).ok).toBe(
      false,
    );
    expect(validateClientMessage({ t: "join_room", code: "ABC" }).ok).toBe(
      false,
    );
  });

  it("accepts loadouts of snake_case ids and rejects anything else", () => {
    const loadout = { faction: "void_corsairs", ships: ["corsair_raider"] };
    expect(validateClientMessage({ t: "set_loadout", loadout }).ok).toBe(true);
    expect(
      validateClientMessage({
        t: "set_loadout",
        loadout: { ...loadout, ships: [] },
      }).ok,
    ).toBe(false);
    expect(
      validateClientMessage({
        t: "set_loadout",
        loadout: { ...loadout, ships: ["<script>"] },
      }).ok,
    ).toBe(false);
    const tooMany = Array.from(
      { length: NET_LIMITS.maxShipsPerLoadout + 1 },
      () => "x",
    );
    expect(
      validateClientMessage({
        t: "set_loadout",
        loadout: { ...loadout, ships: tooMany },
      }).ok,
    ).toBe(false);
  });

  it("accepts input batches of words and word arrays", () => {
    const message = {
      t: "in",
      from: 10,
      inputs: [0, 5, [1, 2, 3]],
      at: 7,
      ack: [11, 3],
    };
    expect(validateClientMessage(message)).toEqual({
      ok: true,
      value: message,
    });
  });

  it("rejects input batches with fractional words, oversized words or too many frames", () => {
    const base = { t: "in", from: 0, at: 0, ack: [0, 0] };
    expect(validateClientMessage({ ...base, inputs: [1.5] }).ok).toBe(false);
    expect(
      validateClientMessage({ ...base, inputs: [[1, 2, 3, 4, 5]] }).ok,
    ).toBe(false);
    expect(validateClientMessage({ ...base, inputs: [[]] }).ok).toBe(false);
    const flood = new Array(NET_LIMITS.maxInputFramesPerMessage + 1).fill(0);
    expect(validateClientMessage({ ...base, inputs: flood }).ok).toBe(false);
    expect(validateClientMessage({ ...base, from: -1, inputs: [0] }).ok).toBe(
      false,
    );
  });

  it("rejects hashes outside the unsigned 32-bit range", () => {
    expect(
      validateClientMessage({ t: "hash", tick: 30, hash: 0xffffffff }).ok,
    ).toBe(true);
    expect(
      validateClientMessage({ t: "hash", tick: 30, hash: 0x100000000 }).ok,
    ).toBe(false);
  });

  it("caps snapshot size", () => {
    const data = "x".repeat(NET_LIMITS.maxSnapshotChars + 1);
    expect(validateClientMessage({ t: "snapshot", tick: 1, data }).ok).toBe(
      false,
    );
  });

  it("accepts match_over with a winning team or a draw", () => {
    expect(
      validateClientMessage({ t: "match_over", tick: 9, winnerTeam: 1 }).ok,
    ).toBe(true);
    expect(
      validateClientMessage({ t: "match_over", tick: 9, winnerTeam: null }).ok,
    ).toBe(true);
    expect(
      validateClientMessage({ t: "match_over", tick: 9, winnerTeam: 2 }).ok,
    ).toBe(false);
  });

  it("rejects modes the relay does not host", () => {
    expect(
      validateClientMessage({ t: "quick_match", mode: "campaign" }).ok,
    ).toBe(false);
    expect(
      validateClientMessage({ t: "create_room", mode: "skirmish" }).ok,
    ).toBe(true);
  });
});

describe("codec", () => {
  it("round-trips a client message through the wire format", () => {
    const decoded = decodeClientMessage(
      encodeMessage({ t: "set_ready", ready: true }),
    );
    expect(decoded).toEqual({
      ok: true,
      value: { t: "set_ready", ready: true },
    });
  });

  it("rejects invalid JSON and oversized frames", () => {
    expect(decodeClientMessage("{not json").ok).toBe(false);
    expect(
      decodeClientMessage(" ".repeat(NET_LIMITS.maxMessageBytes + 1)).ok,
    ).toBe(false);
  });

  it("decodes known server messages and drops unknown ones", () => {
    expect(decodeServerMessage('{"t":"go","serverTime":5}')).toEqual({
      t: "go",
      serverTime: 5,
    });
    expect(decodeServerMessage('{"t":"evil"}')).toBeNull();
    expect(decodeServerMessage("[]")).toBeNull();
  });
});

describe("room codes and modes", () => {
  it("validates normalized codes", () => {
    expect(isRoomCode(normalizeRoomCode("k7q2x"))).toBe(true);
    expect(isRoomCode("K7Q2")).toBe(false);
  });

  it("seats dogfight 1v1 with exactly one ship each", () => {
    expect(MODE_RULES.dogfight).toMatchObject({
      minPlayers: 2,
      maxPlayers: 2,
      minShips: 1,
      maxShips: 1,
    });
  });

  it("lets skirmish seat 2v2 teams", () => {
    expect(MODE_RULES.skirmish).toMatchObject({ maxPlayers: 4, teams: true });
  });
});
