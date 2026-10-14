/**
 * CreatureFeeding — a creature's only way to heal: it feeds on wrecks (ships
 * destroyed near it, its own adds included). It remembers a handful of
 * wrecks, hunts the nearest while hurt, and needs a few uninterrupted
 * seconds beside it; any hit on the creature breaks the meal, so the pilots
 * can stop it. Pure.
 */

import { torusRangePx, type MapPoint } from "../weapons/FiringGeometry";

/** Time a creature needs to finish a wreck (ms). */
export const FEED_DURATION_MS = 1500;
/** Distance from the creature's edge it feeds from (px). */
export const FEED_REACH_PX = 40;
/** Wrecks a creature remembers. */
const MAX_WRECKS = 6;

/** A wreck it may feed on. */
export interface Wreck extends MapPoint {
  x: number;
  y: number;
  active: boolean;
}

/** What a feeding step did. */
export type FeedStep = "none" | "started" | "feeding" | "fed";

/** Wreck memory and the meal in progress. */
export class WreckFeeder {
  private readonly wrecks: Wreck[] = [];
  private cursor = 0;
  private progressMs = 0;
  /** True while a meal is in progress. */
  feeding = false;

  /** @param worldSize - Map edge (px). */
  constructor(private readonly worldSize: number) {
    for (let i = 0; i < MAX_WRECKS; i++)
      this.wrecks.push({ x: 0, y: 0, active: false });
  }

  /**
   * @param x - Wreck x.
   * @param y - Wreck y.
   */
  note(x: number, y: number): void {
    let slot: Wreck | undefined;
    for (const wreck of this.wrecks) {
      if (wreck.active) continue;
      slot = wreck;
      break;
    }
    slot ??= this.wrecks[this.cursor++ % MAX_WRECKS]!;
    slot.x = x;
    slot.y = y;
    slot.active = true;
  }

  /**
   * @param from - Where the creature is.
   * @returns The nearest wreck still worth eating, or null.
   */
  nearest(from: MapPoint): Wreck | null {
    let best: Wreck | null = null;
    let bestRange = Infinity;
    for (const wreck of this.wrecks) {
      if (!wreck.active) continue;
      const range = torusRangePx(from, wreck, this.worldSize);
      if (range >= bestRange) continue;
      best = wreck;
      bestRange = range;
    }
    return best;
  }

  /** A hit (or a new power) breaks the meal. */
  interrupt(): void {
    this.feeding = false;
    this.progressMs = 0;
  }

  /**
   * @param from - Where the creature is.
   * @param radiusPx - Its body radius.
   * @param wreck - The wreck it hunts (null when none / not hurt).
   * @param canEat - False while a power is in progress.
   * @param deltaMs - Frame length.
   * @returns What the meal did this frame.
   */
  step(
    from: MapPoint,
    radiusPx: number,
    wreck: Wreck | null,
    canEat: boolean,
    deltaMs: number,
  ): FeedStep {
    const close =
      wreck !== null &&
      canEat &&
      torusRangePx(from, wreck, this.worldSize) <= radiusPx + FEED_REACH_PX;
    if (!close || !wreck) {
      this.interrupt();
      return "none";
    }
    const started = !this.feeding;
    this.feeding = true;
    this.progressMs += deltaMs;
    if (this.progressMs < FEED_DURATION_MS)
      return started ? "started" : "feeding";
    wreck.active = false;
    this.interrupt();
    return "fed";
  }
}
