/**
 * hotkeyLegendModel — pure, context-aware list of the keys, buttons and
 * gestures a mode uses, built from the curated Controls reference so every
 * label is read from the LIVE bindings (rebinding shows immediately).
 */

import {
  CONTROL_GROUPS,
  gamepadLabelFor,
  keyboardLabelFor,
  type ControlRow,
} from "../ControlsReference";

/** Kinds of battle the legend can describe. */
export type LegendContext =
  | "arcade"
  | "squad"
  | "campaign"
  | "duel"
  | "survival";

/** One legend line. */
export interface LegendRow {
  readonly label: string;
  readonly keyboard: string;
  readonly gamepad: string;
}

/** A titled block of legend lines. */
export interface LegendSection {
  readonly title: string;
  readonly rows: readonly LegendRow[];
}

/** Rows of the Flight / Weapons groups every real-time mode shares. */
const FLIGHT_ROWS = [
  "Steer",
  "Throttle Up / Down",
  "Maneuver Key (Snap / Hook / Knife)",
  "Snap Turn (180°)",
  "Boost Dash",
  "Barrel Roll",
  "Hook Loop",
  "Knife Roll",
  "Primary Weapon",
  "Fire Secondary / Bomb",
  "Cycle Weapon",
  "Cloak",
] as const;

const SQUAD_ROWS = ["Mark Target (squad focus)"] as const;
const CREW_ROWS = ["Cycle Crew Role", "Commander Orders"] as const;
const HERO_ROWS = ["Hero Powers (Campaign)"] as const;
const SYSTEM_ROWS = ["Pause"] as const;

/** Control-reference row labels shown per context. */
export const LEGEND_ROW_LABELS: Readonly<
  Record<LegendContext, readonly string[]>
> = {
  duel: [...FLIGHT_ROWS, ...SYSTEM_ROWS],
  arcade: [...FLIGHT_ROWS, ...SQUAD_ROWS, ...CREW_ROWS, ...SYSTEM_ROWS],
  squad: [...FLIGHT_ROWS, ...SQUAD_ROWS, ...CREW_ROWS, ...SYSTEM_ROWS],
  survival: [...FLIGHT_ROWS, ...SYSTEM_ROWS],
  campaign: [...FLIGHT_ROWS, ...SQUAD_ROWS, ...HERO_ROWS, ...SYSTEM_ROWS],
};

/** Keys that are not rebindable intents but always work. */
export const FIXED_LEGEND_ROWS: readonly LegendRow[] = [
  { label: "Hotkey legend", keyboard: "? / F1", gamepad: "—" },
  { label: "Restart (pause / results)", keyboard: "R", gamepad: "—" },
];

/** Label sources the model depends on (injectable for tests). */
export interface LegendLabels {
  readonly keyboard: (intents: ControlRow["intents"]) => string;
  readonly gamepad: (intents: ControlRow["intents"]) => string;
}

const LIVE_LABELS: LegendLabels = {
  keyboard: (intents) => keyboardLabelFor(intents),
  gamepad: (intents) => gamepadLabelFor(intents),
};

/**
 * @param context - The mode being played.
 * @param labels - Label sources (default: the live bindings).
 * @returns Sections holding only the rows relevant to the mode (in the
 *   Controls screen's category order) plus the fixed system keys.
 */
export function legendSections(
  context: LegendContext,
  labels: LegendLabels = LIVE_LABELS,
): readonly LegendSection[] {
  const wanted = new Set(LEGEND_ROW_LABELS[context]);
  const sections: LegendSection[] = [];
  for (const group of CONTROL_GROUPS) {
    const rows = group.rows
      .filter((row) => wanted.has(row.label))
      .map((row) => ({
        label: row.label,
        keyboard: labels.keyboard(row.intents),
        gamepad: labels.gamepad(row.intents),
      }));
    if (rows.length > 0) sections.push({ title: group.title, rows });
  }
  sections.push({ title: "Always", rows: FIXED_LEGEND_ROWS });
  return sections;
}
