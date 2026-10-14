/**
 * dialGrid — a ship's maneuver dial as a speed x direction grid for the
 * stats tab (columns only for the directions the dial uses). Pure: no Phaser.
 */

import type {
  ManeuverDefinition,
  ManeuverDifficulty,
} from "../../core/types";

/** Direction columns, left to right (turns first, then specials). */
const COLUMN_ORDER: readonly string[] = [
  "turn_left",
  "bank_left",
  "straight",
  "bank_right",
  "turn_right",
  "kturn",
  "segnor_left",
  "segnor_right",
  "tallon_left",
  "tallon_right",
];

/** Short column header (12 px text) and spoken name per direction. */
const DIRECTION_NAMES: Readonly<Record<string, { label: string; name: string }>> = {
  turn_left: { label: "\u2190", name: "Hard turn left" },
  bank_left: { label: "\u2196", name: "Bank left" },
  straight: { label: "\u2191", name: "Straight" },
  bank_right: { label: "\u2197", name: "Bank right" },
  turn_right: { label: "\u2192", name: "Hard turn right" },
  kturn: { label: "S", name: "Snap Turn" },
  segnor_left: { label: "HL", name: "Hook Loop left" },
  segnor_right: { label: "HR", name: "Hook Loop right" },
  tallon_left: { label: "KL", name: "Knife Roll left" },
  tallon_right: { label: "KR", name: "Knife Roll right" },
};

/** One column of the grid. */
export interface DialColumn {
  readonly direction: string;
  readonly label: string;
  readonly name: string;
}

/** One cell: the maneuver's colour, or null when the dial has none there. */
export interface DialCell {
  readonly direction: string;
  readonly difficulty: ManeuverDifficulty | null;
}

/** One speed row. */
export interface DialRow {
  readonly speed: number;
  readonly cells: readonly DialCell[];
}

/** The whole grid. */
export interface DialGrid {
  readonly columns: readonly DialColumn[];
  readonly rows: readonly DialRow[];
  readonly counts: Readonly<Record<ManeuverDifficulty, number>>;
}

/**
 * @param direction - A maneuver direction.
 * @returns Its header label and spoken name.
 */
export function directionName(direction: string): { label: string; name: string } {
  return (
    DIRECTION_NAMES[direction] ?? {
      label: direction.slice(0, 2).toUpperCase(),
      name: direction.replace(/_/g, " "),
    }
  );
}

/**
 * @param dial - A ship's dial.
 * @returns The dial as a grid: used directions as columns, speeds as rows.
 */
export function buildDialGrid(dial: readonly ManeuverDefinition[]): DialGrid {
  const used = new Set<string>(dial.map((m) => m.direction));
  const columns = [
    ...COLUMN_ORDER.filter((d) => used.has(d)),
    ...[...used].filter((d) => !COLUMN_ORDER.includes(d)),
  ].map((direction) => ({ direction, ...directionName(direction) }));
  const speeds = [...new Set(dial.map((m) => m.speed))].sort((a, b) => a - b);
  const rows = speeds.map((speed) => ({
    speed,
    cells: columns.map((column) => ({
      direction: column.direction,
      difficulty:
        dial.find((m) => m.speed === speed && m.direction === column.direction)
          ?.difficulty ?? null,
    })),
  }));
  const counts = { green: 0, white: 0, red: 0 };
  for (const m of dial) counts[m.difficulty] += 1;
  return { columns, rows, counts };
}
