/**
 * chronicleTypes — the global Chronicle (save schema v4): the one record all
 * campaigns share. Per-faction progress stays in each faction's save; the
 * Chronicle holds what crosses campaigns — shared story flags, who witnessed
 * each crossover first (canon), act completion per campaign, the "Free
 * Order" setting and the ending chosen in Act V. localStorage
 * `shattered_stars_chronicle`.
 */

import type { FactionId } from "../../config";
import type { EndingId } from "../../data/campaign/crossovers";

/** Current Chronicle schema version (shipped with campaign save v4). */
export const CHRONICLE_VERSION = 4;

/** A campaign id in the Chronicle: a faction, or the shared Coalition. */
export type ChronicleCampaignId = FactionId | "coalition";

/** One crossover battle as the Chronicle remembers it. */
export interface CrossoverRecord {
  /** The faction that finished it first and wrote canon. */
  readonly canonFaction: FactionId;
  /** The mission through which canon was written. */
  readonly canonMissionId: string;
  /** Every faction that has finished the battle (canon first). */
  readonly witnesses: readonly FactionId[];
}

/** The global Chronicle. */
export interface ChronicleData {
  readonly version: number;
  /** Shared story flags (only flags in CHRONICLE_FLAGS, true when set). */
  readonly flags: Readonly<Record<string, boolean>>;
  /** Crossover id ("X1".."X15") → how it resolved. */
  readonly crossovers: Readonly<Record<string, CrossoverRecord>>;
  /** Campaign → acts (1-5) completed. */
  readonly actsComplete: Readonly<Record<string, readonly number[]>>;
  /** Lifts the cross-faction act conditions (see actUnlocks). */
  readonly freeOrder: boolean;
  /** Ending chosen in Act V (null until then). */
  readonly ending: EndingId | null;
}

/** A mission win folded into the Chronicle. */
export interface ChronicleVictory {
  readonly missionId: string;
  /** Player faction (the Coalition lead for Coalition missions). */
  readonly faction: FactionId;
  /** Campaign the mission belongs to. */
  readonly campaignId: ChronicleCampaignId;
  /** Story flags the mission persisted (already canon-filtered). */
  readonly storyFlags: Readonly<Record<string, boolean>>;
  /** Acts of the campaign now completed. */
  readonly actsComplete: readonly number[];
}
