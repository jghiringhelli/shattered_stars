import { describe, expect, it } from "vitest";
import {
  playerCueFields,
  withPlayerCues,
} from "../../../../src/ui/hud/playerCueFields";
import type {
  BattleHudSnapshot,
  PlayerHudState,
} from "../../../../src/ui/hud/types";

const control = {
  currentManeuver: "tallon_right",
  boostCooldown: 4500,
  barrelRollCooldown: 0,
} as const;

function snapshotOf(player: PlayerHudState | null): BattleHudSnapshot {
  return {
    player,
    contacts: [],
    weapons: [],
    camera: { centerX: 0, centerY: 0, zoom: 1, width: 1280, height: 720 },
  };
}

const basePlayer: PlayerHudState = {
  pose: { x: 1, y: 2, angle: 3 },
  hull: 1,
  maxHull: 1,
  shields: 0,
  maxShields: 0,
  stress: 0,
  isStressed: false,
  speed: 3,
  maxSpeed: 5,
  maneuver: null,
};

describe("playerCueFields", () => {
  it("copies the three control signals the maneuver cue reads", () => {
    expect(playerCueFields(control).maneuverSignals).toEqual(control);
  });

  it("maps combat stats to the weapon envelope", () => {
    const fields = playerCueFields(control, { weaponRange: 250, firingArc: 75 });
    expect([fields.weaponRangePx, fields.firingArcDeg]).toEqual([250, 75]);
  });

  it("leaves the envelope out without combat stats", () => {
    const fields = playerCueFields(control);
    expect(fields.weaponRangePx).toBeUndefined();
    expect(fields.firingArcDeg).toBeUndefined();
  });
});

describe("withPlayerCues", () => {
  it("adds the cue fields to the snapshot's player", () => {
    const result = withPlayerCues(snapshotOf(basePlayer), {
      control,
      combatStats: { weaponRange: 400, firingArc: 90 },
    });
    expect(result.player?.weaponRangePx).toBe(400);
    expect(result.player?.maneuverSignals?.currentManeuver).toBe("tallon_right");
    expect(result.player?.hull).toBe(1);
  });

  it("returns the snapshot unchanged without a player", () => {
    const snapshot = snapshotOf(null);
    expect(withPlayerCues(snapshot, { control })).toBe(snapshot);
  });

  it("returns the snapshot unchanged without a ship", () => {
    const snapshot = snapshotOf(basePlayer);
    expect(withPlayerCues(snapshot, null)).toBe(snapshot);
  });
});
