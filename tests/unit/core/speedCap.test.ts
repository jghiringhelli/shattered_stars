/**
 * Speed cap per maneuver — the pure rule: the speed a ship flies a cycle is
 * min(set speed, the maneuver's allowed speed on its own dial).
 */

import { describe, it, expect } from "vitest";
import {
  dialSpeedTable,
  flownSpeed,
  maneuverSpeedCap,
  capGroupOf,
} from "../../../src/core/speedCap";
import type {
  ManeuverDefinition,
  ManeuverDirection,
} from "../../../src/core/types";
import {
  getShipDial,
  getShipsByRole,
  SHIP_DIALS,
} from "../../../src/data/ShipDefinitions";

const entry = (
  direction: ManeuverDirection,
  speed: number,
): ManeuverDefinition => ({ direction, speed, difficulty: "white" });

/** Fighter dial shape: straight 1-4, bank 1-3, turn 1-2, Snap at 3. */
const FIGHTER = [
  ...[1, 2, 3, 4].map((s) => entry("straight", s)),
  ...[1, 2, 3].flatMap((s) => [entry("bank_left", s), entry("bank_right", s)]),
  ...[1, 2].flatMap((s) => [entry("turn_left", s), entry("turn_right", s)]),
  entry("kturn", 3),
];

describe("capGroupOf", () => {
  it("maps drift to the bank entries and sides to one group", () => {
    expect(capGroupOf("drift_left")).toBe("bank");
    expect(capGroupOf("drift_right")).toBe("bank");
    expect(capGroupOf("bank_right")).toBe("bank");
    expect(capGroupOf("turn_left")).toBe("turn");
    expect(capGroupOf("segnor_right")).toBe("segnor");
    expect(capGroupOf("tallon_left")).toBe("tallon");
    expect(capGroupOf("kturn")).toBe("kturn");
    expect(capGroupOf("straight")).toBe("straight");
  });
});

describe("flownSpeed on a fighter dial", () => {
  const table = dialSpeedTable(FIGHTER);

  it("flies straight at the set speed", () => {
    for (const set of [1, 2, 3, 4])
      expect(flownSpeed(table, "straight", set)).toBe(set);
  });

  it("caps a bank at its highest dial speed", () => {
    expect(flownSpeed(table, "bank_left", 4)).toBe(3);
    expect(flownSpeed(table, "bank_right", 3)).toBe(3);
    expect(flownSpeed(table, "bank_left", 2)).toBe(2);
  });

  it("caps a turn at 2", () => {
    expect(flownSpeed(table, "turn_left", 4)).toBe(2);
    expect(flownSpeed(table, "turn_right", 3)).toBe(2);
    expect(flownSpeed(table, "turn_left", 1)).toBe(1);
  });

  it("flies a drift on the bank entries", () => {
    expect(flownSpeed(table, "drift_left", 4)).toBe(3);
    expect(flownSpeed(table, "drift_right", 2)).toBe(2);
  });

  it("uses the nearest allowed speed when nothing is at or below the set speed", () => {
    expect(flownSpeed(table, "kturn", 2)).toBe(3);
    expect(flownSpeed(table, "kturn", 1)).toBe(3);
    expect(flownSpeed(table, "kturn", 4)).toBe(3);
  });

  it("does not cap straight above the dial (upgrade notch)", () => {
    expect(flownSpeed(table, "straight", 5)).toBe(5);
  });

  it("never lifts a hover (set speed 0)", () => {
    expect(flownSpeed(table, "straight", 0)).toBe(0);
    expect(flownSpeed(table, "bank_left", 0)).toBe(0);
    expect(flownSpeed(table, "kturn", 0)).toBe(0);
  });

  it("caps non-straight maneuvers above the dial", () => {
    expect(flownSpeed(table, "bank_left", 5)).toBe(3);
  });
});

describe("flownSpeed with gaps and several speeds", () => {
  const dial = [
    entry("kturn", 2),
    entry("kturn", 4),
    entry("tallon_left", 3),
    entry("straight", 1),
    entry("straight", 3),
  ];
  const table = dialSpeedTable(dial);

  it("picks the highest dial speed at or below the set speed", () => {
    expect(flownSpeed(table, "kturn", 3)).toBe(2);
    expect(flownSpeed(table, "kturn", 5)).toBe(4);
    expect(flownSpeed(table, "straight", 2)).toBe(1);
  });

  it("takes the nearest above when all are above", () => {
    expect(flownSpeed(table, "tallon_left", 1)).toBe(3);
    expect(flownSpeed(table, "kturn", 1)).toBe(2);
  });

  it("leaves a maneuver absent from the dial at the set speed", () => {
    expect(flownSpeed(table, "bank_left", 4)).toBe(4);
    expect(maneuverSpeedCap(table, "bank_left")).toBeNull();
  });
});

describe("no table", () => {
  it("never caps", () => {
    expect(flownSpeed(undefined, "turn_left", 5)).toBe(5);
    expect(maneuverSpeedCap(undefined, "turn_left")).toBeNull();
  });
});

describe("maneuverSpeedCap", () => {
  it("is the highest dial speed of the maneuver", () => {
    const table = dialSpeedTable(FIGHTER);
    expect(maneuverSpeedCap(table, "bank_left")).toBe(3);
    expect(maneuverSpeedCap(table, "turn_right")).toBe(2);
    expect(maneuverSpeedCap(table, "kturn")).toBe(3);
    expect(maneuverSpeedCap(table, "drift_left")).toBe(3);
    expect(maneuverSpeedCap(table, "straight")).toBe(4);
  });
});

describe("real ship dials", () => {
  const dials = (role: string): ReadonlyArray<readonly ManeuverDefinition[]> =>
    getShipsByRole(role).map((s) => getShipDial(s.id));

  it("caps the turn of every interceptor, bomber, gunship and support at its dial", () => {
    for (const role of ["interceptor", "bomber", "gunship", "support"]) {
      for (const dial of dials(role)) {
        const table = dialSpeedTable(dial);
        const turns = dial
          .filter((m) => m.direction === "turn_left")
          .map((m) => m.speed);
        if (turns.length === 0) continue;
        expect(flownSpeed(table, "turn_left", 5)).toBe(Math.max(...turns));
        expect(maneuverSpeedCap(table, "turn_left")).toBe(Math.max(...turns));
      }
    }
  });

  it("never flies any maneuver above its dial cap or off the dial", () => {
    for (const dial of Object.values(SHIP_DIALS)) {
      const table = dialSpeedTable(dial);
      for (const m of dial) {
        const group = capGroupOf(m.direction);
        const speeds = dial
          .filter((d) => capGroupOf(d.direction) === group)
          .map((d) => d.speed);
        for (let set = 1; set <= 5; set++) {
          const flown = flownSpeed(table, m.direction, set);
          if (group === "straight" && set > Math.max(...speeds)) continue;
          expect(speeds).toContain(flown);
          if (set >= Math.min(...speeds))
            expect(flown).toBeLessThanOrEqual(set);
        }
      }
    }
  });

  it("is plain serialisable data", () => {
    const table = dialSpeedTable(FIGHTER);
    expect(JSON.parse(JSON.stringify(table))).toEqual(table);
  });
});
