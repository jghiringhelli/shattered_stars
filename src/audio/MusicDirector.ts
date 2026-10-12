/**
 * MusicDirector — the stateful part of music selection: which battle track
 * is up, the skirmish rotation, and the Shields Low tension layer (low hull
 * or a boss's final phase). It decides; the injected `play` callback (the
 * AudioManager's player) performs the crossfade.
 */

import type { FactionId } from "../config";
import { nextLowHullTension } from "./musicContexts";
import {
  TENSION_MUSIC_TRACK,
  battleMusicTrack,
  type BattleMusicMode,
  type MusicTrack,
} from "./musicTracks";

/** Plays (crossfades to) a track. */
export type PlayTrack = (track: MusicTrack) => void;

export class MusicDirector {
  private skirmishRotation = 0;
  /** The current battle's track; null outside battles (tension is ignored). */
  private battleTrack: MusicTrack | null = null;
  private lowHull = false;
  private bossFinalPhase = false;

  /** @param play - Player that crossfades to a track. */
  constructor(private readonly play: PlayTrack) {}

  /**
   * Start a battle's music; skirmishes alternate the Combat Skirmish takes.
   *
   * @param mode - Kind of fight.
   * @param factionId - The player's faction.
   */
  battle(mode: BattleMusicMode, factionId: FactionId): void {
    const track = battleMusicTrack(mode, factionId, this.skirmishRotation);
    if (mode === "skirmish") this.skirmishRotation += 1;
    this.battleTrack = track;
    this.lowHull = false;
    this.bossFinalPhase = false;
    this.play(track);
  }

  /**
   * Leave battle music for a non-battle context (menu, map, stinger…).
   *
   * @param track - Track for that context.
   */
  context(track: MusicTrack): void {
    this.battleTrack = null;
    this.lowHull = false;
    this.bossFinalPhase = false;
    this.play(track);
  }

  /**
   * Feed the flagship's hull each frame; low hull raises Shields Low.
   *
   * @param hullFraction - Flagship hull / max hull.
   */
  reportPlayerHull(hullFraction: number): void {
    const next = nextLowHullTension(this.lowHull, hullFraction);
    if (next === this.lowHull) return;
    this.lowHull = next;
    this.applyTension();
  }

  /**
   * A boss entered (or left) its final phase.
   *
   * @param active - Whether the final phase is on.
   */
  setBossFinalPhase(active: boolean): void {
    if (active === this.bossFinalPhase) return;
    this.bossFinalPhase = active;
    this.applyTension();
  }

  private applyTension(): void {
    if (!this.battleTrack) return;
    const tense = this.lowHull || this.bossFinalPhase;
    this.play(tense ? TENSION_MUSIC_TRACK : this.battleTrack);
  }
}
