/**
 * Tests for KeyboardAdapter — held-vs-edge triggering and the shared-key
 * regression (two bindings on the same physical key must both fire once;
 * Phaser.Input.Keyboard.JustDown() consumes its internal flag on the first
 * check, so relying on it directly would silently drop the second binding
 * sharing that key — e.g. ESC -> CANCEL and ESC -> PAUSE).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// KeyboardAdapter only needs Phaser.Input.Keyboard.KeyCodes (a plain numeric
// enum) — mock it directly instead of importing real Phaser, which requires
// a browser `window` (this test file runs under vitest's node environment,
// same constraint NetworkService.test.ts works around the same way).
vi.mock("phaser", () => ({
  default: {
    Input: {
      Keyboard: {
        KeyCodes: {
          UP: 38,
          DOWN: 40,
          LEFT: 37,
          RIGHT: 39,
          ESC: 27,
          TAB: 9,
          P: 80,
          SHIFT: 16,
          CTRL: 17,
          ALT: 18,
        },
      },
    },
  },
}));

const { KeyboardAdapter } =
  await import("../../../src/input/adapters/KeyboardAdapter");
const KeyCodes = {
  UP: 38,
  DOWN: 40,
  LEFT: 37,
  RIGHT: 39,
  ESC: 27,
  TAB: 9,
  P: 80,
  SHIFT: 16,
  CTRL: 17,
  ALT: 18,
} as const;
interface KeyboardBinding {
  key: string;
  intent: string;
  modifiers?: { shift?: boolean; ctrl?: boolean; alt?: boolean };
}

interface FakeKey {
  isDown: boolean;
}

function makeFakeScene(): {
  scene: unknown;
  setKeyDown: (name: keyof typeof KeyCodes, down: boolean) => void;
} {
  const keysByCode = new Map<number, FakeKey>();
  const addKey = vi.fn((code: number) => {
    if (!keysByCode.has(code)) keysByCode.set(code, { isDown: false });
    return keysByCode.get(code);
  });

  const scene = {
    input: {
      keyboard: {
        addKey,
        removeKey: vi.fn(),
      },
    },
  };

  return {
    scene,
    setKeyDown: (name: keyof typeof KeyCodes, down: boolean) => {
      const code = KeyCodes[name];
      const key = keysByCode.get(code);
      if (key) key.isDown = down;
    },
  };
}

describe("KeyboardAdapter", () => {
  let scene: unknown;
  let setKeyDown: (name: keyof typeof KeyCodes, down: boolean) => void;

  beforeEach(() => {
    const fake = makeFakeScene();
    scene = fake.scene;
    setKeyDown = fake.setKeyDown;
  });

  it("emits a held intent every poll while the key stays down", () => {
    const bindings: KeyboardBinding[] = [{ key: "UP", intent: "THRUST_UP" }];
    const adapter = new KeyboardAdapter(scene, bindings);
    adapter.init();

    setKeyDown("UP", true);
    expect(adapter.poll().map((e) => e.intent)).toEqual(["THRUST_UP"]);
    expect(adapter.poll().map((e) => e.intent)).toEqual(["THRUST_UP"]);

    setKeyDown("UP", false);
    expect(adapter.poll()).toEqual([]);
  });

  it("emits an edge-triggered intent only once per physical press", () => {
    const bindings: KeyboardBinding[] = [{ key: "P", intent: "PAUSE" }];
    const adapter = new KeyboardAdapter(scene, bindings);
    adapter.init();

    setKeyDown("P", true);
    expect(adapter.poll().map((e) => e.intent)).toEqual(["PAUSE"]);
    // Still held on the next poll — must NOT fire again.
    expect(adapter.poll()).toEqual([]);

    setKeyDown("P", false);
    expect(adapter.poll()).toEqual([]);

    // Release and press again — should fire once more.
    setKeyDown("P", true);
    expect(adapter.poll().map((e) => e.intent)).toEqual(["PAUSE"]);
  });

  it("regression: two edge-triggered bindings sharing one physical key both fire on the same press", () => {
    // Mirrors ESC -> CANCEL and ESC -> PAUSE in DefaultBindings.ts.
    const bindings: KeyboardBinding[] = [
      { key: "ESC", intent: "CANCEL" },
      { key: "ESC", intent: "PAUSE" },
    ];
    const adapter = new KeyboardAdapter(scene, bindings);
    adapter.init();

    setKeyDown("ESC", true);
    const intents = adapter.poll().map((e) => e.intent);
    expect(intents).toContain("CANCEL");
    expect(intents).toContain("PAUSE");
    expect(intents).toHaveLength(2);

    // Still held next frame — neither should re-fire (both are edge-triggered).
    expect(adapter.poll()).toEqual([]);
  });

  it("respects exact modifier matching (unshifted binding does not fire while shift is held)", () => {
    const bindings: KeyboardBinding[] = [
      { key: "TAB", intent: "CYCLE_NEXT" },
      { key: "TAB", intent: "CYCLE_PREV", modifiers: { shift: true } },
    ];
    const adapter = new KeyboardAdapter(scene, bindings);
    adapter.init();

    setKeyDown("SHIFT", true);
    setKeyDown("TAB", true);
    expect(adapter.poll().map((e) => e.intent)).toEqual(["CYCLE_PREV"]);
  });
});
