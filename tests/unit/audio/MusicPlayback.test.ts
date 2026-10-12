/**
 * Spec: recorded music playback in AudioManager.
 *
 * - legacy menu_theme loads the recorded menu_main file in the browser's format
 * - procedural-only ids never touch the network (no 404s in production)
 * - re-requesting the playing track keeps it running (menus re-enter often)
 * - switching tracks fades the old one out instead of cutting it
 * - stingers play once; skirmishes rotate takes; low hull / boss final phase
 *   raise the Shields Low tension layer
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MUSIC_CROSSFADE_SECONDS } from "../../../src/audio/musicTracks";

interface Ramp {
  value: number;
  at: number;
}

class FakeGain {
  ramps: Ramp[] = [];
  gain = {
    value: 1,
    setValueAtTime: () => {},
    linearRampToValueAtTime: (value: number, at: number) => {
      this.ramps.push({ value, at });
    },
  };
  connect() {}
}

class FakeSource {
  buffer: unknown = null;
  loop = false;
  stoppedAt: number | null = null;
  connected: unknown = null;
  connect(node: unknown) {
    this.connected = node;
  }
  start() {}
  stop(at = 0) {
    this.stoppedAt = at;
  }
}

class FakeAudioContext {
  static sources: FakeSource[] = [];
  state = "running";
  currentTime = 10;
  destination = {};
  sampleRate = 44100;
  createGain() {
    return new FakeGain();
  }
  createBufferSource() {
    const source = new FakeSource();
    FakeAudioContext.sources.push(source);
    return source;
  }
  createOscillator() {
    return {
      type: "sine",
      frequency: { value: 0 },
      connect() {},
      start() {},
      stop() {},
    };
  }
  decodeAudioData() {
    return Promise.resolve({} as AudioBuffer);
  }
  resume() {
    return Promise.resolve();
  }
}

const fetchOk = vi.fn((_url: string) =>
  Promise.resolve({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  }),
);

beforeEach(() => {
  FakeAudioContext.sources = [];
  fetchOk.mockClear();
  (globalThis as any).window = globalThis;
  (globalThis as any).AudioContext = FakeAudioContext;
  (globalThis as any).fetch = fetchOk;
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

afterEach(() => {
  delete (globalThis as any).document;
});

async function freshManager() {
  const mod = await import("../../../src/audio/AudioManager");
  const manager = mod.AudioManager.getInstance();
  manager.initialize();
  return manager;
}

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe("recorded music playback", () => {
  it("loads menu_main as mp3 when the browser cannot decode Ogg Vorbis", async () => {
    const manager = await freshManager();
    manager.playMusic("menu_theme");
    expect(fetchOk).toHaveBeenCalledWith("assets/audio/music/menu_main.mp3");
  });

  it("loads menu_main as ogg when the browser decodes Ogg Vorbis", async () => {
    (globalThis as any).document = {
      createElement: () => ({ canPlayType: () => "probably" }),
    };
    const manager = await freshManager();
    manager.playMenuMusic();
    expect(fetchOk).toHaveBeenCalledWith("assets/audio/music/menu_main.ogg");
  });

  it("loads the faction combat file for a battle", async () => {
    const manager = await freshManager();
    manager.playFactionMusic("ascendant_empire", "combat");
    expect(fetchOk).toHaveBeenCalledWith("assets/audio/music/asc_combat.mp3");
  });

  it("never requests a file for procedural-only tracks", async () => {
    const manager = await freshManager();
    manager.playMusic("combat_high");
    manager.playMusic("void_encounter");
    expect(fetchOk).not.toHaveBeenCalled();
  });

  it("plays victory / defeat stingers once instead of looping them", async () => {
    const manager = await freshManager();
    manager.playFactionStinger("void_corsairs", "victory");
    await settle();
    expect(fetchOk).toHaveBeenCalledWith(
      "assets/audio/music/victory_common.mp3",
    );
    expect(FakeAudioContext.sources[0]!.loop).toBe(false);
  });

  it("alternates the two skirmish takes between battles", async () => {
    const manager = await freshManager();
    manager.playBattleMusic("skirmish", "terran_hegemony");
    manager.playMenuMusic();
    manager.playBattleMusic("skirmish", "terran_hegemony");
    const urls = fetchOk.mock.calls.map(([url]) => url);
    expect(urls).toContain("assets/audio/music/skirmish_combat_a.mp3");
    expect(urls).toContain("assets/audio/music/skirmish_combat_b.mp3");
  });

  it("raises Shields Low on low hull and returns to the battle track on recovery", async () => {
    const manager = await freshManager();
    manager.playBattleMusic("dogfight", "terran_hegemony");
    await settle();
    manager.reportPlayerHull(0.2);
    await settle();
    expect(fetchOk).toHaveBeenLastCalledWith(
      "assets/audio/music/tension_alert.mp3",
    );
    manager.reportPlayerHull(0.9);
    await settle();
    const live = FakeAudioContext.sources.filter((s) => s.stoppedAt === null);
    expect(live).toHaveLength(1);
    expect(FakeAudioContext.sources).toHaveLength(3);
    expect(fetchOk).toHaveBeenCalledTimes(2);
  });

  it("raises Shields Low for a boss's final phase until the next battle", async () => {
    const manager = await freshManager();
    manager.playBattleMusic("boss", "free_confederation");
    manager.setBossFinalPhase(true);
    manager.reportPlayerHull(1);
    expect(fetchOk).toHaveBeenLastCalledWith(
      "assets/audio/music/tension_alert.mp3",
    );
    manager.playBattleMusic("boss", "free_confederation");
    expect(fetchOk).toHaveBeenLastCalledWith(
      "assets/audio/music/boss_dreadnought.mp3",
    );
  });

  it("keeps the playing track running when it is requested again", async () => {
    const manager = await freshManager();
    manager.playMenuMusic();
    await settle();
    manager.playMenuMusic();
    manager.playMusic("menu_theme");
    await settle();
    expect(fetchOk).toHaveBeenCalledTimes(1);
    expect(FakeAudioContext.sources).toHaveLength(1);
    expect(FakeAudioContext.sources[0]!.stoppedAt).toBeNull();
  });

  it("fades the previous recorded track out when switching", async () => {
    const manager = await freshManager();
    manager.playMenuMusic();
    await settle();
    const menu = FakeAudioContext.sources[0]!;
    const menuFader = menu.connected as FakeGain;

    manager.playFactionMusic("terran_hegemony", "tactical");
    await settle();

    const fadeEnd = 10 + MUSIC_CROSSFADE_SECONDS;
    expect(menuFader.ramps.at(-1)).toEqual({ value: 0, at: fadeEnd });
    expect(menu.stoppedAt).toBe(fadeEnd);
    const tactical = FakeAudioContext.sources[1]!;
    expect((tactical.connected as FakeGain).ramps).toEqual([
      { value: 1, at: fadeEnd },
    ]);
  });

  it("does not double-start a track whose loads overlapped (A → B → A)", async () => {
    const manager = await freshManager();
    manager.playMenuMusic();
    manager.playFactionMusic("void_corsairs", "tactical");
    manager.playMenuMusic();
    await settle();
    await settle();
    const live = FakeAudioContext.sources.filter((s) => s.stoppedAt === null);
    expect(live).toHaveLength(1);
  });
});
