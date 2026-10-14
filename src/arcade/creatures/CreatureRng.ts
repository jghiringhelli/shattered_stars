/**
 * CreatureRng — the seeded, saveable random stream of a creature encounter
 * (Mulberry32). Its whole state is one 32-bit number, so a lockstep snapshot
 * can capture and restore it exactly; nothing else in a creature's fight
 * rolls dice (no Math.random, no wall clock).
 */

/** Deterministic random stream. */
export class CreatureRng {
  private state: number;

  /** @param seed - Any integer. */
  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** @returns The next float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** @returns The stream's state (for snapshots). */
  getState(): number {
    return this.state;
  }

  /** @param state - A state from {@link getState}. */
  setState(state: number): void {
    this.state = state | 0;
  }
}
