/**
 * plan — the balance report's sections and their jobs. Each section's work
 * is split into seed blocks so the pool keeps every core busy; `scale`
 * multiplies every block's seed count (0.25 = a quick look).
 */

import type { FactionId } from "../../src/config";
import { SCENARIO_IDS } from "../../src/arcade/scenarios";
import { ACE_MATCHUPS } from "../../src/data/AceMatchups";
import { SHIP_DEFINITIONS } from "../../src/data/ShipDefinitions";
import {
  CURVE_MODES,
  DIFFICULTY_LABELS,
  type CurveMode,
} from "../../src/simulation/balance/difficultyCurve";
import { factionPairs } from "../../src/simulation/balance/factionMatrix";
import type {
  BalanceJob,
  SeedBlock,
} from "../../src/simulation/balance/balanceJobs";
import type { KeyedJob } from "./pool";

/** Every section the report knows, in report order. */
export const SECTIONS = [
  "classic",
  "reinforced",
  "preset",
  "ace",
  "dogfight",
  "difficulty",
  "scenario",
  "ships",
] as const;
export type SectionId = (typeof SECTIONS)[number];

/** Seeds per block and blocks per cell, by section (scale 1). */
const SIZES: Readonly<Record<SectionId, { blocks: number; seeds: number }>> = {
  classic: { blocks: 4, seeds: 10 },
  reinforced: { blocks: 5, seeds: 4 },
  preset: { blocks: 2, seeds: 10 },
  ace: { blocks: 3, seeds: 20 },
  dogfight: { blocks: 2, seeds: 30 },
  difficulty: { blocks: 3, seeds: 4 },
  scenario: { blocks: 2, seeds: 4 },
  ships: { blocks: 1, seeds: 4 },
};

/** Difficulty seeds per block by mode (a mode's cell multiplies them). */
const CURVE_SEEDS: Readonly<Record<CurveMode, number>> = {
  dogfight: 20,
  ace: 3,
  classic: 6,
  reinforced: 3,
  scenario: 3,
};

/** Faction pairings each scenario is played with (lists swapped per seed). */
export const SCENARIO_PAIRS: ReadonlyArray<[FactionId, FactionId]> = [
  ["terran_hegemony", "void_corsairs"],
  ["free_confederation", "ascendant_empire"],
  ["synthetic_collective", "terran_hegemony"],
  ["void_corsairs", "free_confederation"],
  ["ascendant_empire", "synthetic_collective"],
];

/** Seed bases are spread so sections never share seeds. */
const SEED_STRIDE = 1000;

/**
 * @param section - Section id.
 * @param cell - Cell id within the section.
 * @param block - Block index.
 * @returns The result key.
 */
export function keyOf(section: string, cell: string, block: number): string {
  return `${section}|${cell}|${block}`;
}

/**
 * @param sections - Sections to run.
 * @param scale - Seed multiplier.
 * @returns Every keyed job, heaviest sections first.
 */
export function buildPlan(
  sections: ReadonlySet<SectionId>,
  scale: number,
): KeyedJob[] {
  const jobs: KeyedJob[] = [];
  const add = (
    section: SectionId,
    cell: string,
    make: (seeds: SeedBlock) => BalanceJob,
    seedsPerBlock = SIZES[section].seeds,
  ): void => {
    const { blocks } = SIZES[section];
    const count = Math.max(1, Math.round(seedsPerBlock * scale));
    for (let b = 0; b < blocks; b++)
      jobs.push({
        key: keyOf(section, cell, b),
        job: make({ base: (b + 1) * SEED_STRIDE, count }),
      });
  };
  for (const section of [
    "reinforced",
    "ships",
    "difficulty",
    "scenario",
  ] as const)
    if (sections.has(section)) planSection(section, add);
  for (const section of ["classic", "preset", "ace", "dogfight"] as const)
    if (sections.has(section)) planSection(section, add);
  return jobs;
}

type Adder = (
  section: SectionId,
  cell: string,
  make: (seeds: SeedBlock) => BalanceJob,
  seedsPerBlock?: number,
) => void;

function planSection(section: SectionId, add: Adder): void {
  switch (section) {
    case "classic":
    case "preset":
    case "reinforced":
      for (const [a, b] of factionPairs())
        add(section, `${a}:${b}`, (seeds) => ({ kind: section, a, b, seeds }));
      return;
    case "ships":
      for (const id of skirmishHulls())
        add(section, id, (seeds) => ({
          kind: "shipValue",
          definitionId: id,
          seeds,
        }));
      return;
    case "ace":
      for (const m of ACE_MATCHUPS)
        for (const tier of ["average", "expert"] as const)
          add(section, `${m.id}:${tier}`, (seeds) => ({
            kind: "ace",
            matchupId: m.id,
            tier,
            abilities: true,
            seeds,
          }));
      return;
    case "dogfight":
      for (const tier of ["novice", "average", "expert"] as const)
        add(section, tier, (seeds) => ({ kind: "dogfight", tier, seeds }));
      return;
    case "difficulty":
      for (const mode of CURVE_MODES)
        for (const label of DIFFICULTY_LABELS)
          add(
            section,
            `${mode}:${label}`,
            (seeds) => ({ kind: "difficulty", mode, label, seeds }),
            CURVE_SEEDS[mode],
          );
      return;
    case "scenario":
      for (const scenario of SCENARIO_IDS)
        for (const reinforced of [false, true])
          for (const [a, b] of SCENARIO_PAIRS)
            add(
              section,
              `${scenario}:${reinforced ? "r" : "c"}:${a}:${b}`,
              (seeds) => ({
                kind: "scenario",
                scenario,
                a,
                b,
                reinforced,
                seeds,
              }),
            );
      return;
  }
}

/** @returns Every hull Skirmish can field (no capital, no huge). */
export function skirmishHulls(): string[] {
  return Object.values(SHIP_DEFINITIONS)
    .filter((s) => s.role !== "capital" && s.baseStats.size !== "huge")
    .map((s) => s.id)
    .sort();
}
