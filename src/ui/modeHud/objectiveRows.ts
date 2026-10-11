/**
 * objectiveRows — how a Campaign objective reads on the objective tracker:
 * its description, a progress suffix (kills "2/3", time left "45s", or a
 * check mark) and whether it is done. Pure.
 */

/** The objective fields the tracker reads. */
export interface TrackedObjective {
  readonly type: string;
  readonly description: string;
  readonly optional?: boolean | undefined;
  readonly timeLimit?: number | undefined;
}

/** An objective and its live progress. */
export interface ObjectiveProgress {
  readonly objective: TrackedObjective;
  readonly completed: boolean;
  /** Kills for "eliminate"; elapsed seconds for timed objectives. */
  readonly progress: number;
  readonly target: number;
}

/** One tracker row. */
export interface ObjectiveRow {
  readonly text: string;
  readonly done: boolean;
  readonly optional: boolean;
}

/** Objective types that count down a time limit. */
const TIMED_TYPES: ReadonlySet<string> = new Set(["survive", "defend"]);

/** Prefix marking a bonus objective. */
export const BONUS_PREFIX = "(Bonus) ";
/** Suffix marking a completed objective. */
export const DONE_MARK = " ✓";

/**
 * @param state - An objective and its progress.
 * @returns How it reads on the tracker.
 */
export function objectiveRow(state: ObjectiveProgress): ObjectiveRow {
  const { objective } = state;
  const optional = objective.optional === true;
  const prefix = optional ? BONUS_PREFIX : "";
  return {
    text: `${prefix}${objective.description}${progressSuffix(state)}`,
    done: state.completed,
    optional,
  };
}

function progressSuffix(state: ObjectiveProgress): string {
  if (state.completed) return DONE_MARK;
  if (state.objective.type === "eliminate") {
    return ` (${state.progress}/${state.target})`;
  }
  if (
    TIMED_TYPES.has(state.objective.type) &&
    state.objective.timeLimit !== undefined
  ) {
    const remaining = state.objective.timeLimit - state.progress;
    return ` (${Math.max(0, remaining)}s)`;
  }
  return "";
}
