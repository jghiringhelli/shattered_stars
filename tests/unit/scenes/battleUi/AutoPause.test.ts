import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import {
  LEAVE_PAGE_EVENTS,
  bindAutoPause,
  pauseBattleIfRunning,
} from "../../../../src/scenes/battleUi/AutoPause";

function fakeScene(): {
  scene: { game: { events: EventEmitter }; events: EventEmitter };
  gameEvents: EventEmitter;
} {
  const gameEvents = new EventEmitter();
  return { scene: { game: { events: gameEvents }, events: new EventEmitter() }, gameEvents };
}

describe("pauseBattleIfRunning", () => {
  it("pauses a running offline battle", () => {
    const pause = vi.fn();
    expect(pauseBattleIfRunning({ paused: false, online: false }, pause)).toBe(true);
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it("never pauses an online battle", () => {
    const pause = vi.fn();
    expect(pauseBattleIfRunning({ paused: false, online: true }, pause)).toBe(false);
    expect(pause).not.toHaveBeenCalled();
  });

  it("leaves an already paused battle alone (no toggle back to running)", () => {
    const pause = vi.fn();
    expect(pauseBattleIfRunning({ paused: true, online: false }, pause)).toBe(false);
    expect(pause).not.toHaveBeenCalled();
  });
});

describe("bindAutoPause", () => {
  it.each(LEAVE_PAGE_EVENTS)("fires when the game emits %s", (event) => {
    const { scene, gameEvents } = fakeScene();
    const onLeave = vi.fn();
    bindAutoPause(scene, onLeave);
    gameEvents.emit(event);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("does not fire on regaining focus (resume stays manual)", () => {
    const { scene, gameEvents } = fakeScene();
    const onLeave = vi.fn();
    bindAutoPause(scene, onLeave);
    gameEvents.emit("focus");
    gameEvents.emit("visible");
    expect(onLeave).not.toHaveBeenCalled();
  });

  it("stops listening once the scene shuts down, so restarts never stack", () => {
    const { scene, gameEvents } = fakeScene();
    const onLeave = vi.fn();
    bindAutoPause(scene, onLeave);
    scene.events.emit("shutdown");
    gameEvents.emit("blur");
    expect(onLeave).not.toHaveBeenCalled();
    expect(gameEvents.listenerCount("blur")).toBe(0);
    expect(scene.events.listenerCount("destroy")).toBe(0);
  });
});
