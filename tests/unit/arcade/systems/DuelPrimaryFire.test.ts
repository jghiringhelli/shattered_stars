/**
 * DuelPrimaryFire — specification tests for the duel scenes' primary weapon
 * on the round tempo: range/arc targeting, immunity skips, side filtering
 * and the one-attack-per-cycle cooldown.
 */

import { describe, it, expect } from "vitest";
import {
  inPrimaryArc,
  primaryCooldownAfterShot,
  primaryCooldownFraction,
  primaryShotTarget,
  type PrimaryCandidate,
  type PrimaryGunner,
} from "../../../../src/arcade/systems/DuelPrimaryFire";
import {
  ATTACK_INTERVAL_MS,
  HitImmunityLedger,
} from "../../../../src/arcade/systems/CombatTempo";

const RANGE = 250;
const ARC = 75;

function gunner(overrides: Partial<PrimaryGunner> = {}): PrimaryGunner {
  return {
    id: "a",
    x: 0,
    y: 0,
    angle: 0,
    combatStats: { weaponRange: RANGE, firingArc: ARC, weaponCooldown: 400 },
    ...overrides,
  };
}

interface Candidate extends PrimaryCandidate {
  readonly side: 1 | 2;
}

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return { id: "b", x: 0, y: -100, hull: 4, side: 2, ...overrides };
}

const enemyOfSide1 = (c: Candidate): boolean => c.side !== 1;

describe("inPrimaryArc", () => {
  it("accepts a target straight ahead of a north-facing ship", () => {
    expect(inPrimaryArc(gunner(), { x: 0, y: -100 })).toBe(true);
  });

  it("rejects a target beyond weapon range", () => {
    expect(inPrimaryArc(gunner(), { x: 0, y: -RANGE - 1 })).toBe(false);
  });

  it("rejects a target outside half the firing arc", () => {
    expect(inPrimaryArc(gunner(), { x: 100, y: -50 })).toBe(false);
  });

  it("rejects a target directly beside a ship whose heading is near 360", () => {
    expect(inPrimaryArc(gunner({ angle: 359 }), { x: -100, y: 0 })).toBe(false);
  });

  it("accepts a target ahead of a ship whose heading is negative", () => {
    expect(inPrimaryArc(gunner({ angle: -90 }), { x: -100, y: 0 })).toBe(true);
  });
});

describe("primaryShotTarget", () => {
  it("picks a living enemy in arc", () => {
    const target = candidate();
    expect(
      primaryShotTarget({
        gunner: gunner(),
        candidates: [target],
        isEnemy: enemyOfSide1,
        ledger: new HitImmunityLedger(),
        nowMs: 0,
      }),
    ).toBe(target);
  });

  it("holds fire on a target immune to this attacker", () => {
    const ledger = new HitImmunityLedger();
    ledger.recordHit("a", "b", 0);
    expect(
      primaryShotTarget({
        gunner: gunner(),
        candidates: [candidate()],
        isEnemy: enemyOfSide1,
        ledger,
        nowMs: ATTACK_INTERVAL_MS - 1,
      }),
    ).toBeNull();
  });

  it("fires again once the immunity cycle has passed", () => {
    const ledger = new HitImmunityLedger();
    ledger.recordHit("a", "b", 0);
    expect(
      primaryShotTarget({
        gunner: gunner(),
        candidates: [candidate()],
        isEnemy: enemyOfSide1,
        ledger,
        nowMs: ATTACK_INTERVAL_MS,
      }),
    ).not.toBeNull();
  });

  it("skips an immune target for another enemy in arc", () => {
    const ledger = new HitImmunityLedger();
    ledger.recordHit("a", "b", 0);
    const other = candidate({ id: "c", y: -150 });
    expect(
      primaryShotTarget({
        gunner: gunner(),
        candidates: [candidate(), other],
        isEnemy: enemyOfSide1,
        ledger,
        nowMs: 10,
      }),
    ).toBe(other);
  });

  it("ignores ships of its own side even of another faction", () => {
    expect(
      primaryShotTarget({
        gunner: gunner(),
        candidates: [candidate({ side: 1 })],
        isEnemy: enemyOfSide1,
        ledger: new HitImmunityLedger(),
        nowMs: 0,
      }),
    ).toBeNull();
  });

  it("ignores destroyed enemies and itself", () => {
    expect(
      primaryShotTarget({
        gunner: gunner(),
        candidates: [candidate({ hull: 0 }), candidate({ id: "a" })],
        isEnemy: () => true,
        ledger: new HitImmunityLedger(),
        nowMs: 0,
      }),
    ).toBeNull();
  });

  it("fires at the pilot's preferred target over an earlier enemy in arc", () => {
    const preferred = candidate({ id: "c", y: -200 });
    expect(
      primaryShotTarget({
        gunner: gunner(),
        candidates: [candidate(), preferred],
        isEnemy: enemyOfSide1,
        ledger: new HitImmunityLedger(),
        nowMs: 0,
        preferredId: "c",
      }),
    ).toBe(preferred);
  });

  it("falls back to another enemy when the preferred one is out of arc", () => {
    const first = candidate();
    expect(
      primaryShotTarget({
        gunner: gunner(),
        candidates: [first, candidate({ id: "c", x: 0, y: 100 })],
        isEnemy: enemyOfSide1,
        ledger: new HitImmunityLedger(),
        nowMs: 0,
        preferredId: "c",
      }),
    ).toBe(first);
  });

  it("falls back to another enemy when the preferred one is immune", () => {
    const ledger = new HitImmunityLedger();
    ledger.recordHit("a", "c", 0);
    const first = candidate();
    expect(
      primaryShotTarget({
        gunner: gunner(),
        candidates: [first, candidate({ id: "c", y: -150 })],
        isEnemy: enemyOfSide1,
        ledger,
        nowMs: 10,
        preferredId: "c",
      }),
    ).toBe(first);
  });
});

describe("primary weapon cadence", () => {
  it("never attacks faster than once per maneuver cycle", () => {
    expect(primaryCooldownAfterShot(gunner())).toBe(ATTACK_INTERVAL_MS);
  });

  it("keeps a slower weapon's own cooldown", () => {
    const slow = gunner({
      combatStats: { weaponRange: RANGE, firingArc: ARC, weaponCooldown: 900 },
    });
    expect(primaryCooldownAfterShot(slow)).toBe(900);
  });

  it("reports the cooldown as a fraction of the attack interval", () => {
    expect(primaryCooldownFraction(ATTACK_INTERVAL_MS / 2, 400)).toBe(0.5);
  });

  it("clamps the cooldown fraction to [0, 1]", () => {
    expect(primaryCooldownFraction(-5, 400)).toBe(0);
    expect(primaryCooldownFraction(ATTACK_INTERVAL_MS * 3, 400)).toBe(1);
  });
});
