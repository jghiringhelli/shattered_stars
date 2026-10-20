import { describe, expect, it } from "vitest";
import type { MatchStart, ServerMessage } from "../../../src/net/protocol";
import { VirtualScheduler } from "../../../src/net/sim/VirtualScheduler";
import {
  MatchRelay,
  RESYNC_COOLDOWN_MS,
  RESYNC_MAX_ATTEMPTS,
  RESYNC_TIMEOUT_MS,
} from "../../../server/src/MatchRelay";

const seatView = (seat: number) => ({
  seat,
  playerId: `p${seat}`,
  name: `P${seat}`,
  team: (seat % 2) as 0 | 1,
  loadout: { faction: "f", ships: ["s"] },
});

function harness(seatCount = 2) {
  const start: MatchStart = {
    matchId: "m",
    seed: 1,
    mode: "skirmish",
    options: {},
    mapTheme: "t",
    pointLimit: 200,
    inputDelay: 0,
    authoritySeat: 0,
    seats: Array.from({ length: seatCount }, (_, i) => seatView(i)),
  };
  const clock = new VirtualScheduler();
  const outbox: Array<{ seat: number; message: ServerMessage }> = [];
  const ended: Array<{ reason: string; winner: number | null }> = [];
  const relay = new MatchRelay(
    start,
    clock,
    { loadTimeoutMs: 30_000, reconnectWindowMs: 30_000 },
    {
      sendToSeat: (seat, message) => outbox.push({ seat, message }),
      onEnded: (reason, winner) => ended.push({ reason, winner }),
    },
  );
  for (let seat = 0; seat < seatCount; seat++) relay.loaded(seat);
  const to = <T extends ServerMessage["t"]>(seat: number, type: T) =>
    outbox
      .filter((o) => o.seat === seat && o.message.t === type)
      .map((o) => o.message as Extract<ServerMessage, { t: T }>);
  return { clock, outbox, ended, relay, to };
}

describe("MatchRelay hardening", () => {
  it("ignores a repeated loaded from a seat that is already in the match", () => {
    const h = harness();
    h.relay.loaded(1);
    h.relay.loaded(1);
    expect(h.to(0, "snapshot_request")).toHaveLength(0);
    expect(h.to(1, "resync")).toHaveLength(0);
    expect(h.to(1, "go")).toHaveLength(1);
  });

  it("does not start another resync inside the cooldown after a desync", () => {
    const h = harness();
    h.relay.hash(0, 30, 1);
    h.relay.hash(1, 30, 2);
    const first = h.to(0, "snapshot_request").at(-1)!;
    h.relay.snapshot(0, first.tick, "s");
    h.relay.hash(0, 90, 1);
    h.relay.hash(1, 90, 2);
    expect(h.to(0, "snapshot_request")).toHaveLength(1);
    h.clock.advance(RESYNC_COOLDOWN_MS);
    h.relay.hash(0, 150, 1);
    h.relay.hash(1, 150, 2);
    expect(h.to(0, "snapshot_request")).toHaveLength(2);
  });

  it("asks another seat for the snapshot when the authority never answers", () => {
    const h = harness(3);
    h.relay.hash(0, 30, 1);
    h.relay.hash(1, 30, 1);
    h.relay.hash(2, 30, 2);
    expect(h.to(0, "snapshot_request")).toHaveLength(1);
    h.clock.advance(RESYNC_TIMEOUT_MS);
    expect(h.relay.authority).toBe(1);
    expect(h.to(2, "authority").at(-1)?.seat).toBe(1);
    const request = h.to(1, "snapshot_request").at(-1);
    expect(request).toBeDefined();
    h.relay.snapshot(1, request!.tick, "from seat 1");
    expect(h.to(2, "snapshot").map((m) => m.data)).toEqual(["from seat 1"]);
    h.clock.advance(RESYNC_TIMEOUT_MS * RESYNC_MAX_ATTEMPTS);
    expect(h.ended).toEqual([]);
  });

  it("abandons the match when a resync can never be answered", () => {
    const h = harness();
    h.relay.hash(0, 30, 1);
    h.relay.hash(1, 30, 2);
    h.clock.advance(RESYNC_TIMEOUT_MS * RESYNC_MAX_ATTEMPTS);
    expect(h.ended).toEqual([{ reason: "abandoned", winner: null }]);
  });

  it("takes the winner most seats report, not the authority's lone claim", () => {
    const h = harness(3);
    h.relay.matchOver(0, 1);
    h.relay.matchOver(1, 0);
    h.relay.matchOver(2, 0);
    expect(h.ended).toEqual([{ reason: "finished", winner: 0 }]);
  });
});
