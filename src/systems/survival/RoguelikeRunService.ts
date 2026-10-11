/**
 * Survival roguelite — application service: the single owner of the
 * current run and the meta profile, shared by the setup, map, battle and
 * summary scenes through the Phaser registry. It applies pure run
 * operations and saves after each one (save at every map node), and closes
 * finished runs into the history + Star Charts payout.
 */

import type { FactionId } from "../../config";
import { clampAscension } from "../../data/survival/ascension";
import { defaultStore, type KeyValueStore } from "./KeyValueStore";
import {
  loadMeta,
  purchaseUnlock,
  recordRunEnd,
  saveMeta,
  type MetaProfile,
} from "./MetaProgression";
import { clearRun, loadRun, saveRun } from "./RunPersistence";
import { createRun } from "./RunState";
import { enterNode, finishNode } from "./RunNavigation";
import {
  completeCombat,
  failRun,
  type CombatOutcome,
} from "./CombatResolution";
import { seedFromEntropy } from "./RunRng";
import { nextOptions } from "./SectorMapGenerator";
import { summarizeRun, type RunSummary } from "./RunHistory";
import type { RunState } from "./RunTypes";

/** Registry key under which scenes find the service. */
export const RUN_SERVICE_KEY = "survivalRunService";

/** Map time beyond this per save is treated as idle and not counted. */
export const MAX_MAP_SEGMENT_MS = 5 * 60 * 1000;

/** How to start a run. */
export interface StartRunRequest {
  readonly faction: FactionId;
  readonly flagshipId: string;
  readonly loadoutId: string | null;
  readonly ascension: number;
  /** Fixed seed; omitted = random. */
  readonly seed?: number;
  /** Daily challenge: start at `ascension` even if not unlocked yet. */
  readonly uncappedAscension?: boolean;
}

export class RoguelikeRunService {
  private current: RunState | null = null;
  private profile: MetaProfile;
  private summary: RunSummary | null = null;
  private lastTouch: number;

  /**
   * @param store - Storage port (localStorage in the browser).
   * @param clock - Wall clock (ms).
   * @param entropy - Source of randomness for unseeded runs.
   */
  constructor(
    private readonly store: KeyValueStore,
    private readonly clock: () => number = Date.now,
    private readonly entropy: () => number = Math.random,
  ) {
    this.profile = loadMeta(store);
    this.lastTouch = clock();
  }

  /** The run in progress, or null. */
  get run(): RunState | null {
    return this.current;
  }

  /** The meta profile. */
  get meta(): MetaProfile {
    return this.profile;
  }

  /** The last finished run's summary (for the summary screen). */
  get lastSummary(): RunSummary | null {
    return this.summary;
  }

  /** @returns True when a resumable run is saved. */
  hasSavedRun(): boolean {
    return loadRun(this.store) !== null;
  }

  /** @returns The saved run, now current (null when none). */
  resume(): RunState | null {
    this.current = loadRun(this.store);
    this.lastTouch = this.clock();
    return this.current;
  }

  /**
   * @param request - Faction, flagship, ascension, optional seed.
   * @returns The new run (saved).
   */
  startRun(request: StartRunRequest): RunState {
    const seed =
      request.seed ??
      seedFromEntropy(this.clock() ^ Math.floor(this.entropy() * 0xffffffff));
    this.summary = null;
    this.current = null;
    this.lastTouch = this.clock();
    return this.commit(
      createRun({
        seed,
        faction: request.faction,
        flagshipId: request.flagshipId,
        loadoutId: request.loadoutId,
        ascension: request.uncappedAscension
          ? clampAscension(request.ascension)
          : Math.min(
              clampAscension(request.ascension),
              this.profile.maxAscension,
            ),
        unlocked: this.profile.unlocked,
        now: this.clock(),
      }),
    );
  }

  /**
   * A run started straight into battle (SurvivalScene launched without the
   * map): a new run whose first row-0 combat node is already entered.
   *
   * @param request - Faction, flagship, ascension.
   * @returns The run with its first battle active.
   */
  startQuickRun(request: StartRunRequest): RunState {
    const run = this.startRun(request);
    const first = nextOptions(run.map, null)[0];
    return first ? (this.apply((r) => enterNode(r, first.id)) ?? run) : run;
  }

  /**
   * Applies a pure run operation, counts map time, and saves.
   *
   * @param operation - RunState → RunState.
   * @returns The new run (unchanged when no run is active).
   */
  apply(operation: (run: RunState) => RunState): RunState | null {
    if (!this.current) return null;
    return this.commit(operation(this.current));
  }

  /** Ends the active non-battle node and saves. */
  finishActiveNode(): RunState | null {
    return this.apply(finishNode);
  }

  /**
   * @param outcome - The won battle's report.
   * @returns The run afterwards (finished into the history on victory).
   */
  winBattle(outcome: CombatOutcome): RunState | null {
    const run = this.apply((r) => completeCombat(r, outcome));
    if (run && run.status === "victory") this.close(run);
    return run;
  }

  /**
   * @param cause - What destroyed the fleet.
   * @param durationMs - Time in the fatal battle.
   * @param kills - Kills in it.
   * @returns The finished run's summary.
   */
  loseBattle(
    cause: string,
    durationMs: number,
    kills: number,
  ): RunSummary | null {
    if (!this.current) return null;
    return this.close(failRun(this.current, cause, durationMs, kills));
  }

  /** @returns The abandoned run's summary (null when none was active). */
  abandon(): RunSummary | null {
    const run = this.current ?? loadRun(this.store);
    if (!run) return null;
    return this.close({ ...run, status: "abandoned", cause: "Abandoned" });
  }

  /**
   * @param unlockId - A meta unlock to buy with Star Charts.
   * @returns True when bought.
   */
  buyUnlock(unlockId: string): boolean {
    const next = purchaseUnlock(this.profile, unlockId);
    if (!next) return false;
    this.profile = next;
    saveMeta(this.store, next);
    return true;
  }

  private commit(run: RunState): RunState {
    const now = this.clock();
    const segment = Math.min(
      MAX_MAP_SEGMENT_MS,
      Math.max(0, now - this.lastTouch),
    );
    this.lastTouch = now;
    const wasOnMap = (this.current?.activeNodeId ?? null) === null;
    const counted = wasOnMap
      ? {
          ...run,
          stats: { ...run.stats, elapsedMs: run.stats.elapsedMs + segment },
        }
      : run;
    this.current = counted;
    saveRun(this.store, counted);
    return counted;
  }

  private close(run: RunState): RunSummary {
    const summary = summarizeRun(run, this.clock());
    this.profile = recordRunEnd(this.profile, summary);
    saveMeta(this.store, this.profile);
    clearRun(this.store);
    this.current = null;
    this.summary = summary;
    return summary;
  }
}

/** Minimal registry contract (Phaser's DataManager satisfies it). */
export interface RegistryLike {
  get(key: string): unknown;
  set(key: string, value: unknown): unknown;
}

/**
 * @param registry - The game registry (composition root for scenes).
 * @returns The game's run service, created on first use with the default
 *   store.
 */
export function runServiceOf(registry: RegistryLike): RoguelikeRunService {
  const existing = registry.get(RUN_SERVICE_KEY);
  if (existing instanceof RoguelikeRunService) return existing;
  const service = new RoguelikeRunService(defaultStore());
  registry.set(RUN_SERVICE_KEY, service);
  return service;
}
