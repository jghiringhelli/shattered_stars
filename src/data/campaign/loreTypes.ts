/**
 * loreTypes — the lore overlay: per-mission edits that apply the lore bible
 * (docs/lore/campaigns/*.md) on top of the merged story + design data without
 * touching those files. RETEXT = title / tagline / briefing / mood / day /
 * location / textSwaps / objectiveText; REWORK = replace or add objectives,
 * enemies and beats. Plain data; applied by {@link applyLore}.
 */

import type { DialogueMood, ScriptBeat } from "../../campaign/scripting/scriptTypes";
import type {
  DebriefLine,
  MissionEnemy,
  MissionObjective,
  MissionStyle,
  MissionVariant,
} from "./campaignTypes";
import type { EpilogueLine } from "./epilogues";

/** `[from, to]` exact-substring replacement. */
export type TextSwap = readonly [from: string, to: string];

/** Edits to one mission (every field optional). */
export interface MissionLore {
  readonly title?: string;
  readonly tagline?: string;
  readonly briefing?: string;
  readonly mood?: DialogueMood;
  readonly style?: MissionStyle;
  /** Story day of the crisis (0 = the Broadcast). */
  readonly day?: number;
  /** Place name shown on the briefing. */
  readonly location?: string;
  /** Crossover id ("X1".."X15") this mission witnesses. */
  readonly crossover?: string;
  /**
   * Replaces `from` by `to` in EVERY string of the merged mission (briefing,
   * tagline, objective text, script dialogue and banners, debrief, variants).
   * Each swap must match at least once (enforced by the lore test).
   */
  readonly textSwaps?: readonly TextSwap[];
  /** Objective id → new description. */
  readonly objectiveText?: Readonly<Record<string, string>>;
  /** Replaces all objectives. */
  readonly replaceObjectives?: readonly MissionObjective[];
  /** Objectives appended (new bonus objectives, flag carriers). */
  readonly addObjectives?: readonly MissionObjective[];
  /** Replaces the mission's enemies. */
  readonly replaceEnemies?: readonly MissionEnemy[];
  readonly addEnemies?: readonly MissionEnemy[];
  /** Replaces the whole script. */
  readonly replaceScript?: readonly ScriptBeat[];
  /** Beats appended after the existing script. */
  readonly script?: readonly ScriptBeat[];
  /** Replaces the debrief. */
  readonly replaceDebrief?: readonly DebriefLine[];
  /** Debrief lines appended. */
  readonly debriefAppend?: readonly DebriefLine[];
  /** Variants appended. */
  readonly variants?: readonly MissionVariant[];
  /** Merged into the mission's `victoryFlags`. */
  readonly victoryFlags?: Readonly<Record<string, boolean>>;
}

/** Epilogue edits for one faction. */
export interface EpiloguePatch {
  /** Text swaps over the existing epilogue lines. */
  readonly swaps?: readonly TextSwap[];
  /** Lines appended (they may carry `when` flag conditions). */
  readonly add?: readonly EpilogueLine[];
}

/** Everything the bible changes for one faction. */
export interface FactionLore {
  readonly missions: Readonly<Record<string, MissionLore>>;
  readonly epilogue?: EpiloguePatch;
  /** Campaign title / blurb overrides (hub cards). */
  readonly name?: string;
  readonly description?: string;
  readonly protagonist?: string;
}
