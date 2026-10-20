/**
 * Procedural stinger cues: short synthesized phrases layered over whatever
 * music is playing, for story beats that have no recorded track. Pure data
 * plus one tiny Web Audio scheduler — no files, no network, no Phaser.
 *
 * - `broadcast_click`: the Nexus Broadcast — two relay clicks, then a thin
 *   carrier tone beating against a slightly sharp twin.
 * - `tide_motif`: the three falling notes of the Tide (a Phrygian cell, G–F–E).
 */

import type { MusicTrack } from "./musicTracks";

/** Ids of the procedural stinger cues (a subset of {@link MusicTrack}). */
export type CueTrack = "broadcast_click" | "tide_motif";

/** One scheduled tone of a cue. */
export interface CueNote {
  readonly atSeconds: number;
  readonly frequency: number;
  readonly durationSeconds: number;
  /** Peak gain on the music bus, in (0, 1]. */
  readonly peakGain: number;
  readonly wave: OscillatorType;
}

/** The cue ids, in catalog order. */
export const CUE_TRACKS: readonly CueTrack[] = [
  "broadcast_click",
  "tide_motif",
];

/** Gap between two notes of the Tide motif (seconds). */
const TIDE_NOTE_GAP_SECONDS = 1.2;
/** Sounding length of each Tide note (seconds). */
const TIDE_NOTE_SECONDS = 2.2;
/** Length of one relay click (seconds). */
const CLICK_SECONDS = 0.03;
/** Detune of the Broadcast carrier's twin (frequency ratio). */
const CARRIER_BEAT_RATIO = 1.012;

/** The Tide's three notes, falling: G3, F3, E3 (Hz). */
const TIDE_FREQUENCIES: readonly number[] = [196, 174.61, 164.81];

const BROADCAST_CARRIER_HZ = 1318.51;

const CUE_NOTES: Readonly<Record<CueTrack, readonly CueNote[]>> = {
  broadcast_click: [
    {
      atSeconds: 0,
      frequency: 3136,
      durationSeconds: CLICK_SECONDS,
      peakGain: 0.3,
      wave: "square",
    },
    {
      atSeconds: 0.18,
      frequency: 3136,
      durationSeconds: CLICK_SECONDS,
      peakGain: 0.3,
      wave: "square",
    },
    {
      atSeconds: 0.4,
      frequency: BROADCAST_CARRIER_HZ,
      durationSeconds: 1.4,
      peakGain: 0.1,
      wave: "sine",
    },
    {
      atSeconds: 0.4,
      frequency: BROADCAST_CARRIER_HZ * CARRIER_BEAT_RATIO,
      durationSeconds: 1.4,
      peakGain: 0.08,
      wave: "sine",
    },
  ],
  tide_motif: TIDE_FREQUENCIES.map(
    (frequency, index): CueNote => ({
      atSeconds: index * TIDE_NOTE_GAP_SECONDS,
      frequency,
      durationSeconds: TIDE_NOTE_SECONDS,
      peakGain: 0.22,
      wave: "sine",
    }),
  ),
};

/**
 * @param track - Any music track id.
 * @returns Whether it is a procedural stinger cue.
 */
export function isCueTrack(track: MusicTrack): track is CueTrack & MusicTrack {
  return (CUE_TRACKS as readonly string[]).includes(track);
}

/**
 * @param track - Any music track id.
 * @returns The cue's notes in time order; empty for a non-cue track.
 */
export function cueNotes(track: MusicTrack): readonly CueNote[] {
  return isCueTrack(track) ? CUE_NOTES[track] : [];
}

/**
 * @param notes - A cue's notes.
 * @returns Seconds until the last note has finished.
 */
export function cueLengthSeconds(notes: readonly CueNote[]): number {
  return notes.reduce(
    (end, note) => Math.max(end, note.atSeconds + note.durationSeconds),
    0,
  );
}

/** The slice of AudioContext the cue scheduler needs. */
export interface CueAudioContext {
  readonly currentTime: number;
  createOscillator(): OscillatorNode;
  createGain(): GainNode;
}

/**
 * Schedules a cue's notes (attack, exponential-style release) on a bus.
 *
 * @param context - Audio context.
 * @param destination - Node the notes connect to (the music bus).
 * @param notes - The cue's notes.
 */
export function scheduleCue(
  context: CueAudioContext,
  destination: AudioNode,
  notes: readonly CueNote[],
): void {
  const now = context.currentTime;
  for (const note of notes) {
    const start = now + note.atSeconds;
    const end = start + note.durationSeconds;
    const attack = Math.min(0.01, note.durationSeconds / 4);
    const osc = context.createOscillator();
    osc.type = note.wave;
    osc.frequency.value = note.frequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(note.peakGain, start + attack);
    gain.gain.linearRampToValueAtTime(0, end);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(start);
    osc.stop(end);
  }
}
