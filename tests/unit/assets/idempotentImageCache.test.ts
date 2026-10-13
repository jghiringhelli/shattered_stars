/**
 * Spec: two scenes' loaders may fetch the same image at once (a squad
 * builder card still loading when the battle's preload queues the ship).
 * Whichever finishes second must not re-add the key (Phaser logs "Texture
 * key already in use"); a first load still registers it.
 */

import { describe, it, expect } from "vitest";
import {
  installIdempotentImageCache,
  type CachingFile,
} from "../../../src/assets/idempotentImageCache";

interface FakeFile extends CachingFile {
  added: string[];
}

function fakeFileType(): { prototype: { addToCache(this: FakeFile): void } } {
  return {
    prototype: {
      addToCache(this: FakeFile): void {
        this.added.push(this.key);
      },
    },
  };
}

function fileOf(key: string, cached: ReadonlySet<string>): FakeFile {
  return { key, cache: { exists: (k) => cached.has(k) }, added: [] };
}

describe("installIdempotentImageCache", () => {
  it("adds an image whose key is not cached yet", () => {
    const type = fakeFileType();
    installIdempotentImageCache(type);
    const file = fileOf("ship_confed_falcon", new Set());
    type.prototype.addToCache.call(file);
    expect(file.added).toEqual(["ship_confed_falcon"]);
  });

  it("skips an image another loader already cached", () => {
    const type = fakeFileType();
    installIdempotentImageCache(type);
    const file = fileOf("ship_confed_falcon", new Set(["ship_confed_falcon"]));
    type.prototype.addToCache.call(file);
    expect(file.added).toEqual([]);
  });

  it("installs once however often it is called", () => {
    const type = fakeFileType();
    installIdempotentImageCache(type);
    const wrapped = type.prototype.addToCache;
    installIdempotentImageCache(type);
    expect(type.prototype.addToCache).toBe(wrapped);
  });
});
