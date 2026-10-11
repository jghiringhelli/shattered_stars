/**
 * Survival roguelite — key/value storage port and its adapters. The run
 * save and the meta profile go through this port so the logic is testable
 * and the browser's localStorage is just one adapter.
 */

/** Minimal synchronous key/value store (localStorage-compatible). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Process-local store, used when localStorage is unavailable (private mode, SSR). */
export class MemoryStore implements KeyValueStore {
  private readonly values = new Map<string, string>();

  /** @inheritdoc */
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  /** @inheritdoc */
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  /** @inheritdoc */
  removeItem(key: string): void {
    this.values.delete(key);
  }
}

/**
 * @returns The browser's localStorage when usable, else a MemoryStore.
 */
export function defaultStore(): KeyValueStore {
  try {
    if (typeof localStorage !== "undefined") {
      const probe = "__ss_probe__";
      localStorage.setItem(probe, probe);
      localStorage.removeItem(probe);
      return localStorage;
    }
  } catch {
    // Storage blocked (privacy mode / quota): fall through to memory.
  }
  return new MemoryStore();
}

/**
 * @param store - A store.
 * @param key - A key.
 * @returns The parsed JSON at the key, or null when absent or corrupt.
 */
export function readJson(store: KeyValueStore, key: string): unknown {
  const raw = store.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/**
 * @param value - Anything.
 * @returns True for a non-null, non-array object.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param value - Anything.
 * @returns True for a finite number.
 */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
