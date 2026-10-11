/**
 * HullAgility — specification: fighters may K-turn, capital hulls never.
 */

import { describe, it, expect } from "vitest";
import { canHullKTurn } from "../../../../src/arcade/ai/HullAgility";

describe("canHullKTurn", () => {
  it("allows fighters to K-turn", () => {
    expect(canHullKTurn("terran_viper")).toBe(true);
  });

  it("forbids capital ships from K-turning", () => {
    expect(canHullKTurn("terran_imperator")).toBe(false);
  });
});
