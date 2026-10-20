/**
 * Audio Manager
 *
 * Handles all sound effects and music playback:
 * - Procedurally generated sound effects using Web Audio API
 * - Dynamic music intensity based on combat state
 * - Spatial audio for positional sounds
 * - Volume controls and settings persistence
 */

import type { FactionId } from "../config";
import { browserStore } from "../systems/keyValueStore";
import { VOICE_DESIGNS, type SoundEffectType } from "./SoundDesign";
import { playVoice } from "./SfxVoice";
import { attenuationAt, panAt } from "./spatial";
import {
  MENU_MUSIC_TRACK,
  MUSIC_CROSSFADE_SECONDS,
  SUBMENU_MUSIC_TRACK,
  factionMusicTrack,
  isOneShotTrack,
  isRecordedTrack,
  musicFileUrl,
  pickMusicFormat,
  resolveMusicTrack,
  type BattleMusicMode,
  type BattleMusicPhase,
  type MusicFormat,
  type MusicTrack,
} from "./musicTracks";
import { MusicDirector } from "./MusicDirector";
import { cueNotes, isCueTrack, scheduleCue } from "./musicCues";

/** Browser codec probe; Node/test environments without a DOM get mp3. */
function probeAudioSupport(mime: string): string {
  if (typeof document === "undefined") return "";
  return document.createElement("audio").canPlayType(mime);
}

export type { SoundEffectType };
// Track ids + catalog live in musicTracks.ts; re-exported for existing importers.
export type { MusicTrack, BattleMusicPhase, BattleMusicMode };

interface AudioSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  /** Menu/UI feedback bus (hover, press, back), independent of SFX. */
  uiVolume: number;
  muted: boolean;
}

/** Where the listener sits in world space, for positional playback. */
interface ListenerPose {
  x: number;
  y: number;
  /** Distance past which a source is silent. */
  audibleRadius: number;
  /** Offset at which a source reaches maximum stereo panning. */
  panHalfWidth: number;
}

/**
 * Default listening field, sized for the arcade battle viewport.
 *
 * A source roughly one screen away is already well down in the mix, which is
 * what makes a distant firefight read as distant.
 */
const DEFAULT_LISTENER: ListenerPose = {
  x: 0,
  y: 0,
  audibleRadius: 1800,
  panHalfWidth: 640,
};

/**
 * Shortest gap between two plays of the same effect.
 *
 * A dozen ships firing on the same frame used to stack a dozen identical
 * voices, which sums into a single loud smear rather than reading as gunfire.
 * Retriggers inside this window are dropped.
 */
const RETRIGGER_GAP_MS = 45;

export class AudioManager {
  private static instance: AudioManager | null = null;
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private uiGain: GainNode | null = null;

  private settings: AudioSettings = {
    masterVolume: 0.7,
    sfxVolume: 0.8,
    musicVolume: 0.5,
    uiVolume: 0.8,
    muted: false,
  };

  // Current music state
  private currentMusicSource: AudioBufferSourceNode | null = null;
  /** Per-track fader under the music bus, ramped for crossfades. */
  private currentMusicFader: GainNode | null = null;
  private currentMusicTrack: MusicTrack | null = null;
  /** Pending next bar of the procedural loop, so stopMusic can cancel it. */
  private musicLoopTimer: ReturnType<typeof setTimeout> | null = null;
  private combatIntensity: number = 0; // 0-1

  // Sound effect cache
  // File-based music buffers cached after first fetch/decode
  private musicBuffers: Map<string, AudioBuffer> = new Map();
  // Recorded tracks whose fetch/decode failed (avoid retrying)
  private missingMusicFiles: Set<string> = new Set();
  // Last time each effect was triggered, for the retrigger guard
  private lastPlayedAtMs: Map<SoundEffectType, number> = new Map();
  private listener: ListenerPose = { ...DEFAULT_LISTENER };
  /** Encoded format this browser decodes, chosen on initialize(). */
  private musicFormat: MusicFormat = "mp3";
  /** Battle track, skirmish rotation and the tension layer. */
  private readonly musicDirector = new MusicDirector((track) =>
    this.startTrack(track),
  );

  private constructor() {
    this.loadSettings();
  }

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /**
   * Initialize the audio context (must be called after user interaction)
   */
  initialize(): void {
    if (this.context) return;

    try {
      this.context = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();

      // Create gain nodes for volume control
      this.masterGain = this.context.createGain();
      this.masterGain.connect(this.context.destination);
      this.masterGain.gain.value = this.settings.muted
        ? 0
        : this.settings.masterVolume;

      this.sfxGain = this.context.createGain();
      this.sfxGain.connect(this.masterGain);
      this.sfxGain.gain.value = this.settings.sfxVolume;

      this.musicGain = this.context.createGain();
      this.musicGain.connect(this.masterGain);
      this.musicGain.gain.value = this.settings.musicVolume;

      this.uiGain = this.context.createGain();
      this.uiGain.connect(this.masterGain);
      this.uiGain.gain.value = this.settings.uiVolume;

      this.musicFormat = pickMusicFormat(probeAudioSupport);
      console.log("[AudioManager] Initialized");
    } catch (e) {
      console.warn("[AudioManager] Failed to initialize:", e);
    }
  }

  /**
   * Resume audio context if suspended (required for Chrome autoplay policy)
   */
  async resume(): Promise<void> {
    if (this.context?.state === "suspended") {
      await this.context.resume();
    }
  }

  // ==========================================
  // SOUND EFFECTS
  // ==========================================

  /**
   * Move the listener, so positional sounds know what "near" means.
   *
   * Scenes call this as the camera or player ship moves; everything played
   * through `playSoundAt` is mixed relative to this point.
   *
   * @param x - Listener world X.
   * @param y - Listener world Y.
   */
  setListener(x: number, y: number): void {
    this.listener.x = x;
    this.listener.y = y;
  }

  /**
   * Resize the listening field.
   *
   * @param audibleRadius - Distance past which a source is silent.
   * @param panHalfWidth - Offset at which a source is panned as wide as it goes.
   */
  setListeningField(audibleRadius: number, panHalfWidth: number): void {
    this.listener.audibleRadius = audibleRadius;
    this.listener.panHalfWidth = panHalfWidth;
  }

  /**
   * Play a sound effect with no positional treatment.
   *
   * @param type - Which effect to play.
   * @param volume - Peak amplitude in [0, 1].
   * @param pan - Stereo placement in [-1, 1].
   */
  playSound(type: SoundEffectType, volume: number = 1, pan: number = 0): void {
    if (!this.context || !this.sfxGain || this.settings.muted) return;
    if (volume <= 0) return;
    if (this.isRetriggeringTooFast(type)) return;

    const design = VOICE_DESIGNS[type];
    if (!design) return;

    playVoice(this.context, this.sfxGain, design, volume, pan);
  }

  /**
   * Play a menu/UI feedback sound on the UI bus (its own volume slider), so
   * menu clicks stay audible when combat SFX are turned down and vice versa.
   *
   * @param type - A `ui_*` effect.
   * @param volume - Peak amplitude in [0, 1].
   */
  playUiSound(type: SoundEffectType, volume: number = 1): void {
    if (!this.context || !this.uiGain || this.settings.muted) return;
    if (volume <= 0 || this.isRetriggeringTooFast(type)) return;
    const design = VOICE_DESIGNS[type];
    if (design) playVoice(this.context, this.uiGain, design, volume, 0);
  }

  /**
   * Play a sound effect positioned in the world.
   *
   * Volume falls off with distance from the listener and the sound is placed
   * in the stereo field by which side of the listener it happened on, so a
   * firefight across the map reads as distant instead of sitting on top of
   * the player's own guns.
   *
   * @param type - Which effect to play.
   * @param x - Source world X.
   * @param y - Source world Y.
   * @param volume - Peak amplitude before distance attenuation, in [0, 1].
   */
  playSoundAt(
    type: SoundEffectType,
    x: number,
    y: number,
    volume: number = 1,
  ): void {
    const offsetX = x - this.listener.x;
    const offsetY = y - this.listener.y;
    const distance = Math.hypot(offsetX, offsetY);
    const attenuation = attenuationAt(distance, this.listener.audibleRadius);
    if (attenuation <= 0) return;

    this.playSound(
      type,
      volume * attenuation,
      panAt(offsetX, this.listener.panHalfWidth),
    );
  }

  /**
   * Whether this effect fired too recently to be worth triggering again.
   *
   * @param type - Effect being requested.
   * @returns True when the request should be dropped.
   */
  private isRetriggeringTooFast(type: SoundEffectType): boolean {
    const nowMs = this.context!.currentTime * 1000;
    const previousMs = this.lastPlayedAtMs.get(type);
    if (previousMs !== undefined && nowMs - previousMs < RETRIGGER_GAP_MS) {
      return true;
    }
    this.lastPlayedAtMs.set(type, nowMs);
    return false;
  }

  // ==========================================
  // MUSIC
  // ==========================================

  /**
   * Play background music, crossfading from whatever is playing.
   *
   * Recorded tracks (musicTracks.ts catalog) load public/assets/audio/music/
   * <track>.ogg|.mp3; everything else — and any recorded track whose load
   * fails — uses the procedural synth without a network request. Requesting
   * the track that is already playing is a no-op, so menus that re-enter
   * keep their music running.
   *
   * @param requested - Track id (aliases such as menu_theme resolve).
   */
  playMusic(requested: MusicTrack): void {
    if (isCueTrack(requested)) {
      this.playCue(requested);
      return;
    }
    this.musicDirector.context(requested);
  }

  /** Layer a procedural stinger over the music; the playing track is kept. */
  private playCue(cue: MusicTrack): void {
    if (!this.context || !this.musicGain) return;
    scheduleCue(this.context, this.musicGain, cueNotes(cue));
  }

  /** Crossfade to a track (the director's player). */
  private startTrack(requested: MusicTrack): void {
    if (!this.context || !this.musicGain) return;
    const track = resolveMusicTrack(requested);
    if (track === this.currentMusicTrack) return;

    this.stopMusic();
    this.currentMusicTrack = track;

    if (!isRecordedTrack(track) || this.missingMusicFiles.has(track)) {
      this.startProceduralMusic(track);
      return;
    }

    const cached = this.musicBuffers.get(track);
    if (cached) {
      this.playBufferLooped(cached, track);
      return;
    }

    this.loadAndPlayMusicFile(track);
  }

  /**
   * Legacy phase API: tactical → the faction's theme (campaign hub, faction
   * screens), combat → skirmish battle music, boss → boss battle music.
   *
   * @param factionId - Faction whose identity the music carries.
   * @param phase - Game context.
   */
  playFactionMusic(
    factionId: FactionId,
    phase: BattleMusicPhase = "combat",
  ): void {
    if (phase === "tactical") {
      this.playMusic(factionMusicTrack(factionId, phase));
      return;
    }
    this.playBattleMusic(phase === "boss" ? "boss" : "skirmish", factionId);
  }

  /**
   * Start a battle's music: Dogfight Vector (dogfight), Dreadnought (boss),
   * Threading the Belt (hazard) or skirmish (faction combat / rotating
   * Combat Skirmish takes). Resets the tension layer.
   *
   * @param mode - Kind of fight.
   * @param factionId - The player's faction.
   */
  playBattleMusic(mode: BattleMusicMode, factionId: FactionId): void {
    this.musicDirector.battle(mode, factionId);
  }

  /**
   * Feed the flagship's hull fraction (each frame is fine); low hull raises
   * the Shields Low layer, recovery returns to the battle track.
   *
   * @param hullFraction - Flagship hull / max hull.
   */
  reportPlayerHull(hullFraction: number): void {
    this.musicDirector.reportPlayerHull(hullFraction);
  }

  /**
   * @param active - Whether a boss is in its final phase (raises Shields Low).
   */
  setBossFinalPhase(active: boolean): void {
    this.musicDirector.setBossFinalPhase(active);
  }

  /** Play the main theme used by the main menu. */
  playMenuMusic(): void {
    this.playMusic(MENU_MUSIC_TRACK);
  }

  /** Play the ambience used by setup screens and submenus. */
  playSubmenuMusic(): void {
    this.playMusic(SUBMENU_MUSIC_TRACK);
  }

  /**
   * Play the victory / defeat stinger (once, not looped).
   *
   * @param _factionId - Kept for call-site compatibility; stingers are shared.
   * @param outcome - Battle result.
   */
  playFactionStinger(
    _factionId: FactionId,
    outcome: "victory" | "defeat",
  ): void {
    this.playMusic(outcome === "victory" ? "victory_common" : "defeat_common");
  }

  private loadAndPlayMusicFile(track: MusicTrack): void {
    const url = musicFileUrl(track, this.musicFormat);
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buf) => this.context!.decodeAudioData(buf))
      .then((audioBuf) => {
        this.musicBuffers.set(track, audioBuf);
        // Only play if this is still the current track (user may have switched)
        // and an earlier in-flight load for it has not already started it.
        if (this.currentMusicTrack === track && !this.currentMusicSource) {
          this.playBufferLooped(audioBuf, track);
        }
      })
      .catch(() => {
        this.missingMusicFiles.add(track);
        if (this.currentMusicTrack === track) {
          this.startProceduralMusic(track);
        }
      });
  }

  private playBufferLooped(buffer: AudioBuffer, track: MusicTrack): void {
    if (!this.context || !this.musicGain) return;
    const now = this.context.currentTime;
    const fader = this.context.createGain();
    fader.gain.setValueAtTime(0, now);
    fader.gain.linearRampToValueAtTime(1, now + MUSIC_CROSSFADE_SECONDS);
    fader.connect(this.musicGain);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = !isOneShotTrack(track);
    source.connect(fader);
    source.start(0);
    this.currentMusicSource = source;
    this.currentMusicFader = fader;
    this.currentMusicTrack = track;
  }

  /** Ramp the playing recorded track to silence, then stop it. */
  private fadeOutCurrentSource(): void {
    const source = this.currentMusicSource;
    const fader = this.currentMusicFader;
    this.currentMusicSource = null;
    this.currentMusicFader = null;
    if (!source) return;
    const now = this.context?.currentTime ?? 0;
    try {
      if (fader) {
        fader.gain.setValueAtTime(fader.gain.value, now);
        fader.gain.linearRampToValueAtTime(0, now + MUSIC_CROSSFADE_SECONDS);
      }
      source.stop(fader ? now + MUSIC_CROSSFADE_SECONDS : now);
    } catch (e) {
      // Ignore if already stopped
    }
  }

  /**
   * Stop current music (recorded tracks fade out over the crossfade time).
   */
  stopMusic(): void {
    // Cancel the pending bar before anything else. Without this the callback
    // survives the switch, sees the *new* track in currentMusicTrack, and
    // keeps rescheduling the old track's chord alongside it forever.
    if (this.musicLoopTimer !== null) {
      clearTimeout(this.musicLoopTimer);
      this.musicLoopTimer = null;
    }
    this.fadeOutCurrentSource();
    this.currentMusicTrack = null;
  }

  /**
   * Set combat intensity for dynamic music (0-1)
   */
  setCombatIntensity(intensity: number): void {
    this.combatIntensity = Math.max(0, Math.min(1, intensity));
  }

  private startProceduralMusic(track: MusicTrack): void {
    if (!this.context || !this.musicGain) return;

    // Generate a simple ambient loop based on track type
    const params = this.getMusicParams(track);
    if (!params) return;

    this.playMusicLoop(params);
  }

  private getMusicParams(
    track: MusicTrack,
  ): { baseFreq: number; tempo: number; intensity: number } | null {
    const params: Partial<
      Record<MusicTrack, { baseFreq: number; tempo: number; intensity: number }>
    > = {
      menu_theme: { baseFreq: 110, tempo: 0.5, intensity: 0.3 },
      menu_main: { baseFreq: 110, tempo: 0.5, intensity: 0.3 },
      // Fallback voices for recorded tracks whose file fails to load.
      menu_ambient: { baseFreq: 98, tempo: 0.4, intensity: 0.25 },
      long_haul: { baseFreq: 110, tempo: 0.6, intensity: 0.3 },
      skirmish_combat_a: { baseFreq: 110, tempo: 1.0, intensity: 0.6 },
      skirmish_combat_b: { baseFreq: 116.54, tempo: 1.05, intensity: 0.6 },
      dogfight_combat: { baseFreq: 123.47, tempo: 1.2, intensity: 0.7 },
      boss_dreadnought: { baseFreq: 146.83, tempo: 1.2, intensity: 0.8 },
      asteroid_belt: { baseFreq: 92.5, tempo: 0.9, intensity: 0.45 },
      tension_alert: { baseFreq: 103.83, tempo: 1.3, intensity: 0.7 },
      combat_low: { baseFreq: 82.41, tempo: 0.8, intensity: 0.4 },
      combat_medium: { baseFreq: 110, tempo: 1.0, intensity: 0.6 },
      combat_high: { baseFreq: 146.83, tempo: 1.2, intensity: 0.8 },
      victory_sting: { baseFreq: 261.63, tempo: 0.5, intensity: 0.7 },
      defeat_sting: { baseFreq: 98, tempo: 0.3, intensity: 0.5 },
      // Faction battle tracks — procedural stand-ins until Harmonia mp3s are
      // generated; each faction gets a distinct base pitch/tempo character
      // (disciplined/measured, scrappy/fast, mechanical, aggressive, ethereal).
      heg_tactical: { baseFreq: 110, tempo: 0.6, intensity: 0.35 },
      heg_combat: { baseFreq: 130.81, tempo: 1.0, intensity: 0.65 },
      heg_boss: { baseFreq: 164.81, tempo: 1.2, intensity: 0.85 },
      heg_victory: { baseFreq: 261.63, tempo: 0.5, intensity: 0.7 },
      heg_defeat: { baseFreq: 98, tempo: 0.3, intensity: 0.5 },
      conf_tactical: { baseFreq: 98, tempo: 0.7, intensity: 0.35 },
      conf_combat: { baseFreq: 116.54, tempo: 1.15, intensity: 0.65 },
      conf_boss: { baseFreq: 146.83, tempo: 1.3, intensity: 0.85 },
      conf_victory: { baseFreq: 246.94, tempo: 0.55, intensity: 0.7 },
      conf_defeat: { baseFreq: 92, tempo: 0.3, intensity: 0.5 },
      syn_tactical: { baseFreq: 220, tempo: 0.9, intensity: 0.3 },
      syn_combat: { baseFreq: 220, tempo: 1.3, intensity: 0.7 },
      syn_boss: { baseFreq: 277.18, tempo: 1.4, intensity: 0.9 },
      syn_awakening: { baseFreq: 196, tempo: 0.4, intensity: 0.4 },
      cors_tactical: { baseFreq: 87.31, tempo: 0.8, intensity: 0.4 },
      cors_combat: { baseFreq: 103.83, tempo: 1.25, intensity: 0.75 },
      cors_boss: { baseFreq: 130.81, tempo: 1.45, intensity: 0.9 },
      cors_heist: { baseFreq: 116.54, tempo: 1.0, intensity: 0.5 },
      asc_tactical: { baseFreq: 174.61, tempo: 0.4, intensity: 0.25 },
      asc_combat: { baseFreq: 196, tempo: 0.7, intensity: 0.55 },
      asc_boss: { baseFreq: 220, tempo: 0.85, intensity: 0.75 },
      asc_prophecy: { baseFreq: 174.61, tempo: 0.35, intensity: 0.3 },
      victory_common: { baseFreq: 261.63, tempo: 0.5, intensity: 0.7 },
      defeat_common: { baseFreq: 98, tempo: 0.3, intensity: 0.5 },
    };

    return params[track] ?? null;
  }

  private playMusicLoop(params: {
    baseFreq: number;
    tempo: number;
    intensity: number;
  }): void {
    if (!this.context || !this.musicGain || !this.currentMusicTrack) return;

    const now = this.context.currentTime;
    const beatDuration = 60 / (params.tempo * 120); // BPM
    const barSeconds = beatDuration * 4;

    // Play a simple ambient chord
    const notes = [params.baseFreq, params.baseFreq * 1.5, params.baseFreq * 2];

    notes.forEach((freq, i) => {
      const osc = this.context!.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;

      const gain = this.context!.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.1 * params.intensity, now + 0.5);
      gain.gain.linearRampToValueAtTime(
        0.05 * params.intensity,
        now + barSeconds - 0.5,
      );
      gain.gain.linearRampToValueAtTime(0, now + barSeconds);

      osc.connect(gain);
      gain.connect(this.musicGain!);

      osc.start(now + i * 0.1);
      osc.stop(now + barSeconds);
    });

    // Schedule the next bar exactly at the boundary. Firing 100ms early used
    // to overlap each bar with the one before it, and the two copies of the
    // same chord beat against each other.
    this.musicLoopTimer = setTimeout(() => {
      this.musicLoopTimer = null;
      if (this.currentMusicTrack) this.playMusicLoop(params);
    }, barSeconds * 1000);
  }

  // ==========================================
  // VOLUME CONTROLS
  // ==========================================

  setMasterVolume(volume: number): void {
    this.settings.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && !this.settings.muted) {
      this.masterGain.gain.value = this.settings.masterVolume;
    }
    this.saveSettings();
  }

  setSfxVolume(volume: number): void {
    this.settings.sfxVolume = Math.max(0, Math.min(1, volume));
    if (this.sfxGain) {
      this.sfxGain.gain.value = this.settings.sfxVolume;
    }
    this.saveSettings();
  }

  setMusicVolume(volume: number): void {
    this.settings.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicGain) {
      this.musicGain.gain.value = this.settings.musicVolume;
    }
    this.saveSettings();
  }

  /**
   * @param volume - UI feedback bus level in [0, 1].
   */
  setUiVolume(volume: number): void {
    this.settings.uiVolume = Math.max(0, Math.min(1, volume));
    if (this.uiGain) this.uiGain.gain.value = this.settings.uiVolume;
    this.saveSettings();
  }

  /** @returns UI feedback bus level in [0, 1]. */
  getUiVolume(): number {
    return this.settings.uiVolume;
  }

  toggleMute(): void {
    this.settings.muted = !this.settings.muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.settings.muted
        ? 0
        : this.settings.masterVolume;
    }
    this.saveSettings();
  }

  isMuted(): boolean {
    return this.settings.muted;
  }

  getMasterVolume(): number {
    return this.settings.masterVolume;
  }

  getSfxVolume(): number {
    return this.settings.sfxVolume;
  }

  getMusicVolume(): number {
    return this.settings.musicVolume;
  }

  // ==========================================
  // SETTINGS PERSISTENCE
  // ==========================================

  private loadSettings(): void {
    try {
      const saved = browserStore().getItem("audio_settings");
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn("[AudioManager] Failed to load settings");
    }
  }

  private saveSettings(): void {
    try {
      browserStore().setItem("audio_settings", JSON.stringify(this.settings));
    } catch (e) {
      console.warn("[AudioManager] Failed to save settings");
    }
  }
}

// Singleton export
export const audioManager = AudioManager.getInstance();
