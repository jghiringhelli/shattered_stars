import { describe, it, expect } from "vitest";
import { createSeededRng } from "../../../../src/utils/random";
import { createRunState } from "../../../../src/data/survival/model";
import {
  ATOMS,
  CAPSTONES,
  CROSS_POWERS,
  POWER_CATALOG,
  applyPower,
  drawPowers,
  isPowerEligible,
  type Power,
} from "../../../../src/data/survival/powers";

function byId(id: string): Power {
  const p = POWER_CATALOG.find((x) => x.id === id);
  if (!p) throw new Error(`missing power ${id}`);
  return p;
}

describe("survival/powers catalog", () => {
  it("has unique power ids", () => {
    const ids = POWER_CATALOG.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("one capstone per branch and cross powers name two distinct branches", () => {
    expect(CAPSTONES).toHaveLength(6);
    for (const x of CROSS_POWERS) {
      expect(x.crossWith).toBeDefined();
      expect(x.crossWith).not.toBe(x.branch);
    }
  });
});

describe("survival/powers apply", () => {
  it("an atom adds one branch investment and its stat delta", () => {
    const s = createRunState("ace");
    applyPower(s, byId("ord_dmg")); // ordnance, not amplified by ace
    expect(s.branch.ordnance).toBe(1);
    expect(s.bonuses.damage).toBe(1);
  });

  it("amplifies the stat delta when the hull biases that branch", () => {
    const s = createRunState("ace"); // ace amplifies gunnery + drive
    applyPower(s, byId("gun_damage")); // +1 damage * 1.5
    expect(s.bonuses.damage).toBeCloseTo(1.5);
  });

  it("special atoms grant rerolls without stats", () => {
    const s = createRunState();
    applyPower(s, byId("drv_reroll"));
    expect(s.rerolls).toBe(1);
  });

  it("capstones and cross powers are recorded as taken (unique)", () => {
    const s = createRunState("ace"); // ace does not amplify bulwark
    s.branch.bulwark = 5;
    applyPower(s, byId("cap_bulwark"));
    expect(s.taken).toContain("cap_bulwark");
    expect(s.bonuses.maxHull).toBe(6);
  });
});

describe("survival/powers eligibility", () => {
  it("atoms are always eligible", () => {
    const s = createRunState();
    expect(ATOMS.every((a) => isPowerEligible(a, s))).toBe(true);
  });

  it("a capstone appears only at branch depth >= threshold and only once", () => {
    const s = createRunState();
    const cap = byId("cap_gunnery");
    expect(isPowerEligible(cap, s)).toBe(false);
    s.branch.gunnery = 5;
    expect(isPowerEligible(cap, s)).toBe(true);
    s.taken.push("cap_gunnery");
    expect(isPowerEligible(cap, s)).toBe(false);
  });

  it("a cross power needs both branches at the cross threshold", () => {
    const s = createRunState();
    const x = byId("x_saturation"); // ordnance x automation
    expect(isPowerEligible(x, s)).toBe(false);
    s.branch.ordnance = 3;
    expect(isPowerEligible(x, s)).toBe(false);
    s.branch.automation = 3;
    expect(isPowerEligible(x, s)).toBe(true);
  });
});

describe("survival/powers draw", () => {
  it("is deterministic for the same seed", () => {
    const s = createRunState();
    const a = drawPowers(s, 3, createSeededRng(7)).map((p) => p.id);
    const b = drawPowers(s, 3, createSeededRng(7)).map((p) => p.id);
    expect(a).toEqual(b);
  });

  it("returns the requested number of distinct powers", () => {
    const s = createRunState();
    const drawn = drawPowers(s, 3, createSeededRng(99));
    expect(drawn).toHaveLength(3);
    expect(new Set(drawn.map((p) => p.id)).size).toBe(3);
  });

  it("never offers locked capstones or cross powers early", () => {
    const s = createRunState();
    for (let seed = 0; seed < 50; seed++) {
      for (const p of drawPowers(s, 4, createSeededRng(seed))) {
        expect(p.tier).toBe("atom");
      }
    }
  });
});
