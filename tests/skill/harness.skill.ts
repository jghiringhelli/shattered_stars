/**
 * Skill-arena harness sanity: the hands fly the real pilot controls, battles
 * are deterministic per seed, equal pilots in equal ships split ~50/50, and
 * skill tiers order as expected. These MUST pass (the gates may not).
 */
import { describe, expect, it } from "vitest";
import {
  createCycleFlight,
  tickCycleFlight,
} from "../../src/arcade/systems/CycleFlight";
import { CYCLE_DURATION_MS, BATTLEFIELD_SIZE } from "../../src/config";
import { getShipDial } from "../../src/data/ShipDefinitions";
import {
  IDLE_INTENT,
  PilotHands,
  SquadCoordinator,
  TICK_MS,
  runBattle,
  runSeries,
  seedRange,
  type BattleSpec,
  type PilotIntent,
  type SkillTier,
} from "../../src/simulation/skill";

const SHIP = "terran_gladius";
/** Gladius has no boost on its action bar; this ship does. */
const BOOST_SHIP = "terran_viper";
const MIRROR_SEEDS = Number(process.env.SKILL_MIRROR_SEEDS ?? 200);
/** A fair coin over MIRROR_SEEDS battles stays inside this band (~3.4 sigma at 200). */
const MIRROR_BAND = { min: 0.38, max: 0.62 };

function duel(
  tierA: SkillTier,
  tierB: SkillTier,
  seed: number,
  ship = SHIP,
): BattleSpec {
  return {
    A: { ships: [{ definitionId: ship, tier: tierA }], squad: null },
    B: { ships: [{ definitionId: ship, tier: tierB }], squad: null },
    seed,
  };
}

/** Fly a lone ship with a fixed intent; return the maneuvers it committed and its events. */
function flyIntent(intent: PilotIntent, cycles: number, ship = SHIP) {
  const hands = new PilotHands();
  hands.setIntent(intent);
  const dial = getShipDial(ship);
  let flight = createCycleFlight(ship, { x: 3000, y: 3000, angle: 0 });
  const committed: string[] = [];
  const events: string[] = [];
  const speeds: number[] = [];
  for (let t = 0; t < cycles * CYCLE_DURATION_MS; t += TICK_MS) {
    const { motion, stress } = flight;
    const flown = hands.fly({
      flown: { ship: motion, motion, stress, dial },
      nowMs: t,
      deltaMs: TICK_MS,
      worldSize: BATTLEFIELD_SIZE,
    });
    events.push(...flown.events);
    const tick = tickCycleFlight(
      { motion: flown.motion, stress: flown.stress },
      {
        deltaMs: TICK_MS,
        worldSize: BATTLEFIELD_SIZE,
        dial,
        cycleMs: CYCLE_DURATION_MS,
      },
    );
    flight = tick.state;
    if (tick.completed) {
      const started = flight.motion.control.currentManeuver ?? "straight";
      committed.push(started);
      speeds.push(flight.motion.control.speed);
      hands.onCycleCommitted(started);
    }
  }
  return { committed, events, speeds, flight };
}

describe("PilotHands flies the shared pilot controls like a human", () => {
  it("flies_a_held_bank_then_re_presses_for_the_next_bank", () => {
    const { committed } = flyIntent(
      { ...IDLE_INTENT, maneuver: "bank_left" },
      6,
    );
    expect(
      committed.slice(1).filter((m) => m === "bank_left").length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("flies_a_tapped_drift_every_cycle", () => {
    const { committed } = flyIntent(
      { ...IDLE_INTENT, maneuver: "drift_right" },
      6,
    );
    expect(committed.slice(1).every((m) => m === "drift_right")).toBe(true);
  });

  it("queues_a_hard_turn_with_the_q_e_key", () => {
    const { committed, events } = flyIntent(
      { ...IDLE_INTENT, maneuver: "turn_right" },
      3,
    );
    expect(committed).toContain("turn_right");
    expect(events).toContain("hard_turn");
  });

  it("queues_a_k_turn_with_its_key_once", () => {
    const { committed, events } = flyIntent(
      { ...IDLE_INTENT, special: "kturn" },
      3,
    );
    expect(committed.filter((m) => m === "kturn")).toHaveLength(1);
    expect(events.filter((e) => e === "kturn")).toHaveLength(1);
  });

  it("barrel_rolls_with_the_left_right_chord", () => {
    const { events } = flyIntent({ ...IDLE_INTENT, barrelRoll: "left" }, 2);
    expect(events.filter((e) => e === "barrel_roll")).toHaveLength(1);
  });

  it("boosts_with_the_boost_key", () => {
    const { events } = flyIntent(
      { ...IDLE_INTENT, boost: true },
      2,
      BOOST_SHIP,
    );
    expect(events.filter((e) => e === "boost")).toHaveLength(1);
  });

  it("refuses_boost_when_the_action_bar_lacks_it", () => {
    const { events } = flyIntent({ ...IDLE_INTENT, boost: true }, 2);
    expect(events).not.toContain("boost");
  });

  it("steps_the_throttle_one_notch_per_tap_without_triggering_gestures", () => {
    const { speeds, events } = flyIntent({ ...IDLE_INTENT, targetSpeed: 1 }, 4);
    expect(speeds.at(-1)).toBe(1);
    expect(events).not.toContain("kturn");
  });
});

describe("SkillArena battles", () => {
  it("is_deterministic_for_a_seed", () => {
    const first = runBattle(duel("expert", "average", 42));
    const second = runBattle(duel("expert", "average", 42));
    expect(second).toEqual(first);
  });

  it("varies_across_seeds", () => {
    const durations = new Set(
      seedRange(10).map(
        (seed) => runBattle(duel("average", "average", seed)).durationMs,
      ),
    );
    expect(durations.size).toBeGreaterThan(5);
  });

  it("tallies_every_hit_by_arc_position", () => {
    const result = runBattle(duel("expert", "novice", 7));
    for (const side of ["A", "B"] as const) {
      const tally = result.tallies[side];
      expect(
        tally.hitsByArc.front + tally.hitsByArc.flank + tally.hitsByArc.rear,
      ).toBe(tally.hits);
      expect(tally.hits).toBeLessThanOrEqual(tally.shots);
    }
  });

  it("ends_at_the_time_limit_with_the_points_tiebreak", () => {
    const result = runBattle({
      ...duel("novice", "novice", 3),
      timeLimitMs: 2000,
    });
    expect(result.endedBy).toBe("timeout");
    expect(result.durationMs).toBeGreaterThanOrEqual(2000);
    expect(result.winner).toBe("draw");
  });
});

describe("mirror matches split ~50/50", () => {
  for (const tier of ["novice", "average", "expert"] as const) {
    it(`${tier}_vs_${tier}_in_the_same_ship_is_a_coin_flip`, () => {
      const { summary } = runSeries(
        (seed) => duel(tier, tier, seed),
        seedRange(MIRROR_SEEDS),
      );
      console.log(
        `[mirror ${tier}] A=${summary.winRate.toFixed(3)} draw=${summary.drawRate.toFixed(3)} median=${(summary.medianDurationMs / 1000).toFixed(1)}s`,
      );
      expect(summary.drawRate).toBeLessThan(0.25);
      const decisive = summary.winRate / Math.max(1e-9, 1 - summary.drawRate);
      expect(decisive).toBeGreaterThanOrEqual(MIRROR_BAND.min);
      expect(decisive).toBeLessThanOrEqual(MIRROR_BAND.max);
    });
  }
});

describe("SquadCoordinator", () => {
  const ship = (id: string, x: number, y: number, angle = 0, health = 1) => ({
    id,
    side: "A" as const,
    definitionId: SHIP,
    alive: true,
    x,
    y,
    angle,
    speed: 3,
    healthFraction: health,
    isStressed: false,
    firingArcDeg: 75,
    weaponRange: 250,
  });
  const enemy = (
    id: string,
    x: number,
    y: number,
    angle: number,
    health = 1,
  ) => ({
    ...ship(id, x, y, angle, health),
    side: "B" as const,
    vx: 0,
    vy: 0,
    turnRateDegPerMs: 0,
  });

  it("gives_the_whole_squad_one_focus_target", () => {
    const orders = new SquadCoordinator().plan(
      [ship("a", 1000, 1000), ship("b", 1100, 1000), ship("c", 1200, 1000)],
      [enemy("x", 1100, 400, 180), enemy("y", 3000, 3000, 0)],
    );
    expect(new Set([...orders.values()].map((o) => o.focusTargetId))).toEqual(
      new Set(["x"]),
    );
  });

  it("focuses_the_bandit_on_a_squadmates_six_and_the_victim_drags_it", () => {
    const orders = new SquadCoordinator().plan(
      [ship("a", 1000, 1000), ship("b", 1150, 1000)],
      [enemy("far", 1100, 700, 180, 0.1), enemy("bandit", 1000, 1150, 0)],
    );
    expect(orders.get("a")?.focusTargetId).toBe("bandit");
    expect(orders.get("a")?.fallBack).toBe(true);
    expect(orders.get("b")?.fallBack).toBe(false);
  });

  it("sends_a_badly_damaged_pilot_back_to_the_squad", () => {
    const orders = new SquadCoordinator().plan(
      [ship("a", 1000, 1000, 0, 0.2), ship("b", 1100, 1000)],
      [enemy("x", 1100, 300, 180)],
    );
    expect(orders.get("a")?.fallBack).toBe(true);
  });
});

describe("skill tiers order", () => {
  it("expert_beats_average_and_average_beats_novice_in_the_same_ship", () => {
    const expertVsAverage = runSeries(
      (seed) => duel("expert", "average", seed),
      seedRange(60),
    ).summary;
    const averageVsNovice = runSeries(
      (seed) => duel("average", "novice", seed),
      seedRange(60),
    ).summary;
    console.log(
      `[tiers] expert>average ${expertVsAverage.winRate.toFixed(2)} average>novice ${averageVsNovice.winRate.toFixed(2)}`,
    );
    expect(expertVsAverage.winRate).toBeGreaterThan(0.6);
    expect(averageVsNovice.winRate).toBeGreaterThan(0.6);
  });
});
