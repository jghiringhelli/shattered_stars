/**
 * Idempotent image registration: every scene has its own loader, so two
 * scenes can fetch the same image at once (a squad builder card still
 * loading when the battle's preload queues that ship). The loader that
 * finishes second would re-add the key and Phaser logs "Texture key already
 * in use". Installed once at boot on Phaser's ImageFile, the second
 * completion is dropped instead: the texture is already there, and its
 * `addtexture-<key>` event already fired for every listener.
 *
 * Phaser-free (takes the file type), so it is unit-testable.
 */

/** What the guard reads from a loader file: its key and its target cache. */
export interface CachingFile {
  readonly key: string;
  readonly cache: { exists(key: string): boolean };
}

/** A loader file type whose prototype adds a finished file to its cache. */
export interface CachingFileType {
  prototype: { addToCache(this: never): void };
}

const GUARDED = Symbol("idempotentImageCache");

/**
 * Wrap a file type's `addToCache` so a key that is already cached is skipped.
 *
 * @param fileType - The loader file type (Phaser.Loader.FileTypes.ImageFile).
 */
export function installIdempotentImageCache(fileType: CachingFileType): void {
  const proto = fileType.prototype as {
    addToCache(this: CachingFile): void;
    [GUARDED]?: true;
  };
  if (proto[GUARDED]) return;
  const addToCache = proto.addToCache;
  proto.addToCache = function guardedAddToCache(this: CachingFile): void {
    if (this.cache.exists(this.key)) return;
    addToCache.call(this);
  };
  proto[GUARDED] = true;
}
