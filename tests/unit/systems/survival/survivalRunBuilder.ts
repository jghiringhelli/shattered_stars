/**
 * Test data builder for Survival roguelite runs.
 */

import type { FactionId } from "../../../../src/config";
import { createRun } from "../../../../src/systems/survival/RunState";
import { enterNode } from "../../../../src/systems/survival/RunNavigation";
import type { RunState } from "../../../../src/systems/survival/RunTypes";
import type { NodeType } from "../../../../src/data/survival/nodes";

export class RunBuilder {
  private seed = 12345;
  private faction: FactionId = "terran_hegemony";
  private ascension = 0;
  private unlocked: string[] = [];
  private patch: Partial<RunState> = {};

  static aRun(): RunBuilder {
    return new RunBuilder();
  }

  withSeed(seed: number): this {
    this.seed = seed;
    return this;
  }

  withFaction(faction: FactionId): this {
    this.faction = faction;
    return this;
  }

  withAscension(level: number): this {
    this.ascension = level;
    return this;
  }

  withUnlocks(...ids: string[]): this {
    this.unlocked = ids;
    return this;
  }

  with(patch: Partial<RunState>): this {
    this.patch = { ...this.patch, ...patch };
    return this;
  }

  build(): RunState {
    const run = createRun({
      seed: this.seed,
      faction: this.faction,
      flagshipId: "terran_viper",
      loadoutId: null,
      ascension: this.ascension,
      unlocked: this.unlocked,
      now: 1000,
    });
    return { ...run, ...this.patch };
  }
}

/**
 * @param run - A run at the start of a sector.
 * @param type - Wanted node type.
 * @returns The run with the first reachable node of that type forced active.
 */
export function atActiveNode(run: RunState, type: NodeType): RunState {
  const first = run.map.rows[0]![0]!;
  const map = {
    ...run.map,
    rows: run.map.rows.map((row, r) =>
      r === 0 ? row.map((n) => (n.id === first.id ? { ...n, type } : n)) : row,
    ),
  };
  return enterNode({ ...run, map }, first.id);
}
