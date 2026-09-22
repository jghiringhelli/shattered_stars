/**
 * Gate: no sound in the game is a static tone.
 *
 * Every effect used to be a single oscillator held at one frequency for its
 * whole duration — laser_fire was a sawtooth pinned at 800Hz, engine_thrust a
 * sawtooth pinned at 80Hz. A constant-pitch sawtooth is, by definition, a
 * buzz. These tests pin the properties that stop that from coming back.
 */

import { describe, it, expect } from "vitest";
import {
  VOICE_DESIGNS,
  voiceDuration,
  NOISE_DOMINANT_MIX,
} from "../../../src/audio/SoundDesign";
import type { SoundEffectType } from "../../../src/audio/SoundDesign";

const ALL_SOUNDS = Object.keys(VOICE_DESIGNS) as SoundEffectType[];

describe("voice designs", () => {
  it("covers every sound effect the game asks for", () => {
    expect(ALL_SOUNDS.length).toBeGreaterThan(0);
    for (const spec of Object.values(VOICE_DESIGNS)) {
      expect(spec).toBeDefined();
    }
  });

  it("never holds a single pitch for the whole sound", () => {
    // The buzz regression. A voice must either sweep its pitch or be carried
    // by noise; a steady oscillator at one frequency is what we are banning.
    const staticTones = ALL_SOUNDS.filter((name) => {
      const spec = VOICE_DESIGNS[name];
      const sweeps = spec.startFrequency !== spec.endFrequency;
      const noiseLed = spec.noiseMix >= NOISE_DOMINANT_MIX;
      return !sweeps && !noiseLed;
    });
    expect(staticTones).toEqual([]);
  });

  it("builds explosions and impacts out of noise, not a low oscillator", () => {
    // A sawtooth at 40Hz does not sound like an explosion, it sounds like a
    // dying wasp. Percussive effects have to be noise-led.
    for (const name of [
      "explosion_small",
      "explosion_medium",
      "explosion_large",
      "hull_hit",
      "engine_thrust",
    ] as const) {
      expect(VOICE_DESIGNS[name].noiseMix, name).toBeGreaterThanOrEqual(
        NOISE_DOMINANT_MIX,
      );
    }
  });

  it("gives every sound a positive, audible envelope", () => {
    for (const name of ALL_SOUNDS) {
      const spec = VOICE_DESIGNS[name];
      expect(spec.attackSeconds, name).toBeGreaterThan(0);
      expect(spec.holdSeconds, name).toBeGreaterThanOrEqual(0);
      expect(spec.releaseSeconds, name).toBeGreaterThan(0);
    }
  });

  it("keeps every effect short enough that rapid fire does not pile up", () => {
    // Arcade modes fire many shots a second across a dozen ships. Anything
    // that rings for over a second stacks into mush.
    for (const name of ALL_SOUNDS) {
      expect(voiceDuration(VOICE_DESIGNS[name]), name).toBeLessThanOrEqual(1.5);
    }
  });

  it("uses positive frequencies everywhere, since zero silences a filter", () => {
    for (const name of ALL_SOUNDS) {
      const spec = VOICE_DESIGNS[name];
      expect(spec.startFrequency, name).toBeGreaterThan(0);
      expect(spec.endFrequency, name).toBeGreaterThan(0);
      expect(spec.filterStartHz, name).toBeGreaterThan(0);
      expect(spec.filterEndHz, name).toBeGreaterThan(0);
    }
  });

  it("keeps the noise mix a proper ratio", () => {
    for (const name of ALL_SOUNDS) {
      const mix = VOICE_DESIGNS[name].noiseMix;
      expect(mix, name).toBeGreaterThanOrEqual(0);
      expect(mix, name).toBeLessThanOrEqual(1);
    }
  });

  it("sweeps weapon fire downward, which is what reads as a shot", () => {
    for (const name of ["laser_fire", "missile_launch"] as const) {
      const spec = VOICE_DESIGNS[name];
      expect(spec.endFrequency, name).toBeLessThan(spec.startFrequency);
    }
  });
});

describe("voiceDuration", () => {
  it("is the sum of the envelope stages", () => {
    const spec = VOICE_DESIGNS.laser_fire;
    expect(voiceDuration(spec)).toBeCloseTo(
      spec.attackSeconds + spec.holdSeconds + spec.releaseSeconds,
      10,
    );
  });
});
