/**
 * The piloting gates. Thresholds are fixed by decision; when a gate fails,
 * tune the levers (position, cadence, wingman/auras, focus fire) — never
 * these numbers. Not part of `npm test` (fast smoke versions are, in
 * tests/unit/simulation/skill): run with `npm run test:skill`.
 *
 * SKILL_PAIRS (default 60, "all" = full matrix), SKILL_SEEDS (default 20)
 * and SKILL_SQUAD_SEEDS (default 40) widen the sample. A gate-1 pair that
 * dips below the threshold is re-measured with GATE1_CONFIRM_SEEDS.
 */
import { describe, expect, it } from "vitest";
import {
  GATE1_CONFIRM_SEEDS,
  GATE1_MIN_EXPERT_WIN_RATE,
  GATE2_MIN_SQUAD_WIN_RATE,
  fighterRoster,
  gate1Pairs,
  gate2Compositions,
  measureGate1Pair,
  measureGate2,
  median,
  pairCoverage,
  sampleGate1Pairs,
} from "../../src/simulation/skill";

const PAIRS =
  process.env.SKILL_PAIRS === "all"
    ? Infinity
    : Number(process.env.SKILL_PAIRS ?? 60);
const SEEDS = Number(process.env.SKILL_SEEDS ?? 20);
const SQUAD_SEEDS = Number(process.env.SKILL_SQUAD_SEEDS ?? 40);

const seconds = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;
const pct = (rate: number): string => `${(rate * 100).toFixed(0)}%`;

describe("Gate 1 — an expert beats a novice in any pair of fighters", () => {
  const roster = fighterRoster();
  const all = gate1Pairs(roster.fighters);
  const sample = sampleGate1Pairs(all, PAIRS);

  it("reports_coverage_of_the_fighter_matrix", () => {
    const coverage = pairCoverage(sample, all, roster.fighters);
    console.log(
      `[gate1] coverage ${JSON.stringify(coverage)} seeds/pair=${SEEDS} (confirm ${GATE1_CONFIRM_SEEDS})`,
    );
    console.log(`[gate1] excluded ${JSON.stringify(roster.excluded)}`);
    expect(coverage.expertShips).toBeGreaterThan(0);
  });

  it(`expert_wins_at_least_${pct(GATE1_MIN_EXPERT_WIN_RATE)}_in_every_sampled_pair_up_to_plus_30_percent_novice_price`, () => {
    const rows = sample.map((pair) => measureGate1Pair(pair, SEEDS));
    const sorted = [...rows].sort(
      (a, b) => a.summary.winRate - b.summary.winRate,
    );
    const mean =
      rows.reduce((sum, r) => sum + r.summary.winRate, 0) / rows.length;
    const failing = sorted.filter(
      (r) => r.summary.winRate < GATE1_MIN_EXPERT_WIN_RATE,
    );
    const confirmed = rows.filter((r) => r.confirmed).length;
    console.log(
      `[gate1] mean expert win ${pct(mean)}; re-measured ${confirmed}; pairs below ${pct(GATE1_MIN_EXPERT_WIN_RATE)}: ${failing.length}/${rows.length}`,
    );
    console.log(
      `[gate1] median duel ${seconds(median(rows.map((r) => r.summary.medianDurationMs)))}; expert hit share rear ${pct(median(rows.map((r) => r.summary.gunnery.A.hitShareByArc.rear)))}`,
    );
    for (const { pair, summary, confirmed: again } of sorted.slice(0, 12)) {
      console.log(
        `[gate1] ${pct(summary.winRate)}${again ? ` (${summary.battles} seeds)` : ""} draw ${pct(summary.drawRate)} ${seconds(summary.medianDurationMs)} ${pair.expertShip} vs ${pair.noviceShip} (novice x${pair.priceRatio.toFixed(2)})`,
      );
    }
    expect(
      failing.map(
        (r) =>
          `${r.pair.expertShip}>${r.pair.noviceShip}=${pct(r.summary.winRate)}`,
      ),
    ).toEqual([]);
  });
});

describe("Gate 2 — a coordinated average squadron beats solo expert aces", () => {
  const compositions = gate2Compositions(fighterRoster().fighters);

  it(`coordinated_average_squad_wins_at_least_${pct(GATE2_MIN_SQUAD_WIN_RATE)}_against_equal_points_of_experts`, () => {
    const gate = measureGate2(compositions, SQUAD_SEEDS);
    for (const { composition, summary } of gate.rows) {
      console.log(
        `[gate2] ${pct(summary.winRate)} draw ${pct(summary.drawRate)} median ${seconds(summary.medianDurationMs)} shots squad/aces ${summary.gunnery.A.shots}/${summary.gunnery.B.shots} on mark ${pct(summary.gunnery.A.markedShare)} rear hits ${pct(summary.gunnery.A.hitShareByArc.rear)}/${pct(summary.gunnery.B.hitShareByArc.rear)} — ${composition.join(" + ")}`,
      );
    }
    console.log(
      `[gate2] squad win ${pct(gate.winRate)} over ${gate.battles} battles (need ${pct(GATE2_MIN_SQUAD_WIN_RATE)})`,
    );
    expect(gate.winRate).toBeGreaterThanOrEqual(GATE2_MIN_SQUAD_WIN_RATE);
  });
});
