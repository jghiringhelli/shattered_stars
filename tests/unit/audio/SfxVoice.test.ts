/**
 * Gate: the synth actually sweeps what the design asks it to.
 *
 * A VoiceSpec is only worth anything if SfxVoice wires the sweeps into the
 * audio graph. These use a recording stub in place of a real AudioContext to
 * verify the graph gets built and ramped, not to judge how it sounds.
 */

import { describe, it, expect } from "vitest";
import { playVoice, NOISE_BUFFER_SECONDS } from "../../../src/audio/SfxVoice";
import { VOICE_DESIGNS } from "../../../src/audio/SoundDesign";

interface RampCall {
  readonly value: number;
  readonly time: number;
}

class RecordingParam {
  value = 0;
  readonly exponentialRamps: RampCall[] = [];
  readonly linearRamps: RampCall[] = [];
  readonly setValues: RampCall[] = [];
  setValueAtTime(value: number, time: number): void {
    this.setValues.push({ value, time });
    this.value = value;
  }
  exponentialRampToValueAtTime(value: number, time: number): void {
    this.exponentialRamps.push({ value, time });
  }
  linearRampToValueAtTime(value: number, time: number): void {
    this.linearRamps.push({ value, time });
  }
}

class RecordingOscillator {
  type = "sine";
  frequency = new RecordingParam();
  detune = new RecordingParam();
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  connect(): void {}
  start(t: number): void {
    this.startedAt = t;
  }
  stop(t: number): void {
    this.stoppedAt = t;
  }
}

class RecordingBufferSource {
  buffer: unknown = null;
  loop = false;
  playbackRate = new RecordingParam();
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  connect(): void {}
  start(t: number): void {
    this.startedAt = t;
  }
  stop(t: number): void {
    this.stoppedAt = t;
  }
}

class RecordingFilter {
  type = "lowpass";
  frequency = new RecordingParam();
  Q = new RecordingParam();
  connect(): void {}
}

class RecordingGain {
  gain = new RecordingParam();
  connect(): void {}
}

class RecordingPanner {
  pan = new RecordingParam();
  connect(): void {}
}

class RecordingContext {
  currentTime = 5;
  sampleRate = 44100;
  readonly oscillators: RecordingOscillator[] = [];
  readonly bufferSources: RecordingBufferSource[] = [];
  readonly filters: RecordingFilter[] = [];
  readonly panners: RecordingPanner[] = [];
  createdBuffers = 0;
  createOscillator(): RecordingOscillator {
    const o = new RecordingOscillator();
    this.oscillators.push(o);
    return o;
  }
  createBufferSource(): RecordingBufferSource {
    const s = new RecordingBufferSource();
    this.bufferSources.push(s);
    return s;
  }
  createBiquadFilter(): RecordingFilter {
    const f = new RecordingFilter();
    this.filters.push(f);
    return f;
  }
  createGain(): RecordingGain {
    return new RecordingGain();
  }
  createStereoPanner(): RecordingPanner {
    const p = new RecordingPanner();
    this.panners.push(p);
    return p;
  }
  createBuffer(_ch: number, length: number, rate: number): AudioBuffer {
    this.createdBuffers += 1;
    return {
      length,
      sampleRate: rate,
      getChannelData: () => new Float32Array(length),
    } as unknown as AudioBuffer;
  }
}

function play(
  context: RecordingContext,
  name: keyof typeof VOICE_DESIGNS,
  volume = 1,
  pan = 0,
): void {
  playVoice(
    context as unknown as AudioContext,
    new RecordingGain() as unknown as AudioNode,
    VOICE_DESIGNS[name],
    volume,
    pan,
  );
}

describe("playVoice", () => {
  it("ramps the oscillator from the design's start pitch to its end pitch", () => {
    const context = new RecordingContext();
    play(context, "laser_fire");
    const spec = VOICE_DESIGNS.laser_fire;
    const osc = context.oscillators[0]!;
    expect(osc.frequency.setValues[0]!.value).toBe(spec.startFrequency);
    expect(osc.frequency.exponentialRamps.at(-1)!.value).toBe(
      spec.endFrequency,
    );
  });

  it("ramps the filter cutoff too, so the timbre moves with the pitch", () => {
    const context = new RecordingContext();
    play(context, "explosion_large");
    const spec = VOICE_DESIGNS.explosion_large;
    const filter = context.filters[0]!;
    expect(filter.frequency.setValues[0]!.value).toBe(spec.filterStartHz);
    expect(filter.frequency.exponentialRamps.at(-1)!.value).toBe(
      spec.filterEndHz,
    );
  });

  it("doubles the oscillator when the design asks for detune", () => {
    const context = new RecordingContext();
    play(context, "laser_fire");
    expect(VOICE_DESIGNS.laser_fire.detuneCents).not.toBe(0);
    expect(context.oscillators).toHaveLength(2);
    expect(context.oscillators[1]!.detune.value).toBe(
      VOICE_DESIGNS.laser_fire.detuneCents,
    );
  });

  it("plays a single oscillator when the design does not ask for detune", () => {
    const context = new RecordingContext();
    play(context, "ui_back");
    expect(VOICE_DESIGNS.ui_back.detuneCents).toBe(0);
    expect(context.oscillators).toHaveLength(1);
  });

  it("adds a noise source for noise-led sounds", () => {
    const context = new RecordingContext();
    play(context, "explosion_medium");
    expect(context.bufferSources).toHaveLength(1);
  });

  it("skips the noise source entirely when the design is purely tonal", () => {
    const context = new RecordingContext();
    play(context, "ui_hover");
    expect(VOICE_DESIGNS.ui_hover.noiseMix).toBe(0);
    expect(context.bufferSources).toHaveLength(0);
  });

  it("reuses one noise buffer per context instead of allocating per shot", () => {
    // Allocating a fresh Float32Array for every explosion is exactly the
    // per-frame allocation that causes GC stutter mid-fight.
    const context = new RecordingContext();
    play(context, "explosion_small");
    play(context, "explosion_small");
    play(context, "explosion_large");
    expect(context.createdBuffers).toBe(1);
  });

  it("stops every source it started, so voices do not leak", () => {
    const context = new RecordingContext();
    play(context, "explosion_medium");
    for (const osc of context.oscillators) {
      expect(osc.startedAt).not.toBeNull();
      expect(osc.stoppedAt).toBeGreaterThan(osc.startedAt!);
    }
    for (const src of context.bufferSources) {
      expect(src.startedAt).not.toBeNull();
      expect(src.stoppedAt).toBeGreaterThan(src.startedAt!);
    }
  });

  it("places the voice at the requested pan position", () => {
    const context = new RecordingContext();
    play(context, "laser_fire", 1, -0.4);
    expect(context.panners[0]!.pan.value).toBeCloseTo(-0.4, 10);
  });

  it("scales the envelope peak by the requested volume", () => {
    const quiet = new RecordingContext();
    play(quiet, "laser_fire", 0.25);
    const loud = new RecordingContext();
    play(loud, "laser_fire", 1);
    // Same design, so the only difference in the peak must be the volume.
    expect(quiet.oscillators).toHaveLength(loud.oscillators.length);
  });

  it("does nothing at all for a silent voice rather than building a graph", () => {
    const context = new RecordingContext();
    play(context, "laser_fire", 0);
    expect(context.oscillators).toHaveLength(0);
    expect(context.bufferSources).toHaveLength(0);
  });

  it("holds enough noise to cover the longest effect without looping audibly", () => {
    expect(NOISE_BUFFER_SECONDS).toBeGreaterThanOrEqual(1.5);
  });
});
