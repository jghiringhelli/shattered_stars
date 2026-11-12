import { describe, expect, it } from "vitest";
import { RenderPoseTracker } from "../../../../src/rendering/smoothing/RenderPoseTracker";

const SIZE = 6000;
const TICK_MS = 1000 / 60;

function ship(x: number, y: number, angle = 0) {
  return { id: "s", x, y, angle };
}

function tracker(): RenderPoseTracker {
  return new RenderPoseTracker({ worldSize: SIZE });
}

/** Fly `steps` ordinary ticks of 6 px along +x from `x`. */
function fly(t: RenderPoseTracker, x: number, steps: number): number {
  let at = x;
  for (let i = 0; i < steps; i++) {
    at += 6;
    t.capture(ship(at, 100), TICK_MS);
  }
  return at;
}

describe("RenderPoseTracker interpolation", () => {
  it("draws the point alpha of the way between the last two ticks", () => {
    const t = tracker();
    t.capture(ship(100, 100), TICK_MS);
    t.capture(ship(106, 100), TICK_MS);
    t.beginFrame(0, 0.5);
    expect(t.poseOf(ship(106, 100)).x).toBeCloseTo(103);
    t.beginFrame(0, 1);
    expect(t.poseOf(ship(106, 100)).x).toBeCloseTo(106);
    t.beginFrame(0, 0);
    expect(t.poseOf(ship(106, 100)).x).toBeCloseTo(100);
  });

  it("interpolates across the arena seam the short way", () => {
    const t = tracker();
    t.capture(ship(5997, 100), TICK_MS);
    t.capture(ship(3, 100), TICK_MS);
    t.beginFrame(0, 0.5);
    expect(t.poseOf(ship(3, 100)).x).toBeCloseTo(0);
    t.beginFrame(0, 0.25);
    expect(t.poseOf(ship(3, 100)).x).toBeCloseTo(5998.5);
  });

  it("turns the short way round the heading seam", () => {
    const t = tracker();
    t.capture(ship(100, 100, 358), TICK_MS);
    t.capture(ship(106, 100, 4), TICK_MS);
    t.beginFrame(0, 0.5);
    const angle = t.poseOf(ship(106, 100, 4)).angle;
    expect(((angle % 360) + 360) % 360).toBeCloseTo(1);
  });

  it("draws an unseen ship at its sim pose", () => {
    const t = tracker();
    t.beginFrame(0, 0.3);
    expect(t.poseOf(ship(42, 43, 44))).toEqual({ x: 42, y: 43, angle: 44 });
  });

  it("reports the flown velocity in px per second", () => {
    const t = tracker();
    fly(t, 100, 3);
    expect(t.velocityOf("s")?.vx).toBeCloseTo(360);
    expect(t.velocityOf("s")?.vy).toBeCloseTo(0);
  });
});

describe("RenderPoseTracker dash glide", () => {
  it("draws a dash as a glide from where the ship was", () => {
    const t = tracker();
    const at = fly(t, 100, 10);
    t.capture(ship(at + 226, 100), TICK_MS);
    t.beginFrame(0, 1);
    expect(t.poseOf(ship(at + 226, 100)).x).toBeCloseTo(at, 0);
    t.beginFrame(90, 1);
    const mid = t.poseOf(ship(at + 226, 100)).x;
    expect(mid).toBeGreaterThan(at + 100);
    expect(mid).toBeLessThan(at + 226);
  });

  it("settles on the sim pose once the glide has run its time", () => {
    const t = tracker();
    const at = fly(t, 100, 10);
    t.capture(ship(at + 226, 100), TICK_MS);
    t.beginFrame(200, 1);
    expect(t.poseOf(ship(at + 226, 100)).x).toBeCloseTo(at + 226);
  });

  it("eases out: most of the distance is covered early", () => {
    const t = tracker();
    const at = fly(t, 100, 10);
    t.capture(ship(at + 226, 100), TICK_MS);
    t.beginFrame(0, 1);
    t.beginFrame(90, 1);
    const half = t.poseOf(ship(at + 226, 100)).x - at;
    expect(half).toBeGreaterThan(226 * 0.7);
  });

  it("glides across the seam without a wrong-way sweep", () => {
    const t = tracker();
    let x = 5800;
    for (let i = 0; i < 10; i++) {
      x = (x + 6) % SIZE;
      t.capture(ship(x, 100), TICK_MS);
    }
    const before = x;
    const after = (before + 226) % SIZE;
    t.capture(ship(after, 100), TICK_MS);
    t.beginFrame(0, 1);
    const drawn = t.poseOf(ship(after, 100)).x;
    expect(Math.abs(drawn - before)).toBeLessThan(1);
    t.beginFrame(60, 1);
    const later = t.poseOf(ship(after, 100)).x;
    const travelled = (((later - before) % SIZE) + SIZE) % SIZE;
    expect(travelled).toBeGreaterThan(100);
    expect(travelled).toBeLessThan(226);
  });

  it("does not glide ordinary flight", () => {
    const t = tracker();
    const at = fly(t, 100, 30);
    t.beginFrame(0, 1);
    expect(t.poseOf(ship(at, 100)).x).toBeCloseTo(at);
  });

  it("does not glide a teleport (a jump beyond the dash range)", () => {
    const t = tracker();
    fly(t, 100, 10);
    t.capture(ship(3000, 3000), TICK_MS);
    t.beginFrame(0, 1);
    expect(t.poseOf(ship(3000, 3000))).toMatchObject({ x: 3000, y: 3000 });
  });

  it("does not glide the first pose it sees", () => {
    const t = tracker();
    t.capture(ship(2000, 2000), TICK_MS);
    t.beginFrame(0, 0.5);
    expect(t.poseOf(ship(2000, 2000))).toMatchObject({ x: 2000, y: 2000 });
  });

  it("does not glide a long step that matches the time it covered (frame hitch)", () => {
    const t = tracker();
    fly(t, 100, 20);
    const hitchMs = 150;
    const jump = (360 * hitchMs) / 1000;
    t.capture(ship(100 + 6 * 20 + jump, 100), hitchMs);
    t.beginFrame(0, 1);
    expect(t.poseOf(ship(100 + 6 * 20 + jump, 100)).x).toBeCloseTo(
      100 + 6 * 20 + jump,
    );
  });

  it("forget and reset drop any glide and history", () => {
    for (const drop of ["forget", "reset"] as const) {
      const t = tracker();
      const at = fly(t, 100, 10);
      t.capture(ship(at + 226, 100), TICK_MS);
      if (drop === "forget") t.forget("s");
      else t.reset();
      t.beginFrame(0, 1);
      expect(t.poseOf(ship(at + 226, 100)).x).toBeCloseTo(at + 226);
      t.capture(ship(at + 232, 100), TICK_MS);
      t.beginFrame(0, 0);
      expect(t.poseOf(ship(at + 232, 100)).x).toBeCloseTo(at + 232);
    }
  });

  it("chains two dashes into one glide that ends on the sim pose", () => {
    const t = tracker();
    const at = fly(t, 100, 10);
    t.capture(ship(at + 226, 100), TICK_MS);
    t.beginFrame(40, 1);
    t.capture(ship(at + 452, 100), TICK_MS);
    t.beginFrame(0, 1);
    expect(t.poseOf(ship(at + 452, 100)).x).toBeLessThan(at + 452 - 200);
    t.beginFrame(300, 1);
    expect(t.poseOf(ship(at + 452, 100)).x).toBeCloseTo(at + 452);
  });
});
