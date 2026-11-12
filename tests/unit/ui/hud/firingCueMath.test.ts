import { describe, expect, it } from "vitest";
import {
  FIRING_CUE_VISIBLE_RANGE_FACTOR,
  buildFiringCue,
  classifyHostile,
  firingStateText,
  readHostile,
  turnHintSide,
  type FiringEnvelope,
} from "../../../../src/ui/hud/firingCueMath";
import type { ContactHudState, HudPose } from "../../../../src/ui/hud/types";

const WORLD = 4000;
const HEAVY: FiringEnvelope = { rangePx: 250, arcDeg: 75 };
const player: HudPose = { x: 1000, y: 1000, angle: 0 };

function enemy(
  id: string,
  x: number,
  y: number,
  patch: Partial<ContactHudState> = {},
): ContactHudState {
  return {
    id,
    pose: { x, y, angle: 0 },
    side: "enemy",
    sizeClass: "small",
    isTarget: false,
    alive: true,
    ...patch,
  };
}

describe("readHostile", () => {
  it("measures distance and bearing off the nose (right is positive)", () => {
    const reading = readHostile(
      { pose: player, hostile: { x: 1100, y: 1000 }, worldSize: WORLD },
      HEAVY,
    );
    expect(reading.distancePx).toBeCloseTo(100);
    expect(reading.bearingDeg).toBeCloseTo(90);
  });

  it("is zero degrees straight ahead and negative to the left", () => {
    const ahead = readHostile(
      { pose: player, hostile: { x: 1000, y: 900 }, worldSize: WORLD },
      HEAVY,
    );
    const left = readHostile(
      { pose: player, hostile: { x: 900, y: 1000 }, worldSize: WORLD },
      HEAVY,
    );
    expect(ahead.bearingDeg).toBeCloseTo(0);
    expect(left.bearingDeg).toBeCloseTo(-90);
  });

  it("follows the ship heading", () => {
    const reading = readHostile(
      {
        pose: { ...player, angle: 90 },
        hostile: { x: 1100, y: 1000 },
        worldSize: WORLD,
      },
      HEAVY,
    );
    expect(reading.bearingDeg).toBeCloseTo(0);
  });

  it("measures the short way across the torus seam", () => {
    const reading = readHostile(
      {
        pose: { x: 20, y: 1000, angle: 0 },
        hostile: { x: WORLD - 30, y: 1000 },
        worldSize: WORLD,
      },
      HEAVY,
    );
    expect(reading.distancePx).toBeCloseTo(50);
    expect(reading.bearingDeg).toBeCloseTo(-90);
  });
});

describe("classifyHostile", () => {
  it("is in range when inside both range and arc", () => {
    expect(classifyHostile(200, 20, HEAVY)).toBe("in_range");
  });

  it("is in range on either side of the nose within half the arc", () => {
    expect(classifyHostile(100, -37, HEAVY)).toBe("in_range");
    expect(classifyHostile(100, 37, HEAVY)).toBe("in_range");
  });

  it("is out of arc when close enough but off the nose", () => {
    expect(classifyHostile(100, 60, HEAVY)).toBe("out_of_arc");
    expect(classifyHostile(100, 180, HEAVY)).toBe("out_of_arc");
  });

  it("is out of range at or beyond the weapon range, even in the arc", () => {
    expect(classifyHostile(250, 0, HEAVY)).toBe("out_of_range");
    expect(classifyHostile(400, 10, HEAVY)).toBe("out_of_range");
  });

  it("calls a far, off-nose hostile out of range first", () => {
    expect(classifyHostile(400, 120, HEAVY)).toBe("out_of_range");
  });

  it("has no arc limit for a turret (360 degrees)", () => {
    expect(classifyHostile(100, 170, { rangePx: 250, arcDeg: 360 })).toBe(
      "in_range",
    );
  });
});

describe("turnHintSide", () => {
  it("turns right for a hostile on the right outside the arc", () => {
    expect(turnHintSide(80, 75)).toBe("right");
  });

  it("turns left for a hostile on the left outside the arc", () => {
    expect(turnHintSide(-80, 75)).toBe("left");
  });

  it("gives no hint inside the arc", () => {
    expect(turnHintSide(30, 75)).toBeNull();
    expect(turnHintSide(-37, 75)).toBeNull();
  });

  it("gives no hint for a turret", () => {
    expect(turnHintSide(170, 360)).toBeNull();
  });

  it("picks the right for a hostile dead astern", () => {
    expect(turnHintSide(180, 75)).toBe("right");
  });

  it("turns the short way when the hostile sits across the seam", () => {
    const reading = readHostile(
      {
        pose: { x: 20, y: 1000, angle: 0 },
        hostile: { x: WORLD - 30, y: 1000 },
        worldSize: WORLD,
      },
      HEAVY,
    );
    expect(turnHintSide(reading.bearingDeg, HEAVY.arcDeg)).toBe("left");
  });
});

describe("firingStateText", () => {
  it("names the three states", () => {
    expect(firingStateText("in_range")).toBe("IN RANGE");
    expect(firingStateText("out_of_arc")).toBe("OUT OF ARC");
    expect(firingStateText("out_of_range")).toBe("OUT OF RANGE");
  });
});

describe("buildFiringCue", () => {
  const near = (x: number, y: number) => enemy("e", x, y);

  it("shows nothing without a weapon envelope", () => {
    expect(
      buildFiringCue({
        pose: player,
        envelope: null,
        contacts: [near(1000, 900)],
        worldSize: WORLD,
      }),
    ).toBeNull();
  });

  it("shows nothing when no hostile is near", () => {
    const far = near(1000, 1000 - HEAVY.rangePx * 2.5);
    expect(
      buildFiringCue({
        pose: player,
        envelope: HEAVY,
        contacts: [far],
        worldSize: WORLD,
      }),
    ).toBeNull();
  });

  it("ignores allies, neutrals and the dead", () => {
    const contacts = [
      enemy("a", 1000, 900, { side: "ally" }),
      enemy("n", 1000, 900, { side: "neutral" }),
      enemy("d", 1000, 900, { alive: false }),
    ];
    expect(
      buildFiringCue({
        pose: player,
        envelope: HEAVY,
        contacts,
        worldSize: WORLD,
      }),
    ).toBeNull();
  });

  it("appears from twice the weapon range, dim while nothing is in the wedge", () => {
    const edge = near(
      1000,
      1000 - HEAVY.rangePx * (FIRING_CUE_VISIBLE_RANGE_FACTOR - 0.1),
    );
    const cue = buildFiringCue({
      pose: player,
      envelope: HEAVY,
      contacts: [edge],
      worldSize: WORLD,
    });
    expect(cue).not.toBeNull();
    expect(cue?.anyInWedge).toBe(false);
    expect(cue?.focus.state).toBe("out_of_range");
  });

  it("lights the wedge when a hostile is inside it", () => {
    const cue = buildFiringCue({
      pose: player,
      envelope: HEAVY,
      contacts: [near(1000, 850)],
      worldSize: WORLD,
    });
    expect(cue?.anyInWedge).toBe(true);
    expect(cue?.focus.state).toBe("in_range");
    expect(cue?.turnHint).toBeNull();
  });

  it("hints the turn toward a hostile outside the arc", () => {
    const cue = buildFiringCue({
      pose: player,
      envelope: HEAVY,
      contacts: [near(1120, 1000)],
      worldSize: WORLD,
    });
    expect(cue?.focus.state).toBe("out_of_arc");
    expect(cue?.turnHint).toBe("right");
  });

  it("hints a left turn for a hostile across the seam on the left", () => {
    const cue = buildFiringCue({
      pose: { x: 20, y: 1000, angle: 0 },
      envelope: HEAVY,
      contacts: [near(WORLD - 60, 1000)],
      worldSize: WORLD,
    });
    expect(cue?.turnHint).toBe("left");
  });

  it("focuses the nearest hostile", () => {
    const cue = buildFiringCue({
      pose: player,
      envelope: HEAVY,
      contacts: [enemy("far", 1000, 800), enemy("close", 1000, 900)],
      worldSize: WORLD,
    });
    expect(cue?.focus.id).toBe("close");
  });

  it("focuses a hostile in the wedge over a nearer one outside it", () => {
    const cue = buildFiringCue({
      pose: player,
      envelope: HEAVY,
      contacts: [enemy("beside", 1060, 1000), enemy("ahead", 1000, 800)],
      worldSize: WORLD,
    });
    expect(cue?.focus.id).toBe("ahead");
    expect(cue?.anyInWedge).toBe(true);
    expect(cue?.turnHint).toBeNull();
  });

  it("prefers the marked or locked hostile among those in the wedge", () => {
    const cue = buildFiringCue({
      pose: player,
      envelope: HEAVY,
      contacts: [
        enemy("near", 1000, 900),
        enemy("locked", 1000, 800, { isTarget: true }),
      ],
      worldSize: WORLD,
    });
    expect(cue?.focus.id).toBe("locked");
  });

  it("prefers the marked hostile when none is in the wedge", () => {
    const cue = buildFiringCue({
      pose: player,
      envelope: HEAVY,
      contacts: [
        enemy("near", 1060, 1000),
        enemy("marked", 1000, 1200, { isMarked: true }),
      ],
      worldSize: WORLD,
    });
    expect(cue?.focus.id).toBe("marked");
  });

  it("reports the full envelope and the focus world offset", () => {
    const cue = buildFiringCue({
      pose: player,
      envelope: HEAVY,
      contacts: [near(1000, 900)],
      worldSize: WORLD,
    });
    expect(cue?.envelope).toEqual(HEAVY);
    expect(cue?.focus.dx).toBeCloseTo(0);
    expect(cue?.focus.dy).toBeCloseTo(-100);
  });
});
