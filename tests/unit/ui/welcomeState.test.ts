import { describe, expect, it } from "vitest";
import {
  WELCOME_SEEN_KEY,
  markWelcomeSeen,
  shouldAutoOpenWelcome,
} from "../../../src/ui/welcome/welcomeState";
import type { KeyValueStore } from "../../../src/systems/keyValueStore";

function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  } as KeyValueStore;
}

describe("shouldAutoOpenWelcome", () => {
  it("opens on the first launch", () => {
    expect(
      shouldAutoOpenWelcome({
        store: memoryStore(),
        automated: false,
        search: "",
      }),
    ).toBe(true);
  });

  it("does not open again after it was shown", () => {
    const store = memoryStore();
    markWelcomeSeen(store);
    expect(store.getItem(WELCOME_SEEN_KEY)).toBe("1");
    expect(shouldAutoOpenWelcome({ store, automated: false, search: "" })).toBe(
      false,
    );
  });

  it("never opens by itself in automated browsers", () => {
    expect(
      shouldAutoOpenWelcome({
        store: memoryStore(),
        automated: true,
        search: "",
      }),
    ).toBe(false);
  });

  it("opens in automated browsers when ?welcome=1 asks for it", () => {
    expect(
      shouldAutoOpenWelcome({
        store: memoryStore({ [WELCOME_SEEN_KEY]: "1" }),
        automated: true,
        search: "?welcome=1",
      }),
    ).toBe(true);
  });
});
