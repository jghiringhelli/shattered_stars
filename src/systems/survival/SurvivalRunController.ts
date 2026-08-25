/**
 * Survival roguelite — run controller (application layer, no Phaser, no I/O).
 *
 * Owns the mutable {@link SurvivalRunState} and the run's seeded RNG, and is the
 * single source of truth for progression: wave pacing, drafts, the milestone
 * Hangar, threat-driven wave sizing and the accumulated stat bonuses the scene
 * reads back. The scene renders and fights; this class decides.
 *
 * See docs/adr/ADR-0003-survival-roguelite-leveling.md.
 */

import { createSeededRng, type RandomGenerator } from "../../utils/random";
import {
  type HullClass,
  type StatBonuses,
  type SurvivalRunState,
  createRunState,
  isMilestoneLevel,
} from "../../data/survival/model";
import { type Power, applyPower, drawPowers } from "../../data/survival/powers";
import {
  type HangarOption,
  applyEscort,
  applyEvolve,
  applyGraduate,
  hangarOptions,
} from "../../data/survival/hangar";
import {
  type WaveSize,
  computeThreat,
  sizeWave,
} from "../../data/survival/threat";

/** Number of powers offered on a regular-level draft. */
export const DRAFT_SIZE = 3;

export class SurvivalRunController {
  private readonly rng: RandomGenerator;
  private readonly run: SurvivalRunState;
  private escortsSpawned = 0;

  constructor(seed: number, hull?: HullClass) {
    this.rng = createSeededRng(seed);
    this.run = createRunState(hull);
  }

  /** Read-only snapshot of the run state (for HUD / debugging). */
  get state(): Readonly<SurvivalRunState> {
    return this.run;
  }

  /** Current level, which equals the wave number being fought. */
  get level(): number {
    return this.run.level;
  }

  /** Accumulated stat deltas the scene folds into effective ship stats. */
  get bonuses(): Readonly<StatBonuses> {
    return this.run.bonuses;
  }

  /** True when the current level is a milestone (boss wave → Hangar). */
  get isMilestone(): boolean {
    return isMilestoneLevel(this.run.level);
  }

  /** Advances to the next wave and returns its (1-based) level number. */
  beginWave(): number {
    this.run.level += 1;
    return this.run.level;
  }

  /** Enemy composition for the current wave given the live fleet size. */
  waveSize(playerShipCount: number): WaveSize {
    const threat = computeThreat(this.run, playerShipCount);
    return sizeWave(threat, this.isMilestone);
  }

  /** Draws the power choices offered after clearing a regular wave. */
  draft(size: number = DRAFT_SIZE): Power[] {
    return drawPowers(this.run, size, this.rng);
  }

  /** Applies a drafted power to the run. */
  choosePower(power: Power): void {
    applyPower(this.run, power);
  }

  /** Options offered by the milestone Hangar. */
  hangar(): HangarOption[] {
    return hangarOptions(this.run);
  }

  /** Applies a Hangar choice (graduate / evolve / escort). */
  chooseHangar(option: HangarOption): void {
    if (option.kind === "graduate" && option.hull) {
      applyGraduate(this.run, option.hull);
    } else if (option.kind === "evolve") {
      applyEvolve(this.run);
    } else if (option.kind === "escort") {
      applyEscort(this.run);
    }
  }

  /** Escorts earned by the run but not yet spawned into the fleet. */
  pendingEscorts(): number {
    return Math.max(0, this.run.escorts - this.escortsSpawned);
  }

  /** Records that one pending escort has been materialised in the scene. */
  markEscortSpawned(): void {
    this.escortsSpawned += 1;
  }
}
