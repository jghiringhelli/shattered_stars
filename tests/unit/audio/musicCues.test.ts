/**
 * Procedural stinger cues (Broadcast click-tone, Tide motif): catalog ids,
 * note data and the scheduler. They are procedural-only (no files, no
 * fetches), layered over the playing music and never alias another track.
 */

import { describe, expect, it } from "vitest";
import {
  CUE_TRACKS,
  cueLengthSeconds,
  cueNotes,
  isCueTrack,
  scheduleCue,
  type CueAudioContext,
} from "../../../src/audio/musicCues";
import {
  RECORDED_MUSIC_TRACKS,
  TRACK_ALIASES,
  isOneShotTrack,
  isRecordedTrack,
  resolveMusicTrack,
} from "../../../src/audio/musicTracks";
import { campaignStingerTrack } from "../../../src/audio/musicContexts";

describe("cue catalog", () => {
  it.each(CUE_TRACKS)("%s is procedural-only and has no alias", (track) => {
    expect(isRecordedTrack(track)).toBe(false);
    expect(RECORDED_MUSIC_TRACKS.has(track)).toBe(false);
    expect(TRACK_ALIASES[track]).toBeUndefined();
    expect(resolveMusicTrack(track)).toBe(track);
    expect(isOneShotTrack(track)).toBe(false);
  });

  it("recognises cue tracks and nothing else", () => {
    expect(isCueTrack("tide_motif")).toBe(true);
    expect(isCueTrack("broadcast_click")).toBe(true);
    expect(isCueTrack("tension_alert")).toBe(false);
  });

  it("maps campaign cue names to cue tracks and leaves the rest alone", () => {
    expect(campaignStingerTrack("broadcast")).toBe("broadcast_click");
    expect(campaignStingerTrack("tide_motif")).toBe("tide_motif");
    for (const plain of ["tactical", "combat", "boss", "victory", "tension"])
      expect(campaignStingerTrack(plain)).toBeNull();
  });
});

describe("tide motif", () => {
  const notes = cueNotes("tide_motif");

  it("is exactly three notes", () => {
    expect(notes).toHaveLength(3);
  });

  it("falls: each note lower than the last, ending on a semitone step", () => {
    const [a, b, c] = notes.map((n) => n.frequency);
    expect(a!).toBeGreaterThan(b!);
    expect(b!).toBeGreaterThan(c!);
    const semitones = 12 * Math.log2(b! / c!);
    expect(semitones).toBeCloseTo(1, 1);
  });

  it("plays the notes one after another", () => {
    const starts = notes.map((n) => n.atSeconds);
    expect(starts).toEqual([...starts].sort((x, y) => x - y));
    expect(new Set(starts).size).toBe(3);
  });
});

describe("broadcast click-tone", () => {
  const notes = cueNotes("broadcast_click");

  it("opens with short square clicks before a sustained carrier", () => {
    const clicks = notes.filter((n) => n.wave === "square");
    const tones = notes.filter((n) => n.wave === "sine");
    expect(clicks.length).toBeGreaterThanOrEqual(2);
    expect(tones.length).toBeGreaterThanOrEqual(1);
    for (const click of clicks) expect(click.durationSeconds).toBeLessThan(0.1);
    const lastClick = Math.max(...clicks.map((c) => c.atSeconds));
    for (const tone of tones) {
      expect(tone.atSeconds).toBeGreaterThan(lastClick);
      expect(tone.durationSeconds).toBeGreaterThan(1);
    }
  });
});

describe("every cue", () => {
  it.each(CUE_TRACKS)("%s stays quiet and short", (track) => {
    const notes = cueNotes(track);
    expect(notes.length).toBeGreaterThan(0);
    for (const note of notes) {
      expect(note.peakGain).toBeGreaterThan(0);
      expect(note.peakGain).toBeLessThanOrEqual(0.35);
      expect(note.frequency).toBeGreaterThan(0);
    }
    expect(cueLengthSeconds(notes)).toBeLessThan(6);
  });

  it("is empty for a track that is not a cue", () => {
    expect(cueNotes("tension_alert")).toEqual([]);
  });
});

describe("scheduleCue", () => {
  it("starts and stops one oscillator per note on the given bus", () => {
    const starts: number[] = [];
    const stops: number[] = [];
    const connected: unknown[] = [];
    const param = () => ({
      value: 0,
      setValueAtTime: () => undefined,
      linearRampToValueAtTime: () => undefined,
    });
    const bus = { id: "bus" } as unknown as AudioNode;
    const context: CueAudioContext = {
      currentTime: 10,
      createOscillator: () =>
        ({
          type: "sine",
          frequency: param(),
          connect: () => undefined,
          start: (t: number) => starts.push(t),
          stop: (t: number) => stops.push(t),
        }) as unknown as OscillatorNode,
      createGain: () =>
        ({
          gain: param(),
          connect: (node: unknown) => connected.push(node),
        }) as unknown as GainNode,
    };
    const notes = cueNotes("tide_motif");
    scheduleCue(context, bus, notes);
    expect(starts).toEqual(notes.map((n) => 10 + n.atSeconds));
    expect(stops).toEqual(
      notes.map((n) => 10 + n.atSeconds + n.durationSeconds),
    );
    expect(connected).toEqual([bus, bus, bus]);
  });
});
