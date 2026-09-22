/**
 * Gate: the listener sits where the player is looking.
 *
 * A camera's scrollX/scrollY is its top-left corner, not its centre. Feeding
 * that straight to the listener puts the ear half a screen up and to the left
 * of the action, which skews every pan to one side.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncListenerToCamera } from "../../../src/audio/CameraListener";
import { audioManager } from "../../../src/audio/AudioManager";

/** Minimal stand-in for the parts of a Phaser camera the adapter reads. */
function cameraAt(
  scrollX: number,
  scrollY: number,
  width: number,
  height: number,
  zoom = 1,
) {
  return {
    scrollX,
    scrollY,
    width,
    height,
    zoom,
    worldView: {
      centerX: scrollX + width / (2 * zoom),
      centerY: scrollY + height / (2 * zoom),
    },
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("syncListenerToCamera", () => {
  it("places the listener at the centre of what the camera shows", () => {
    const setListener = vi.spyOn(audioManager, "setListener");
    syncListenerToCamera(cameraAt(1000, 500, 1280, 720) as never);
    expect(setListener).toHaveBeenCalledWith(1640, 860);
  });

  it("does not mistake the camera's top-left corner for its centre", () => {
    const setListener = vi.spyOn(audioManager, "setListener");
    syncListenerToCamera(cameraAt(1000, 500, 1280, 720) as never);
    expect(setListener).not.toHaveBeenCalledWith(1000, 500);
  });

  it("scales the audible field with what the camera can see", () => {
    // Zoomed out, more of the battle is on screen, so more of it should be
    // audible. A fixed radius would silence ships the player can see.
    const setField = vi.spyOn(audioManager, "setListeningField");
    syncListenerToCamera(cameraAt(0, 0, 1280, 720, 0.5) as never);
    const zoomedOut = setField.mock.calls.at(-1)!;

    setField.mockClear();
    syncListenerToCamera(cameraAt(0, 0, 1280, 720, 2) as never);
    const zoomedIn = setField.mock.calls.at(-1)!;

    expect(zoomedOut[0]).toBeGreaterThan(zoomedIn[0]);
    expect(zoomedOut[1]).toBeGreaterThan(zoomedIn[1]);
  });

  it("keeps the audible radius wider than the visible half-width", () => {
    // Sounds should fade in before their source scrolls on screen, not pop.
    const setField = vi.spyOn(audioManager, "setListeningField");
    syncListenerToCamera(cameraAt(0, 0, 1280, 720) as never);
    const [audibleRadius, panHalfWidth] = setField.mock.calls.at(-1)!;
    expect(audibleRadius).toBeGreaterThan(panHalfWidth);
  });

  it("survives a camera that has no worldView yet", () => {
    const setListener = vi.spyOn(audioManager, "setListener");
    expect(() =>
      syncListenerToCamera({
        scrollX: 10,
        scrollY: 20,
        width: 800,
        height: 600,
        zoom: 1,
      } as never),
    ).not.toThrow();
    expect(setListener).toHaveBeenCalledWith(410, 320);
  });
});
