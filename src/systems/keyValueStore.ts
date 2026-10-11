/**
 * KeyValueStore — the slice of the Web Storage API persistence modules need,
 * so settings, telemetry and tutorial progress can be tested in node with an
 * in-memory store and run in the browser on localStorage.
 */

/** Minimal string key/value persistence. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * @returns A fresh in-memory store (tests, or browsers without storage).
 */
export function createMemoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

/** Fallback when localStorage is missing (node) or throws (privacy mode). */
const fallbackStore = createMemoryStore();

/**
 * @returns localStorage when usable, otherwise a process-wide memory store.
 */
export function browserStore(): KeyValueStore {
  try {
    if (typeof localStorage !== "undefined" && localStorage !== null)
      return localStorage;
  } catch {
    // Accessing localStorage can throw when storage is disabled.
  }
  return fallbackStore;
}
