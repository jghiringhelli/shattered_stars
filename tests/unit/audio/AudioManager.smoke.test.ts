/**
 * AudioManager smoke tests.
 *
 * We can't run the real Web Audio graph in Node, so we stub AudioContext to
 * verify the fallback + missing-file bookkeeping behaves correctly. The point
 * is not to test the actual audio output — that requires a browser — but to
 * guarantee playMusic() never throws when the mp3 is missing and that repeated
 * calls to a known-missing track go straight to the procedural fallback.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── AudioContext stub ────────────────────────────────────────────────────
class FakeGain {
  gain = { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} };
  connect() {}
}
class FakeSource {
  buffer: unknown = null;
  loop = false;
  connect() {}
  start() {}
  stop() {}
}
class FakeAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
  createGain() {
    return new FakeGain();
  }
  createBufferSource() {
    return new FakeSource();
  }
  createOscillator() {
    return {
      type: "sine",
      frequency: { value: 0 },
      detune: { value: 0 },
      connect() {},
      start() {},
      stop() {},
    };
  }
  createBiquadFilter() {
    return {
      type: "lowpass",
      frequency: { value: 0 },
      Q: { value: 0 },
      connect() {},
    };
  }
  createStereoPanner() {
    return { pan: { value: 0 }, connect() {} };
  }
  createBuffer() {
    return { getChannelData: () => new Float32Array(1) };
  }
  decodeAudioData(_buf: ArrayBuffer): Promise<AudioBuffer> {
    return Promise.resolve({} as AudioBuffer);
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
  get sampleRate() {
    return 44100;
  }
}

// Fake browser globals for the module's constructor + initialize()
beforeEach(() => {
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
  vi.resetModules();
});

describe("AudioManager — file-based music fallback", () => {
  it("does not throw when playMusic is called after initialize", async () => {
    (globalThis as any).fetch = vi.fn(() =>
      Promise.reject(new Error("network down")),
    );
    const mod = await import("../../../src/audio/AudioManager");
    const mgr = mod.AudioManager.getInstance();
    mgr.initialize();
    expect(() => mgr.playMusic("heg_combat")).not.toThrow();
  });

  it("marks a track as missing after a failed fetch, then uses procedural on retry", async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error("404")));
    (globalThis as any).fetch = fetchMock;
    const mod = await import("../../../src/audio/AudioManager");
    const mgr = mod.AudioManager.getInstance();
    mgr.initialize();

    mgr.playMusic("conf_combat");
    // Let the rejected fetch promise settle
    await new Promise((r) => setTimeout(r, 0));

    // Second call for same track must NOT re-fetch — it's cached-missing
    fetchMock.mockClear();
    mgr.playMusic("conf_combat");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("legacy track names have procedural params so fallback plays sound", async () => {
    (globalThis as any).fetch = vi.fn(() => Promise.reject(new Error("404")));
    const mod = await import("../../../src/audio/AudioManager");
    const mgr = mod.AudioManager.getInstance();
    mgr.initialize();
    expect(() => mgr.playMusic("combat_medium")).not.toThrow();
    expect(() => mgr.playMusic("menu_theme")).not.toThrow();
  });

  it("stopMusic is safe to call when nothing is playing", async () => {
    (globalThis as any).fetch = vi.fn(() => Promise.reject(new Error("404")));
    const mod = await import("../../../src/audio/AudioManager");
    const mgr = mod.AudioManager.getInstance();
    mgr.initialize();
    expect(() => mgr.stopMusic()).not.toThrow();
  });
});
