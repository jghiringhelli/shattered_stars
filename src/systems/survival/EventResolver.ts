/**
 * Survival roguelite — event resolution (pure). Picks a node's event,
 * judges which choices are open (costs, "blue" requirements) and applies
 * a choice: up-front cost, outcomes, seeded gambles, or a battle whose
 * other outcomes become the post-victory bonus.
 */

import { getEvent, pickEvent } from "../../data/survival/events";
import type {
  EventChoice,
  EventOutcome,
  SurvivalEvent,
} from "../../data/survival/eventTypes";
import { drawRelics, relicsOf } from "../../data/survival/relicCatalog";
import { FACTION_NAMES_SHORT } from "../../data/survival/factionNames";
import { rngFor } from "./RunRng";
import {
  addEscort,
  adjustFleetHull,
  removeEscort,
  upgradeShip,
  withLog,
} from "./RunState";
import { gainSalvage, spendSalvage } from "./RunEconomy";
import { grantRelic } from "./RewardFlow";
import type { RunState } from "./RunTypes";

/** Whether a choice can be taken, and why not. */
export interface ChoiceAvailability {
  readonly enabled: boolean;
  readonly reason: string | null;
}

/** Result of taking a choice. */
export interface EventResolution {
  readonly run: RunState;
  /** Player-facing summary of what happened. */
  readonly message: string;
  /** True when the choice started a battle. */
  readonly startsCombat: boolean;
}

/**
 * @param run - The run.
 * @param nodeId - The event node.
 * @returns The node's event (stable per node, avoids repeats).
 */
export function eventForNode(run: RunState, nodeId: string): SurvivalEvent {
  if (run.activeEventId) {
    const active = getEvent(run.activeEventId);
    if (active) return active;
  }
  return pickEvent(rngFor(run.seed, "event", nodeId), run.seenEvents);
}

/**
 * @param run - The run.
 * @param choice - An event choice.
 * @returns Whether the run can take it.
 */
export function choiceAvailability(
  run: RunState,
  choice: EventChoice,
): ChoiceAvailability {
  const req = choice.requires;
  if (choice.cost !== undefined && run.salvage < choice.cost) {
    return {
      enabled: false,
      reason: `Needs ${choice.cost} salvage (${choice.cost - run.salvage} short)`,
    };
  }
  if (req?.faction && req.faction !== run.faction) {
    return {
      enabled: false,
      reason: `${FACTION_NAMES_SHORT[req.faction]} only`,
    };
  }
  if (req?.minEscorts !== undefined && run.escorts.length < req.minEscorts) {
    return { enabled: false, reason: `Needs ${req.minEscorts} escort` };
  }
  if (req?.minRerolls !== undefined && run.rerolls < req.minRerolls) {
    return { enabled: false, reason: `Needs ${req.minRerolls} reroll` };
  }
  if (
    req?.relicTag &&
    !relicsOf(run.relics).some((r) => r.tags.includes(req.relicTag!))
  ) {
    return { enabled: false, reason: `Needs a [${req.relicTag}] relic` };
  }
  return { enabled: true, reason: null };
}

/**
 * @param run - The run (its active node is the event node).
 * @param event - The event.
 * @param index - The chosen option.
 * @returns The new run, a summary, and whether a battle starts.
 */
export function resolveEventChoice(
  run: RunState,
  event: SurvivalEvent,
  index: number,
): EventResolution {
  const choice = event.choices[index];
  if (!choice || !choiceAvailability(run, choice).enabled) {
    return { run, message: "Nothing happens.", startsCombat: false };
  }
  const nodeKey = run.activeNodeId ?? event.id;
  let next = choice.cost ? (spendSalvage(run, choice.cost) ?? run) : run;
  let outcomes = [...(choice.outcomes ?? [])];
  let message = choice.description;
  if (choice.gamble) {
    const won =
      rngFor(run.seed, "gamble", nodeKey, index).next() < choice.gamble.chance;
    outcomes = [
      ...outcomes,
      ...(won ? choice.gamble.success : choice.gamble.failure),
    ];
    message = won ? "Fortune favours you." : "It goes badly.";
  }
  const combat = outcomes.find((o) => o.kind === "combat");
  if (combat && combat.kind === "combat") {
    const bonus = outcomes.filter((o) => o.kind !== "combat");
    next = {
      ...next,
      eventCombat: {
        elite: combat.elite,
        bonus,
        ...(combat.creature ? { creature: combat.creature } : {}),
      },
    };
    return {
      run: withLog(next, `${event.title}: battle!`),
      message: "Battle stations!",
      startsCombat: true,
    };
  }
  next = applyOutcomes(next, outcomes, `${nodeKey}:${index}`);
  return {
    run: withLog(next, `${event.title}: ${choice.label}`),
    message,
    startsCombat: false,
  };
}

/**
 * @param run - The run.
 * @param outcomes - Outcomes to apply in order.
 * @param key - Stable key for any seeded draw (relic).
 * @returns The run with every outcome applied.
 */
export function applyOutcomes(
  run: RunState,
  outcomes: readonly EventOutcome[],
  key: string,
): RunState {
  return outcomes.reduce(
    (acc, outcome, i) => applyOutcome(acc, outcome, `${key}:${i}`),
    run,
  );
}

function applyOutcome(
  run: RunState,
  outcome: EventOutcome,
  key: string,
): RunState {
  switch (outcome.kind) {
    case "salvage":
      return gainSalvage(run, outcome.amount);
    case "hull":
      return adjustFleetHull(run, outcome.fraction);
    case "relic":
      return grantEventRelic(run, outcome.minRarity, key);
    case "escort":
      return addEscort(run);
    case "loseEscort":
      return removeEscort(run);
    case "rerolls":
      return { ...run, rerolls: Math.max(0, run.rerolls + outcome.amount) };
    case "power":
      return {
        ...run,
        pendingRewards: [...run.pendingRewards, { kind: "power", key }],
      };
    case "upgrade":
      return upgradeShip(run, 0);
    case "meta":
      return {
        ...run,
        stats: {
          ...run.stats,
          bonusCharts: run.stats.bonusCharts + outcome.amount,
        },
      };
    case "combat":
      return run;
  }
}

function grantEventRelic(
  run: RunState,
  minRarity: "common" | "uncommon" | "rare" | undefined,
  key: string,
): RunState {
  const [relic] = drawRelics(rngFor(run.seed, "eventRelic", key), {
    owned: run.relics,
    pools: run.pools,
    count: 1,
    ...(minRarity ? { minRarity } : {}),
  });
  return relic ? grantRelic(run, relic.id) : gainSalvage(run, 40);
}
