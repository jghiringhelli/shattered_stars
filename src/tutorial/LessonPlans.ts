/**
 * LessonPlans — the inputs each Flight School lesson asks for: the key chips
 * (labelled with the player's bound keys) and the stages of its gesture.
 * Pure: no Phaser.
 */

import type { ActionIntent } from "../input/InputTypes";
import type { KeyLabeler } from "./FlightSchoolSteps";
import { DOUBLE_TAP_WINDOW_MS } from "../arcade/ArcadeInputGestures";
import { MANEUVER_DOUBLE_TAP_WINDOW_MS } from "../arcade/ManeuverKey";
import {
  type GestureStage,
  type InputChipSpec,
  type LessonInputPlan,
} from "./LessonInputs";

const chip = (label: string, ...intents: ActionIntent[]): InputChipSpec => ({
  label,
  intents,
});

/** The chips most lessons use, labelled with the bound keys. */
interface Chips {
  readonly sides: InputChipSpec;
  readonly maneuver: InputChipSpec;
  readonly up: InputChipSpec;
  readonly down: InputChipSpec;
  readonly turns: InputChipSpec;
  readonly mark: InputChipSpec;
}

type Plans = Readonly<Record<string, LessonInputPlan>>;

const single = (
  hint: string,
  mode: GestureStage["mode"],
  chips: InputChipSpec[],
  extra: Partial<GestureStage> = {},
): LessonInputPlan => ({
  stages: [{ hint, mode, chips, ...extra }],
  tracked: true,
});

/** Chips that only light up: the input alone cannot prove the lesson. */
const looks = (hint: string, chips: InputChipSpec[]): LessonInputPlan => ({
  stages: [{ hint, mode: "hold", chips }],
  tracked: false,
});

function chipsOf(keys: KeyLabeler): Chips {
  return {
    sides: chip(
      `${keys("STEER_LEFT")} / ${keys("STEER_RIGHT")}`,
      "STEER_LEFT",
      "STEER_RIGHT",
    ),
    maneuver: chip(keys("MANEUVER"), "MANEUVER"),
    up: chip(keys("THRUST_UP"), "THRUST_UP"),
    down: chip(keys("THRUST_DOWN"), "THRUST_DOWN"),
    turns: chip(
      `${keys("SHARP_TURN_LEFT")} / ${keys("SHARP_TURN_RIGHT")}`,
      "SHARP_TURN_LEFT",
      "SHARP_TURN_RIGHT",
    ),
    mark: chip(keys("MARK_TARGET"), "MARK_TARGET"),
  };
}

/** Throttle, steering and the hard turn. */
function flightBasics(c: Chips): Plans {
  return {
    throttle_up: single("tap", "tap", [c.up], { taps: 2 }),
    throttle_down: single("tap", "tap", [c.down], { taps: 2 }),
    drift: single("tap", "tap", [c.sides]),
    bank: single("hold", "hold", [c.sides]),
    hard_turn: single("tap", "tap", [c.turns]),
  };
}

/** Snap turn, Hook, Knife, boost and barrel roll. */
function tricks(c: Chips): Plans {
  /** The real gestures' own double-tap windows. */
  const arrows = { taps: 2, windowMs: DOUBLE_TAP_WINDOW_MS };
  const side: GestureStage = {
    hint: "then",
    mode: "hold",
    chips: [c.sides],
    keepPrevious: true,
  };
  return {
    kturn: single("tap", "tap", [c.maneuver]),
    segnor: {
      stages: [{ hint: "hold", mode: "hold", chips: [c.maneuver] }, side],
      tracked: true,
    },
    tallon: {
      stages: [
        { hint: "tap", mode: "tap", chips: [c.maneuver] },
        {
          hint: "tap again, keep held",
          mode: "tap",
          chips: [c.maneuver],
          windowMs: MANEUVER_DOUBLE_TAP_WINDOW_MS,
        },
        side,
      ],
      tracked: true,
    },
    boost: single("double-tap", "tap", [c.up], arrows),
    barrel_roll: single("double-tap", "tap", [c.sides], arrows),
  };
}

/** Weapons, marking, the radar, the status ring and the final exam. */
function combatLessons(c: Chips, keys: KeyLabeler): Plans {
  return {
    primary_fire: looks("steer", [c.sides]),
    secondary: looks("fire", [chip(keys("FIRE_SECONDARY"), "FIRE_SECONDARY")]),
    mark: single("tap", "tap", [c.mark]),
    radar: looks("steer", [c.sides]),
    status_ring: single("tap", "tap", [chip(keys("CONFIRM"), "CONFIRM")]),
    final_fight: looks("mark", [c.mark]),
  };
}

/**
 * @param stepId - A Flight School lesson id.
 * @param keys - Labels the player's bound keys.
 * @returns The lesson's input plan, or null for an unknown lesson.
 */
export function lessonInputPlan(
  stepId: string,
  keys: KeyLabeler,
): LessonInputPlan | null {
  const chips = chipsOf(keys);
  const plans: Plans = {
    ...flightBasics(chips),
    ...tricks(chips),
    ...combatLessons(chips, keys),
  };
  return plans[stepId] ?? null;
}
