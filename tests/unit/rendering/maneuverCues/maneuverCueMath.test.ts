import { describe, expect, it } from "vitest";
import {
  CUE_FADE_IN_MS,
  CUE_FADE_OUT_MS,
  CUE_HOLD_MS,
  CUE_TOTAL_MS,
  GHOST_LIFE_MS,
  cueAlpha,
  cueGlyph,
  cueLabel,
  cueUsesSide,
  detectManeuverEvent,
  ghostAlpha,
  type ManeuverSignals,
  type MotionPose,
} from "../../../../src/rendering/maneuverCues/maneuverCueMath";

const WORLD = 4000;
const idle: ManeuverSignals = {
  currentManeuver: "straight",
  boostCooldown: 0,
  barrelRollCooldown: 0,
};
const north: MotionPose = { x: 500, y: 500, angle: 0 };

function detect(
  prev: ManeuverSignals | null,
  next: Partial<ManeuverSignals>,
  poses: { prev?: MotionPose; next?: MotionPose } = {},
) {
  return detectManeuverEvent({
    prev,
    next: { ...idle, ...next },
    prevPose: poses.prev ?? north,
    nextPose: poses.next ?? north,
    worldSize: WORLD,
  });
}

describe("detectManeuverEvent", () => {
  it("reports nothing on the first observation", () => {
    expect(detect(null, { boostCooldown: 4500 })).toBeNull();
  });

  it("reports nothing while the signals do not change", () => {
    expect(detect(idle, {})).toBeNull();
  });

  it("reports nothing while a cooldown only counts down", () => {
    const cooling = { ...idle, boostCooldown: 3000 };
    expect(detect(cooling, { boostCooldown: 2984 })).toBeNull();
  });

  it("reports a boost on the rising edge of its cooldown", () => {
    expect(detect(idle, { boostCooldown: 4500 })).toEqual({
      kind: "boost",
      side: null,
    });
  });

  it("reports a boost again when the cooldown restarts after running out", () => {
    const almostReady = { ...idle, boostCooldown: 1 };
    expect(detect(almostReady, { boostCooldown: 4500 })?.kind).toBe("boost");
  });

  it("reports a Snap Turn when the maneuver enters kturn", () => {
    expect(detect(idle, { currentManeuver: "kturn" })).toEqual({
      kind: "snap",
      side: null,
    });
  });

  it("does not repeat a special while it keeps flying", () => {
    const flying = { ...idle, currentManeuver: "kturn" } as const;
    expect(detect(flying, { currentManeuver: "kturn" })).toBeNull();
  });

  it.each([
    ["segnor_left", "hook", "left"],
    ["segnor_right", "hook", "right"],
    ["tallon_left", "knife", "left"],
    ["tallon_right", "knife", "right"],
  ] as const)("maps %s to %s with side %s", (maneuver, kind, side) => {
    expect(detect(idle, { currentManeuver: maneuver })).toEqual({ kind, side });
  });

  it("ignores ordinary maneuvers", () => {
    expect(detect(idle, { currentManeuver: "bank_left" })).toBeNull();
  });

  it("reports a barrel roll to the left from the sideways displacement", () => {
    const event = detect(
      idle,
      { barrelRollCooldown: 3000 },
      { next: { x: 440, y: 500, angle: 0 } },
    );
    expect(event).toEqual({ kind: "roll", side: "left" });
  });

  it("reports a barrel roll to the right from the sideways displacement", () => {
    const event = detect(
      idle,
      { barrelRollCooldown: 3000 },
      { next: { x: 560, y: 500, angle: 0 } },
    );
    expect(event?.side).toBe("right");
  });

  it("measures the roll side against the heading, not the screen", () => {
    // Heading east: the ship's left is up the screen (negative y).
    const event = detect(
      idle,
      { barrelRollCooldown: 3000 },
      {
        prev: { x: 500, y: 500, angle: 90 },
        next: { x: 500, y: 440, angle: 90 },
      },
    );
    expect(event?.side).toBe("left");
  });

  it("measures the roll side the short way across the torus seam", () => {
    // Heading north at the left edge; a roll to the left wraps to the far edge.
    const event = detect(
      idle,
      { barrelRollCooldown: 3000 },
      {
        prev: { x: 20, y: 500, angle: 0 },
        next: { x: WORLD - 40, y: 500, angle: 0 },
      },
    );
    expect(event).toEqual({ kind: "roll", side: "left" });
  });

  it("prefers a special maneuver over a dash in the same frame", () => {
    const event = detect(idle, {
      currentManeuver: "segnor_right",
      boostCooldown: 4500,
    });
    expect(event?.kind).toBe("hook");
  });
});

describe("cue labels and glyphs", () => {
  it("labels every kind", () => {
    expect(
      (["snap", "hook", "knife", "boost", "roll"] as const).map(cueLabel),
    ).toEqual(["SNAP", "HOOK", "KNIFE", "BOOST", "ROLL"]);
  });

  it("gives every kind its own glyph shape (not colour alone)", () => {
    const glyphs = (["snap", "hook", "knife", "boost", "roll"] as const).map(
      cueGlyph,
    );
    expect(new Set(glyphs).size).toBe(5);
  });

  it("shows a side arrow for hook, knife and roll only", () => {
    expect(cueUsesSide("hook")).toBe(true);
    expect(cueUsesSide("knife")).toBe(true);
    expect(cueUsesSide("roll")).toBe(true);
    expect(cueUsesSide("snap")).toBe(false);
    expect(cueUsesSide("boost")).toBe(false);
  });
});

describe("cueAlpha", () => {
  it("lasts fade-in + hold + fade-out", () => {
    expect(CUE_TOTAL_MS).toBe(CUE_FADE_IN_MS + CUE_HOLD_MS + CUE_FADE_OUT_MS);
  });

  it("starts invisible and fades in over ~100 ms", () => {
    expect(cueAlpha(0)).toBe(0);
    expect(cueAlpha(CUE_FADE_IN_MS / 2)).toBeCloseTo(0.5);
    expect(cueAlpha(CUE_FADE_IN_MS)).toBe(1);
  });

  it("holds fully visible for ~600 ms", () => {
    expect(cueAlpha(CUE_FADE_IN_MS + CUE_HOLD_MS / 2)).toBe(1);
    expect(cueAlpha(CUE_FADE_IN_MS + CUE_HOLD_MS)).toBe(1);
  });

  it("fades out over ~300 ms and ends at zero", () => {
    const fadeStart = CUE_FADE_IN_MS + CUE_HOLD_MS;
    expect(cueAlpha(fadeStart + CUE_FADE_OUT_MS / 2)).toBeCloseTo(0.5);
    expect(cueAlpha(CUE_TOTAL_MS)).toBe(0);
    expect(cueAlpha(CUE_TOTAL_MS + 500)).toBe(0);
  });

  it("is zero before the cue starts", () => {
    expect(cueAlpha(-10)).toBe(0);
  });
});

describe("ghostAlpha", () => {
  it("fades each afterimage out within ~250 ms", () => {
    expect(GHOST_LIFE_MS).toBe(250);
    expect(ghostAlpha(0, 0)).toBeGreaterThan(ghostAlpha(125, 0));
    expect(ghostAlpha(GHOST_LIFE_MS, 0)).toBe(0);
    expect(ghostAlpha(GHOST_LIFE_MS + 100, 0)).toBe(0);
  });

  it("makes older afterimages fainter", () => {
    expect(ghostAlpha(50, 0)).toBeGreaterThan(ghostAlpha(50, 2));
  });

  it("stays faint (below the glyph)", () => {
    expect(ghostAlpha(0, 0)).toBeLessThanOrEqual(0.5);
  });
});
