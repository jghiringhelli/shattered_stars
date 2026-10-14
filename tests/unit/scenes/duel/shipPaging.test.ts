import { describe, expect, it } from "vitest";
import {
  SHIPS_PER_PAGE,
  shipPage,
} from "../../../../src/scenes/duel/shipPaging";

const ships = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}` }));

describe("shipPage", () => {
  it("follows the selection onto its page", () => {
    const page = shipPage(ships, "s5", null);
    expect(page.page).toBe(1);
    expect(page.items.map((s) => s.id)).toContain("s5");
    expect(page.items).toHaveLength(SHIPS_PER_PAGE);
  });

  it("shows the first page when the selection is unknown", () => {
    expect(shipPage(ships, "nope", null).page).toBe(0);
  });

  it("honours a requested page and clamps it into range", () => {
    expect(shipPage(ships, "s0", 2).items.map((s) => s.id)).toEqual(["s8", "s9"]);
    expect(shipPage(ships, "s0", 99).page).toBe(2);
    expect(shipPage(ships, "s0", -3).page).toBe(0);
  });

  it("captions the range shown", () => {
    expect(shipPage(ships, "s0", 1).caption).toBe("5-8 OF 10 SHIPS");
  });
});
