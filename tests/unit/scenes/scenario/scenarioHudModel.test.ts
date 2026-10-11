import { describe, expect, it } from "vitest";
import {
  SCENARIO_DEFINITIONS,
  SCENARIO_ROUND_MS,
  SCRAMBLE_HOLD_MS,
  createScenarioState,
  withBonusPoints,
} from "../../../../src/arcade/scenarios";
import {
  OWNER_SYMBOLS,
  OWNER_TAGS,
  objectiveGlyphs,
  scoreboardView,
} from "../../../../src/scenes/scenario/scenarioHudModel";

const WORLD = 6000;

describe("objectiveGlyphs", () => {
  it("draws a satellite per control zone with its controller", () => {
    const base = createScenarioState(
      SCENARIO_DEFINITIONS.satellite_array,
      WORLD,
    );
    const state = {
      ...base,
      zones: base.zones.map((z, i) => ({
        ...z,
        controller: i === 0 ? ("enemy" as const) : z.controller,
      })),
    };
    const glyphs = objectiveGlyphs(state);
    expect(glyphs.map((g) => [g.label, g.kind, g.owner])).toEqual([
      ["A", "satellite", "enemy"],
      ["B", "satellite", "none"],
      ["C", "satellite", "none"],
    ]);
  });

  it("a node shows its owner and the scrambling progress", () => {
    const base = createScenarioState(
      SCENARIO_DEFINITIONS.scramble_transmissions,
      WORLD,
    );
    const state = {
      ...base,
      nodes: base.nodes.map((n, i) =>
        i === 0
          ? {
              ...n,
              owner: "player" as const,
              progressSide: "enemy" as const,
              progressMs: SCRAMBLE_HOLD_MS / 2,
            }
          : n,
      ),
    };
    const [node] = objectiveGlyphs(state);
    expect(node).toMatchObject({
      kind: "node",
      owner: "player",
      progress: 0.5,
      progressSide: "enemy",
    });
  });

  it("a carried crate belongs to its carrier's side and names the carrier", () => {
    const base = createScenarioState(
      SCENARIO_DEFINITIONS.salvage_mission,
      WORLD,
    );
    const state = {
      ...base,
      crates: base.crates.map((c, i) =>
        i === 1
          ? { ...c, carrierId: "player_0", carrierSide: "player" as const }
          : c,
      ),
    };
    const glyphs = objectiveGlyphs(state);
    expect(glyphs[1]).toMatchObject({
      kind: "crate",
      owner: "player",
      carrierId: "player_0",
    });
    expect(glyphs[0]).toMatchObject({ owner: "none", carrierId: null });
  });

  it("never relies on colour alone: every owner has its own tag and symbol", () => {
    const owners = ["player", "enemy", "contested", "none"] as const;
    expect(new Set(owners.map((o) => OWNER_TAGS[o])).size).toBe(4);
    expect(new Set(owners.map((o) => OWNER_SYMBOLS[o])).size).toBe(4);
  });
});

describe("scoreboardView", () => {
  const satellites = () =>
    createScenarioState(SCENARIO_DEFINITIONS.satellite_array, WORLD);

  it("shows both totals and the threshold", () => {
    const state = withBonusPoints(
      withBonusPoints(satellites(), "player", 7),
      "enemy",
      3,
    );
    const view = scoreboardView(state, null);
    expect(view.playerScore).toBe("YOU 7");
    expect(view.enemyScore).toBe("3 FOE");
    expect(view.goal).toBe("FIRST TO 20");
  });

  it("shows the round and the time to its end", () => {
    const state = {
      ...satellites(),
      round: 4,
      roundElapsedMs: SCENARIO_ROUND_MS - 1200,
    };
    expect(scoreboardView(state, null).round).toContain("ROUND 5");
    expect(scoreboardView(state, null).round).toContain("1.2s");
  });

  it("lists every objective with its letter and owner symbol", () => {
    const base = satellites();
    const state = {
      ...base,
      zones: base.zones.map((z, i) => ({
        ...z,
        controller: (["player", "enemy", "contested"] as const)[i]!,
      })),
    };
    expect(scoreboardView(state, null).chips).toBe(
      `A${OWNER_SYMBOLS.player} B${OWNER_SYMBOLS.enemy} C${OWNER_SYMBOLS.contested}`,
    );
  });

  it("warns the player while they carry salvage", () => {
    const base = createScenarioState(
      SCENARIO_DEFINITIONS.salvage_mission,
      WORLD,
    );
    const state = {
      ...base,
      crates: base.crates.map((c, i) =>
        i === 0
          ? { ...c, carrierId: "player_0", carrierSide: "player" as const }
          : c,
      ),
    };
    expect(scoreboardView(state, "player_0").alert).toContain(
      "CARRYING SALVAGE",
    );
    expect(scoreboardView(state, "other").alert).toBe("");
  });

  it("Chance Engagement announces when scoring starts", () => {
    const state = createScenarioState(
      SCENARIO_DEFINITIONS.chance_engagement,
      WORLD,
    );
    expect(scoreboardView(state, null).alert).toContain("SCORING FROM ROUND 4");
  });
});
