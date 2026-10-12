import { describe, it, expect, vi } from "vitest";
import {
  createMemoryStore,
  createSafeStore,
  type KeyValueStore,
} from "../../../src/systems/keyValueStore";

/** A backing store whose chosen operations throw like a blocked/full localStorage. */
function failingStore(fail: {
  get?: boolean;
  set?: boolean;
  remove?: boolean;
}): KeyValueStore & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  const quota = (): never => {
    throw new DOMException("quota", "QuotaExceededError");
  };
  return {
    data,
    getItem: (key) => (fail.get ? quota() : (data.get(key) ?? null)),
    setItem: (key, value) => {
      if (fail.set) quota();
      data.set(key, value);
    },
    removeItem: (key) => {
      if (fail.remove) quota();
      data.delete(key);
    },
  };
}

describe("createSafeStore", () => {
  it("writes through to a healthy backing store and stays persistent", () => {
    const backing = createMemoryStore();
    const store = createSafeStore(() => backing);
    store.setItem("k", "v");
    expect(backing.getItem("k")).toBe("v");
    expect(store.getItem("k")).toBe("v");
    expect(store.isPersistent()).toBe(true);
  });

  it("never throws when setItem hits the quota, and keeps the value for this session", () => {
    const store = createSafeStore(() => failingStore({ set: true }));
    expect(() => store.setItem("k", "v")).not.toThrow();
    expect(store.getItem("k")).toBe("v");
    expect(store.isPersistent()).toBe(false);
  });

  it("returns null instead of throwing when getItem is blocked", () => {
    const store = createSafeStore(() => failingStore({ get: true }));
    expect(store.getItem("missing")).toBeNull();
  });

  it("falls back to memory when resolving localStorage itself throws", () => {
    const store = createSafeStore(() => {
      throw new DOMException("denied", "SecurityError");
    });
    store.setItem("k", "v");
    expect(store.getItem("k")).toBe("v");
    expect(store.isPersistent()).toBe(false);
  });

  it("treats a missing backing store (node, SSR) as memory-only", () => {
    const store = createSafeStore(() => null);
    store.setItem("k", "v");
    expect(store.getItem("k")).toBe("v");
    expect(store.isPersistent()).toBe(false);
  });

  it("hides a removed key even when the backing remove throws", () => {
    const backing = failingStore({ remove: true });
    backing.data.set("k", "old");
    const store = createSafeStore(() => backing);
    expect(() => store.removeItem("k")).not.toThrow();
    expect(store.getItem("k")).toBeNull();
  });

  it("still reads saves that exist in a full (write-failing) store", () => {
    const backing = failingStore({ set: true });
    backing.data.set("save", "{}");
    const store = createSafeStore(() => backing);
    expect(store.getItem("save")).toBe("{}");
  });

  it("notifies degradation listeners exactly once", () => {
    const store = createSafeStore(() => failingStore({ set: true }));
    const listener = vi.fn();
    store.onDegraded(listener);
    store.setItem("a", "1");
    store.setItem("b", "2");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("notifies a listener registered after degradation immediately", () => {
    const store = createSafeStore(() => null);
    store.setItem("a", "1");
    const listener = vi.fn();
    store.onDegraded(listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("prefers a later successful write over the session overlay", () => {
    let failing = true;
    const data = new Map<string, string>();
    const store = createSafeStore(() => ({
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => {
        if (failing) throw new Error("full");
        data.set(key, value);
      },
      removeItem: (key) => {
        data.delete(key);
      },
    }));
    store.setItem("k", "memory");
    failing = false;
    store.setItem("k", "disk");
    expect(data.get("k")).toBe("disk");
    expect(store.getItem("k")).toBe("disk");
  });
});
