/**
 * AI behaviour profile — flies the real BotPilot / SquadCommand through the
 * skill arena (1v1 and 3v3, every tier, several hull pairs) and prints, per
 * ship, what the pilot did: aim and range, shots, closing speed, heading
 * reversals, orbiting, throttle flapping, specials, stress, running, idle
 * flight and seam behaviour.
 *
 *   npm run profile:ai -- [--seconds 120] [--seeds 2] [--only <text>] [--ships]
 *
 * Without --ships only the per-scenario averages are printed.
 */

import type { ShipEntry } from "../src/simulation/skill/ArenaSpec";
import { profileBattle } from "../src/simulation/skill/BehaviourRun";
import type { ShipProfile } from "../src/simulation/skill/BehaviourProfile";
import type { BotTier } from "../src/arcade/ai/BotTypes";

interface Scenario {
  readonly name: string;
  readonly A: readonly string[];
  readonly B: readonly string[];
  readonly tierA: BotTier;
  readonly tierB: BotTier;
}

const TIERS: readonly BotTier[] = ["novice", "average", "expert"];

const DUELS: readonly (readonly [string, string])[] = [
  ["terran_centurion", "terran_viper"],
  ["terran_gladius", "confed_raven"],
  ["terran_hammer", "terran_stiletto"],
  ["terran_bastion", "confed_falcon"],
  ["terran_sentinel", "corsair_blade"],
  ["corsair_fang", "confed_wasp"],
];

const SQUADS: readonly (readonly [readonly string[], readonly string[]])[] = [
  [
    ["terran_gladius", "terran_viper", "terran_hammer"],
    ["corsair_cutlass", "corsair_blade", "corsair_reaver"],
  ],
  [
    ["confed_falcon", "confed_raven", "confed_harrier"],
    ["terran_centurion", "terran_viper", "terran_sentinel"],
  ],
  [
    [
      "terran_gladius",
      "terran_viper",
      "terran_hammer",
      "terran_sentinel",
      "terran_bastion",
    ],
    [
      "corsair_cutlass",
      "corsair_blade",
      "corsair_torpedo_boat",
      "corsair_specter",
      "corsair_reaver",
    ],
  ],
  [
    ["terran_imperator", "terran_gladius", "terran_viper"],
    ["corsair_dreadnought", "corsair_cutlass", "corsair_blade"],
  ],
];

function scenarios(): Scenario[] {
  const list: Scenario[] = [];
  for (const tier of TIERS)
    for (const [a, b] of DUELS)
      list.push({
        name: `1v1 ${tier} ${a} v ${b}`,
        A: [a],
        B: [b],
        tierA: tier,
        tierB: tier,
      });
  for (const tier of TIERS)
    for (const [a, b] of SQUADS)
      list.push({
        name: `3v3 ${tier} ${a[0]}.. v ${b[0]}..`,
        A: a,
        B: b,
        tierA: tier,
        tierB: tier,
      });
  return list;
}

function entries(ids: readonly string[], tier: BotTier): ShipEntry[] {
  return ids.map((definitionId) => ({ definitionId, tier }));
}

interface Totals {
  ships: number;
  [key: string]: number;
}

function perMinute(profile: ShipProfile, count: number): number {
  return profile.aliveMs > 0 ? (count * 60000) / profile.aliveMs : 0;
}

function fraction(profile: ShipProfile, ms: number): number {
  return profile.aliveMs > 0 ? ms / profile.aliveMs : 0;
}

function metrics(p: ShipProfile): Record<string, number> {
  const specials =
    p.specialsFlown.kturn + p.specialsFlown.segnor + p.specialsFlown.tallon;
  const seconds = p.aliveMs / 1000;
  return {
    aliveS: seconds,
    arcRange: fraction(p, p.inArcAndRangeMs),
    arc: fraction(p, p.inArcMs),
    range: fraction(p, p.inRangeMs),
    rear: fraction(p, p.inTargetRearMs),
    shotsMin: perMinute(p, p.shots),
    firstShotS: p.firstShotMs === null ? -1 : p.firstShotMs / 1000,
    closing: fraction(p, p.closingMs),
    opening: fraction(p, p.openingMs),
    closePx: p.rangeSamples > 0 ? p.closingPxSum / p.rangeSamples : 0,
    revMin: perMinute(p, p.reversals),
    revSeam: perMinute(p, p.reversalsNearSeam),
    orbitMin: perMinute(p, p.orbits),
    thrS: seconds > 0 ? p.throttleChanges / seconds : 0,
    specMin: perMinute(p, specials),
    reqMin: perMinute(p, p.decisions.specialRequests),
    reqStrMin: perMinute(p, p.decisions.specialRequestsWhileStressed),
    reflexMin: perMinute(
      p,
      p.decisions.boostRequests + p.decisions.rollRequests,
    ),
    stressed: fraction(p, p.stressedMs),
    stressAvg: fraction(p, p.stressSum),
    running: fraction(p, p.runningMs),
    idle: fraction(p, p.idleInRangeMs),
    seamMin: perMinute(p, p.seamCrossings),
    capped: fraction(p, p.cappedMs),
    turnShare: p.cycles > 0 ? p.turnCycles / p.cycles : 0,
    spinMin: perMinute(p, p.spinRuns),
    stacked: fraction(p, p.stackedMs),
    allyPx: p.allyMs > 0 ? p.allyDistanceSum / p.allyMs : 0,
    asPlanned: p.cycles > 0 ? p.asPlanned / p.cycles : 0,
    offThr: p.cycles > 0 ? p.offThrottle / p.cycles : 0,
    thrShare: p.cycles > 0 ? p.throttleShareSum / p.cycles : 0,
  };
}

const COLUMNS: readonly string[] = [
  "aliveS",
  "arcRange",
  "arc",
  "range",
  "rear",
  "shotsMin",
  "firstShotS",
  "closing",
  "opening",
  "closePx",
  "revMin",
  "orbitMin",
  "thrS",
  "specMin",
  "reqMin",
  "reqStrMin",
  "reflexMin",
  "stressed",
  "running",
  "idle",
  "seamMin",
  "capped",
  "turnShare",
  "spinMin",
  "thrShare",
  "asPlanned",
  "offThr",
  "stacked",
  "allyPx",
];

function row(label: string, values: Record<string, number>): string {
  const cells = COLUMNS.map((c) =>
    (values[c] ?? 0).toFixed(c === "closePx" ? 0 : 2).padStart(9),
  );
  return `${label.padEnd(44)}${cells.join("")}`;
}

function argument(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

function main(): void {
  const seconds = Number(argument("seconds", "120"));
  const seeds = Number(argument("seeds", "2"));
  const only = argument("only", "");
  const showShips = process.argv.includes("--ships");
  console.log(`${"".padEnd(44)}${COLUMNS.map((c) => c.padStart(9)).join("")}`);
  const byTier = new Map<string, Totals>();
  for (const scenario of scenarios()) {
    if (only && !scenario.name.includes(only)) continue;
    const profiles: ShipProfile[] = [];
    for (let seed = 1; seed <= seeds; seed++)
      profiles.push(
        ...profileBattle({
          A: {
            ships: entries(scenario.A, scenario.tierA),
            squad: scenario.A.length > 1 ? {} : null,
          },
          B: {
            ships: entries(scenario.B, scenario.tierB),
            squad: scenario.B.length > 1 ? {} : null,
          },
          seed,
          timeLimitMs: seconds * 1000,
        }),
      );
    const rows = profiles.map(metrics);
    const mean: Record<string, number> = {};
    for (const column of COLUMNS)
      mean[column] =
        rows.reduce((sum, r) => sum + (r[column] ?? 0), 0) /
        Math.max(1, rows.length);
    console.log(row(scenario.name, mean));
    if (showShips)
      profiles.forEach((p, i) =>
        console.log(row(`   ${p.id} ${p.definitionId}`, rows[i] ?? {})),
      );
    const key = scenario.name.slice(0, scenario.name.indexOf(" ", 5));
    const total = byTier.get(key) ?? { ships: 0 };
    for (const column of COLUMNS)
      total[column] = (total[column] ?? 0) + (mean[column] ?? 0);
    total.ships++;
    byTier.set(key, total);
  }
  for (const [key, total] of byTier) {
    const averaged: Record<string, number> = {};
    for (const column of COLUMNS)
      averaged[column] = (total[column] ?? 0) / total.ships;
    console.log(row(`ALL ${key}`, averaged));
  }
}

main();
