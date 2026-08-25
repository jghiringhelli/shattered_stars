import { describe, it, expect } from "vitest";
import { createRunState } from "../../../../src/data/survival/model";
import {
  MAX_ESCORTS,
  ESCORT_UNIT_POWER,
  applyEscortOption,
  escortFleetPower,
  escortOptions,
  escortQualityMultiplier,
} from "../../../../src/data/survival/escorts";

describe("survival/escorts — quality multiplier", () => {
  it("is 1 with no support investment", () => {
    expect(escortQualityMultiplier(createRunState())).toBe(1);
  });

  it("rises with fleet-branch depth", () => {
    const s = createRunState();
    s.branch.fleet = 4;
    expect(escortQualityMultiplier(s)).toBeGreaterThan(1);
  });

  it("adds a flat bonus for the carrier hull", () => {
    const plain = createRunState();
    const carrier = createRunState("carrier");
    expect(escortQualityMultiplier(carrier)).toBeGreaterThan(
      escortQualityMultiplier(plain),
    );
  });
});

describe("survival/escorts — fleet power", () => {
  it("is zero with no escorts", () => {
    expect(escortFleetPower(createRunState())).toBe(0);
  });

  it("an unsupported escort is weak (contributes only its base unit power)", () => {
    const s = createRunState();
    s.escorts = 1;
    expect(escortFleetPower(s)).toBe(ESCORT_UNIT_POWER);
  });

  it("support investment makes the same wing stronger", () => {
    const plain = createRunState();
    plain.escorts = 3;
    const supported = createRunState();
    supported.escorts = 3;
    supported.branch.fleet = 4;
    expect(escortFleetPower(supported)).toBeGreaterThan(
      escortFleetPower(plain),
    );
  });

  it("caps the counted escorts at MAX_ESCORTS", () => {
    const capped = createRunState();
    capped.escorts = MAX_ESCORTS;
    const over = createRunState();
    over.escorts = MAX_ESCORTS + 5;
    expect(escortFleetPower(over)).toBe(escortFleetPower(capped));
  });
});

describe("survival/escorts — track options", () => {
  it("offers recruit and bank below the escort cap", () => {
    const kinds = escortOptions(createRunState()).map((o) => o.kind);
    expect(kinds).toContain("recruit");
    expect(kinds).toContain("bank");
  });

  it("withholds recruit once the wing is at cap", () => {
    const s = createRunState();
    s.escorts = MAX_ESCORTS;
    const kinds = escortOptions(s).map((o) => o.kind);
    expect(kinds).not.toContain("recruit");
    expect(kinds).toContain("bank");
  });

  it("recruit adds one escort, bank adds one reroll", () => {
    const s = createRunState();
    applyEscortOption(s, {
      kind: "recruit",
      name: "",
      description: "",
      icon: "",
    });
    expect(s.escorts).toBe(1);
    applyEscortOption(s, { kind: "bank", name: "", description: "", icon: "" });
    expect(s.rerolls).toBe(1);
  });

  it("recruit is a no-op at the escort cap", () => {
    const s = createRunState();
    s.escorts = MAX_ESCORTS;
    applyEscortOption(s, {
      kind: "recruit",
      name: "",
      description: "",
      icon: "",
    });
    expect(s.escorts).toBe(MAX_ESCORTS);
  });
});
