/**
 * Survival roguelite — sector map generation (pure, seeded).
 *
 * A sector map is REGULAR_ROWS rows of 2–4 nodes plus a single boss row.
 * Consecutive rows are joined by a monotone "staircase" of edges, so no
 * two edges cross, every node has at least one way in and one way out,
 * and nodes branch to 1–3 successors (Slay the Spire-style DAG).
 *
 * Fixed rows: row 0 is all combat; the row before the boss is all repair
 * docks. Each sector is guaranteed at least one shop, one event and one
 * elite. See docs/adr/ADR-0004-survival-roguelite-run-structure.md.
 */

import type { RandomGenerator } from "../../utils/random";
import type { NodeType } from "../../data/survival/nodes";
import {
  FIRST_ELITE_ROW,
  FIRST_SHOP_ROW,
  MAX_ROW_WIDTH,
  MIN_ROW_WIDTH,
  NODE_WEIGHTS,
  PRE_BOSS_ROW,
  REGULAR_ROWS,
} from "../../data/survival/sectors";
import { rngFor } from "./RunRng";

/** One node of a sector map. */
export interface MapNode {
  readonly id: string;
  readonly row: number;
  readonly col: number;
  /** Horizontal lane position in [0, 1] for drawing. */
  readonly lane: number;
  readonly type: NodeType;
  /** Ids of the nodes on the next row this node leads to. */
  readonly next: readonly string[];
}

/** A sector's map: rows of nodes, the last row being the boss. */
export interface SectorMap {
  readonly sector: number;
  readonly rows: readonly (readonly MapNode[])[];
}

/** Generation knobs that ascension can turn. */
export interface MapOptions {
  readonly eliteWeightMultiplier: number;
}

type MutableNode = { -readonly [K in keyof MapNode]: MapNode[K] } & {
  next: string[];
};

/**
 * @param seed - The run seed.
 * @param sector - 1-based sector number.
 * @param options - Ascension-driven knobs.
 * @returns The sector's map (same inputs → same map).
 */
export function generateSectorMap(
  seed: number,
  sector: number,
  options: MapOptions = { eliteWeightMultiplier: 1 },
): SectorMap {
  const rng = rngFor(seed, "map", sector);
  const rows: MutableNode[][] = [];
  for (let row = 0; row < REGULAR_ROWS; row++) {
    const width = rng.nextInt(MIN_ROW_WIDTH, MAX_ROW_WIDTH);
    rows.push(makeRow(sector, row, width, (r) => rowType(rng, r, options)));
  }
  rows.push(makeRow(sector, REGULAR_ROWS, 1, () => "boss"));
  for (let row = 0; row < rows.length - 1; row++) {
    linkRows(rng, rows[row]!, rows[row + 1]!);
  }
  guaranteeTypes(rng, rows);
  return { sector, rows };
}

function makeRow(
  sector: number,
  row: number,
  width: number,
  typeOf: (row: number) => NodeType,
): MutableNode[] {
  return Array.from({ length: width }, (_, col) => ({
    id: `s${sector}-r${row}-c${col}`,
    row,
    col,
    // Narrow rows are centred in the lane space of the widest possible row.
    lane: (col + (MAX_ROW_WIDTH - width) / 2) / (MAX_ROW_WIDTH - 1),
    type: typeOf(row),
    next: [],
  }));
}

function rowType(
  rng: RandomGenerator,
  row: number,
  options: MapOptions,
): NodeType {
  if (row === 0) return "combat";
  if (row === PRE_BOSS_ROW) return "repair";
  const weights = Object.entries(NODE_WEIGHTS)
    .filter(([type]) => isAllowedAt(type as NodeType, row))
    .map(([type, weight]) => ({
      type: type as NodeType,
      weight:
        type === "elite" ? weight * options.eliteWeightMultiplier : weight,
    }));
  const total = weights.reduce((sum, w) => sum + w.weight, 0);
  let roll = rng.next() * total;
  for (const entry of weights) {
    roll -= entry.weight;
    if (roll < 0) return entry.type;
  }
  return "combat";
}

function isAllowedAt(type: NodeType, row: number): boolean {
  if (type === "elite") return row >= FIRST_ELITE_ROW;
  if (type === "shop") return row >= FIRST_SHOP_ROW;
  if (type === "repair") return row >= FIRST_SHOP_ROW && row < PRE_BOSS_ROW - 1;
  return true;
}

/**
 * Joins two rows with a non-crossing staircase: walk both rows left to
 * right, linking the current pair and advancing one or both cursors.
 */
function linkRows(
  rng: RandomGenerator,
  from: MutableNode[],
  to: MutableNode[],
): void {
  let i = 0;
  let j = 0;
  link(from[i]!, to[j]!);
  while (i < from.length - 1 || j < to.length - 1) {
    const canI = i < from.length - 1;
    const canJ = j < to.length - 1;
    const step = canI && canJ ? rng.nextInt(0, 2) : canI ? 0 : 1;
    if (step === 0 || step === 2) i += 1;
    if (step === 1 || step === 2) j += 1;
    link(from[i]!, to[j]!);
  }
}

function link(from: MutableNode, to: MutableNode): void {
  if (!from.next.includes(to.id)) from.next.push(to.id);
}

/** Ensures each sector offers at least one shop, one event and one elite. */
function guaranteeTypes(rng: RandomGenerator, rows: MutableNode[][]): void {
  const required: NodeType[] = ["shop", "event", "elite"];
  for (const type of required) {
    const all = rows.flat();
    if (all.some((node) => node.type === type)) continue;
    const candidates = all.filter(
      (node) =>
        node.type === "combat" && node.row > 0 && isAllowedAt(type, node.row),
    );
    const pick = rng.pick(candidates);
    if (pick) pick.type = type;
  }
}

/**
 * @param map - A sector map.
 * @param id - A node id.
 * @returns The node, or undefined.
 */
export function findNode(map: SectorMap, id: string): MapNode | undefined {
  for (const row of map.rows) {
    const node = row.find((n) => n.id === id);
    if (node) return node;
  }
  return undefined;
}

/**
 * @param map - A sector map.
 * @param currentId - The node the fleet sits at, or null at sector start.
 * @returns The nodes the player may travel to next.
 */
export function nextOptions(
  map: SectorMap,
  currentId: string | null,
): MapNode[] {
  if (currentId === null) return [...(map.rows[0] ?? [])];
  const current = findNode(map, currentId);
  if (!current) return [];
  return current.next.flatMap((id) => {
    const node = findNode(map, id);
    return node ? [node] : [];
  });
}

/** What a mystery node turns out to be. */
export type MysteryOutcome = "event" | "combat" | "shop" | "treasure";

/** Odds of each mystery outcome (cumulative order: event, combat, shop, treasure). */
export const MYSTERY_ODDS: Readonly<Record<MysteryOutcome, number>> = {
  event: 0.5,
  combat: 0.2,
  shop: 0.15,
  treasure: 0.15,
};

/**
 * @param seed - The run seed.
 * @param nodeId - The mystery node.
 * @returns What it reveals (stable for the node).
 */
export function revealMystery(seed: number, nodeId: string): MysteryOutcome {
  let roll = rngFor(seed, "mystery", nodeId).next();
  for (const [outcome, odds] of Object.entries(MYSTERY_ODDS)) {
    roll -= odds;
    if (roll < 0) return outcome as MysteryOutcome;
  }
  return "event";
}
