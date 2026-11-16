/**
 * Disengage — specification tests of the disengage reward: an ace that was
 * under an enemy's guns and gets clear (out of arc, range opened) or shakes
 * an enemy mark earns evasion and a boost refund, once per cooldown.
 */

import { describe, expect, it } from "vitest";
import {
  createAceStrikeBook,
  enlistAce,
  isEvading,
} from "../../../../src/arcade/systems/AceStrike";
import {
  refundBoost,
  updateDisengage,
  type DisengageShip,
} from "../../../../src/arcade/systems/Disengage";
import { placeMark } from "../../../../src/arcade/systems/SquadMark";
import {
  DISENGAGE_BOOST_REFUND,
  DISENGAGE_EVADE_MS,
  DISENGAGE_MIN_RANGE_PX,
  DISENGAGE_REWARD_COOLDOWN_MS,
} from "../../../../src/data/aceConfig";
import { NO_SQUAD_MARKS } from "../../../../src/arcade/systems/SquadMark";

const WORLD = 6000;
const FIRING = { firingArcDeg: 90, weaponRange: 300 };

/** The ace at the origin; the enemy straight ahead of ITS nose (facing the ace). */
const ace = (over: Partial<DisengageShip> = {}): DisengageShip => ({
  id: "ace",
  side: "A",
  x: 3000,
  y: 3000,
  angle: 0,
  alive: true,
  ...FIRING,
  ...over,
});

/** An enemy `distance` px north of the ace, nose pointing south at it. */
const enemyNorth = (
  distance: number,
  over: Partial<DisengageShip> = {},
): DisengageShip => ({
  id: "foe",
  side: "B",
  x: 3000,
  y: 3000 - distance,
  angle: 180,
  alive: true,
  ...FIRING,
  ...over,
});

const bookWithAce = () => {
  const book = createAceStrikeBook();
  enlistAce(book, "ace");
  return book;
};

const pass = (
  book: ReturnType<typeof createAceStrikeBook>,
  ships: DisengageShip[],
  nowMs: number,
  marks = NO_SQUAD_MARKS,
) => updateDisengage(book, { ships, marks, nowMs, worldSize: WORLD });

describe("updateDisengage by arc and range", () => {
  it("rewards an ace that leaves the arc of an enemy and opens the range", () => {
    const book = bookWithAce();
    pass(book, [ace(), enemyNorth(200)], 1000);
    const rewarded = pass(
      book,
      [ace({ y: 3000 + DISENGAGE_MIN_RANGE_PX }), enemyNorth(0)],
      1100,
    );
    expect(rewarded).toEqual(["ace"]);
    expect(isEvading(book, "ace", 1100 + DISENGAGE_EVADE_MS - 1)).toBe(true);
    expect(isEvading(book, "ace", 1100 + DISENGAGE_EVADE_MS)).toBe(false);
  });

  it("does not reward stepping out of the arc while still close", () => {
    const book = bookWithAce();
    pass(book, [ace(), enemyNorth(200)], 1000);
    const rewarded = pass(
      book,
      [ace({ x: 3000 + 250 }), enemyNorth(200)],
      1100,
    );
    expect(rewarded).toEqual([]);
  });

  it("does not reward an ace that was never under the enemy's guns", () => {
    const book = bookWithAce();
    pass(book, [ace(), enemyNorth(900)], 1000);
    const rewarded = pass(book, [ace(), enemyNorth(1500)], 1100);
    expect(rewarded).toEqual([]);
  });

  it("does not reward when the threat was destroyed", () => {
    const book = bookWithAce();
    pass(book, [ace(), enemyNorth(200)], 1000);
    const rewarded = pass(book, [ace(), enemyNorth(200, { alive: false })], 1100);
    expect(rewarded).toEqual([]);
  });

  it("does not reward a ship that is not an enlisted ace", () => {
    const book = createAceStrikeBook();
    pass(book, [ace(), enemyNorth(200)], 1000);
    const rewarded = pass(
      book,
      [ace({ y: 3000 + DISENGAGE_MIN_RANGE_PX }), enemyNorth(0)],
      1100,
    );
    expect(rewarded).toEqual([]);
  });

  it("rewards once per cooldown, not on every flicker", () => {
    const book = bookWithAce();
    const away = ace({ y: 3000 + DISENGAGE_MIN_RANGE_PX });
    pass(book, [ace(), enemyNorth(200)], 1000);
    expect(pass(book, [away, enemyNorth(0)], 1100)).toEqual(["ace"]);
    pass(book, [ace(), enemyNorth(200)], 1200);
    expect(pass(book, [away, enemyNorth(0)], 1300)).toEqual([]);
    pass(book, [ace(), enemyNorth(200)], 1400 + DISENGAGE_REWARD_COOLDOWN_MS);
    expect(
      pass(book, [away, enemyNorth(0)], 1500 + DISENGAGE_REWARD_COOLDOWN_MS),
    ).toEqual(["ace"]);
  });

  it("measures the range across the map seam", () => {
    const book = bookWithAce();
    const nearSeam = (y: number) => ace({ y });
    pass(book, [nearSeam(50), enemyNorth(0, { y: 5900 })], 1000);
    const rewarded = pass(
      book,
      [nearSeam(50 + DISENGAGE_MIN_RANGE_PX), enemyNorth(0, { y: 5900 })],
      1100,
    );
    expect(rewarded).toEqual(["ace"]);
  });
});

describe("updateDisengage by squad mark", () => {
  it("rewards an ace that shakes an enemy mark", () => {
    const book = bookWithAce();
    const marks = placeMark(NO_SQUAD_MARKS, "B", "ace", 1000, 8000);
    pass(book, [ace(), enemyNorth(900)], 1100, marks);
    const rewarded = pass(book, [ace(), enemyNorth(900)], 1200, NO_SQUAD_MARKS);
    expect(rewarded).toEqual(["ace"]);
  });

  it("does not reward while the mark holds", () => {
    const book = bookWithAce();
    const marks = placeMark(NO_SQUAD_MARKS, "B", "ace", 1000, 8000);
    pass(book, [ace(), enemyNorth(900)], 1100, marks);
    expect(pass(book, [ace(), enemyNorth(900)], 1200, marks)).toEqual([]);
  });

  it("ignores its own side's marks", () => {
    const book = bookWithAce();
    const own = placeMark(NO_SQUAD_MARKS, "A", "ace", 1000, 8000);
    pass(book, [ace(), enemyNorth(900)], 1100, own);
    expect(pass(book, [ace(), enemyNorth(900)], 1200, NO_SQUAD_MARKS)).toEqual(
      [],
    );
  });
});

describe("refundBoost", () => {
  it("refunds the configured share of the remaining boost recharge", () => {
    const refunded = refundBoost({ boostCooldown: 4000, other: 1 });
    expect(refunded.boostCooldown).toBeCloseTo(4000 * (1 - DISENGAGE_BOOST_REFUND));
    expect(refunded.other).toBe(1);
  });

  it("leaves a recharged boost at zero", () => {
    expect(refundBoost({ boostCooldown: 0 }).boostCooldown).toBe(0);
  });
});
