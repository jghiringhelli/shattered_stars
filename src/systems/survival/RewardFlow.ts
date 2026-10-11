/**
 * Survival roguelite — claiming pending rewards on the map (pure): the
 * power draft (with rerolls that are actually SPENT — each reroll costs a
 * charge and re-derives the draw), relic picks, the boss Hangar, mutations
 * and the jump to the next sector.
 */

import {
  applyPower,
  drawPowers,
  POWER_CATALOG,
  type Power,
} from "../../data/survival/powers";
import {
  applyEvolve,
  applyGraduate,
  hangarOptions,
  type HangarOption,
} from "../../data/survival/hangar";
import { drawRelics, getRelic } from "../../data/survival/relicCatalog";
import type { Relic } from "../../data/survival/relics";
import {
  getMutation,
  mutationsForSlot,
  type Mutation,
} from "../../data/survival/mutations";
import { SKIP_DRAFT_SALVAGE } from "../../data/survival/economy";
import type { SurvivalRunState } from "../../data/survival/model";
import { DRAFT_SIZE } from "./SurvivalRunController";
import { rngFor } from "./RunRng";
import { addEscort, enterSector, withLog } from "./RunState";
import { gainSalvage } from "./RunEconomy";
import type { PendingReward, RunState } from "./RunTypes";

/** Relics offered by a relic reward. */
export const RELIC_CHOICES = 3;

/**
 * @param run - The run.
 * @returns The reward waiting to be claimed, or null.
 */
export function currentReward(run: RunState): PendingReward | null {
  return run.pendingRewards[0] ?? null;
}

/** Drops the reward at the front of the queue and resets its reroll count. */
function popReward(run: RunState): RunState {
  return {
    ...run,
    pendingRewards: run.pendingRewards.slice(1),
    rerollsSpentHere: 0,
  };
}

function cloneProgression(run: RunState): SurvivalRunState {
  return structuredClone(run.progression) as SurvivalRunState;
}

/**
 * @param run - The run.
 * @param key - The draft's key (the node it rewards).
 * @returns The powers offered (stable for key + rerolls spent).
 */
export function powerDraft(run: RunState, key: string): Power[] {
  const rng = rngFor(run.seed, "draft", key, run.rerollsSpentHere);
  return drawPowers(cloneProgression(run), DRAFT_SIZE, rng);
}

/**
 * Spends one reroll charge on the reward on screen.
 *
 * @param run - The run.
 * @returns The run with one fewer reroll and a fresh draw, or null when
 *   no charges are left.
 */
export function spendReroll(run: RunState): RunState | null {
  if (run.rerolls <= 0) return null;
  return {
    ...run,
    rerolls: run.rerolls - 1,
    rerollsSpentHere: run.rerollsSpentHere + 1,
  };
}

/**
 * @param run - The run.
 * @param powerId - The drafted power.
 * @returns The run with the power applied and the reward claimed.
 */
export function choosePower(run: RunState, powerId: string): RunState {
  const power = POWER_CATALOG.find((p) => p.id === powerId);
  if (!power) return run;
  const progression = applyPower(cloneProgression(run), power);
  let next: RunState = popReward({
    ...run,
    progression: { ...progression, escorts: run.escorts.length },
  });
  for (let i = run.escorts.length; i < progression.escorts; i++)
    next = addEscort(next);
  return withLog(next, `Power: ${power.name}`);
}

/**
 * @param run - The run.
 * @returns The run paid SKIP_DRAFT_SALVAGE instead of a power.
 */
export function skipPower(run: RunState): RunState {
  return popReward(gainSalvage(run, SKIP_DRAFT_SALVAGE));
}

/**
 * @param run - The run.
 * @param reward - A relic reward.
 * @returns The relics offered (stable for its key + rerolls spent).
 */
export function relicChoices(
  run: RunState,
  reward: Extract<PendingReward, { kind: "relic" }>,
): Relic[] {
  return drawRelics(
    rngFor(run.seed, "relic", reward.key, run.rerollsSpentHere),
    {
      owned: run.relics,
      pools: run.pools,
      count: RELIC_CHOICES,
      minRarity: reward.minRarity,
    },
  );
}

/**
 * @param run - The run.
 * @param relicId - The relic taken.
 * @returns The run owning it, reward claimed.
 */
export function chooseRelic(run: RunState, relicId: string): RunState {
  return popReward(grantRelic(run, relicId));
}

/**
 * @param run - The run.
 * @param relicId - A relic id.
 * @returns The run owning it (no duplicates, unknown ids ignored).
 */
export function grantRelic(run: RunState, relicId: string): RunState {
  const relic = getRelic(relicId);
  if (!relic || run.relics.includes(relicId)) return run;
  return withLog(
    { ...run, relics: [...run.relics, relicId] },
    `Relic: ${relic.name}`,
  );
}

/**
 * @param run - The run.
 * @returns The Hangar options (graduate / evolve).
 */
export function hangarChoices(run: RunState): HangarOption[] {
  return hangarOptions(cloneProgression(run));
}

/**
 * @param run - The run.
 * @param index - Index into hangarChoices().
 * @returns The run with the hull graduated or evolved.
 */
export function chooseHangar(run: RunState, index: number): RunState {
  const option = hangarChoices(run)[index];
  if (!option) return popReward(run);
  const progression = cloneProgression(run);
  if (option.kind === "graduate" && option.hull)
    applyGraduate(progression, option.hull);
  else applyEvolve(progression);
  return withLog(popReward({ ...run, progression }), `Hangar: ${option.name}`);
}

/**
 * @param reward - A mutation reward.
 * @returns Its mutually exclusive options.
 */
export function mutationChoices(
  reward: Extract<PendingReward, { kind: "mutation" }>,
): Mutation[] {
  return mutationsForSlot(reward.slot);
}

/**
 * @param run - The run.
 * @param mutationId - The mutation taken (replaces any in its slot).
 * @returns The run with the mutation installed.
 */
export function chooseMutation(run: RunState, mutationId: string): RunState {
  const mutation = getMutation(mutationId);
  if (!mutation) return popReward(run);
  return withLog(
    popReward({
      ...run,
      mutations: { ...run.mutations, [mutation.slot]: mutation.id },
    }),
    `Mutation: ${mutation.name}`,
  );
}

/**
 * @param run - The run (front reward must be nextSector).
 * @returns The run at the start of the next sector.
 */
export function advanceSector(run: RunState): RunState {
  const next = enterSector(popReward(run), run.sector + 1);
  return withLog(next, `Jumped to sector ${next.sector}`);
}
