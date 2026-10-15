/**
 * Survival roguelite — combat node planning (pure). Turns the node being
 * fought (type, sector, row) plus the run's ascension into everything the
 * battle scene needs: wave count, threat scaling, elite count and affixes,
 * the effective wave for AI tiers and belt tightening, the enemy faction
 * and boss phases. Same run + node → same plan.
 */

import type { FactionId } from "../../config";
import { BOSS_PHASE_THRESHOLDS } from "../../arcade/creatures/phaseThresholds";
import {
  CREATURE_EXTRA_PHASES,
  survivalBossFor,
} from "../../data/creatures/creatureCatalog";
import { ascensionRules } from "../../data/survival/ascension";
import { pickEnemyFaction } from "../../data/survival/enemyFactions";
import { SECTOR_COUNT } from "../../data/survival/sectors";
import { deriveSeed, rngFor } from "./RunRng";
import { findNode } from "./SectorMapGenerator";
import type { RunState } from "./RunTypes";

export type CombatKind = "combat" | "elite" | "boss";

/**
 * Waves fought per sector-1 battle node, by kind (later sectors add
 * {@link EXTRA_WAVES_PER_SECTOR}). Regular waves come first; an elite node's
 * elite and a boss node's boss arrive on its last wave (NodeWaveRoster), so
 * elite and boss nodes fight more waves than a combat node (60–120 s against
 * 45–90 s). A node used to be a single wave (~16 s median); several waves at
 * a lower enemy lethality (ascension.BASE_ENEMY_DAMAGE_MULTIPLIER) make it
 * 50 / 75 / 72 s median (ADR-0004, node-length pass 2026-10-12).
 */
export const WAVES_PER_NODE: Readonly<Record<CombatKind, number>> = {
  combat: 3,
  elite: 4,
  boss: 5,
};
/**
 * Waves a node adds per sector beyond the first: the fleet grows stronger
 * and clears a wave faster, so later nodes field more of them.
 */
export const EXTRA_WAVES_PER_SECTOR = 1;

/**
 * Base scale on the inherited threat curve for roguelite battles. The old
 * endless mode's waves spawned inside the belt and lost much of their hull
 * before engaging; with waves now entering inside the safe zone, the full
 * curve fielded 6–8 ships against a 2-ship fleet by mid sector 1.
 */
export const ROGUELITE_THREAT_SCALE = 0.45;
/** Threat added per sector beyond the first (+25% each). */
export const SECTOR_THREAT_STEP = 0.25;
/** Threat added per map row (+4% each). */
export const ROW_THREAT_STEP = 0.04;
/**
 * Most regular ships one wave fields, in every sector. It used to grow
 * with the sector (1 + sector: up to four expert regulars in sector 3,
 * where an average wing cleared ~30 % of combat nodes); sectors now get
 * harder through pilot tiers, threat and the belt instead.
 */
export const MAX_REGULARS_PER_WAVE = 2;
/** Regulars a node's extra elite replaces (an elite ≈ 2–3 regulars of power). */
export const REGULARS_PER_EXTRA_ELITE = 2;
/**
 * Effective waves (AI tier) a sector spans: with two map rows per step,
 * sector 1 flies novices (its last rows average), sector 2 average pilots
 * and sector 3 average pilots turning expert from its fifth row (see
 * SurvivalSteering's wave bands 1–3 / 4–10 / 11+).
 */
export const EFFECTIVE_WAVES_PER_SECTOR = 4;
/** The curve above as one table the balance sweeps tune. */
export const PLAN_TUNING = {
  threatScale: ROGUELITE_THREAT_SCALE,
  sectorThreatStep: SECTOR_THREAT_STEP,
  rowThreatStep: ROW_THREAT_STEP,
  wavesPerSector: EFFECTIVE_WAVES_PER_SECTOR,
};
/** Map rows per effective-wave step within a sector. */
export const ROWS_PER_TIER_STEP = 2;
/** Belt squeezes added per sector beyond the first. */
export const BELT_STEPS_PER_SECTOR = 4;
/** Map rows per extra belt squeeze within a sector. */
export const ROWS_PER_BELT_STEP = 2;
/**
 * Most belt squeezes a battle node starts with (12 steps: safe radius
 * 1160 px, wall 1800 px) — the arena never collapses onto the fleet.
 */
export const MAX_BELT_STEPS = 12;
/** Elites an elite node fields (Elite Contracts, ascension 1, adds one more). */
export const ELITE_NODE_EXTRA_ELITES = 1;
/** Phases of a regular sector boss; the final boss has one more. */
export const BASE_BOSS_PHASES = 1;
/** Waves per boss-multiplier step (matches SurvivalDurability). */
const BOSS_WAVE_PER_SECTOR = 5;

/** Everything a battle node needs. */
export interface CombatPlan {
  readonly nodeId: string;
  readonly kind: CombatKind;
  readonly sector: number;
  readonly row: number;
  readonly waves: number;
  readonly enemyFaction: FactionId;
  readonly threatMultiplier: number;
  /** Most regular ships one wave may field. */
  readonly maxRegulars: number;
  readonly extraElites: number;
  readonly eliteAffixCount: number;
  /** Wave number used for AI tiers (survivalEnemyTier). */
  readonly effectiveWave: number;
  readonly enemyHullMultiplier: number;
  /** Multiplier on the damage enemies deal to the player's fleet. */
  readonly enemyDamageMultiplier: number;
  /** Belt tightening steps at the node's first wave. */
  readonly beltSteps: number;
  readonly bossPhases: number;
  /** Of those, the phases Second Wind (ascension 8) added: shields only. */
  readonly secondWindPhases: number;
  /**
   * The creature that is the boss of a boss node (its enrage adds
   * {@link CREATURE_EXTRA_PHASES} to the plan's phases), or null.
   */
  readonly creatureBoss: {
    readonly id: string;
    readonly phases: number;
  } | null;
  /** A creature an event battle adds to its last wave, or null. */
  readonly eventCreature: string | null;
  /** Wave number fed to bossMultiplier/bossDurability. */
  readonly bossWave: number;
  readonly isFinalBoss: boolean;
  /** Seed for the battle's own rolls (spawns, dice, affixes). */
  readonly combatSeed: number;
}

/** What grows with the sector, the row and the ascension level. */
interface PlanScaling {
  readonly effectiveWave: number;
  readonly threatMultiplier: number;
  readonly beltSteps: number;
}

/**
 * @param run - The run.
 * @param row - The active node's map row.
 * @param rules - The run's ascension rules.
 * @returns The wave tier, threat and belt squeeze the node's battle starts at.
 */
function planScaling(
  run: RunState,
  row: number,
  rules: ReturnType<typeof ascensionRules>,
): PlanScaling {
  const sectorStep = run.sector - 1;
  return {
    effectiveWave:
      sectorStep * PLAN_TUNING.wavesPerSector +
      Math.floor((row + rules.tierRowShift) / ROWS_PER_TIER_STEP) +
      1,
    threatMultiplier:
      PLAN_TUNING.threatScale *
      (1 +
        sectorStep * PLAN_TUNING.sectorThreatStep +
        row * PLAN_TUNING.rowThreatStep) *
      rules.threatMultiplier,
    beltSteps: Math.min(
      MAX_BELT_STEPS,
      sectorStep * BELT_STEPS_PER_SECTOR +
        Math.floor(row / ROWS_PER_BELT_STEP) +
        rules.extraBeltSqueezes,
    ),
  };
}

/**
 * @param run - The run (its active node is the battle).
 * @returns The battle plan, or null when no battle is active.
 */
export function planCombat(run: RunState): CombatPlan | null {
  const nodeId = run.activeNodeId;
  const kind = combatKindOf(run);
  if (!nodeId || !kind) return null;
  const node = findNode(run.map, nodeId);
  const row = node?.row ?? 0;
  const rules = ascensionRules(run.ascension);
  const isFinalBoss = kind === "boss" && run.sector >= SECTOR_COUNT;
  const bossPhases =
    kind === "boss"
      ? BASE_BOSS_PHASES + (isFinalBoss ? 1 : 0) + rules.extraBossPhases
      : 0;
  const scaling = planScaling(run, row, rules);
  return {
    nodeId,
    kind,
    sector: run.sector,
    row,
    waves: WAVES_PER_NODE[kind] + (run.sector - 1) * EXTRA_WAVES_PER_SECTOR,
    enemyFaction: pickEnemyFaction(
      rngFor(run.seed, "faction", nodeId),
      run.faction,
    ),
    threatMultiplier: scaling.threatMultiplier,
    maxRegulars: MAX_REGULARS_PER_WAVE,
    extraElites:
      kind === "elite" ? ELITE_NODE_EXTRA_ELITES + rules.extraElites : 0,
    eliteAffixCount: rules.eliteAffixCount,
    effectiveWave: scaling.effectiveWave,
    enemyHullMultiplier: rules.enemyHullMultiplier,
    enemyDamageMultiplier: rules.enemyDamageMultiplier,
    beltSteps: scaling.beltSteps,
    bossPhases,
    secondWindPhases: kind === "boss" ? rules.extraBossPhases : 0,
    eventCreature: run.eventCombat?.creature ?? null,
    creatureBoss:
      kind === "boss"
        ? {
            id: survivalBossFor(run.sector).id,
            // Second Wind refills shields, it is no enrage level: an earlier,
            // third enrage phase plus two reinforcements made A8 bosses clear 9 %.
            phases: bossPhases - rules.extraBossPhases + CREATURE_EXTRA_PHASES,
          }
        : null,
    bossWave: run.sector * BOSS_WAVE_PER_SECTOR,
    isFinalBoss,
    combatSeed: deriveSeed(run.seed, "combat", nodeId),
  };
}

/**
 * @param run - The run.
 * @returns The kind of battle the active node is, or null when it is not one.
 */
export function combatKindOf(run: RunState): CombatKind | null {
  if (run.eventCombat) return run.eventCombat.elite ? "elite" : "combat";
  const kind = run.activeKind;
  return kind === "combat" || kind === "elite" || kind === "boss" ? kind : null;
}

export { BOSS_PHASE_THRESHOLDS };

/**
 * Only the plan's own boss phases call reinforcements; a creature boss's
 * extra enrage phase just makes it angrier and Second Wind only refills
 * its shields ({@link phaseRestoresShields}).
 *
 * @param planPhases - Phases of the plan, Second Wind's excluded.
 * @param phasesStarted - Phases already started when the next one begins.
 * @returns True when entering the next phase calls the wing in.
 */
export function phaseCallsReinforcements(
  planPhases: number,
  phasesStarted: number,
): boolean {
  return phasesStarted < planPhases;
}

/**
 * @param planPhases - Phases of the plan (ascension and the final boss add some).
 * @param phasesStarted - Phases already started when the next one begins.
 * @returns True when entering the next phase restores the boss's shields.
 */
export function phaseRestoresShields(
  planPhases: number,
  phasesStarted: number,
): boolean {
  return phasesStarted < planPhases;
}

/**
 * @param totalPhases - The boss's phase count.
 * @param phasesStarted - Phases already started (1 = the opening phase).
 * @param hullFraction - Its hull left as a fraction of max.
 * @returns True when the boss enters its next phase now.
 */
export function shouldStartNextBossPhase(
  totalPhases: number,
  phasesStarted: number,
  hullFraction: number,
): boolean {
  const thresholds = BOSS_PHASE_THRESHOLDS[totalPhases] ?? [];
  const next = thresholds[phasesStarted - 1];
  return next !== undefined && hullFraction <= next;
}
