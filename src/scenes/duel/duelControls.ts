/**
 * duelControls — the flight controls the duel scenes (Dogfight, Ace Duel)
 * advertise on their setup screens and in-battle hint, read from the live
 * key bindings so a rebind shows up everywhere.
 */

import type { ActionIntent } from "../../input/InputTypes";
import { keyboardLabelFor, quickTipLine } from "../../ui/ControlsReference";

/** A control the duel scenes advertise. */
interface DuelControlTip {
  readonly label: string;
  readonly intents: readonly ActionIntent[];
}

/** Controls in the order they are listed. Weapons autofire (no intent). */
export const DUEL_CONTROL_TIPS: readonly DuelControlTip[] = [
  { label: "Steer", intents: ["STEER_LEFT", "STEER_RIGHT"] },
  { label: "Hard turn", intents: ["SHARP_TURN_LEFT", "SHARP_TURN_RIGHT"] },
  { label: "K-turn", intents: ["KTURN"] },
  { label: "Boost", intents: ["BOOST"] },
  { label: "Throttle", intents: ["THRUST_UP", "THRUST_DOWN"] },
  { label: "Weapon", intents: [] },
  { label: "Pause", intents: ["PAUSE"] },
];

/** Tips per line of the in-battle hint. */
const TIPS_PER_HINT_LINE = 2;
/** Separator between tips on one hint line. */
const HINT_SEPARATOR = "   \u00b7   ";

/**
 * One-line control summary for a setup screen footer.
 *
 * @returns e.g. "Steer: ← / →   ·   Hard turn: Q / E …".
 */
export function duelControlsLine(): string {
  return quickTipLine(DUEL_CONTROL_TIPS);
}

/**
 * Compact multi-line control hint for the in-battle HUD corner.
 *
 * @returns Lines of at most two tips each.
 */
export function duelControlsHintLines(): string[] {
  const tips = DUEL_CONTROL_TIPS.map(
    (tip) => `${tip.label} ${keyboardLabelFor(tip.intents)}`,
  );
  const lines: string[] = [];
  for (let i = 0; i < tips.length; i += TIPS_PER_HINT_LINE) {
    lines.push(tips.slice(i, i + TIPS_PER_HINT_LINE).join(HINT_SEPARATOR));
  }
  return lines;
}
