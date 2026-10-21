import { describe, expect, it } from "vitest";
import type { MatchStart, TeamId } from "../../../src/net/protocol";
import { VirtualScheduler } from "../../../src/net/sim/VirtualScheduler";
import {
  MATCH_OVER_GRACE_MS,
  MatchRelay,
} from "../../../server/src/MatchRelay";

function harness(seatCount: number) {
  const start: MatchStart = {
    matchId: "m",
    seed: 1,
    mode: "skirmish",
    options: {},
    mapTheme: "t",
    pointLimit: 200,
    inputDelay: 0,
    authoritySeat: 0,
    seats: Array.from({ length: seatCount }, (_, seat) => ({
      seat,
      playerId: `p${seat}`,
      name: `P${seat}`,
      team: (seat % 2) as 0 | 1,
      loadout: { faction: "f", ships: ["s"] },
    })),
  };
  const clock = new VirtualScheduler();
  const ended: Array<{ reason: string; winner: TeamId | null }> = [];
  const relay = new MatchRelay(
    start,
    clock,
    { loadTimeoutMs: 30_000, reconnectWindowMs: 30_000 },
    { sendToSeat: () => undefined, onEnded: (reason, winner) => ended.push({ reason, winner }) },
  );
  for (let seat = 0; seat < seatCount; seat++) relay.loaded(seat);
  const agreeOnState = (): void => {
    for (let seat = 0; seat < seatCount; seat++) relay.hash(seat, 30, 7);
  };
  return { clock, ended, relay, agreeOnState };
}

describe("MatchRelay result integrity", () => {
  it("does not let a lone report decide while another connected seat stays silent", () => {
    const h = harness(2);
    h.relay.matchOver(1, 0);
    h.clock.advance(MATCH_OVER_GRACE_MS);
    expect(h.ended).toEqual([{ reason: "abandoned", winner: null }]);
  });

  it("does not let a lone report decide when two others are silent", () => {
    const h = harness(3);
    h.relay.matchOver(0, 1);
    h.clock.advance(MATCH_OVER_GRACE_MS);
    expect(h.ended).toEqual([{ reason: "abandoned", winner: null }]);
  });

  it("ends as soon as every connected seat reported the same winner", () => {
    const h = harness(2);
    h.relay.matchOver(0, 1);
    h.relay.matchOver(1, 1);
    expect(h.ended).toEqual([{ reason: "finished", winner: 1 }]);
  });

  it("accepts a strict majority of connected seats over a dissenter", () => {
    const h = harness(3);
    h.relay.matchOver(0, 1);
    h.relay.matchOver(1, 0);
    h.relay.matchOver(2, 0);
    expect(h.ended).toEqual([{ reason: "finished", winner: 0 }]);
  });

  it("accepts a majority reached after the grace period", () => {
    const h = harness(3);
    h.relay.matchOver(1, 0);
    h.relay.matchOver(2, 0);
    h.clock.advance(MATCH_OVER_GRACE_MS);
    expect(h.ended).toEqual([{ reason: "finished", winner: 0 }]);
  });

  it("counts only connected seats: the one seat left decides", () => {
    const h = harness(2);
    h.relay.disconnect(1);
    h.relay.matchOver(0, 1);
    expect(h.ended).toEqual([{ reason: "finished", winner: 1 }]);
  });

  it("does not count a disconnected seat's silence against the others", () => {
    const h = harness(3);
    h.relay.disconnect(2);
    h.relay.matchOver(0, 1);
    h.relay.matchOver(1, 1);
    expect(h.ended).toEqual([{ reason: "finished", winner: 1 }]);
  });

  it("settles a tie with the authority's report when the seats' hashes agreed", () => {
    const h = harness(2);
    h.agreeOnState();
    h.relay.matchOver(1, 0);
    h.relay.matchOver(0, 1);
    expect(h.ended).toEqual([{ reason: "finished", winner: 1 }]);
  });

  it("settles a 2-2 split with the authority's report when the hashes agreed", () => {
    const h = harness(4);
    h.agreeOnState();
    [0, 1, 2, 3].forEach((seat) => h.relay.matchOver(seat, seat < 2 ? 1 : 0));
    expect(h.ended).toEqual([{ reason: "finished", winner: 1 }]);
  });

  it("abandons a tie when no agreed state hash backs the authority", () => {
    const h = harness(2);
    h.relay.matchOver(1, 0);
    h.relay.matchOver(0, 1);
    expect(h.ended).toEqual([{ reason: "abandoned", winner: null }]);
  });

  it("abandons a tie when the latest hashes disagreed", () => {
    const h = harness(2);
    h.agreeOnState();
    h.relay.hash(0, 60, 1);
    h.relay.hash(1, 60, 2);
    h.relay.matchOver(1, 0);
    h.relay.matchOver(0, 1);
    expect(h.ended).toEqual([{ reason: "abandoned", winner: null }]);
  });

  it("abandons a tie when the authority did not report", () => {
    const h = harness(4);
    h.agreeOnState();
    [1, 2, 3].forEach((seat) => h.relay.matchOver(seat, seat === 1 ? 1 : 0));
    h.clock.advance(MATCH_OVER_GRACE_MS);
    expect(h.ended).toEqual([{ reason: "abandoned", winner: null }]);
  });
});
