import { describe, it, expect } from "vitest";
import {
  findNode,
  generateSectorMap,
  nextOptions,
  revealMystery,
  type SectorMap,
} from "../../../../src/systems/survival/SectorMapGenerator";
import {
  FIRST_ELITE_ROW,
  FIRST_SHOP_ROW,
  MAX_ROW_WIDTH,
  MIN_ROW_WIDTH,
  PRE_BOSS_ROW,
  REGULAR_ROWS,
} from "../../../../src/data/survival/sectors";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 3);

function everyMap(check: (map: SectorMap) => void): void {
  for (const seed of SEEDS) {
    for (const sector of [1, 2, 3]) check(generateSectorMap(seed, sector));
  }
}

describe("generateSectorMap — shape", () => {
  it("has REGULAR_ROWS rows of 2-4 nodes then a single boss row", () => {
    everyMap((map) => {
      expect(map.rows).toHaveLength(REGULAR_ROWS + 1);
      map.rows.slice(0, REGULAR_ROWS).forEach((row) => {
        expect(row.length).toBeGreaterThanOrEqual(MIN_ROW_WIDTH);
        expect(row.length).toBeLessThanOrEqual(MAX_ROW_WIDTH);
      });
      const boss = map.rows[REGULAR_ROWS]!;
      expect(boss).toHaveLength(1);
      expect(boss[0]!.type).toBe("boss");
    });
  });

  it("opens with combat and rests at a repair dock before the boss", () => {
    everyMap((map) => {
      expect(map.rows[0]!.every((n) => n.type === "combat")).toBe(true);
      expect(map.rows[PRE_BOSS_ROW]!.every((n) => n.type === "repair")).toBe(
        true,
      );
    });
  });

  it("never places elites or shops before their first allowed row", () => {
    everyMap((map) => {
      map.rows.flat().forEach((n) => {
        if (n.type === "elite")
          expect(n.row).toBeGreaterThanOrEqual(FIRST_ELITE_ROW);
        if (n.type === "shop")
          expect(n.row).toBeGreaterThanOrEqual(FIRST_SHOP_ROW);
      });
    });
  });

  it("lays every row out left to right within [0, 1], narrow rows centred", () => {
    everyMap((map) => {
      map.rows.forEach((row) => {
        row.forEach((n, i) => {
          expect(n.lane).toBeGreaterThanOrEqual(0);
          expect(n.lane).toBeLessThanOrEqual(1);
          if (i > 0) expect(n.lane).toBeGreaterThan(row[i - 1]!.lane);
        });
        const mid = (row[0]!.lane + row[row.length - 1]!.lane) / 2;
        expect(mid).toBeCloseTo(0.5);
      });
    });
  });

  it("guarantees at least one shop, event and elite per sector", () => {
    everyMap((map) => {
      const types = new Set(map.rows.flat().map((n) => n.type));
      expect(types.has("shop")).toBe(true);
      expect(types.has("event")).toBe(true);
      expect(types.has("elite")).toBe(true);
    });
  });
});

describe("generateSectorMap — connectivity", () => {
  it("gives every non-boss node a way forward and every later node a way in", () => {
    everyMap((map) => {
      map.rows
        .slice(0, -1)
        .forEach((row) =>
          row.forEach((n) => expect(n.next.length).toBeGreaterThan(0)),
        );
      map.rows.slice(1).forEach((row, r) => {
        const incoming = new Set(map.rows[r]!.flatMap((n) => n.next));
        row.forEach((n) => expect(incoming.has(n.id)).toBe(true));
      });
    });
  });

  it("only links to the next row and never crosses edges", () => {
    everyMap((map) => {
      map.rows.slice(0, -1).forEach((row) => {
        const edges = row.flatMap((n) =>
          n.next.map((id) => [n.col, findNode(map, id)!.col] as const),
        );
        row.forEach((n) =>
          n.next.forEach((id) =>
            expect(findNode(map, id)!.row).toBe(n.row + 1),
          ),
        );
        for (const [a1, b1] of edges) {
          for (const [a2, b2] of edges) {
            if (a1 < a2) expect(b1).toBeLessThanOrEqual(b2);
          }
        }
      });
    });
  });

  it("offers the whole first row at sector start and a node's successors afterwards", () => {
    const map = generateSectorMap(99, 1);
    expect(nextOptions(map, null).map((n) => n.id)).toEqual(
      map.rows[0]!.map((n) => n.id),
    );
    const first = map.rows[0]![0]!;
    expect(nextOptions(map, first.id).map((n) => n.id)).toEqual(first.next);
    expect(nextOptions(map, "nope")).toEqual([]);
  });
});

describe("generateSectorMap — determinism", () => {
  it("returns the same map for the same seed and sector", () => {
    expect(generateSectorMap(4242, 2)).toEqual(generateSectorMap(4242, 2));
  });

  it("returns different maps for different seeds or sectors", () => {
    const a = JSON.stringify(generateSectorMap(1, 1));
    expect(JSON.stringify(generateSectorMap(2, 1))).not.toBe(a);
    expect(JSON.stringify(generateSectorMap(1, 2))).not.toBe(a);
  });

  it("makes elites more common when ascension boosts their weight", () => {
    const count = (mult: number) =>
      SEEDS.reduce(
        (sum, seed) =>
          sum +
          generateSectorMap(seed, 1, { eliteWeightMultiplier: mult })
            .rows.flat()
            .filter((n) => n.type === "elite").length,
        0,
      );
    expect(count(3)).toBeGreaterThan(count(1));
  });

  it("reveals a mystery node the same way every time", () => {
    expect(revealMystery(77, "s1-r3-c1")).toBe(revealMystery(77, "s1-r3-c1"));
    const outcomes = new Set(
      SEEDS.map((seed) => revealMystery(seed, "s1-r3-c1")),
    );
    expect(outcomes.size).toBeGreaterThan(1);
  });
});
