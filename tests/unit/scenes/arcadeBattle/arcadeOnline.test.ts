import { describe, expect, it } from "vitest";
import {
  ArcadeOnline,
  readOnlineBattle,
} from "../../../../src/scenes/arcadeBattle/online/ArcadeOnline";
import { encodePilotInput } from "../../../../src/net/input/PilotInputCodec";
import { INPUT_AI_CONTROL } from "../../../../src/net/protocol";

const CONFIG = {
  seed: 7,
  online: {
    matchId: "m",
    localSeat: 1,
    seatCount: 2,
    authoritySeat: 0,
    inputDelay: 4,
  },
  factions: [
    {
      factionId: "terran_hegemony",
      controller: "remote",
      ships: ["terran_viper"],
      teamId: "team_0",
      seat: 0,
    },
    {
      factionId: "void_corsairs",
      controller: "player",
      ships: ["corsair_raider", "corsair_raider"],
      teamId: "team_1",
      seat: 1,
    },
  ],
};

describe("readOnlineBattle", () => {
  it("reads the online context and the seats in canonical order", () => {
    const battle = readOnlineBattle(CONFIG)!;
    expect(battle.seed).toBe(7);
    expect(battle.localSeat).toBe(1);
    expect(battle.seats.map((s) => s.faction)).toEqual([
      "terran_hegemony",
      "void_corsairs",
    ]);
    expect(battle.seats.map((s) => s.team)).toEqual([0, 1]);
  });

  it("is null for a local battle", () => {
    expect(readOnlineBattle({ factions: [] })).toBeNull();
    expect(readOnlineBattle(undefined)).toBeNull();
  });
});

describe("ArcadeOnline", () => {
  const make = () => new ArcadeOnline(readOnlineBattle(CONFIG)!);

  it("flies seat ships by human input until the relay hands a seat to the AI", () => {
    const online = make();
    online.assignShip(0, "player_0");
    online.assignShip(1, "enemy_0");
    online.feed([0, 0]);
    expect(online.isHumanFlown("enemy_0")).toBe(true);
    expect(online.isHumanFlown("enemy_1")).toBe(false);
    online.feed([0, INPUT_AI_CONTROL]);
    expect(online.isHumanFlown("enemy_0")).toBe(false);
    expect(online.isHumanFlown("player_0")).toBe(true);
  });

  it("hands a seat whose ship is lost the next ship its faction deploys", () => {
    const online = make();
    online.assignShip(1, "enemy_0");
    const alive = new Set(["enemy_0"]);
    expect(
      online.claimReinforcement("enemy_5", "void_corsairs", (id) =>
        alive.has(id),
      ),
    ).toBe(-1);
    alive.delete("enemy_0");
    expect(
      online.claimReinforcement("enemy_5", "terran_hegemony", (id) =>
        alive.has(id),
      ),
    ).toBe(-1);
    expect(
      online.claimReinforcement("enemy_5", "void_corsairs", (id) =>
        alive.has(id),
      ),
    ).toBe(1);
    expect(online.shipOf(1)).toBe("enemy_5");
  });

  it("keeps each seat's flight memory apart", () => {
    const online = make();
    online.assignShip(0, "player_0");
    online.assignShip(1, "enemy_0");
    const steering = encodePilotInput({
      held: new Set(["STEER_LEFT"]),
      edges: new Set(["KTURN"]),
    });
    online.feed([0, steering]);
    expect(online.keysOf(1)!.held("STEER_LEFT")).toBe(true);
    expect(online.keysOf(0)!.held("STEER_LEFT")).toBe(false);
    expect(online.keysOf(1)!.consume("KTURN")).toBe(true);
    expect(online.keysOf(1)!.consume("KTURN")).toBe(false);
  });

  it("reports results by team and shows them from the local seat", () => {
    const online = make();
    expect(online.winnerTeam(true)).toBe(0);
    expect(online.winnerTeam(false)).toBe(1);
    expect(online.winnerTeam(null)).toBeNull();
    expect(online.localVictory(false)).toBe(true);
    expect(online.localVictory(true)).toBe(false);
  });

  it("seeds the bot fleet from the match seed, as a local battle would", () => {
    const a = make();
    const b = make();
    expect(a.fleetRng.next()).toBe(b.fleetRng.next());
    expect(a.combatRng.getSeed()).not.toBe(a.fleetRng.getSeed());
  });
});
