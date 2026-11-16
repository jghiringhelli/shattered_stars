/**
 * AceStrikePolicy — specification tests of the ace's hit-and-run bot: it
 * prefers marked and isolated targets, approaches on the rear flank, dives
 * with a boost from outside weapon range, breaks off after a burst or when
 * hurt, flies away at full throttle, and re-enters.
 */

import { describe, expect, it } from "vitest";
import {
  ACE_ESCAPE_STEER,
  aceStrikeIntent,
  createAceMemory,
} from "../../../../src/arcade/ai/AceStrikePolicy";
import {
  aceStrikeView,
  preferredAceTargetId,
} from "../../../../src/arcade/ai/AceTargeting";
import {
  IDLE_INTENT,
  type OwnShipView,
  type PerceivedShip,
  type PilotIntent,
  type PilotView,
  type SquadOrder,
} from "../../../../src/arcade/ai/BotTypes";
import {
  ACE_APPROACH_BEARING_DEG,
  ACE_BREAK_OFF_HEALTH,
  ACE_BURST_MS,
  ACE_OUTNUMBERED_THREATS,
  ACE_DISENGAGE_MAX_MS,
  ACE_DISENGAGE_MS,
  ACE_ISOLATION_RADIUS_PX,
  ACE_LOW_HEALTH_BURST_MS,
  ACE_REENTRY_RANGE_PX,
} from "../../../../src/data/aceConfig";

const WORLD = 6000;
const RANGE = 300;
const ARC = 90;

const ship = (
  id: string,
  side: string,
  x: number,
  y: number,
  angle: number,
): PerceivedShip => ({
  id,
  side,
  definitionId: "terran_gladius",
  x,
  y,
  angle,
  alive: true,
  speed: 3,
  healthFraction: 1,
  isStressed: false,
  firingArcDeg: ARC,
  weaponRange: RANGE,
  vx: 0,
  vy: 0,
  turnRateDegPerMs: 0,
});

/** The ace at (3000, 3000) heading north. */
const self = (over: Partial<OwnShipView> = {}): OwnShipView => ({
  ...ship("ace", "A", 3000, 3000, 0),
  minSpeed: 1,
  maxSpeed: 5,
  baseSize: 32,
  stressLevel: 0,
  dial: [],
  msToCommit: 300,
  endPose: { x: 3000, y: 3000, angle: 0 },
  kturnReady: true,
  availableSpecials: [],
  boostReady: true,
  barrelRollReady: true,
  ...over,
});

const viewOf = (
  enemies: PerceivedShip[],
  nowMs: number,
  over: { self?: Partial<OwnShipView>; order?: SquadOrder | null } = {},
): PilotView => ({
  nowMs,
  worldSize: WORLD,
  self: self(over.self),
  allies: [],
  enemies,
  order: over.order ?? null,
});

const wanted = (targetId: string | null): PilotIntent => ({
  ...IDLE_INTENT,
  maneuver: "bank_left",
  targetSpeed: 3,
  targetId,
});

/** An enemy `distance` px north of the ace flying away from it (cannot shoot back). */
const foeAhead = (distance: number, id = "foe") =>
  ship(id, "B", 3000, 3000 - distance, 0);

describe("preferredAceTargetId", () => {
  it("takes the nearest enemy when nothing else matters", () => {
    const view = viewOf([foeAhead(800, "far"), foeAhead(500, "near")], 0);
    const cluster = [view.enemies[0]!, { ...view.enemies[1]!, x: 3200 }];
    expect(preferredAceTargetId({ ...view, enemies: cluster })).toBe("near");
  });

  it("prefers the squad's marked target over a nearer one", () => {
    const order: SquadOrder = {
      focusTargetId: "marked",
      approachBearingDeg: null,
      supportAllyId: null,
      rallyPoint: null,
      fallBack: false,
    };
    const near = ship("near", "B", 3000, 2600, 0);
    const marked = ship("marked", "B", 3000, 3800, 0);
    const buddy = ship("buddy", "B", 3100, 2600, 0);
    expect(preferredAceTargetId(viewOf([near, buddy, marked], 0, { order }))).toBe(
      "marked",
    );
  });

  it("prefers an isolated enemy over a slightly nearer one with company", () => {
    const company = ship("company", "B", 3000, 2500, 0);
    const buddy = ship("buddy", "B", 3000 + ACE_ISOLATION_RADIUS_PX - 50, 2500, 0);
    const loner = ship("loner", "B", 3000, 3600, 0);
    expect(preferredAceTargetId(viewOf([company, buddy, loner], 0))).toBe(
      "loner",
    );
  });

  it("returns null when no enemy is left", () => {
    expect(preferredAceTargetId(viewOf([], 0))).toBeNull();
  });
});

describe("aceStrikeView", () => {
  it("hands a lone ace a focus target and a rear-flank approach on its side", () => {
    const view = aceStrikeView(viewOf([foeAhead(600)], 0));
    expect(view.order?.focusTargetId).toBe("foe");
    expect(Math.abs(view.order?.approachBearingDeg ?? 0)).toBe(
      ACE_APPROACH_BEARING_DEG,
    );
  });

  it("approaches from the side the ace is on", () => {
    const foe = ship("foe", "B", 2500, 3000, 0);
    const left = aceStrikeView(viewOf([foe], 0));
    const right = aceStrikeView(viewOf([{ ...foe, x: 3500 }], 0));
    expect(left.order?.approachBearingDeg).toBe(ACE_APPROACH_BEARING_DEG);
    expect(right.order?.approachBearingDeg).toBe(-ACE_APPROACH_BEARING_DEG);
  });

  it("keeps the squad's own flank slot", () => {
    const order: SquadOrder = {
      focusTargetId: "foe",
      approachBearingDeg: 100,
      supportAllyId: "wing",
      rallyPoint: null,
      fallBack: false,
    };
    const view = aceStrikeView(viewOf([foeAhead(600)], 0, { order }));
    expect(view.order?.approachBearingDeg).toBe(100);
    expect(view.order?.supportAllyId).toBe("wing");
  });

  it("returns the view untouched without enemies", () => {
    const view = viewOf([], 0);
    expect(aceStrikeView(view)).toBe(view);
  });
});

describe("aceStrikeIntent dive", () => {
  it("boosts in from just outside weapon range at a target that cannot shoot back", () => {
    const view = viewOf([foeAhead(RANGE + 150)], 0);
    const intent = aceStrikeIntent(view, wanted("foe"), createAceMemory());
    expect(intent.boost).toBe(true);
  });

  it("does not boost into a target that has it in arc", () => {
    const facing = ship("foe", "B", 3000, 3000 - (RANGE + 150), 180);
    const intent = aceStrikeIntent(viewOf([facing], 0), wanted("foe"), createAceMemory());
    expect(intent.boost).toBe(false);
  });

  it("does not boost when boost is recharging or the pilot is stressed", () => {
    const foe = foeAhead(RANGE + 150);
    const cold = viewOf([foe], 0, { self: { boostReady: false } });
    const tense = viewOf([foe], 0, { self: { stressLevel: 0.9 } });
    expect(aceStrikeIntent(cold, wanted("foe"), createAceMemory()).boost).toBe(false);
    expect(aceStrikeIntent(tense, wanted("foe"), createAceMemory()).boost).toBe(false);
  });

  it("does not boost when already in weapon range", () => {
    const intent = aceStrikeIntent(viewOf([foeAhead(RANGE - 50)], 0), wanted("foe"), createAceMemory());
    expect(intent.boost).toBe(false);
  });

  it("changes nothing without a target", () => {
    const intent = wanted(null);
    expect(aceStrikeIntent(viewOf([foeAhead(500)], 0), intent, createAceMemory())).toBe(intent);
  });
});

/** Enemies that have the ace (heading north at 3000, 3000) in arc: just south of it, heading north. */
const gunners = (count: number): PerceivedShip[] =>
  Array.from({ length: count }, (_, i) =>
    ship(`gunner${i}`, "B", 2950 + i * 50, 3150, 0),
  );

interface Dwell {
  readonly gunners?: number;
  readonly self?: Partial<OwnShipView>;
}

/** Decisions every 150 ms with the target in the ace's arc, from `fromMs` until `untilMs`. */
function dwellInContact(
  memory: ReturnType<typeof createAceMemory>,
  fromMs: number,
  untilMs: number,
  over: Dwell = {},
): void {
  const enemies = [foeAhead(RANGE - 100), ...gunners(over.gunners ?? 0)];
  for (let now = fromMs; now <= untilMs; now += 150) {
    aceStrikeIntent(
      viewOf(enemies, now, over.self ? { self: over.self } : {}),
      wanted("foe"),
      memory,
    );
  }
}

const HURT = { healthFraction: ACE_BREAK_OFF_HEALTH - 0.05 };

describe("aceStrikeIntent break-off", () => {
  it("keeps attacking however long the burst when nothing threatens it", () => {
    const memory = createAceMemory();
    dwellInContact(memory, 0, ACE_BURST_MS * 3);
    expect(memory.phase).toBe("approach");
  });

  it("keeps attacking a healthy ace that is not outnumbered", () => {
    const memory = createAceMemory();
    dwellInContact(memory, 0, ACE_BURST_MS + 600, {
      gunners: ACE_OUTNUMBERED_THREATS - 1,
    });
    expect(memory.phase).toBe("approach");
  });

  it("breaks off a healthy ace outnumbered after its burst", () => {
    const memory = createAceMemory();
    dwellInContact(memory, 0, ACE_BURST_MS + 300, {
      gunners: ACE_OUTNUMBERED_THREATS,
    });
    expect(memory.phase).toBe("disengage");
  });

  it("does not break off an outnumbered ace before the burst is over", () => {
    const memory = createAceMemory();
    dwellInContact(memory, 0, ACE_BURST_MS - 300, {
      gunners: ACE_OUTNUMBERED_THREATS,
    });
    expect(memory.phase).toBe("approach");
  });

  it("breaks off a hurt ace under fire after one attack", () => {
    const memory = createAceMemory();
    dwellInContact(memory, 0, ACE_LOW_HEALTH_BURST_MS + 300, {
      gunners: 1,
      self: HURT,
    });
    expect(memory.phase).toBe("disengage");
  });

  it("keeps a hurt ace in the fight when nobody has it in arc", () => {
    const memory = createAceMemory();
    dwellInContact(memory, 0, ACE_BURST_MS, { self: HURT });
    expect(memory.phase).toBe("approach");
  });

  it("does not break off a hurt ace before it has engaged at all", () => {
    const memory = createAceMemory();
    const far = viewOf([foeAhead(1500), ...gunners(1)], 0, { self: HURT });
    aceStrikeIntent(far, wanted("foe"), memory);
    expect(memory.phase).toBe("approach");
  });
});

describe("aceStrikeIntent disengage", () => {
  /** A hurt ace under fire that just broke off. */
  const breakingOff = () => {
    const memory = createAceMemory();
    dwellInContact(memory, 0, ACE_LOW_HEALTH_BURST_MS + 300, {
      gunners: 1,
      self: HURT,
    });
    return memory;
  };

  it("flies away at full throttle, turning away from the target", () => {
    const memory = breakingOff();
    const target = ship("foe", "B", 3000, 3000 - 200, 0);
    const away = aceStrikeIntent(viewOf([target], 2000), wanted("foe"), memory);
    expect(away.targetSpeed).toBe(5);
    expect(away.special).toBeNull();
    expect(away.barrelRoll).toBeNull();
    expect(away.maneuver).toMatch(/^turn_/);
    expect(away.targetId).toBe("foe");
  });

  it("boosts out once it points away from the target", () => {
    const memory = breakingOff();
    const target = ship("foe", "B", 3000, 3000 + 200, 0);
    const away = aceStrikeIntent(viewOf([target], 2000), wanted("foe"), memory);
    expect(away.boost).toBe(true);
    expect(ACE_ESCAPE_STEER.hold).toBeGreaterThan(0);
  });

  it("re-enters once the range is open and the disengage has run its time", () => {
    const memory = breakingOff();
    const startedAt = memory.phaseStartMs;
    const far = foeAhead(ACE_REENTRY_RANGE_PX + 100);
    const early = startedAt + ACE_DISENGAGE_MS - 100;
    aceStrikeIntent(viewOf([far], early), wanted("foe"), memory);
    expect(memory.phase).toBe("disengage");
    aceStrikeIntent(viewOf([far], early + 200), wanted("foe"), memory);
    expect(memory.phase).toBe("approach");
    expect(memory.contactMs).toBe(0);
  });

  it("re-enters after the longest disengage even when the target keeps close", () => {
    const memory = breakingOff();
    const at = memory.phaseStartMs + ACE_DISENGAGE_MAX_MS + 10;
    aceStrikeIntent(viewOf([foeAhead(200)], at), wanted("foe"), memory);
    expect(memory.phase).toBe("approach");
  });

  it("is deterministic: the same decisions give the same memory", () => {
    const run = () => {
      const memory = createAceMemory();
      dwellInContact(memory, 0, 4000, { gunners: 3 });
      return JSON.stringify(memory);
    };
    expect(run()).toBe(run());
  });
});

describe("aceStrikeIntent roll-out", () => {
  /** A target to the east the ace cannot shoot, and a gunner that has it at the edge of its arc. */
  const exposed = (over: { self?: Partial<OwnShipView> } = {}): PilotView =>
    viewOf(
      [
        ship("foe", "B", 4000, 3000, 90),
        { ...ship("gunner", "B", 3000, 3200, 320), id: "gunner" },
      ],
      0,
      over,
    );

  it("rolls out of a gunner's arc when it cannot shoot back", () => {
    const intent = aceStrikeIntent(exposed(), wanted("foe"), createAceMemory());
    expect(intent.barrelRoll).toBe("right");
  });

  it("does not roll when the roll is recharging", () => {
    const view = exposed({ self: { barrelRollReady: false } });
    expect(
      aceStrikeIntent(view, wanted("foe"), createAceMemory()).barrelRoll,
    ).toBeNull();
  });

  it("does not roll when it can shoot its target", () => {
    const view = viewOf(
      [foeAhead(RANGE - 100), ...gunners(1)],
      0,
    );
    expect(
      aceStrikeIntent(view, wanted("foe"), createAceMemory()).barrelRoll,
    ).toBeNull();
  });

  it("does not roll when nobody threatens it", () => {
    const view = viewOf([ship("foe", "B", 4000, 3000, 90)], 0);
    expect(
      aceStrikeIntent(view, wanted("foe"), createAceMemory()).barrelRoll,
    ).toBeNull();
  });
});
