import { describe, expect, it } from "vitest";
import {
  captureGraph,
  restoreGraph,
  type GraphOptions,
} from "../../../src/net/lockstep/StateGraph";

class Counter {
  private count = 0;
  constructor(readonly step: number) {}
  bump(): void {
    this.count += this.step;
  }
  get value(): number {
    return this.count;
  }
}

class Pilot {
  readonly random: () => number;
  memory: { heading: number; history: number[] } = { heading: 0, history: [] };
  constructor(random: () => number) {
    this.random = random;
  }
  fly(): void {
    this.memory = {
      heading: this.memory.heading + this.random(),
      history: [...this.memory.history, this.memory.heading],
    };
  }
}

class Crew {
  readonly pilots = new Map<string, Pilot>();
  constructor(private readonly random: () => number) {}
  enlist(id: string): void {
    this.pilots.set(id, new Pilot(this.random));
  }
}

const roundTrip = <T>(live: T, data: string, options?: GraphOptions): T =>
  restoreGraph(live, data, options).root as T;

describe("StateGraph", () => {
  it("round-trips primitives, special numbers, arrays, maps and sets", () => {
    const state = {
      n: 1.5,
      s: "x",
      b: true,
      nil: null,
      none: undefined,
      nan: Number.NaN,
      inf: Number.POSITIVE_INFINITY,
      negInf: Number.NEGATIVE_INFINITY,
      negZero: -0,
      list: [1, [2, 3]],
      map: new Map<string, number>([
        ["b", 2],
        ["a", 1],
      ]),
      set: new Set(["q", "p"]),
    };
    const restored = roundTrip({}, captureGraph(state)) as typeof state;
    expect(restored.n).toBe(1.5);
    expect(restored.s).toBe("x");
    expect(restored.b).toBe(true);
    expect(restored.nil).toBeNull();
    expect("none" in restored && restored.none === undefined).toBe(true);
    expect(restored.nan).toBeNaN();
    expect(restored.inf).toBe(Number.POSITIVE_INFINITY);
    expect(restored.negInf).toBe(Number.NEGATIVE_INFINITY);
    expect(Object.is(restored.negZero, -0)).toBe(true);
    expect(restored.list).toEqual([1, [2, 3]]);
    expect([...restored.map.entries()]).toEqual([
      ["b", 2],
      ["a", 1],
    ]);
    expect([...restored.set]).toEqual(["q", "p"]);
  });

  it("restores a class instance in place, private state included", () => {
    const authority = new Counter(2);
    authority.bump();
    authority.bump();
    const local = new Counter(2);
    local.bump();
    const root = roundTrip(
      { counter: local },
      captureGraph({ counter: authority }),
    );
    expect(root.counter).toBe(local);
    expect(local.value).toBe(4);
  });

  it("keeps maps in place and replays their entry order", () => {
    const map = new Map<string, number>([
      ["stale", 9],
      ["a", 0],
    ]);
    const root = roundTrip(
      { map },
      captureGraph({
        map: new Map([
          ["a", 1],
          ["b", 2],
        ]),
      }),
    );
    expect(root.map).toBe(map);
    expect([...map.entries()]).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("keeps shared references shared and survives cycles", () => {
    const shared = { hits: 3 };
    const node: { self?: unknown; a: object; b: object } = {
      a: shared,
      b: shared,
    };
    node.self = node;
    const restored = roundTrip({}, captureGraph(node)) as typeof node;
    expect(restored.a).toBe(restored.b);
    expect(restored.self).toBe(restored);
  });

  it("keeps functions and opaque objects live", () => {
    const opaqueLive = { sprite: true };
    const fn = (): number => 1;
    const options: GraphOptions = { isOpaque: (v) => v === opaqueLive };
    const live = { fn, view: opaqueLive, n: 0 };
    const data = captureGraph(
      { fn: () => 2, view: { sprite: false }, n: 5 },
      { isOpaque: (v) => "sprite" in v },
    );
    const root = roundTrip(live, data, options);
    expect(root.fn).toBe(fn);
    expect(root.view).toBe(opaqueLive);
    expect(root.n).toBe(5);
  });

  it("never writes into a plain object shared with the live graph (constants stay intact)", () => {
    const INITIAL = Object.freeze({ level: 0 });
    const live = { a: { stress: INITIAL }, b: { stress: INITIAL } };
    const root = roundTrip(
      live,
      captureGraph({ a: { stress: { level: 2 } }, b: { stress: INITIAL } }),
    );
    expect(INITIAL.level).toBe(0);
    expect(root.a.stress.level).toBe(2);
    expect(root.b.stress.level).toBe(0);
  });

  it("keeps registered constants by identity", () => {
    const NEUTRAL = Object.freeze({ damage: 1 });
    const options: GraphOptions = { constants: [NEUTRAL] };
    const root = roundTrip(
      {},
      captureGraph({ modifiers: NEUTRAL }, options),
      options,
    ) as { modifiers: object };
    expect(root.modifiers).toBe(NEUTRAL);
  });

  it("creates instances the live graph lacks, with function fields from a live donor", () => {
    let draws = 0;
    const random = (): number => ++draws / 10;
    const authority = new Crew(random);
    authority.enlist("a");
    authority.enlist("b");
    authority.pilots.get("b")!.fly();
    const local = new Crew(random);
    local.enlist("a");
    const root = roundTrip({ crew: local }, captureGraph({ crew: authority }));
    expect(root.crew).toBe(local);
    const b = local.pilots.get("b")!;
    expect(b).toBeInstanceOf(Pilot);
    expect(b.random).toBe(local.pilots.get("a")!.random);
    expect(b.memory.heading).toBeCloseTo(
      authority.pilots.get("b")!.memory.heading,
    );
  });

  it("creates instances of registered classes without any live donor", () => {
    const options: GraphOptions = { classes: [Counter] };
    const authority = new Counter(3);
    authority.bump();
    const root = roundTrip({}, captureGraph({ c: authority }), options) as {
      c: Counter;
    };
    expect(root.c).toBeInstanceOf(Counter);
    expect(root.c.value).toBe(3);
  });

  it("skips the named presentation keys on capture and restore", () => {
    const options: GraphOptions = { skipKeys: new Set(["hud"]) };
    const liveHud = { text: "local" };
    const live = { hud: liveHud, score: 0 };
    const data = captureGraph({ hud: { text: "remote" }, score: 7 }, options);
    expect(data).not.toContain("remote");
    const root = roundTrip(live, data, options);
    expect(root.hud).toBe(liveHud);
    expect(root.score).toBe(7);
  });

  it("re-captures a restored graph identically (a diverged copy converges)", () => {
    let seed = 0;
    const random = (): number =>
      (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const authority = new Crew(random);
    authority.enlist("x");
    for (let i = 0; i < 5; i++) authority.pilots.get("x")!.fly();
    const diverged = new Crew(random);
    diverged.enlist("x");
    diverged.enlist("y");
    diverged.pilots.get("y")!.fly();
    const data = captureGraph({ crew: authority });
    roundTrip({ crew: diverged }, data);
    expect(captureGraph({ crew: diverged })).toBe(data);
  });
});
