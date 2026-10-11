import { describe, expect, it } from "vitest";
import {
  CONTROL_RANGE_PX,
  SCRAMBLE_HOLD_MS,
  nodesOwnedBy,
  stepScrambleNode,
  type ScrambleNode,
} from "../../../../src/arcade/scenarios";
import { aFrame, aShip } from "./scenarioBuilders";

const NODE: ScrambleNode = {
  id: "A",
  label: "A",
  x: 0,
  y: 0,
  radius: CONTROL_RANGE_PX,
  owner: null,
  progressSide: null,
  progressMs: 0,
  controller: "none",
};

const HALF = SCRAMBLE_HOLD_MS / 2;

describe("stepScrambleNode", () => {
  it("builds progress for the side holding the node", () => {
    const node = stepScrambleNode(NODE, aFrame([aShip()], [], HALF));
    expect(node).toMatchObject({
      progressSide: "player",
      progressMs: HALF,
      owner: null,
    });
  });

  it("scrambles the node after holding it for the hold time", () => {
    let node = stepScrambleNode(NODE, aFrame([aShip()], [], HALF));
    node = stepScrambleNode(node, aFrame([aShip()], [], HALF));
    expect(node).toMatchObject({
      owner: "player",
      progressSide: null,
      progressMs: 0,
    });
  });

  it("a contested node loses the progress", () => {
    let node = stepScrambleNode(NODE, aFrame([aShip()], [], HALF));
    node = stepScrambleNode(
      node,
      aFrame([aShip(), aShip({ id: "e", side: "enemy" })], [], HALF),
    );
    expect(node).toMatchObject({
      owner: null,
      progressMs: 0,
      controller: "contested",
    });
  });

  it("leaving the node loses the progress", () => {
    let node = stepScrambleNode(NODE, aFrame([aShip()], [], HALF));
    node = stepScrambleNode(node, aFrame([], [], HALF));
    expect(node.progressMs).toBe(0);
    expect(node.owner).toBeNull();
  });

  it("the owner keeps the node until the other side re-scrambles it", () => {
    const owned: ScrambleNode = { ...NODE, owner: "player" };
    let node = stepScrambleNode(owned, aFrame([], [], SCRAMBLE_HOLD_MS));
    expect(node.owner).toBe("player");
    node = stepScrambleNode(
      node,
      aFrame([aShip({ side: "enemy" })], [], SCRAMBLE_HOLD_MS),
    );
    expect(node.owner).toBe("enemy");
  });

  it("the owner holding its own node builds no progress", () => {
    const owned: ScrambleNode = { ...NODE, owner: "player" };
    const node = stepScrambleNode(owned, aFrame([aShip()], [], HALF));
    expect(node).toMatchObject({
      owner: "player",
      progressMs: 0,
      progressSide: null,
    });
  });

  it("counts the nodes each side owns", () => {
    const nodes = [
      { ...NODE, owner: "player" as const },
      { ...NODE, id: "B", owner: "enemy" as const },
      { ...NODE, id: "C", owner: "player" as const },
    ];
    expect(nodesOwnedBy(nodes, "player")).toBe(2);
    expect(nodesOwnedBy(nodes, "enemy")).toBe(1);
  });
});
