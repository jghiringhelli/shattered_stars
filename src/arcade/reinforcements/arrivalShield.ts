/**
 * arrivalShield — a ship that just warped in cannot be hit until its
 * arrival protection runs out (one maneuver cycle by default): the same
 * immunity idea as CombatTempo's per-attacker ledger, against everyone.
 *
 * Pure.
 */

export class ArrivalShield {
  private readonly protectedUntil = new Map<string, number>();

  /**
   * @param shipId - The new ship.
   * @param nowMs - Battle time of its arrival.
   * @param durationMs - How long it is protected.
   */
  protect(shipId: string, nowMs: number, durationMs: number): void {
    this.protectedUntil.set(shipId, nowMs + durationMs);
  }

  /**
   * @param shipId - A ship.
   * @param nowMs - Battle time.
   * @returns Whether hits on it are ignored right now.
   */
  isProtected(shipId: string, nowMs: number): boolean {
    return (
      nowMs < (this.protectedUntil.get(shipId) ?? Number.NEGATIVE_INFINITY)
    );
  }

  /** @param shipId - A ship destroyed or gone. */
  forget(shipId: string): void {
    this.protectedUntil.delete(shipId);
  }

  /** Drop every protection. */
  clear(): void {
    this.protectedUntil.clear();
  }
}
