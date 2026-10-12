/**
 * Survival roguelite — run controller (application layer, no Phaser, no I/O).
 *
 * Owns a mutable {@link SurvivalRunState} (powers, branches, hull, level,
 * escorts, rerolls) and a seeded RNG: drafts, the Hangar, threat-driven wave
 * sizing and the accumulated stat bonuses the battle reads back. In the
 * roguelite run (ADR-0004) each battle node restores one from the saved
 * progression (`fromState`) and sizes its waves with `scaledWaveSize`; the
 * map claims drafts through the pure RewardFlow. The balance sim drives it
 * directly as an endless run.
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
  applyEvolve,
  applyGraduate,
  hangarOptions,
} from "../../data/survival/hangar";
import {
  type EscortOption,
  applyEscortOption,
  escortOptions,
} from "../../data/survival/escorts";
import {
  MAX_ENEMIES,
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

  /**
   * Rebuilds a controller around a saved progression (roguelite battles
   * resume the run's powers, hull and level). Escorts already exist in the
   * saved fleet, so none are pending.
   *
   * @param seed - Seed for this controller's own draws.
   * @param state - The saved progression (copied, never mutated).
   * @returns The controller.
   */
  static fromState(
    seed: number,
    state: Readonly<SurvivalRunState>,
  ): SurvivalRunController {
    const controller = new SurvivalRunController(seed, state.hull);
    Object.assign(controller.run, structuredClone(state));
    controller.escortsSpawned = state.escorts;
    return controller;
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

  /**
   * Spends one reroll charge (earned from Nav Computer, Hold Formation,
   * shops and events) on a fresh draft.
   *
   * @param size - Powers to draw.
   * @returns The new draft, or null when no reroll charge is left.
   */
  rerollDraft(size: number = DRAFT_SIZE): Power[] | null {
    if (this.run.rerolls <= 0) return null;
    this.run.rerolls -= 1;
    return this.draft(size);
  }

  /**
   * Enemy composition for a roguelite battle wave: regulars from the run's
   * threat scaled by the node's multiplier (capped per node); elites only
   * from the node itself (elite nodes, ascension). The node's elites replace
   * regulars and may fly alone; a wave without elites keeps one regular.
   * Unlike the endless {@link waveSize} there are no threat elites and no
   * boss-wave bonus elite — elites on regular nodes and an elite beside
   * every boss made combat nodes in sectors 2–3 and bosses walls (ADR-0004).
   *
   * @param playerShipCount - Living player ships.
   * @param threatMultiplier - Sector / row / ascension threat scale.
   * @param extraElites - Elites the node adds.
   * @param maxEnemies - Cap on regular ships (defaults to the threat cap).
   * @param regularsPerElite - Regulars each extra elite replaces.
   * @returns The wave's size.
   */
  scaledWaveSize(
    playerShipCount: number,
    threatMultiplier: number,
    extraElites: number,
    maxEnemies: number = MAX_ENEMIES,
    regularsPerElite = 0,
  ): WaveSize {
    const threat = computeThreat(this.run, playerShipCount) * threatMultiplier;
    const size = sizeWave(threat);
    const regulars = Math.max(
      extraElites > 0 ? 0 : 1,
      size.enemyCount - extraElites * regularsPerElite,
    );
    return {
      enemyCount: Math.min(maxEnemies, regulars),
      eliteCount: extraElites,
    };
  }

  /** Applies a drafted power to the run. */
  choosePower(power: Power): void {
    applyPower(this.run, power);
  }

  /** Options offered by the milestone Hangar. */
  hangar(): HangarOption[] {
    return hangarOptions(this.run);
  }

  /** Applies a Hangar choice (graduate / evolve). */
  chooseHangar(option: HangarOption): void {
    if (option.kind === "graduate" && option.hull) {
      applyGraduate(this.run, option.hull);
    } else if (option.kind === "evolve") {
      applyEvolve(this.run);
    }
  }

  /** The parallel escort-track choice offered each wave. */
  draftEscort(): EscortOption[] {
    return escortOptions(this.run);
  }

  /** Applies an escort-track choice (recruit / bank). */
  chooseEscort(option: EscortOption): void {
    applyEscortOption(this.run, option);
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
