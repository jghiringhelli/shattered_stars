/**
 * scrambleRules — "Scramble the Transmissions" in real time: a side
 * scrambles a network node by controlling it (more ship weight in range,
 * {@link resolveControl}) for {@link SCRAMBLE_HOLD_MS} without a break;
 * losing control (contested, left, or the owner back in charge) resets the
 * progress. A scrambled node belongs to its side — and scores for it every
 * round — until the other side scrambles it back.
 *
 * Pure.
 */

import { resolveControl } from "./controlRules";
import { SCRAMBLE_HOLD_MS } from "./scenarioConstants";
import type {
  ScenarioFrame,
  ScenarioSide,
  ScrambleNode,
} from "./scenarioTypes";

/**
 * @param node - A network node.
 * @param frame - This frame.
 * @returns The node after this frame's scrambling.
 */
export function stepScrambleNode(
  node: ScrambleNode,
  frame: ScenarioFrame,
): ScrambleNode {
  const controller = resolveControl(
    frame.ships,
    node,
    node.radius,
    frame.worldSize,
  );
  const scrambler =
    (controller === "player" || controller === "enemy") &&
    controller !== node.owner
      ? controller
      : null;
  if (!scrambler) {
    return { ...node, controller, progressSide: null, progressMs: 0 };
  }
  const progressMs =
    (node.progressSide === scrambler ? node.progressMs : 0) + frame.deltaMs;
  if (progressMs >= SCRAMBLE_HOLD_MS) {
    return {
      ...node,
      controller,
      owner: scrambler,
      progressSide: null,
      progressMs: 0,
    };
  }
  return { ...node, controller, progressSide: scrambler, progressMs };
}

/**
 * @param nodes - Network nodes.
 * @param side - A side.
 * @returns How many of them the side has scrambled.
 */
export function nodesOwnedBy(
  nodes: readonly ScrambleNode[],
  side: ScenarioSide,
): number {
  return nodes.filter((node) => node.owner === side).length;
}
