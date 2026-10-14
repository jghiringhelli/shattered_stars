/**
 * Quick controls shown in the welcome panel: the rows come from the player's
 * live key bindings (ControlsReference), so rebinding is reflected.
 */

import type { ActionIntent } from "../../input/InputTypes";
import { keyboardLabelFor } from "../ControlsReference";

/** One row of the cheat sheet. */
export interface ControlRow {
  readonly label: string;
  readonly keys: string;
}

const QUICK_ROWS: ReadonlyArray<{
  readonly label: string;
  readonly intents: readonly ActionIntent[];
}> = [
  { label: "Steer", intents: ["STEER_LEFT", "STEER_RIGHT"] },
  { label: "Throttle up / down", intents: ["THRUST_UP", "THRUST_DOWN"] },
  { label: "Primary weapon", intents: [] },
  { label: "Fire secondary / ordnance", intents: ["FIRE_SECONDARY"] },
  { label: "Switch weapon", intents: ["WEAPON_CYCLE"] },
  { label: "Boost", intents: ["BOOST"] },
  { label: "Barrel roll", intents: ["BARREL_ROLL"] },
  { label: "Snap turn (U-turn)", intents: ["KTURN"] },
  { label: "Hook loop", intents: ["SEGNOR_LEFT", "SEGNOR_RIGHT"] },
  { label: "Knife roll", intents: ["TALLON_LEFT", "TALLON_RIGHT"] },
  { label: "Pause", intents: ["PAUSE"] },
];

/** @returns The cheat-sheet rows for the current key bindings. */
export function controlRows(): ControlRow[] {
  return QUICK_ROWS.map((row) => ({
    label: row.label,
    keys: keyboardLabelFor(row.intents),
  }));
}
