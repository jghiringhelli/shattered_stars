/**
 * Survival roguelite — key/value storage port and its adapters. The run
 * save and the meta profile go through this port so the logic is testable
 * and the browser's localStorage is just one adapter.
 */

import { browserStore, type KeyValueStore } from "../keyValueStore";

/** Minimal synchronous key/value store (localStorage-compatible). */
export type { KeyValueStore };

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
 * @returns The shared never-throwing browser store (memory-backed when
 *   storage is blocked or full).
 */
export function defaultStore(): KeyValueStore {
  return browserStore();
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
