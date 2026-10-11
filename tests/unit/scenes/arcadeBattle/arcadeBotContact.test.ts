/**
 * arcadeBotContact — specification: a Skirmish ship is described to the AI
 * with its faction as its side and the AI's real firing envelope.
 */

import { describe, it, expect } from "vitest";
import {
  SKIRMISH_FIRING_ARC_DEG,
  SKIRMISH_WEAPON_RANGE_PX,
  toBotContact,
} from "../../../../src/scenes/arcadeBattle/arcadeBotContact";
import {
  AI_AIM_CONE_DEG,
  AI_MAX_FIRE_RANGE_PX,
} from "../../../../src/scenes/arcadeBattle/aiFiringSolution";

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

  it("uses the AI's firing cone and reach as the weapon envelope", () => {
    const contact = toBotContact(SHIP);
    expect(contact.firingArcDeg).toBe(SKIRMISH_FIRING_ARC_DEG);
    expect(SKIRMISH_FIRING_ARC_DEG).toBe(AI_AIM_CONE_DEG * 2);
    expect(contact.weaponRange).toBe(SKIRMISH_WEAPON_RANGE_PX);
    expect(SKIRMISH_WEAPON_RANGE_PX).toBe(AI_MAX_FIRE_RANGE_PX);
  });

  it("reports a destroyed ship as not alive, never with negative hull", () => {
    const wreck = toBotContact({ ...SHIP, hull: -4 });
    expect(wreck.alive).toBe(false);
    expect(wreck.hull).toBe(0);
  });
});
