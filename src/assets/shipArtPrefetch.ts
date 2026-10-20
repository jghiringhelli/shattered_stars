/**
 * shipArtPrefetch — warms the sprites of ships that will join a battle soon
 * (the next survival wave, the reinforcement queue and pick list, escort
 * waves) while the fight is on, so they arrive with their art instead of a
 * faction placeholder. Loads trickle in a few at a time through
 * `requestTexture`; nothing here touches BOOT_ASSETS.
 */

import type Phaser from "phaser";
import { shipSpriteAssetById, type AssetEntry } from "./assetManifest";
import { requestTexture } from "./textureLoading";

/** Sprites downloading at once, so a prefetch never starves the fight's own loads. */
export const PREFETCH_CONCURRENCY = 3;
/** Most sprites one {@link ShipArtPrefetcher.enqueue} call may add. */
export const PREFETCH_MAX_PER_CALL = 24;

/** Starts loading an entry and calls back when it settles (loaded or failed). */
export type SpriteRequester = (entry: AssetEntry, onSettled: () => void) => void;

/**
 * Which sprites still have to be fetched.
 *
 * @param shipIds - Ship definition ids that will appear soon (repeats allowed).
 * @param isCached - Whether a texture key is already loaded.
 * @param skip - Keys already requested (skipped).
 * @param limit - Most entries to return. Default {@link PREFETCH_MAX_PER_CALL}.
 * @returns Sprite entries to load, in first-seen order; unknown ids dropped.
 */
export function planShipArtPrefetch(
  shipIds: Iterable<string>,
  isCached: (key: string) => boolean,
  skip: ReadonlySet<string> = new Set(),
  limit: number = PREFETCH_MAX_PER_CALL,
): AssetEntry[] {
  const planned = new Map<string, AssetEntry>();
  for (const shipId of shipIds) {
    if (planned.size >= limit) break;
    const entry = shipSpriteAssetById(shipId);
    if (!entry || planned.has(entry.key)) continue;
    if (skip.has(entry.key) || isCached(entry.key)) continue;
    planned.set(entry.key, entry);
  }
  return [...planned.values()];
}

export class ShipArtPrefetcher {
  private readonly requested = new Set<string>();
  private readonly waiting: AssetEntry[] = [];
  private inFlight = 0;

  /**
   * @param isCached - Whether a texture key is loaded.
   * @param request - Starts a load; must call back on success and failure.
   * @param concurrency - Loads at once. Default {@link PREFETCH_CONCURRENCY}.
   */
  constructor(
    private readonly isCached: (key: string) => boolean,
    private readonly request: SpriteRequester,
    private readonly concurrency: number = PREFETCH_CONCURRENCY,
  ) {}

  /**
   * Queue the art of ships about to appear (cheap to call every frame).
   *
   * @param shipIds - Ship definition ids.
   * @returns How many sprites were newly queued.
   */
  enqueue(shipIds: Iterable<string>): number {
    const entries = planShipArtPrefetch(shipIds, this.isCached, this.requested);
    for (const entry of entries) {
      this.requested.add(entry.key);
      this.waiting.push(entry);
    }
    this.pump();
    return entries.length;
  }

  /** @returns Sprites queued or downloading (a settled load is no longer pending). */
  get pending(): number {
    return this.waiting.length + this.inFlight;
  }

  private pump(): void {
    while (this.inFlight < this.concurrency) {
      const entry = this.waiting.shift();
      if (!entry) return;
      this.inFlight += 1;
      this.request(entry, () => {
        this.inFlight -= 1;
        this.pump();
      });
    }
  }
}

/**
 * A prefetcher bound to a scene's loader. Loads in flight are dropped by
 * `requestTexture` when the scene shuts down.
 *
 * @param scene - Battle scene.
 * @returns The prefetcher.
 */
export function createShipArtPrefetcher(scene: Phaser.Scene): ShipArtPrefetcher {
  return new ShipArtPrefetcher(
    (key) => scene.textures.exists(key),
    (entry, onSettled) => requestTexture(scene, entry, onSettled, onSettled),
  );
}
