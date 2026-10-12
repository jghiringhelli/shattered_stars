import { describe, expect, it } from "vitest";
import {
  SALVAGE_PICKUP_RADIUS_PX,
  SALVAGE_REPICKUP_COOLDOWN_MS,
  cratesCarriedBy,
  createCrates,
  stepSalvage,
  type SalvageCrate,
} from "../../../../src/arcade/scenarios";
import { aFrame, aShip } from "./scenarioBuilders";

const loose = (): SalvageCrate[] => createCrates([{ x: 0, y: 0, label: "1" }]);

function carried(
  by: string,
  side: "player" | "enemy" = "player",
): SalvageCrate[] {
  return loose().map((c) => ({ ...c, carrierId: by, carrierSide: side }));
}

describe("salvage pick-up", () => {
  it("never hands an exact tie between the sides to whoever is listed first or last", () => {
    for (const order of [
      ["p", "e"],
      ["e", "p"],
    ]) {
      const ships = order.map((id) =>
        aShip({
          id,
          side: id === "p" ? "player" : "enemy",
          x: 0,
          y: id === "p" ? 40 : -40,
        }),
      );
      const { crates } = stepSalvage({
        crates: loose(),
        cooldowns: new Map(),
        frame: aFrame(ships),
        nowMs: 0,
      });
      expect(crates[0]!.carrierId).toBeNull();
    }
  });

  it("gives an exact tie to the side carrying fewer crates", () => {
    const crates: SalvageCrate[] = [
      ...createCrates([{ x: 0, y: 0, label: "1" }]),
      {
        ...createCrates([{ x: 900, y: 0, label: "2" }])[0]!,
        id: "crate_held",
        carrierId: "p2",
        carrierSide: "player",
      },
    ];
    const result = stepSalvage({
      crates,
      cooldowns: new Map(),
      frame: aFrame([
        aShip({ id: "p", side: "player", x: 0, y: 40 }),
        aShip({ id: "e", side: "enemy", x: 0, y: -40 }),
        aShip({ id: "p2", side: "player", x: 900, y: 0 }),
      ]),
      nowMs: 0,
    });
    expect(result.crates[0]!.carrierSide).toBe("enemy");
  });

  it("an unstressed ship at range 0 picks the crate up", () => {
    const { crates } = stepSalvage({
      crates: loose(),
      cooldowns: new Map(),
      frame: aFrame([aShip({ id: "p", x: SALVAGE_PICKUP_RADIUS_PX - 1 })]),
      nowMs: 0,
    });
    expect(crates[0]!.carrierId).toBe("p");
    expect(crates[0]!.carrierSide).toBe("player");
  });

  it("an enemy ship can pick a crate up too", () => {
    const { crates } = stepSalvage({
      crates: loose(),
      cooldowns: new Map(),
      frame: aFrame([aShip({ id: "e", side: "enemy" })]),
      nowMs: 0,
    });
    expect(crates[0]!.carrierSide).toBe("enemy");
  });

  it("a stressed ship cannot pick a crate up", () => {
    const { crates } = stepSalvage({
      crates: loose(),
      cooldowns: new Map(),
      frame: aFrame([aShip({ stressed: true })]),
      nowMs: 0,
    });
    expect(crates[0]!.carrierId).toBeNull();
  });

  it("a ship beyond range 0 cannot pick a crate up", () => {
    const { crates } = stepSalvage({
      crates: loose(),
      cooldowns: new Map(),
      frame: aFrame([aShip({ x: SALVAGE_PICKUP_RADIUS_PX + 1 })]),
      nowMs: 0,
    });
    expect(crates[0]!.carrierId).toBeNull();
  });

  it("a ship already carrying cannot pick up a second crate", () => {
    const crates: SalvageCrate[] = createCrates([
      { x: 0, y: 0, label: "1" },
      { x: 10, y: 0, label: "2" },
    ]);
    const result = stepSalvage({
      crates,
      cooldowns: new Map(),
      frame: aFrame([aShip({ id: "p" })]),
      nowMs: 0,
    });
    expect(result.crates.filter((c) => c.carrierId === "p")).toHaveLength(1);
  });

  it("the nearest eligible ship gets the crate", () => {
    const { crates } = stepSalvage({
      crates: loose(),
      cooldowns: new Map(),
      frame: aFrame([
        aShip({ id: "far", x: 50 }),
        aShip({ id: "near", side: "enemy", x: 10 }),
      ]),
      nowMs: 0,
    });
    expect(crates[0]!.carrierId).toBe("near");
  });
});

describe("salvage carry and drop", () => {
  it("a carried crate follows its carrier", () => {
    const { crates } = stepSalvage({
      crates: carried("p"),
      cooldowns: new Map(),
      frame: aFrame([aShip({ id: "p", x: 900, y: 300 })]),
      nowMs: 0,
    });
    expect(crates[0]).toMatchObject({ x: 900, y: 300, carrierId: "p" });
  });

  it("a boost or barrel roll drops the crate where the action started", () => {
    const result = stepSalvage({
      crates: carried("p"),
      cooldowns: new Map(),
      frame: aFrame(
        [aShip({ id: "p", x: 160, y: 0 })],
        [{ kind: "evasive", shipId: "p", x: 100, y: 0 }],
      ),
      nowMs: 1000,
    });
    expect(result.crates[0]).toMatchObject({
      x: 100,
      y: 0,
      carrierId: null,
      carrierSide: null,
    });
  });

  it("the ship that dropped a crate cannot pick it straight back up", () => {
    const dropped = stepSalvage({
      crates: carried("p"),
      cooldowns: new Map(),
      frame: aFrame(
        [aShip({ id: "p", x: 10 })],
        [{ kind: "evasive", shipId: "p", x: 0, y: 0 }],
      ),
      nowMs: 1000,
    });
    const next = stepSalvage({
      ...dropped,
      frame: aFrame([aShip({ id: "p", x: 10 })]),
      nowMs: 1000 + SALVAGE_REPICKUP_COOLDOWN_MS - 1,
    });
    expect(next.crates[0]!.carrierId).toBeNull();
    const later = stepSalvage({
      ...next,
      frame: aFrame([aShip({ id: "p", x: 10 })]),
      nowMs: 1000 + SALVAGE_REPICKUP_COOLDOWN_MS,
    });
    expect(later.crates[0]!.carrierId).toBe("p");
  });

  it("a destroyed carrier drops the crate at its wreck", () => {
    const { crates } = stepSalvage({
      crates: carried("p"),
      cooldowns: new Map(),
      frame: aFrame(
        [],
        [
          {
            kind: "destroyed",
            shipId: "p",
            side: "player",
            value: 4,
            x: 700,
            y: 50,
          },
        ],
      ),
      nowMs: 0,
    });
    expect(crates[0]).toMatchObject({ x: 700, y: 50, carrierId: null });
  });

  it("an enemy at the wreck picks the dropped crate up", () => {
    const { crates } = stepSalvage({
      crates: carried("p"),
      cooldowns: new Map(),
      frame: aFrame(
        [aShip({ id: "e", side: "enemy", x: 700, y: 50 })],
        [
          {
            kind: "destroyed",
            shipId: "p",
            side: "player",
            value: 4,
            x: 700,
            y: 50,
          },
        ],
      ),
      nowMs: 0,
    });
    expect(crates[0]!.carrierId).toBe("e");
  });

  it("counts the crates each side carries", () => {
    const crates: SalvageCrate[] = [
      ...carried("p"),
      { ...carried("e", "enemy")[0]!, id: "c2" },
      { ...loose()[0]!, id: "c3" },
    ];
    expect(cratesCarriedBy(crates, "player")).toBe(1);
    expect(cratesCarriedBy(crates, "enemy")).toBe(1);
  });
});
