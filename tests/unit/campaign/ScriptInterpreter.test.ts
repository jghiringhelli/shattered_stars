/**
 * ScriptInterpreter — specification of the declarative mission timeline:
 * triggers (start, time, objective state, ship destroyed, area entered,
 * flag), flag conditions, delays, one-shot vs repeating beats and flag
 * chaining. Pure.
 */

import { describe, expect, it } from "vitest";
import {
  createScriptState,
  stepScript,
  type ScriptInput,
} from "../../../src/campaign/scripting/ScriptInterpreter";
import type {
  ScriptAction,
  ScriptBeat,
} from "../../../src/campaign/scripting/scriptTypes";

const SAY: ScriptAction = {
  do: "say",
  speaker: "COMMAND",
  portraitKey: "portrait_command",
  text: "Go.",
};

/** A quiet input at a given mission time. */
function input(overrides: Partial<ScriptInput> = {}): ScriptInput {
  return {
    elapsedMs: 0,
    objectives: [],
    destroyed: [],
    ships: [],
    worldSize: 6000,
    ...overrides,
  };
}

/** Runs one step and returns the emitted action kinds. */
function emitted(
  beats: ScriptBeat[],
  steps: ScriptInput[],
  flags = {},
): string[][] {
  let state = createScriptState(beats, flags);
  return steps.map((step) => {
    const result = stepScript(state, step);
    state = result.state;
    return result.actions.map((a) => a.do);
  });
}

describe("ScriptInterpreter triggers", () => {
  it("fires a start beat on the first step only", () => {
    const beats = [{ id: "b", when: { on: "start" as const }, actions: [SAY] }];
    expect(emitted(beats, [input(), input()])).toEqual([["say"], []]);
  });

  it("fires a time beat once its time is reached", () => {
    const beats = [
      { id: "b", when: { on: "time" as const, atSeconds: 5 }, actions: [SAY] },
    ];
    expect(
      emitted(beats, [
        input({ elapsedMs: 4_000 }),
        input({ elapsedMs: 5_000 }),
      ]),
    ).toEqual([[], ["say"]]);
  });

  it("fires on an objective changing to a status", () => {
    const beats = [
      {
        id: "b",
        when: {
          on: "objective" as const,
          objectiveId: "k",
          status: "completed" as const,
        },
        actions: [SAY],
      },
    ];
    const active = { id: "k", status: "active" as const, hidden: false };
    const done = { ...active, status: "completed" as const };
    expect(
      emitted(beats, [
        input({ objectives: [active] }),
        input({ objectives: [done] }),
      ]),
    ).toEqual([[], ["say"]]);
  });

  it("counts destroyed ships by tag and side", () => {
    const beats = [
      {
        id: "b",
        when: {
          on: "destroyed" as const,
          tag: "lance",
          side: "player" as const,
          count: 2,
        },
        actions: [SAY],
      },
    ];
    const lance = { shipId: "a", side: "player" as const, tags: ["lance"] };
    const other = { shipId: "c", side: "enemy" as const, tags: ["lance"] };
    expect(
      emitted(beats, [
        input({ destroyed: [lance, other] }),
        input({ destroyed: [{ ...lance, shipId: "b" }] }),
      ]),
    ).toEqual([[], ["say"]]);
  });

  it("fires when a player ship enters an area", () => {
    const beats = [
      {
        id: "b",
        when: { on: "area" as const, at: { x: 0, y: 0 }, radius: 100 },
        actions: [SAY],
      },
    ];
    const far = { x: 500, y: 0, side: "player" as const, tags: [] };
    const near = { ...far, x: 50 };
    expect(
      emitted(beats, [input({ ships: [far] }), input({ ships: [near] })]),
    ).toEqual([[], ["say"]]);
  });

  it("chains flag triggers within the same step", () => {
    const beats: ScriptBeat[] = [
      {
        id: "set",
        when: { on: "start" },
        actions: [{ do: "setFlag", flag: "alarm" }],
      },
      { id: "react", when: { on: "flag", flag: "alarm" }, actions: [SAY] },
    ];
    expect(emitted(beats, [input()])).toEqual([["setFlag", "say"]]);
  });
});

describe("ScriptInterpreter conditions and timing", () => {
  it("skips a beat whose flag condition fails (story flag from the save)", () => {
    const beats: ScriptBeat[] = [
      {
        id: "ally",
        when: { on: "start" },
        if: [{ flag: "lance_lost", is: false }],
        actions: [SAY],
      },
    ];
    expect(emitted(beats, [input()], { lance_lost: true })).toEqual([[]]);
    expect(emitted(beats, [input()], {})).toEqual([["say"]]);
  });

  it("delays a beat's actions after its trigger", () => {
    const beats: ScriptBeat[] = [
      { id: "b", when: { on: "start" }, delaySeconds: 3, actions: [SAY] },
    ];
    expect(
      emitted(beats, [
        input(),
        input({ elapsedMs: 2_000 }),
        input({ elapsedMs: 3_000 }),
        input({ elapsedMs: 9_000 }),
      ]),
    ).toEqual([[], [], ["say"], []]);
  });

  it("repeats a repeating beat on every new match", () => {
    const beats: ScriptBeat[] = [
      {
        id: "b",
        when: { on: "destroyed", side: "enemy" },
        repeat: true,
        actions: [SAY],
      },
    ];
    const kill = { shipId: "e", side: "enemy" as const, tags: [] };
    expect(
      emitted(beats, [
        input({ destroyed: [kill] }),
        input(),
        input({ destroyed: [kill] }),
      ]),
    ).toEqual([["say"], [], ["say"]]);
  });

  it("records persistent story flags separately from mission flags", () => {
    const beats: ScriptBeat[] = [
      {
        id: "b",
        when: { on: "start" },
        actions: [
          { do: "setFlag", flag: "local" },
          { do: "setFlag", flag: "convoy_saved", persist: true },
        ],
      },
    ];
    const { state } = stepScript(createScriptState(beats, {}), input());
    expect(state.flags).toMatchObject({ local: true, convoy_saved: true });
    expect(state.storyFlags).toEqual({ convoy_saved: true });
  });
});

describe("ScriptInterpreter victory phase", () => {
  const victoryBeat: ScriptBeat = {
    id: "after",
    when: { on: "victory" },
    actions: [SAY],
  };

  it("never fires a victory beat while the mission is still on", () => {
    expect(
      emitted([victoryBeat], [input(), input({ elapsedMs: 90_000 })]),
    ).toEqual([[], []]);
  });

  it("fires a victory beat once the step reports the win", () => {
    expect(emitted([victoryBeat], [input({ victory: true })])).toEqual([
      ["say"],
    ]);
  });

  it("plays a victory beat at once even when it carries a delay", () => {
    const delayed: ScriptBeat = { ...victoryBeat, delaySeconds: 8 };
    expect(emitted([delayed], [input({ victory: true })])).toEqual([["say"]]);
  });

  it("holds a victory beat to its flag conditions", () => {
    const gated: ScriptBeat = {
      ...victoryBeat,
      if: [{ flag: "kept_promise" }],
    };
    expect(emitted([gated], [input({ victory: true })])).toEqual([[]]);
    expect(
      emitted([gated], [input({ victory: true })], { kept_promise: true }),
    ).toEqual([["say"]]);
  });

  it("lets a victory beat persist a story flag", () => {
    const beats: ScriptBeat[] = [
      {
        id: "seal",
        when: { on: "victory" },
        actions: [
          { do: "setFlag", flag: "x14_ceasefire_called", persist: true },
        ],
      },
    ];
    const { state } = stepScript(
      createScriptState(beats, {}),
      input({ victory: true }),
    );
    expect(state.storyFlags).toEqual({ x14_ceasefire_called: true });
  });
});
