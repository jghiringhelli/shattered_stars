/**
 * optionPanelTypes — the view-model of the Armory and Research panels: both
 * are four groups of two options, shown as one of three data sets (overview,
 * effects, cost) with a tooltip on every row. Pure: no Phaser.
 */

import type { TermId } from "../../data/tooltips";
import type { TooltipContent } from "../menu/tooltipContent";

/** Colour role of a text (resolved to a palette colour by the view). */
export type Tone = "normal" | "good" | "warn" | "muted" | "accent";

/** What a hover explains: a catalog term or ready-made content. */
export type TipSubject = TermId | TooltipContent;

/** One option on the overview tab. */
export interface OptionCard {
  readonly key: string;
  readonly name: string;
  /** State text ("" when there is none to show). */
  readonly mark: string;
  readonly markTone: Tone;
  /** Dimmed: cannot be chosen now. */
  readonly dim: boolean;
  /** Id handed to the action callback, or null when pressing does nothing. */
  readonly actionKey: string | null;
  readonly tip: TipSubject;
}

/** One slot / tier with its two options. */
export interface OptionGroup {
  readonly caption: string;
  readonly captionTip: TipSubject;
  readonly cards: readonly OptionCard[];
}

/** One line of the effects or cost tab. */
export interface OptionRow {
  readonly key: string;
  readonly text: string;
  readonly tone: Tone;
  readonly tip: TipSubject;
  readonly actionKey: string | null;
}

/** Everything a tab of the panel can show. */
export interface OptionPanelModel {
  readonly title: string;
  readonly groups: readonly OptionGroup[];
  readonly effects: readonly OptionRow[];
  readonly costs: readonly OptionRow[];
  readonly summary: readonly OptionRow[];
}
