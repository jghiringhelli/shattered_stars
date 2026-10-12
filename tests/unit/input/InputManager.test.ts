/**
 * Tests for InputManager — adapter registration, dispatch, and held-intent tracking.
 * Pure logic, no Phaser dependency (InputManager is a plain singleton class).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { InputManager } from "../../../src/input/InputManager";
import type {
  InputAdapter,
  InputEvent,
  InputSource,
} from "../../../src/input/InputTypes";

function makeAdapter(
  source: InputSource,
  events: InputEvent[] = [],
): InputAdapter & { setEvents: (e: InputEvent[]) => void } {
  let queued = events;
  return {
    source,
    init: vi.fn(),
    destroy: vi.fn(),
    isAvailable: () => true,
    poll: () => queued,
    setEvents: (e: InputEvent[]) => {
      queued = e;
    },
  };
}

describe("InputManager", () => {
  beforeEach(() => {
    InputManager.destroy();
  });

  it("dispatches events to subscribers for the matching intent", () => {
    const adapter = makeAdapter("keyboard", [
      { intent: "PAUSE", timestamp: 1, source: "keyboard", value: 1 },
    ]);
    InputManager.registerAdapter(adapter);

    const callback = vi.fn();
    InputManager.on("PAUSE", callback);
    InputManager.update();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0]![0].intent).toBe("PAUSE");
  });

  it("does not call subscribers registered for a different intent", () => {
    const adapter = makeAdapter("keyboard", [
      { intent: "PAUSE", timestamp: 1, source: "keyboard", value: 1 },
    ]);
    InputManager.registerAdapter(adapter);

    const callback = vi.fn();
    InputManager.on("CANCEL", callback);
    InputManager.update();

    expect(callback).not.toHaveBeenCalled();
  });

  it("onAny() receives every intent", () => {
    const adapter = makeAdapter("keyboard", [
      { intent: "PAUSE", timestamp: 1, source: "keyboard", value: 1 },
      { intent: "CONFIRM", timestamp: 1, source: "keyboard", value: 1 },
    ]);
    InputManager.registerAdapter(adapter);

    const callback = vi.fn();
    InputManager.onAny(callback);
    InputManager.update();

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("off() unsubscribes by id", () => {
    const adapter = makeAdapter("keyboard", [
      { intent: "PAUSE", timestamp: 1, source: "keyboard", value: 1 },
    ]);
    InputManager.registerAdapter(adapter);

    const callback = vi.fn();
    const id = InputManager.on("PAUSE", callback);
    InputManager.off(id);
    InputManager.update();

    expect(callback).not.toHaveBeenCalled();
  });

  it("isHeld() is true while an adapter keeps emitting a positive-value event", () => {
    const adapter = makeAdapter("keyboard", [
      { intent: "THRUST_UP", timestamp: 1, source: "keyboard", value: 1 },
    ]);
    InputManager.registerAdapter(adapter);
    InputManager.update();

    expect(InputManager.isHeld("THRUST_UP")).toBe(true);
    expect(InputManager.getHeldValue("THRUST_UP")).toBe(1);
  });

  it("isHeld() becomes false once the adapter stops emitting the event", () => {
    const adapter = makeAdapter("keyboard", [
      { intent: "THRUST_UP", timestamp: 1, source: "keyboard", value: 1 },
    ]);
    InputManager.registerAdapter(adapter);
    InputManager.update();
    expect(InputManager.isHeld("THRUST_UP")).toBe(true);

    adapter.setEvents([]);
    InputManager.update();
    expect(InputManager.isHeld("THRUST_UP")).toBe(false);
  });

  it("skips polling adapters that report unavailable", () => {
    const adapter = makeAdapter("gamepad", [
      { intent: "PAUSE", timestamp: 1, source: "gamepad", value: 1 },
    ]);
    adapter.isAvailable = () => false;
    InputManager.registerAdapter(adapter);

    const callback = vi.fn();
    InputManager.on("PAUSE", callback);
    InputManager.update();

    expect(callback).not.toHaveBeenCalled();
  });

  it("registerAdapter() replaces and destroys an existing adapter for the same source", () => {
    const first = makeAdapter("keyboard");
    const second = makeAdapter("keyboard");
    InputManager.registerAdapter(first);
    InputManager.registerAdapter(second);

    expect(first.destroy).toHaveBeenCalled();
    expect(InputManager.getAvailableSources()).toEqual(["keyboard"]);
  });

  it("unregisterAdapter() destroys and removes the adapter", () => {
    const adapter = makeAdapter("touch");
    InputManager.registerAdapter(adapter);
    InputManager.unregisterAdapter("touch");

    expect(adapter.destroy).toHaveBeenCalled();
    expect(InputManager.getAvailableSources()).toEqual([]);
  });

  it("destroy() clears adapters, subscriptions, and held state", () => {
    const adapter = makeAdapter("keyboard", [
      { intent: "THRUST_UP", timestamp: 1, source: "keyboard", value: 1 },
    ]);
    InputManager.registerAdapter(adapter);
    InputManager.on("THRUST_UP", vi.fn());
    InputManager.update();

    InputManager.destroy();

    expect(InputManager.getAvailableSources()).toEqual([]);
    expect(InputManager.isHeld("THRUST_UP")).toBe(false);
  });

  it("a subscriber throwing does not stop other subscribers for the same intent", () => {
    const adapter = makeAdapter("keyboard", [
      { intent: "PAUSE", timestamp: 1, source: "keyboard", value: 1 },
    ]);
    InputManager.registerAdapter(adapter);

    const goodCallback = vi.fn();
    InputManager.on("PAUSE", () => {
      throw new Error("boom");
    });
    InputManager.on("PAUSE", goodCallback);

    expect(() => InputManager.update()).not.toThrow();
    expect(goodCallback).toHaveBeenCalledTimes(1);
  });
});

describe("InputManager.suppress", () => {
  beforeEach(() => {
    InputManager.destroy();
  });

  const pausePress = (): InputEvent => ({
    intent: "PAUSE",
    timestamp: 1,
    source: "keyboard",
    value: 1,
  });

  it("holds back a suppressed intent while a modal is open", () => {
    InputManager.registerAdapter(makeAdapter("keyboard", [pausePress()]));
    const onPause = vi.fn();
    InputManager.on("PAUSE", onPause);
    const release = InputManager.suppress("PAUSE");
    InputManager.update();
    expect(onPause).not.toHaveBeenCalled();
    release();
    InputManager.update();
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it("keeps other intents flowing while one is suppressed", () => {
    InputManager.registerAdapter(
      makeAdapter("keyboard", [
        { intent: "CONFIRM", timestamp: 1, source: "keyboard", value: 1 },
      ]),
    );
    const onConfirm = vi.fn();
    InputManager.on("CONFIRM", onConfirm);
    InputManager.suppress("PAUSE");
    InputManager.update();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("stays suppressed until every holder releases, and release is idempotent", () => {
    InputManager.registerAdapter(makeAdapter("keyboard", [pausePress()]));
    const onPause = vi.fn();
    InputManager.on("PAUSE", onPause);
    const first = InputManager.suppress("PAUSE");
    const second = InputManager.suppress("PAUSE");
    first();
    first();
    InputManager.update();
    expect(onPause).not.toHaveBeenCalled();
    second();
    InputManager.update();
    expect(onPause).toHaveBeenCalledTimes(1);
  });
});
