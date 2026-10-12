/**
 * KeyValueStore — the slice of the Web Storage API persistence modules need,
 * so settings, telemetry and tutorial progress can be tested in node with an
 * in-memory store and run in the browser on localStorage.
 *
 * Every browser read/write goes through {@link browserStore}, a "safe" store:
 * localStorage access can throw (Safari "block all cookies", sandboxed
 * iframes, quota exceeded), and an uncaught throw during boot used to leave
 * a black screen. The safe store never throws; failed writes are kept in a
 * session-only overlay so the game stays playable, just not persistent.
 */

/** Minimal string key/value persistence. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** A store that never throws and reports whether writes actually persist. */
export interface SafeKeyValueStore extends KeyValueStore {
  /** @returns False once storage is known to be unavailable or full. */
  isPersistent(): boolean;
  /**
   * @param listener - Called once when persistence is lost (immediately if
   *   it already was).
   * @returns Unsubscribe function.
   */
  onDegraded(listener: () => void): () => void;
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

/** Session overlay entry: a value, or null for "removed this session". */
type OverlayValue = string | null;

/**
 * Wrap a (possibly hostile) backing store so no operation ever throws.
 *
 * @param resolveBacking - Returns the backing store, null when there is none;
 *   may throw (accessing `window.localStorage` can). Called per operation so a
 *   store that becomes reachable later is used.
 * @returns The safe store.
 */
export function createSafeStore(
  resolveBacking: () => KeyValueStore | null,
): SafeKeyValueStore {
  const overlay = new Map<string, OverlayValue>();
  const listeners = new Set<() => void>();
  let persistent = true;

  const degrade = (): void => {
    if (!persistent) return;
    persistent = false;
    for (const listener of [...listeners]) listener();
  };
  const backing = (): KeyValueStore | null => {
    try {
      return resolveBacking();
    } catch {
      return null;
    }
  };
  const attempt = (op: (store: KeyValueStore) => void): boolean => {
    const store = backing();
    if (!store) return false;
    try {
      op(store);
      return true;
    } catch {
      return false;
    }
  };

  return {
    getItem: (key) => {
      if (overlay.has(key)) return overlay.get(key) ?? null;
      const store = backing();
      try {
        return store ? store.getItem(key) : null;
      } catch {
        return null;
      }
    },
    setItem: (key, value) => {
      if (attempt((store) => store.setItem(key, value))) {
        overlay.delete(key);
        return;
      }
      overlay.set(key, value);
      degrade();
    },
    removeItem: (key) => {
      if (attempt((store) => store.removeItem(key))) overlay.delete(key);
      else overlay.set(key, null);
    },
    isPersistent: () => persistent && backing() !== null,
    onDegraded: (listener) => {
      if (!persistent || backing() === null) {
        degrade();
        listener();
        return () => undefined;
      }
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * @returns The global localStorage, or null outside a browser. May throw when
 *   the browser blocks storage — {@link createSafeStore} catches that.
 *   Resolved through `globalThis` so node tests can stub it.
 */
function resolveLocalStorage(): KeyValueStore | null {
  const host = globalThis as { localStorage?: KeyValueStore | null };
  return host.localStorage ?? null;
}

/** Process-wide safe store over localStorage (created on first use). */
let sharedBrowserStore: SafeKeyValueStore | null = null;

/**
 * @returns The process-wide safe store over localStorage (memory-backed in
 *   node or when the browser blocks storage). Never throws.
 */
export function browserStore(): SafeKeyValueStore {
  sharedBrowserStore ??= createSafeStore(resolveLocalStorage);
  return sharedBrowserStore;
}

/**
 * Drop the shared store's session overlay and degradation state, so the next
 * {@link browserStore} call starts fresh (test isolation).
 */
export function resetBrowserStore(): void {
  sharedBrowserStore = null;
}
