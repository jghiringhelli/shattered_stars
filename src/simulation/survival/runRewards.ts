/**
 * runRewards — the average player's claim of a Survival run's pending
 * rewards: the generalist draft policy's power, the first relic, Hangar
 * option and mutation offered, and the jump to the next sector.
 *
 * Pure: no Phaser.
 */

import {
  advanceSector,
  chooseHangar,
  chooseMutation,
  choosePower,
  chooseRelic,
  currentReward,
  mutationChoices,
  powerDraft,
  relicChoices,
  skipPower,
} from "../../systems/survival/RewardFlow";
import type { RunState } from "../../systems/survival/RunTypes";
import { generalistPolicy } from "../SurvivalDraftPolicy";

/** Rewards claimed at most per call (a boss queues a handful). */
const MAX_REWARDS = 16;

/**
 * Claim every pending reward.
 * @param start - The run.
 * @returns The run with no reward pending.
 */
export function claimRewards(start: RunState): RunState {
  const policy = generalistPolicy();
  let run = start;
  for (let i = 0; i < MAX_REWARDS; i++) {
    const reward = currentReward(run);
    if (!reward) return run;
    switch (reward.kind) {
      case "power": {
        const offered = powerDraft(run, reward.key);
        run =
          offered.length > 0
            ? choosePower(run, policy.pickPower(offered, run.progression).id)
            : skipPower(run);
        break;
      }
      case "relic":
        run = chooseRelic(run, relicChoices(run, reward)[0]?.id ?? "");
        break;
      case "hangar":
        run = chooseHangar(run, 0);
        break;
      case "mutation":
        run = chooseMutation(run, mutationChoices(reward)[0]?.id ?? "");
        break;
      case "nextSector":
        run = advanceSector(run);
        break;
    }
  }
  return run;
}
