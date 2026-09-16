/**
 * Archetype drills — the same scripted maneuver sequence applied to different
 * ship classes so their divergent stress/speed response can be measured and
 * compared. This operationalizes the design hypothesis: movement identity
 * (speed, stress thresholds, actions) should produce the ship's role, not
 * just its flavor text.
 *
 * Timing constants below mirror src/arcade/ArcadeInputGestures.ts exactly:
 * BANK_HOLD_THRESHOLD_MS=250 (hold longer = hard turn), DOUBLE_TAP_WINDOW_MS=300,
 * CHORD_WINDOW_MS=150 (simultaneous L+R = barrel roll).
 */

import type { Page } from "playwright";
import type { ArchetypeDrill, DrillStep, TelemetryFrame } from "./types";
import { sampleShips } from "./telemetry";

const step = (
  key: string,
  downMs: number,
  waitAfterMs: number,
  shift = false,
): DrillStep => ({ key, shift, downMs, waitAfterMs });

/**
 * One repetition: hard turn left, hard turn right, K-turn, boost dash, barrel roll.
 * Hard turns hold past the 250ms bank threshold to force full (red-eligible)
 * deflection; K-turn and boost each apply an instant stress spike.
 */
const AGGRESSIVE_REP: readonly DrillStep[] = [
  step("ArrowLeft", 600, 300),
  step("ArrowRight", 600, 300),
  step("Z", 60, 700),
  step("ArrowUp", 60, 80),
  step("ArrowUp", 60, 500),
  step("ArrowLeft", 60, 60),
];

const REPEAT_COUNT = 4;

/** The canonical stress drill: AGGRESSIVE_REP repeated to accumulate fatigue. */
export const STRESS_DRILL: ArchetypeDrill = {
  name: "aggressive_maneuvering",
  steps: Array.from({ length: REPEAT_COUNT }, () => AGGRESSIVE_REP).flat(),
};

/** One repetition: bank, fire, bank the other way, fire, boost, fire — real dogfighting. */
const COMBAT_REP: readonly DrillStep[] = [
  step("ArrowLeft", 300, 100),
  step("Space", 150, 150),
  step("ArrowRight", 300, 100),
  step("Space", 150, 150),
  step("ArrowUp", 60, 80),
  step("ArrowUp", 60, 300),
  step("Space", 150, 150),
];

const COMBAT_REPEAT_COUNT = 6;

/** Player-piloted combat drill for modes without a squad builder (Dogfight, Survival). */
export const COMBAT_DRILL: ArchetypeDrill = {
  name: "player_combat",
  steps: Array.from({ length: COMBAT_REPEAT_COUNT }, () => COMBAT_REP).flat(),
};

const KEY_CODES: Record<string, number> = {
  ArrowUp: 38,
  ArrowDown: 40,
  ArrowLeft: 37,
  ArrowRight: 39,
  Shift: 16,
  Z: 90,
  Q: 81,
  E: 69,
  T: 84,
  Space: 32,
};

/** Dispatch a keydown/keyup pair directly to window, matching Phaser's listener target. */
async function tapKey(
  page: Page,
  key: string,
  shift: boolean,
  downMs: number,
): Promise<void> {
  const keyCode = KEY_CODES[key] ?? 0;
  await page.evaluate(
    ([k, kc, sh]: [string, number, boolean]) => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: k,
          code: k,
          keyCode: kc,
          which: kc,
          shiftKey: sh,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    [key, keyCode, shift] as [string, number, boolean],
  );
  await page.waitForTimeout(downMs);
  await page.evaluate(
    ([k, kc, sh]: [string, number, boolean]) => {
      window.dispatchEvent(
        new KeyboardEvent("keyup", {
          key: k,
          code: k,
          keyCode: kc,
          which: kc,
          shiftKey: sh,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    [key, keyCode, shift] as [string, number, boolean],
  );
}

/** Runs every step of a drill in sequence, sampling telemetry once per step. */
export async function runDrillWithTelemetry(
  page: Page,
  drill: ArchetypeDrill,
  sceneKey: string,
  startMs: number,
): Promise<TelemetryFrame[]> {
  const frames: TelemetryFrame[] = [];
  for (const s of drill.steps) {
    await tapKey(page, s.key, s.shift, s.downMs);
    if (s.waitAfterMs > 0) await page.waitForTimeout(s.waitAfterMs);
    frames.push(...(await sampleShips(page, sceneKey, startMs)));
  }
  return frames;
}
