/**
 * tooltipContent — what a rich tooltip says, and how that text is split into
 * styled blocks. Content comes from the tooltip catalog (a term id) or from
 * a role hint (the quick-build / card "role" and "best with" lines, which
 * may also name a play style whose definition and example are appended).
 *
 * Pure: no Phaser.
 */

import {
  styleTermId,
  termEntry,
  type TermGlyph,
  type TermId,
} from "../../data/tooltips";
import type { Playstyle } from "../../data/roleHints/playstyleCatalog";

/** What a tooltip can show; every part is optional. */
export interface TooltipContent {
  /** Bold heading. */
  readonly title?: string;
  /** Plain-language definition. */
  readonly body?: string;
  /** Role line ("Flanker — strikes from behind"). */
  readonly role?: string;
  /** "Best with …" line. */
  readonly bestWith?: string;
  readonly howItPlays?: string;
  readonly example?: string;
  readonly glyph?: TermGlyph;
  /** Play style of a role hint: its definition and example are appended. */
  readonly playstyle?: Playstyle;
}

/** A role / best-with hint (P2-1) — the original tooltip content. */
export interface HintContent extends TooltipContent {
  readonly role: string;
  readonly bestWith: string;
}

/** Visual style of one block of tooltip text. */
export type BlockStyle =
  | "title"
  | "body"
  | "role"
  | "best"
  | "label"
  | "howItPlays"
  | "example";

/** One styled paragraph. */
export interface TooltipBlock {
  readonly style: BlockStyle;
  readonly text: string;
}

/** Section captions. */
const LABEL_HOW = "HOW IT PLAYS";
const LABEL_EXAMPLE = "EXAMPLE";

/**
 * @param id - A catalog term.
 * @returns Tooltip content showing the term's definition, how it plays and example.
 */
export function contentFromTerm(id: TermId): TooltipContent {
  const entry = termEntry(id);
  return {
    title: entry.title,
    body: entry.definition,
    example: entry.example,
    ...(entry.howItPlays ? { howItPlays: entry.howItPlays } : {}),
    ...(entry.glyph ? { glyph: entry.glyph } : {}),
  };
}

/**
 * A hint's content with its play style's definition and example filled in
 * (a hint that already carries its own example keeps it).
 *
 * @param content - Tooltip content.
 * @returns The content to show.
 */
export function withStyleDetail(content: TooltipContent): TooltipContent {
  if (!content.playstyle) return content;
  const style = termEntry(styleTermId(content.playstyle));
  return {
    ...content,
    ...(content.example ? {} : { example: style.example }),
    ...(content.howItPlays ? {} : style.howItPlays ? { howItPlays: style.howItPlays } : {}),
  };
}

/**
 * Splits content into styled paragraphs, top to bottom.
 *
 * @param content - Tooltip content.
 * @returns The blocks (empty when the content says nothing).
 */
export function tooltipBlocks(content: TooltipContent): TooltipBlock[] {
  const shown = withStyleDetail(content);
  const blocks: TooltipBlock[] = [];
  const add = (style: BlockStyle, text: string | undefined): void => {
    if (text) blocks.push({ style, text });
  };
  add("title", shown.title);
  add("body", shown.body);
  add("role", shown.role);
  add("best", shown.bestWith);
  if (shown.howItPlays) {
    add("label", LABEL_HOW);
    add("howItPlays", shown.howItPlays);
  }
  if (shown.example) {
    add("label", LABEL_EXAMPLE);
    add("example", shown.example);
  }
  return blocks;
}

/**
 * @param content - Tooltip content.
 * @returns All the text, one paragraph per line (what e2e reads back).
 */
export function tooltipText(content: TooltipContent): string {
  return tooltipBlocks(content)
    .map((block) => block.text)
    .join("\n");
}
