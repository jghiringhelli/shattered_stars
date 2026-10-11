/**
 * Skirmish side panels — specification tests: clock tone, action readiness,
 * commander orders and the squad roster.
 */

import { describe, it, expect } from "vitest";
import {
  actionRows,
  CLOCK_DANGER_MS,
  CLOCK_WARNING_MS,
  commanderOrderRows,
  crewTitle,
  formatSeconds,
  matchClockTone,
  READY_LABEL,
  ROSTER_MAX_PIPS,
  rosterTeams,
} from "../../../../src/scenes/arcadeBattle/arcadeStatusModel";
import {
  createCommanderOrders,
  MAIN_BEAM_CHARGE_DURATION_MS,
  POWER_REDIRECT_COOLDOWN_MS,
  redirectPower,
} from "../../../../src/systems/ShipCrew";
import { HudShipBuilder } from "./hudShipBuilder";

describe("matchClockTone", () => {
  it("turns amber, then red, as time runs out", () => {
    expect(matchClockTone(CLOCK_WARNING_MS + 1)).toBe("normal");
    expect(matchClockTone(CLOCK_WARNING_MS)).toBe("warning");
    expect(matchClockTone(CLOCK_DANGER_MS)).toBe("danger");
  });
});

describe("formatSeconds", () => {
  it("shows tenths under ten seconds and whole seconds above", () => {
    expect(formatSeconds(1234)).toBe("1.2s");
    expect(formatSeconds(12_100)).toBe("13s");
    expect(formatSeconds(-50)).toBe("0.0s");
  });
});

describe("crewTitle", () => {
  it("names each crew role", () => {
    expect(crewTitle("pilot")).toBe("PILOT");
    expect(crewTitle("gunner")).toContain("GUNNER");
    expect(crewTitle("commander")).toContain("COMMANDER");
  });
});

describe("actionRows", () => {
  it("reports ready actions as READY", () => {
    const ship = HudShipBuilder.aPlayer().build();
    expect(
      actionRows(ship.control).every(
        (r) => r.ready && r.status === READY_LABEL,
      ),
    ).toBe(true);
  });

  it("counts down an action on cooldown", () => {
    const ship = HudShipBuilder.aPlayer()
      .withControl({ boostCooldown: 2500 })
      .build();
    const boost = actionRows(ship.control).find((r) => r.label === "BOOST")!;
    expect(boost).toMatchObject({ ready: false, status: "2.5s" });
  });
});

describe("commanderOrderRows", () => {
  it("lists the four orders on keys 1–4, all ready at the start", () => {
    const rows = commanderOrderRows(createCommanderOrders(), 1000);
    expect(rows.map((r) => r.key)).toEqual(["1", "2", "3", "4"]);
    expect(rows.every((r) => r.ready)).toBe(true);
  });

  it("shows the power focus and its cooldown after a redirect", () => {
    const orders = {
      ...createCommanderOrders(),
      powerRedirect: redirectPower("shields", 0),
      lastPowerRedirectAt: 0,
    };
    const power = commanderOrderRows(orders, 5000)[1]!;
    expect(power.label).toBe("POWER → SHIELDS");
    expect(power.ready).toBe(false);
    expect(power.status).toBe(
      `${Math.ceil((POWER_REDIRECT_COOLDOWN_MS - 5000) / 1000)}s`,
    );
  });

  it("shows main beam charge progress", () => {
    const orders = {
      ...createCommanderOrders(),
      mainBeam: { charging: true, chargeMs: MAIN_BEAM_CHARGE_DURATION_MS / 2 },
    };
    expect(commanderOrderRows(orders, 0)[2]!.status).toBe("50%");
  });
});

describe("rosterTeams", () => {
  it("puts the player's side first and keeps dead ships as empty pips", () => {
    const enemy = HudShipBuilder.anEnemy().withHull(0).build();
    const player = HudShipBuilder.aPlayer()
      .withHull(6, 12)
      .withShields(1, 4)
      .build();
    const teams = rosterTeams(
      [enemy, player],
      "free_confederation",
      "player_0",
    );
    expect(teams.map((t) => t.isPlayerSide)).toEqual([true, false]);
    expect(teams[0]!.pips[0]).toEqual({
      hullFraction: 0.5,
      shieldFraction: 0.25,
      alive: true,
      isPlayer: true,
    });
    expect(teams[1]!.pips[0]!.alive).toBe(false);
  });

  it("labels factions in plain words", () => {
    const teams = rosterTeams([HudShipBuilder.anEnemy().build()], "x", null);
    expect(teams[0]!.label).toBe("VOID CORSAIRS");
  });

  it("drops the oldest fallen ships past one line of pips (reinforcement battles)", () => {
    const fallen = Array.from({ length: ROSTER_MAX_PIPS }, (_, i) =>
      HudShipBuilder.anEnemy().withHull(0).build(),
    );
    const living = [1, 2, 3].map((i) => HudShipBuilder.anEnemy().build());
    const [team] = rosterTeams([...fallen, ...living], "x", null);
    expect(team!.pips).toHaveLength(ROSTER_MAX_PIPS);
    expect(team!.pips.filter((p) => p.alive)).toHaveLength(3);
  });

  it("keeps every living ship even past one line", () => {
    const living = Array.from({ length: ROSTER_MAX_PIPS + 2 }, (_, i) =>
      HudShipBuilder.anEnemy().build(),
    );
    const [team] = rosterTeams(
      [HudShipBuilder.anEnemy().withHull(0).build(), ...living],
      "x",
      null,
    );
    expect(team!.pips).toHaveLength(ROSTER_MAX_PIPS + 2);
    expect(team!.pips.every((p) => p.alive)).toBe(true);
  });
});
