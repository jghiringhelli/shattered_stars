/**
 * Sound design data.
 *
 * One `VoiceSpec` per effect, describing how the sound moves over its lifetime
 * rather than what single note it sits on. Pure data — no Web Audio here, so
 * the design can be inspected and tested without a browser. `SfxVoice` turns
 * these into an audio graph.
 *
 * Everything sweeps. The previous design held one oscillator at one frequency
 * for the whole effect, which is the textbook recipe for a buzz.
 */

export type SoundEffectType =
  | "laser_fire"
  | "missile_launch"
  | "explosion_small"
  | "explosion_medium"
  | "explosion_large"
  | "shield_hit"
  | "hull_hit"
  | "engine_thrust"
  | "ui_click"
  | "ui_hover"
  | "ui_select"
  | "ui_back"
  | "powerup"
  | "alert"
  | "victory"
  | "defeat";

/** A noise mix at or above this counts as noise-led rather than tonal. */
export const NOISE_DOMINANT_MIX = 0.5;

/**
 * How one sound effect behaves over its lifetime.
 *
 * Frequencies are in Hz and times in seconds. The `start`/`end` pairs are
 * swept exponentially across the sound's duration.
 */
export interface VoiceSpec {
  /** Oscillator pitch at the attack. */
  readonly startFrequency: number;
  /** Oscillator pitch by the end of the release. */
  readonly endFrequency: number;
  /** Oscillator waveform. Ignored when `noiseMix` is 1. */
  readonly oscillator: OscillatorType;
  /** Detune of a doubled oscillator, in cents. 0 plays a single oscillator. */
  readonly detuneCents: number;
  /** Share of the voice carried by filtered noise, 0 (tonal) to 1 (pure noise). */
  readonly noiseMix: number;
  readonly filterType: BiquadFilterType;
  /** Filter cutoff at the attack. */
  readonly filterStartHz: number;
  /** Filter cutoff by the end of the release. */
  readonly filterEndHz: number;
  /** Filter Q. Higher values ring more. */
  readonly resonance: number;
  readonly attackSeconds: number;
  readonly holdSeconds: number;
  readonly releaseSeconds: number;
}

/**
 * Total time a voice occupies, used to schedule its stop.
 *
 * @param spec - The voice to measure.
 * @returns Duration in seconds.
 */
export function voiceDuration(spec: VoiceSpec): number {
  return spec.attackSeconds + spec.holdSeconds + spec.releaseSeconds;
}

export const VOICE_DESIGNS: Readonly<Record<SoundEffectType, VoiceSpec>> = {
  // Weapons ─ a shot reads as a fast downward pitch sweep, not a held tone.
  laser_fire: {
    startFrequency: 1750,
    endFrequency: 190,
    oscillator: "sawtooth",
    detuneCents: 14,
    noiseMix: 0.12,
    filterType: "lowpass",
    filterStartHz: 5200,
    filterEndHz: 700,
    resonance: 7,
    attackSeconds: 0.004,
    holdSeconds: 0.02,
    releaseSeconds: 0.11,
  },
  missile_launch: {
    startFrequency: 620,
    endFrequency: 120,
    oscillator: "sawtooth",
    detuneCents: 22,
    noiseMix: 0.45,
    filterType: "lowpass",
    filterStartHz: 2600,
    filterEndHz: 420,
    resonance: 3,
    attackSeconds: 0.015,
    holdSeconds: 0.1,
    releaseSeconds: 0.3,
  },

  // Explosions ─ almost entirely noise, with a sub sweeping down underneath.
  explosion_small: {
    startFrequency: 180,
    endFrequency: 48,
    oscillator: "sine",
    detuneCents: 0,
    noiseMix: 0.82,
    filterType: "lowpass",
    filterStartHz: 3200,
    filterEndHz: 180,
    resonance: 1.2,
    attackSeconds: 0.004,
    holdSeconds: 0.04,
    releaseSeconds: 0.3,
  },
  explosion_medium: {
    startFrequency: 140,
    endFrequency: 36,
    oscillator: "sine",
    detuneCents: 0,
    noiseMix: 0.85,
    filterType: "lowpass",
    filterStartHz: 2600,
    filterEndHz: 120,
    resonance: 1.1,
    attackSeconds: 0.005,
    holdSeconds: 0.07,
    releaseSeconds: 0.5,
  },
  explosion_large: {
    startFrequency: 110,
    endFrequency: 26,
    oscillator: "sine",
    detuneCents: 0,
    noiseMix: 0.88,
    filterType: "lowpass",
    filterStartHz: 2000,
    filterEndHz: 70,
    resonance: 1,
    attackSeconds: 0.006,
    holdSeconds: 0.12,
    releaseSeconds: 0.85,
  },

  // Impacts ─ shields ring, hulls thud.
  shield_hit: {
    startFrequency: 2100,
    endFrequency: 880,
    oscillator: "sine",
    detuneCents: 35,
    noiseMix: 0.22,
    filterType: "bandpass",
    filterStartHz: 2400,
    filterEndHz: 1100,
    resonance: 9,
    attackSeconds: 0.003,
    holdSeconds: 0.02,
    releaseSeconds: 0.2,
  },
  hull_hit: {
    startFrequency: 260,
    endFrequency: 70,
    oscillator: "triangle",
    detuneCents: 0,
    noiseMix: 0.62,
    filterType: "lowpass",
    filterStartHz: 1800,
    filterEndHz: 200,
    resonance: 2,
    attackSeconds: 0.003,
    holdSeconds: 0.015,
    releaseSeconds: 0.16,
  },
  engine_thrust: {
    // Rocket wash is broadband noise. The old 80Hz sawtooth was the single
    // worst offender in the mix.
    startFrequency: 90,
    endFrequency: 62,
    oscillator: "triangle",
    detuneCents: 0,
    noiseMix: 0.9,
    filterType: "lowpass",
    filterStartHz: 900,
    filterEndHz: 500,
    resonance: 2.5,
    attackSeconds: 0.02,
    holdSeconds: 0.05,
    releaseSeconds: 0.09,
  },

  // Interface ─ short, clean, and quiet enough to live under everything else.
  ui_hover: {
    startFrequency: 1320,
    endFrequency: 1560,
    oscillator: "sine",
    detuneCents: 0,
    noiseMix: 0,
    filterType: "lowpass",
    filterStartHz: 6000,
    filterEndHz: 6000,
    resonance: 0.7,
    attackSeconds: 0.004,
    holdSeconds: 0.006,
    releaseSeconds: 0.05,
  },
  ui_click: {
    startFrequency: 900,
    endFrequency: 1350,
    oscillator: "sine",
    detuneCents: 0,
    noiseMix: 0.08,
    filterType: "lowpass",
    filterStartHz: 7000,
    filterEndHz: 4000,
    resonance: 0.8,
    attackSeconds: 0.003,
    holdSeconds: 0.008,
    releaseSeconds: 0.07,
  },
  ui_select: {
    startFrequency: 720,
    endFrequency: 1480,
    oscillator: "triangle",
    detuneCents: 6,
    noiseMix: 0,
    filterType: "lowpass",
    filterStartHz: 8000,
    filterEndHz: 5000,
    resonance: 0.8,
    attackSeconds: 0.005,
    holdSeconds: 0.02,
    releaseSeconds: 0.13,
  },
  ui_back: {
    startFrequency: 760,
    endFrequency: 380,
    oscillator: "sine",
    detuneCents: 0,
    noiseMix: 0,
    filterType: "lowpass",
    filterStartHz: 5000,
    filterEndHz: 2200,
    resonance: 0.8,
    attackSeconds: 0.004,
    holdSeconds: 0.015,
    releaseSeconds: 0.1,
  },

  // Stingers.
  powerup: {
    startFrequency: 440,
    endFrequency: 1760,
    oscillator: "triangle",
    detuneCents: 9,
    noiseMix: 0.05,
    filterType: "lowpass",
    filterStartHz: 3000,
    filterEndHz: 8000,
    resonance: 1.5,
    attackSeconds: 0.01,
    holdSeconds: 0.06,
    releaseSeconds: 0.24,
  },
  alert: {
    startFrequency: 720,
    endFrequency: 960,
    oscillator: "square",
    detuneCents: 0,
    noiseMix: 0,
    filterType: "bandpass",
    filterStartHz: 1200,
    filterEndHz: 1600,
    resonance: 4,
    attackSeconds: 0.008,
    holdSeconds: 0.05,
    releaseSeconds: 0.15,
  },
  victory: {
    startFrequency: 523.25,
    endFrequency: 1046.5,
    oscillator: "triangle",
    detuneCents: 7,
    noiseMix: 0,
    filterType: "lowpass",
    filterStartHz: 4000,
    filterEndHz: 7000,
    resonance: 1,
    attackSeconds: 0.02,
    holdSeconds: 0.25,
    releaseSeconds: 0.55,
  },
  defeat: {
    startFrequency: 294,
    endFrequency: 98,
    oscillator: "triangle",
    detuneCents: 11,
    noiseMix: 0.1,
    filterType: "lowpass",
    filterStartHz: 1800,
    filterEndHz: 400,
    resonance: 1,
    attackSeconds: 0.03,
    holdSeconds: 0.3,
    releaseSeconds: 0.7,
  },
};
