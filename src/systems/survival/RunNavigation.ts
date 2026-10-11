/**
 * Survival roguelite — moving on the sector map (pure): entering a node
 * (revealing mysteries, picking the event) and finishing it.
 */

import { getEvent } from "../../data/survival/events";
import { findNode, nextOptions, revealMystery } from "./SectorMapGenerator";
import { eventForNode } from "./EventResolver";
import type { ResolvedNodeKind, RunState } from "./RunTypes";

/**
 * @param run - The run.
 * @param nodeId - A node on the map.
 * @returns True when the fleet may travel there now.
 */
export function canEnterNode(run: RunState, nodeId: string): boolean {
  if (run.status !== "active" || run.activeNodeId !== null) return false;
  if (run.pendingRewards.length > 0) return false;
  return nextOptions(run.map, run.currentNodeId).some((n) => n.id === nodeId);
}

/**
 * @param run - The run.
 * @param nodeId - The node to travel to (must pass canEnterNode).
 * @returns The run with the node active (mystery revealed, event picked),
 *   or the unchanged run when the move is not allowed.
 */
export function enterNode(run: RunState, nodeId: string): RunState {
  if (!canEnterNode(run, nodeId)) return run;
  const node = findNode(run.map, nodeId);
  if (!node) return run;
  const kind = resolveKind(run, node.id, node.type);
  const entered: RunState = {
    ...run,
    activeNodeId: node.id,
    activeKind: kind,
    activeEventId: null,
    eventCombat: null,
    shopBought: [],
    rerollsSpentHere: 0,
    path: [...run.path, node.id],
  };
  if (kind === "treasure") {
    return finishNode({
      ...entered,
      pendingRewards: [
        ...entered.pendingRewards,
        { kind: "relic", key: node.id, minRarity: "common" },
      ],
    });
  }
  if (kind !== "event") return entered;
  const event = eventForNode(entered, node.id);
  return {
    ...entered,
    activeEventId: event.id,
    seenEvents: [...entered.seenEvents, event.id],
  };
}

function resolveKind(
  run: RunState,
  nodeId: string,
  type: string,
): ResolvedNodeKind {
  if (type !== "mystery") return type as ResolvedNodeKind;
  const outcome = revealMystery(run.seed, nodeId);
  return outcome === "event" ? "event" : outcome;
}

/**
 * @param run - The run with an active node.
 * @returns The run with the node resolved: it becomes the current node.
 */
export function finishNode(run: RunState): RunState {
  if (!run.activeNodeId) return run;
  return {
    ...run,
    currentNodeId: run.activeNodeId,
    activeNodeId: null,
    activeKind: null,
    activeEventId: null,
    eventCombat: null,
    shopBought: [],
    stats: { ...run.stats, nodesCleared: run.stats.nodesCleared + 1 },
  };
}

/**
 * @param run - The run.
 * @returns The active event's title, for headers (null when none).
 */
export function activeEventTitle(run: RunState): string | null {
  return run.activeEventId
    ? (getEvent(run.activeEventId)?.title ?? null)
    : null;
}
