import { describe, expect, it } from "vitest";
import { CONTROL_GROUPS } from "../../../../src/ui/ControlsReference";
import {
  LEGEND_ROW_LABELS,
  legendSections,
  type LegendContext,
} from "../../../../src/ui/legend/hotkeyLegendModel";

const STUB = { keyboard: () => "K", gamepad: () => "G" };
const CONTEXTS = Object.keys(LEGEND_ROW_LABELS) as LegendContext[];

describe("hotkeyLegendModel", () => {
  it("only references rows that exist in the controls reference", () => {
    const known = new Set(CONTROL_GROUPS.flatMap((g) => g.rows.map((r) => r.label)));
    for (const context of CONTEXTS) {
      for (const label of LEGEND_ROW_LABELS[context]) {
        expect(known.has(label), `${context}: ${label}`).toBe(true);
      }
    }
  });

  it("shows squad mark in squad modes but not in duels", () => {
    const labels = (c: LegendContext): string[] =>
      legendSections(c, STUB).flatMap((s) => s.rows.map((r) => r.label));
    expect(labels("squad")).toContain("Mark Target (squad focus)");
    expect(labels("duel")).not.toContain("Mark Target (squad focus)");
  });

  it("shows hero powers only in the campaign", () => {
    const has = (c: LegendContext): boolean =>
      legendSections(c, STUB).some((s) =>
        s.rows.some((r) => r.label.startsWith("Hero Powers")),
      );
    expect(has("campaign")).toBe(true);
    expect(has("arcade")).toBe(false);
  });

  it("reads keyboard and gamepad labels from the injected sources", () => {
    const rows = legendSections("duel", STUB).flatMap((s) => s.rows);
    expect(rows.find((r) => r.label === "Steer")).toEqual({
      label: "Steer",
      keyboard: "K",
      gamepad: "G",
    });
  });

  it("always ends with the fixed system keys", () => {
    for (const context of CONTEXTS) {
      const last = legendSections(context, STUB).at(-1);
      expect(last?.title).toBe("Always");
      expect(last?.rows.map((r) => r.keyboard)).toContain("? / F1");
    }
  });
});
