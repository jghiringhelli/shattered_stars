/**
 * Continuous telemetry sampling + Role Fidelity scoring.
 *
 * Reads live ArcadeShip state (control.speed/currentManeuver, stress.level/
 * isStressed) via page.evaluate, polling at a fixed interval for the whole
 * drill/session — not a single snapshot like verify_loop.ts.
 */

import type { Page } from "playwright";
import type { ArchetypeRole, RoleFidelityScore, TelemetryFrame } from "./types";

interface RawShip {
  shipId: string;
  owner: string;
  x: number;
  y: number;
  angle: number;
  hull: number;
  maxHull: number;
  speed: number;
  stressLevel: number;
  isStressed: boolean;
  maneuver: string | null;
}

/** One poll of every ship's kinematic + stress state in the given scene. */
export async function sampleShips(
  page: Page,
  sceneKey: string,
  startMs: number,
): Promise<TelemetryFrame[]> {
  const raw = (await page.evaluate((key: string) => {
    const scene = (window as any).game?.scene.getScene(key) as any;
    const map = scene?.ships;
    const src = map ? Array.from(map.values()) : [];
    return src.map((sh: any) => ({
      shipId: sh.id,
      owner: sh.owner,
      x: sh.x,
      y: sh.y,
      angle: sh.angle,
      hull: sh.hull,
      maxHull: sh.maxHull ?? sh.hull,
      speed: sh.control?.speed ?? 0,
      stressLevel: sh.stress?.level ?? 0,
      isStressed: sh.stress?.isStressed ?? false,
      maneuver: sh.control?.currentManeuver ?? null,
    }));
  }, sceneKey)) as RawShip[];
  const tMs = Date.now() - startMs;
  return raw.map((r) => ({ ...r, tMs }));
}

/** Polls sampleShips at `intervalMs` for `durationMs`, collecting every frame. */
export async function recordTelemetry(
  page: Page,
  sceneKey: string,
  durationMs: number,
  intervalMs = 250,
): Promise<TelemetryFrame[]> {
  const startMs = Date.now();
  const frames: TelemetryFrame[] = [];
  while (Date.now() - startMs < durationMs) {
    frames.push(...(await sampleShips(page, sceneKey, startMs)));
    await page.waitForTimeout(intervalMs);
  }
  return frames;
}

/** Raw descriptive metrics for one ship's frames. Verdict filled in by rankRoleDifferentiation. */
export function computeRoleFidelity(
  frames: readonly TelemetryFrame[],
  shipId: string,
  role: ArchetypeRole,
  drillName: string,
): RoleFidelityScore {
  const own = frames.filter((f) => f.shipId === shipId);
  if (own.length === 0) {
    return {
      shipId,
      role,
      drill: drillName,
      avgSpeed: 0,
      maxStressLevel: 0,
      cyclesToFirstStress: null,
      stressedFraction: 0,
      verdict: "inconclusive",
      detail: "no telemetry samples captured",
    };
  }
  const avgSpeed = own.reduce((s, f) => s + f.speed, 0) / own.length;
  const maxStressLevel = Math.max(...own.map((f) => f.stressLevel));
  const firstStressIdx = own.findIndex((f) => f.isStressed);
  const stressedFraction = own.filter((f) => f.isStressed).length / own.length;
  return {
    shipId,
    role,
    drill: drillName,
    avgSpeed,
    maxStressLevel,
    cyclesToFirstStress: firstStressIdx === -1 ? null : firstStressIdx,
    stressedFraction,
    verdict: "inconclusive",
    detail: `avgSpeed=${avgSpeed.toFixed(2)} maxStress=${maxStressLevel.toFixed(2)} stressedFraction=${stressedFraction.toFixed(2)}`,
  };
}

/** Expected relative fatigue tolerance under an identical aggressive-maneuvering drill. */
const NIMBLE_ROLES: readonly ArchetypeRole[] = ["light_fighter", "interceptor"];
const RIGID_ROLES: readonly ArchetypeRole[] = ["bomber", "capital"];

/**
 * Cross-checks stress accumulation across roles under the same drill.
 * Nimble ships (light_fighter/interceptor) are expected to accumulate LESS
 * stress than rigid ships (bomber/capital) — if that ordering is violated,
 * movement is not producing the intended role differentiation ("role bleed").
 */
export function rankRoleDifferentiation(scores: readonly RoleFidelityScore[]): {
  readonly scored: readonly RoleFidelityScore[];
  readonly findings: readonly string[];
} {
  const avg = (roles: readonly ArchetypeRole[]): number => {
    const subset = scores.filter((s) => roles.includes(s.role));
    if (subset.length === 0) return NaN;
    return subset.reduce((s, x) => s + x.stressedFraction, 0) / subset.length;
  };
  const nimbleAvg = avg(NIMBLE_ROLES);
  const rigidAvg = avg(RIGID_ROLES);
  const findings: string[] = [];
  const differentiates =
    Number.isFinite(nimbleAvg) && Number.isFinite(rigidAvg)
      ? nimbleAvg < rigidAvg
      : null;
  if (differentiates === false) {
    findings.push(
      `role_bleed: nimble roles (${NIMBLE_ROLES.join("/")}) stressed ${nimbleAvg.toFixed(2)} vs rigid roles (${RIGID_ROLES.join("/")}) at ${rigidAvg.toFixed(2)} under the identical drill — expected nimble < rigid`,
    );
  }
  const verdict =
    differentiates == null
      ? "inconclusive"
      : differentiates
        ? "matches_archetype"
        : "role_bleed";
  const scored = scores.map((s) =>
    NIMBLE_ROLES.includes(s.role) || RIGID_ROLES.includes(s.role)
      ? { ...s, verdict }
      : s,
  );
  return { scored, findings };
}
