/**
 * guideSections — the pure content of the picker's HOW TO FLY, PROS & CONS
 * and COST tabs, cut out of a BuildExplanation. No Phaser.
 */

import type { BuildExplanation, CostLine } from "../../data/roleHints";

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

/** Most lines each builds-tab list shows (the rest is on hover / in the loadout tab). */
export const BUILDS_CAPS = { howToFly: 3, pros: 2, cons: 2 } as const;

/** The builds tab's two columns. */
export interface BuildsSections {
  readonly left: GuideSection[];
  readonly right: GuideSection[];
}

/** Caps of the single-column (narrow panel) variant: it drops best-with / counter and trims the lists. */
export const NARROW_BUILDS_CAPS = { howToFly: 2, pros: 1, cons: 1 } as const;

/**
 * @param guide - The build's explanation.
 * @param narrow - A narrow panel: fewer sections and shorter lists (best-with and counter are on the build's hover).
 * @returns The builds tab's two columns of sections.
 */
export function buildsSections(
  guide: BuildExplanation,
  narrow = false,
): BuildsSections {
  const caps = narrow ? NARROW_BUILDS_CAPS : BUILDS_CAPS;
  return {
    left: [
      LINE("WHEN TO PICK IT", [guide.whenToPick]),
      LINE("EXAMPLE", [guide.example], "example"),
      ...(narrow
        ? []
        : [
            LINE("BEST WITH", [guide.bestWith.replace(/^Best with /, "")]),
            LINE("COUNTERED BY", [guide.counter.replace(/^Struggles against: /, "")]),
          ]),
    ],
    right: [
      LINE("HOW TO FLY", guide.howToFly.slice(0, caps.howToFly), "normal", true),
      LINE("STRENGTHS", guide.strengths.slice(0, caps.pros), "good", true),
      LINE("WEAKNESSES", guide.weaknesses.slice(0, caps.cons), "bad", true),
    ],
  };
}

/**
 * @param guide - The build's explanation.
 * @returns "Hull 45 + Pilot 8 + 2 cards 10 = 63 pt" (zero parts left out).
 */
export function costSummary(guide: BuildExplanation): string {
  const sum = (kind: CostLine["kind"]): { points: number; count: number } => {
    const lines = guide.costLines.filter((line) => line.kind === kind);
    return {
      points: lines.reduce((total, line) => total + line.points, 0),
      count: lines.length,
    };
  };
  const hull = sum("hull");
  const pilot = sum("pilot");
  const cards = sum("card");
  const parts = [
    `Hull ${hull.points}`,
    ...(pilot.points > 0 ? [`Pilot ${pilot.points}`] : []),
    ...(cards.count > 0
      ? [`${cards.count} card${cards.count === 1 ? "" : "s"} ${cards.points}`]
      : []),
  ];
  return `${parts.join(" + ")} = ${guide.totalPoints} pt`;
}