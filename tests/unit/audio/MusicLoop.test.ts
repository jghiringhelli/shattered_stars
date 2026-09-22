/**
 * Gate: the procedural music loop stops when told to.
 *
 * `playMusicLoop` rescheduled itself through setTimeout and nothing ever
 * cancelled the pending callback. Switching tracks only reassigned
 * `currentMusicTrack`, which the orphaned callback then read as "still
 * playing" — so it kept going. Every scene transition stacked another layer
 * of sustained sine chords on top of the last, which is what turned the
 * soundtrack into a drone.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

class FakeGain {
  gain = {
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
  };
  connect() {}
}

class FakeAudioContext {
  static oscillatorsCreated = 0;
  state = "running";
  currentTime = 0;
  destination = {};
  sampleRate = 44100;
  createGain() {
    return new FakeGain();
  }
  createBufferSource() {
    return {
      buffer: null,
      loop: false,
      playbackRate: { value: 1 },
      connect() {},
      start() {},
      stop() {},
    };
  }
  createOscillator() {
    FakeAudioContext.oscillatorsCreated += 1;
    return {
      type: "sine",
      frequency: {
        value: 0,
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
      },
      detune: { value: 0 },
      connect() {},
      start() {},
      stop() {},
    };
  }
  createBiquadFilter() {
    return {
      type: "lowpass",
      frequency: {
        value: 0,
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
      },
      Q: { value: 0 },
      connect() {},
    };
  }
  createStereoPanner() {
    return { pan: { value: 0 }, connect() {} };
  }
  createBuffer(_ch: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
  decodeAudioData() {
    return Promise.resolve({} as AudioBuffer);
  }
  resume() {
    return Promise.resolve();
  }
}

beforeEach(() => {
  FakeAudioContext.oscillatorsCreated = 0;
  (globalThis as any).window = globalThis;
  (globalThis as any).AudioContext = FakeAudioContext;
  (globalThis as any).localStorage = {
    _store: {} as Record<string, string>,
    getItem(k: string) {
      return this._store[k] ?? null;
    },
    setItem(k: string, v: string) {
      this._store[k] = v;
    },
  };
  (globalThis as any).fetch = vi.fn(() => Promise.reject(new Error("404")));
  vi.resetModules();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Loads a fresh AudioManager with a track already known to have no mp3. */
async function managerPlayingProcedurally(track: string) {
  const mod = await import("../../../src/audio/AudioManager");
  const manager = mod.AudioManager.getInstance();
  manager.initialize();
  // First call fails its fetch and marks the track missing; the retry then
  // goes straight to the procedural synth.
  manager.playMusic(track as never);
  await vi.advanceTimersByTimeAsync(0);
  return manager;
}

describe("procedural music loop", () => {
  it("schedules no further chords once the music is stopped", async () => {
    const manager = await managerPlayingProcedurally("combat_low");
    manager.playMusic("combat_low" as never);
    await vi.advanceTimersByTimeAsync(5000);

    manager.stopMusic();
    const afterStop = FakeAudioContext.oscillatorsCreated;
    await vi.advanceTimersByTimeAsync(20000);

    expect(FakeAudioContext.oscillatorsCreated).toBe(afterStop);
  });

  it("does not leave the old track looping after switching tracks", async () => {
    const manager = await managerPlayingProcedurally("combat_low");

    manager.playMusic("combat_low" as never);
    await vi.advanceTimersByTimeAsync(10000);
    const singleTrackChords = FakeAudioContext.oscillatorsCreated;

    // Switch tracks repeatedly. Each switch used to orphan a live callback
    // chain, so the chord rate multiplied with every transition.
    FakeAudioContext.oscillatorsCreated = 0;
    for (let i = 0; i < 4; i += 1) {
      manager.playMusic("combat_low" as never);
      await vi.advanceTimersByTimeAsync(200);
    }
    await vi.advanceTimersByTimeAsync(10000);

    // Allow generous slack for the partial windows, but nothing close to the
    // 5x that stacked chains produce.
    expect(FakeAudioContext.oscillatorsCreated).toBeLessThan(
      singleTrackChords * 2,
    );
  });
});
