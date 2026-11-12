import { afterEach, describe, expect, it } from "vitest";
import type { ManeuverDirection } from "../../../../src/core/types";
import { ManeuverCueFx } from "../../../../src/rendering/maneuverCues/ManeuverCueFx";
import { CUE_TOTAL_MS } from "../../../../src/rendering/maneuverCues/maneuverCueMath";
import { setMotionReduced } from "../../../../src/ui/settings/motionComfort";

/** Records draw calls; every other method is a chainable no-op. */
function recorder(): { object: any; calls: string[] } {
  const calls: string[] = [];
  const state = { visible: false, width: 40 };
  const object: any = new Proxy(
    {},
    {
      get(_target, key: string) {
        if (key === "visible") return state.visible;
        if (key === "width") return state.width;
        return (...args: unknown[]) => {
          calls.push(key);
          if (key === "setVisible") state.visible = Boolean(args[0]);
          if (key === "clear") calls.push("clear");
          return object;
        };
      },
    },
  );
  return { object, calls };
}

function fakeScene() {
  const graphics = recorder();
  const text = recorder();
  const scene = {
    add: { graphics: () => graphics.object, text: () => text.object },
  };
  return { scene: scene as never, graphics, text };
}

const idle: {
  currentManeuver: ManeuverDirection | null;
  boostCooldown: number;
  barrelRollCooldown: number;
} = {
  currentManeuver: "straight",
  boostCooldown: 0,
  barrelRollCooldown: 0,
};
const pose = { x: 100, y: 100, angle: 0 };

function frame(
  nowMs: number,
  signals: Partial<typeof idle> | null = {},
  at = pose,
) {
  return {
    signals: signals === null ? null : { ...idle, ...signals },
    pose: signals === null ? null : at,
    worldSize: 4000,
    zoom: 1,
    nowMs,
  };
}

afterEach(() => setMotionReduced(false));

describe("ManeuverCueFx", () => {
  it("stays hidden while nothing happens", () => {
    const { scene } = fakeScene();
    const fx = new ManeuverCueFx(scene, 32);
    fx.update(frame(0));
    fx.update(frame(16));
    expect(fx.isShowing).toBe(false);
    expect(fx.cueCount).toBe(0);
  });

  it("shows a cue on a boost's rising edge and hides it after its timeline", () => {
    const { scene } = fakeScene();
    const fx = new ManeuverCueFx(scene, 32);
    fx.update(frame(0));
    fx.update(frame(16, { boostCooldown: 4500 }, { x: 100, y: 0, angle: 0 }));
    expect(fx.isShowing).toBe(true);
    expect(fx.cueCount).toBe(1);
    fx.update(frame(16 + CUE_TOTAL_MS - 1, { boostCooldown: 3000 }));
    expect(fx.isShowing).toBe(true);
    fx.update(frame(16 + CUE_TOTAL_MS + 1, { boostCooldown: 3000 }));
    expect(fx.isShowing).toBe(false);
  });

  it("does not repeat the cue while the cooldown only counts down", () => {
    const { scene } = fakeScene();
    const fx = new ManeuverCueFx(scene, 32);
    fx.update(frame(0));
    fx.update(frame(16, { boostCooldown: 4500 }));
    fx.update(frame(32, { boostCooldown: 4484 }));
    fx.update(frame(48, { boostCooldown: 4468 }));
    expect(fx.cueCount).toBe(1);
  });

  it("starts a cue when a special maneuver begins", () => {
    const { scene } = fakeScene();
    const fx = new ManeuverCueFx(scene, 32);
    fx.update(frame(0));
    fx.update(frame(16, { currentManeuver: "segnor_left" }));
    expect(fx.cueCount).toBe(1);
  });

  it("hides when the ship is gone", () => {
    const { scene } = fakeScene();
    const fx = new ManeuverCueFx(scene, 32);
    fx.update(frame(0));
    fx.update(frame(16, { boostCooldown: 4500 }));
    fx.update(frame(32, null));
    expect(fx.isShowing).toBe(false);
  });

  it("draws afterimages by default and none with Reduce Motion", () => {
    const full = fakeScene();
    const reduced = fakeScene();
    const fxFull = new ManeuverCueFx(full.scene, 32);
    const fxReduced = new ManeuverCueFx(reduced.scene, 32);
    const run = (fx: ManeuverCueFx) => {
      fx.update(frame(0));
      fx.update(frame(16, { boostCooldown: 4500 }, { x: 100, y: 0, angle: 0 }));
      fx.update(frame(40, { boostCooldown: 4400 }));
    };
    run(fxFull);
    setMotionReduced(true);
    run(fxReduced);
    const closes = (calls: string[]) =>
      calls.filter((call) => call === "closePath").length;
    expect(closes(full.graphics.calls)).toBeGreaterThan(0);
    expect(closes(reduced.graphics.calls)).toBe(0);
  });
});
