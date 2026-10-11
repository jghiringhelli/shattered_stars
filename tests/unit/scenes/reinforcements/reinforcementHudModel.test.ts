import { describe, expect, it } from "vitest";
import {
  countdownLabel,
  deployToast,
  nextLine,
  pickerRowLabel,
  poolTone,
  sideRow,
} from "../../../../src/scenes/arcadeBattle/reinforcements/reinforcementHudModel";
import {
  toDeployOption,
  type SideSummary,
} from "../../../../src/arcade/reinforcements";
import type { PickerOption } from "../../../../src/arcade/reinforcements";

const kestrel = toDeployOption({
  definitionId: "confed_kestrel",
  loadoutId: "kestrel_striker",
})!;
const wasp = toDeployOption({ definitionId: "confed_wasp", loadoutId: null })!;

const summary = (overrides: Partial<SideSummary> = {}): SideSummary => ({
  faction: "free_confederation",
  isPlayerSide: true,
  poolPoints: 1000,
  remainingPoints: 640,
  fieldPoints: 180,
  fieldCapPoints: 250,
  deployedCount: 6,
  lostCount: 2,
  lostPoints: 90,
  exhausted: false,
  ...overrides,
});

const row = (overrides: Partial<PickerOption> = {}): PickerOption => ({
  option: kestrel,
  check: { allowed: true, block: null, reason: "" },
  source: "reserve",
  reserveIndex: 0,
  isDefault: false,
  ...overrides,
});

describe("reinforcement HUD text", () => {
  it("a side row names the side, pool left and field vs cap", () => {
    expect(sideRow(summary())).toBe("YOU  POOL 640  FIELD 180/250");
    expect(
      sideRow(summary({ isPlayerSide: false, faction: "void_corsairs" })),
    ).toBe("FOE  POOL 640  FIELD 180/250");
  });

  it("an exhausted side says so in words, not just colour", () => {
    expect(sideRow(summary({ remainingPoints: 0, exhausted: true }))).toContain(
      "EXHAUSTED",
    );
  });

  it("the pool tone warns at a quarter and is danger when empty", () => {
    expect(poolTone(summary())).toBe("normal");
    expect(poolTone(summary({ remainingPoints: 200 }))).toBe("warning");
    expect(poolTone(summary({ remainingPoints: 0 }))).toBe("danger");
  });

  it("previews the next reserve ships", () => {
    expect(nextLine([kestrel, wasp])).toBe(
      `NEXT ▸ ${kestrel.label} · ${wasp.label}`.toUpperCase(),
    );
    expect(nextLine([])).toBe("NEXT ▸ —");
  });

  it("deploy notifications say whose ship arrived, with a direction glyph", () => {
    const base = {
      shipId: "x",
      faction: "void_corsairs",
      option: wasp,
      slot: 0,
    };
    expect(deployToast({ ...base, pilot: "ai" }, "free_confederation")).toBe(
      `▼ FOE  ${wasp.label.toUpperCase()}  ${wasp.cost} PTS`,
    );
    expect(
      deployToast(
        { ...base, faction: "free_confederation", pilot: "wingman" },
        "free_confederation",
      ),
    ).toMatch(/^▲ ALLY  /);
    expect(
      deployToast(
        { ...base, faction: "free_confederation", pilot: "player" },
        "free_confederation",
      ),
    ).toMatch(/^★ YOU  /);
  });
});

describe("picker text", () => {
  it("numbers rows, shows cost, and marks the default", () => {
    expect(pickerRowLabel(row({ isDefault: true }), 0)).toBe(
      `1  ${kestrel.label.toUpperCase()}  ${kestrel.cost} PTS  · NEXT`,
    );
  });

  it("disabled rows show the reason", () => {
    expect(
      pickerRowLabel(
        row({
          check: {
            allowed: false,
            block: "quota_field",
            reason: "MAX 2 BOMBERS ON FIELD",
          },
        }),
        3,
      ),
    ).toBe(
      `4  ${kestrel.label.toUpperCase()}  ${kestrel.cost} PTS  — MAX 2 BOMBERS ON FIELD`,
    );
  });

  it("the countdown counts whole seconds, or says why it is held", () => {
    expect(
      countdownLabel({ options: [row()], remainingMs: 4200, counting: true }),
    ).toBe("AUTO-DEPLOY NEXT IN 5 S  ·  1–1 PICK  ·  ENTER NOW");
    expect(
      countdownLabel({
        options: [row({ check: { allowed: false, block: "cap", reason: "" } })],
        remainingMs: 5000,
        counting: false,
      }),
    ).toBe("WAITING FOR ROOM ON THE FIELD");
    expect(
      countdownLabel({
        options: [
          row({ check: { allowed: false, block: "pool", reason: "" } }),
        ],
        remainingMs: 5000,
        counting: false,
      }),
    ).toBe("POOL EXHAUSTED — WATCHING YOUR WINGMEN");
  });
});
