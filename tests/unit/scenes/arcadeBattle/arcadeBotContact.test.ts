/**
 * arcadeBotContact — specification: a Skirmish ship is described to the AI
 * with its faction as its side and its primary weapon's real envelope.
 */

import { describe, it, expect } from "vitest";
import { toBotContact } from "../../../../src/scenes/arcadeBattle/arcadeBotContact";

const SHIP = {
  id: "enemy_0",
  faction: "void_corsairs",
  definitionId: "corsair_venom",
  x: 100,
  y: 200,
  angle: 90,
  hull: 30,
  maxHull: 36,
  shields: 6,
  maxShields: 12,
  control: { speed: 3 },
  stress: { isStressed: true },
  combatStats: { firingArc: 75, weaponRange: 250 },
};

describe("toBotContact", () => {
  it("describes the ship with its faction as its side", () => {
    expect(toBotContact(SHIP)).toMatchObject({
      id: "enemy_0",
      side: "void_corsairs",
      definitionId: "corsair_venom",
      x: 100,
      y: 200,
      angle: 90,
      alive: true,
      hull: 30,
      maxHull: 36,
      shields: 6,
      maxShields: 12,
      speed: 3,
      isStressed: true,
    });
  });

  it("uses its primary weapon's range and firing arc as the envelope", () => {
    const contact = toBotContact(SHIP);
    expect(contact.firingArcDeg).toBe(75);
    expect(contact.weaponRange).toBe(250);
  });

  it("reports a destroyed ship as not alive, never with negative hull", () => {
    const wreck = toBotContact({ ...SHIP, hull: -4 });
    expect(wreck.alive).toBe(false);
    expect(wreck.hull).toBe(0);
  });
});
