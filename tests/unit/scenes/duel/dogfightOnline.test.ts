import { describe, expect, it } from "vitest";
import { DogfightOnline } from "../../../../src/scenes/duel/online/DogfightOnline";
import type { OnlineDogfightInit } from "../../../../src/net/lobby/matchSetup";
import {
  encodePilotInput,
  type EdgeAction,
} from "../../../../src/net/input/PilotInputCodec";
import { INPUT_AI_CONTROL } from "../../../../src/net/protocol";

const INIT: OnlineDogfightInit = {
  online: {
    matchId: "m1",
    localSeat: 1,
    seatCount: 2,
    authoritySeat: 0,
    inputDelay: 4,
  },
  seed: 42,
  seats: [
    {
      seat: 0,
      name: "A",
      team: 0,
      faction: "void_corsairs",
      shipId: "corsair_raider",
    },
    {
      seat: 1,
      name: "B",
      team: 1,
      faction: "terran_hegemony",
      shipId: "terran_viper",
    },
  ],
};

const press = (...edges: EdgeAction[]): number =>
  encodePilotInput({ held: new Set(), edges: new Set(edges) }) as number;

describe("DogfightOnline", () => {
  it("maps seats to the duel's canonical sides and ship ids", () => {
    const online = new DogfightOnline(INIT);
    expect(online.shipIdOf(0)).toBe("player_0");
    expect(online.shipIdOf(1)).toBe("ai_0");
    expect(online.localSide).toBe("ai");
    expect(online.localShipId).toBe("ai_0");
    expect(online.seatOf("player_0")).toBe(0);
    expect(online.seatOf("nobody")).toBe(-1);
  });

  it("flies a seat by its human input unless the relay hands it to the AI", () => {
    const online = new DogfightOnline(INIT);
    online.feed([0, INPUT_AI_CONTROL]);
    expect(online.isHumanFlown("player_0")).toBe(true);
    expect(online.isHumanFlown("ai_0")).toBe(false);
  });

  it("delivers a seat's MARK_TARGET to that seat's pilot only", () => {
    const online = new DogfightOnline(INIT);
    online.feed([press("MARK_TARGET"), 0]);
    expect(online.pilotFor("ai_0")?.takeMarkRequest()).toBe(false);
    expect(online.pilotFor("player_0")?.takeMarkRequest()).toBe(true);
  });

  it("runs round-flow timers on the simulation clock, in order", () => {
    const online = new DogfightOnline(INIT);
    online.nowMs = 1000;
    online.schedule(2000, "next_round");
    online.schedule(1500, "round_live");
    online.nowMs = 2499;
    expect(online.takeDue()).toEqual([]);
    online.nowMs = 3000;
    expect(online.takeDue()).toEqual(["round_live", "next_round"]);
    expect(online.takeDue()).toEqual([]);
  });

  it("reports the winner by team and shows the result from the local seat", () => {
    const online = new DogfightOnline(INIT);
    expect(online.winnerTeam("player_win")).toBe(0);
    expect(online.winnerTeam("enemy_win")).toBe(1);
    expect(online.winnerTeam("draw")).toBeNull();
    expect(online.localResult("player_win")).toBe("enemy_win");
    expect(online.localResult("draw")).toBe("draw");
  });

  it("seeds a saveable RNG from the match seed", () => {
    const a = new DogfightOnline(INIT);
    const b = new DogfightOnline(INIT);
    expect(a.rng.next()).toBe(b.rng.next());
  });
});
