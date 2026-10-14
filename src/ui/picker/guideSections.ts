/**
 * guideSections — the pure content of the picker's HOW TO FLY, PROS & CONS
 * and COST tabs, cut out of a BuildExplanation. No Phaser.
 */

import type { BuildExplanation } from "../../data/roleHints";

/** Tabs that show guide text. */
export type GuideTab = "guide" | "pros" | "cost";

/** How a section's lines read. */
export type SectionTone = "normal" | "good" | "bad" | "example";

/** One headed block of the guide. */
export interface GuideSection {
  readonly heading: string;
  readonly tone: SectionTone;
  readonly lines: readonly string[];
  /** Render lines as a bulleted list. */
  readonly bullets: boolean;
  /** Label / value rows (cost tab) instead of lines. */
  readonly rows?: ReadonlyArray<{ readonly label: string; readonly value: string }>;
}

const LINE = (
  heading: string,
  lines: readonly string[],
  tone: SectionTone = "normal",
  bullets = false,
): GuideSection => ({ heading, tone, lines, bullets });

const KIND_LABEL = { hull: "hull", pilot: "pilot", card: "card" } as const;

/**
 * @param tab - Which tab.
 * @param guide - The build's explanation.
 * @returns The tab's sections, top to bottom.
 */
export function guideSections(
  tab: GuideTab,
  guide: BuildExplanation,
): GuideSection[] {
  if (tab === "guide") {
    return [
      LINE("WHEN TO PICK IT", [guide.whenToPick]),
      LINE("EXAMPLE", [guide.example], "example"),
      LINE("HOW TO FLY", guide.howToFly, "normal", true),
    ];
  }
  if (tab === "pros") {
    return [
      LINE("STRENGTHS", guide.strengths, "good", true),
      LINE("WEAKNESSES", guide.weaknesses, "bad", true),
      LINE("BEST WITH", [guide.bestWith.replace(/^Best with /, "")]),
      LINE("COUNTERED BY", [guide.counter.replace(/^Struggles against: /, "")]),
    ];
  }
  return [
    {
      heading: "COST BREAKDOWN",
      tone: "normal",
      lines: [],
      bullets: false,
      rows: [
        ...guide.costLines.map((line) => ({
          label: `${line.label} (${KIND_LABEL[line.kind]})`,
          value: `${line.points} pt`,
        })),
        { label: "TOTAL", value: `${guide.totalPoints} pt` },
      ],
    },
  ];
}
