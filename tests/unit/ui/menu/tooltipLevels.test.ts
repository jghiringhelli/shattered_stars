/**
 * Spec: a tooltip has two levels. Hover shows a SHORT one (name + one line);
 * holding (Shift / gamepad Y / long hover) or keyboard focus shows the FULL
 * explanation with its example.
 */

import { describe, it, expect } from "vitest";
import {
  allTermIds,
  termEntry,
} from "../../../../src/data/tooltips";
import {
  contentFromTerm,
  tooltipBlocks,
  tooltipText,
} from "../../../../src/ui/menu/tooltipContent";

describe("tooltip levels", () => {
  it("short level shows the title and only the first sentence of the definition", () => {
    const entry = termEntry("stat.hull");
    const blocks = tooltipBlocks(contentFromTerm("stat.hull"), "short");
    expect(blocks[0]).toEqual({ style: "title", text: entry.title });
    expect(blocks).toHaveLength(2);
    expect(entry.definition.startsWith(blocks[1]!.text)).toBe(true);
    expect(blocks[1]!.text.split(/(?<=[.!?])\s/)).toHaveLength(1);
  });

  it("short level never shows the example label", () => {
    for (const id of allTermIds()) {
      const text = tooltipText(contentFromTerm(id), "short");
      expect(text, id).not.toContain("EXAMPLE");
      expect(text, id).not.toContain(termEntry(id).example);
    }
  });

  it("full level is the default and carries the example", () => {
    const content = contentFromTerm("stat.hull");
    expect(tooltipText(content)).toBe(tooltipText(content, "full"));
    expect(tooltipText(content)).toContain(termEntry("stat.hull").example);
  });

  it("short level is strictly shorter than full for every term", () => {
    for (const id of allTermIds()) {
      const content = contentFromTerm(id);
      expect(tooltipText(content, "short").length, id).toBeLessThan(
        tooltipText(content, "full").length,
      );
    }
  });

  it("a role-only hint reads as its role line when short", () => {
    const blocks = tooltipBlocks(
      { role: "Flanker — strikes from behind", bestWith: "Best with wingmen" },
      "short",
    );
    expect(blocks.map((b) => b.text)).toEqual(["Flanker — strikes from behind"]);
  });
});
