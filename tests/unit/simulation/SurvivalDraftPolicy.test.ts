import { describe, it, expect } from "vitest";
import { createSeededRng } from "../../../src/utils/random";
import {
  brawlerPolicy,
  generalistPolicy,
  randomPolicy,
  specialistPolicy,
} from "../../../src/simulation/SurvivalDraftPolicy";
import { createRunState } from "../../../src/data/survival/model";
import { ATOMS, type Power } from "../../../src/data/survival/powers";
import type { HangarOption } from "../../../src/data/survival/hangar";
import type { EscortOption } from "../../../src/data/survival/escorts";

function atomById(id: string): Power {
  const p = ATOMS.find((a) => a.id === id);
  if (!p) throw new Error(`missing atom ${id}`);
  return p;
}

describe("SurvivalDraftPolicy — specialist", () => {
  it("deepens the branch it already has the most investment in", () => {
    const state = createRunState("ace");
    state.branch.gunnery = 3;
    state.branch.drive = 1;
    const offered = [atomById("gun_damage"), atomById("drv_speed")];
    const pick = specialistPolicy().pickPower(offered, state);
    expect(pick.branch).toBe("gunnery");
  });

  it("evolves at the hangar", () => {
    const options: HangarOption[] = [
      { kind: "graduate", hull: "ace", name: "", description: "", icon: "" },
      { kind: "evolve", name: "", description: "", icon: "" },
    ];
    expect(specialistPolicy().pickHangar(options, createRunState()).kind).toBe(
      "evolve",
    );
  });
});

describe("SurvivalDraftPolicy — generalist", () => {
  it("spreads into the shallowest branch", () => {
    const state = createRunState("ace");
    state.branch.gunnery = 3;
    state.branch.drive = 0;
    const offered = [atomById("gun_damage"), atomById("drv_speed")];
    const pick = generalistPolicy().pickPower(offered, state);
    expect(pick.branch).toBe("drive");
  });

  it("graduates at the hangar when a lane is available", () => {
    const options: HangarOption[] = [
      {
        kind: "graduate",
        hull: "gunboat",
        name: "",
        description: "",
        icon: "",
      },
      { kind: "evolve", name: "", description: "", icon: "" },
    ];
    expect(generalistPolicy().pickHangar(options, createRunState()).kind).toBe(
      "graduate",
    );
  });
});

describe("SurvivalDraftPolicy — brawler", () => {
  it("prefers a durability stat over a damage stat", () => {
    const state = createRunState("ace");
    const offered = [atomById("gun_damage"), atomById("bul_hull")];
    const pick = brawlerPolicy().pickPower(offered, state);
    expect(pick.stat).toBe("maxHull");
  });

  it("evolves at the hangar (escorts are a separate track)", () => {
    const options: HangarOption[] = [
      { kind: "graduate", hull: "ace", name: "", description: "", icon: "" },
      { kind: "evolve", name: "", description: "", icon: "" },
    ];
    expect(brawlerPolicy().pickHangar(options, createRunState()).kind).toBe(
      "evolve",
    );
  });

  it("recruits on the escort track", () => {
    const options: EscortOption[] = [
      { kind: "recruit", name: "", description: "", icon: "" },
      { kind: "bank", name: "", description: "", icon: "" },
    ];
    expect(brawlerPolicy().pickEscort(options, createRunState()).kind).toBe(
      "recruit",
    );
  });
});

describe("SurvivalDraftPolicy — random", () => {
  it("is deterministic for a fixed seed", () => {
    const state = createRunState("ace");
    const offered = [atomById("gun_damage"), atomById("drv_speed")];
    const a = randomPolicy(createSeededRng(7)).pickPower(offered, state);
    const b = randomPolicy(createSeededRng(7)).pickPower(offered, state);
    expect(a.id).toBe(b.id);
  });

  it("only ever returns an offered power", () => {
    const state = createRunState();
    const offered = [atomById("gun_damage"), atomById("bul_hull")];
    const policy = randomPolicy(createSeededRng(3));
    for (let i = 0; i < 20; i++) {
      expect(offered).toContain(policy.pickPower(offered, state));
    }
  });
});
