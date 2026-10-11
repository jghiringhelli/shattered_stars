/**
 * SquadMark — focus fire as a squad order. A side's leader (the player, or a
 * squad's AI leader) marks one enemy; every ship of that side shooting the
 * marked target hits it more often and harder (DiceAttack applies the bonus
 * through ShotLevers). A side has at most one mark; it expires when the
 * target is destroyed or after {@link SQUAD_MARK_DURATION_MS} unless the
 * leader marks it again. Pilots flying on their own have no mark.
 *
 * Pure and immutable: every operation returns a new mark table.
 */

/** Hit-chance bonus when shooting the target your side marked. */
export const SQUAD_MARK_HIT_BONUS = 0.35;

/**
 * Extra damage per hit on the target your side marked. Focus fire must kill
 * quickly: without the mark a coordinated squad of average pilots wins ~2%
 * against the same points of solo aces at x12 durability; with +0.35 / +5
 * it wins ~84% (skill gate 2: >= 70%).
 */
export const SQUAD_MARK_DAMAGE_BONUS = 5;

/** A mark lapses this long after it was placed unless re-marked (ms). */
export const SQUAD_MARK_DURATION_MS = 8000;

/** One side's mark. */
export interface SquadMark {
  readonly targetId: string;
  /** Scene time after which the mark no longer applies (ms). */
  readonly expiresAtMs: number;
}

/** Marks by side (any side key the scene uses: faction, owner...). */
export type SquadMarks = ReadonlyMap<string, SquadMark>;

/** No side has marked anything. */
export const NO_SQUAD_MARKS: SquadMarks = new Map();

/**
 * Mark a target for a side (replaces that side's previous mark; marking the
 * same target again refreshes it).
 *
 * @param marks - Current marks.
 * @param side - The marking side.
 * @param targetId - The enemy to mark.
 * @param nowMs - Scene time (ms).
 * @param durationMs - How long the mark lasts (ms).
 * @returns The new marks.
 */
export function placeMark(
  marks: SquadMarks,
  side: string,
  targetId: string,
  nowMs: number,
  durationMs: number = SQUAD_MARK_DURATION_MS,
): SquadMarks {
  const next = new Map(marks);
  next.set(side, { targetId, expiresAtMs: nowMs + durationMs });
  return next;
}

/**
 * Drop a side's mark (its leader called it off, or the side has no leader).
 *
 * @param marks - Current marks.
 * @param side - The side.
 * @returns The new marks.
 */
export function clearMark(marks: SquadMarks, side: string): SquadMarks {
  if (!marks.has(side)) return marks;
  const next = new Map(marks);
  next.delete(side);
  return next;
}

/**
 * Drop every mark on a ship (it was destroyed or left the battle).
 *
 * @param marks - Current marks.
 * @param targetId - The ship.
 * @returns The new marks.
 */
export function forgetMarkedTarget(
  marks: SquadMarks,
  targetId: string,
): SquadMarks {
  let next: Map<string, SquadMark> | null = null;
  for (const [side, mark] of marks) {
    if (mark.targetId !== targetId) continue;
    next ??= new Map(marks);
    next.delete(side);
  }
  return next ?? marks;
}

/**
 * @param marks - Current marks.
 * @param side - The side asking.
 * @param nowMs - Scene time (ms).
 * @returns The side's live marked target, or null (none, or expired).
 */
export function markedTargetOf(
  marks: SquadMarks,
  side: string,
  nowMs: number,
): string | null {
  const mark = marks.get(side);
  return mark && nowMs < mark.expiresAtMs ? mark.targetId : null;
}

/**
 * @param marks - Current marks.
 * @param attackerSide - The shooter's side.
 * @param targetId - The ship being shot.
 * @param nowMs - Scene time (ms).
 * @returns Whether the shooter's side has this target marked right now.
 */
export function isMarkedBy(
  marks: SquadMarks,
  attackerSide: string,
  targetId: string,
  nowMs: number,
): boolean {
  return markedTargetOf(marks, attackerSide, nowMs) === targetId;
}
