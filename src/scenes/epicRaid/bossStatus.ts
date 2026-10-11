/**
 * bossStatus — pure presentation rules for the Boss Raid status panel:
 * phase labels and colours, hull gauge colour, per-section gauge segments
 * and the raid clock colour. No Phaser.
 */

import {
  BOSS_PHASE_2_HULL_RATIO,
  BOSS_PHASE_3_HULL_RATIO,
  type BossPhase,
} from "../../systems/EpicBossRules";
import { HOLO_PALETTE } from "../../ui/theme/HoloTheme";

/** One boss section as the status panel sees it. */
export interface BossSectionStatus {
  readonly hull: number;
  readonly maxHull: number;
  readonly disabled: boolean;
}

/** The boss as the status panel sees it. */
export interface BossStatusView {
  readonly name: string;
  readonly phase: BossPhase;
  readonly shields: number;
  readonly maxShields: number;
  readonly hull: number;
  readonly maxHull: number;
  readonly sections: readonly BossSectionStatus[];
}

/** A section's slice of the hull gauge, in gauge px. */
export interface GaugeSegment {
  readonly x: number;
  readonly width: number;
  /** Remaining hull fraction of the section, 0..1. */
  readonly fill: number;
  readonly disabled: boolean;
}

const PHASE_LABELS: Readonly<Record<BossPhase, string>> = {
  1: "PHASE 1",
  2: "PHASE 2 — SHIELDS FAILING",
  3: "PHASE 3 — CRITICAL",
};

const PHASE_COLORS: Readonly<Record<BossPhase, number>> = {
  1: HOLO_PALETTE.success,
  2: HOLO_PALETTE.warning,
  3: HOLO_PALETTE.danger,
};

/**
 * @param phase - Boss phase.
 * @returns The phase banner text.
 */
export function bossPhaseLabel(phase: BossPhase): string {
  return PHASE_LABELS[phase];
}

/**
 * @param phase - Boss phase.
 * @returns The phase banner colour.
 */
export function bossPhaseColor(phase: BossPhase): number {
  return PHASE_COLORS[phase];
}

/**
 * Hull gauge colour, changing at the same ratios as the boss's phases.
 *
 * @param hullRatio - Remaining hull fraction, 0..1.
 * @returns Gauge colour.
 */
export function bossHullColor(hullRatio: number): number {
  if (hullRatio <= BOSS_PHASE_3_HULL_RATIO) return HOLO_PALETTE.danger;
  if (hullRatio <= BOSS_PHASE_2_HULL_RATIO) return HOLO_PALETTE.warning;
  return HOLO_PALETTE.success;
}

/**
 * Split a hull gauge into one slice per section, sized by section max hull.
 *
 * @param sections - The boss's sections, in order.
 * @param gaugeWidth - Gauge width in px.
 * @returns One segment per section, left to right.
 */
export function sectionSegments(
  sections: readonly BossSectionStatus[],
  gaugeWidth: number,
): GaugeSegment[] {
  const total = sections.reduce((sum, s) => sum + s.maxHull, 0);
  if (total <= 0) return [];
  let x = 0;
  return sections.map((section) => {
    const width = (section.maxHull / total) * gaugeWidth;
    const fill =
      section.maxHull > 0
        ? Math.min(1, Math.max(0, section.hull / section.maxHull))
        : 0;
    const segment = { x, width, fill, disabled: section.disabled };
    x += width;
    return segment;
  });
}
