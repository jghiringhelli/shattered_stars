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
import { VOICE_DESIGNS, type SoundEffectType } from "./SoundDesign";
import { playVoice } from "./SfxVoice";
import { attenuationAt, panAt } from "./spatial";

export type { SoundEffectType };

// Music tracks — generic legacy names + Harmonia faction IDs.
// Any string listed here can be passed to playMusic(). If a matching mp3
// exists under public/assets/audio/music/<id>.mp3 it will be loaded and
// looped; otherwise falls back to the procedural synth (legacy names only).
export type MusicTrack =
  | "menu_theme"
  | "combat_low"
  | "combat_medium"
  | "combat_high"
  | "victory_sting"
  | "defeat_sting"
  // Harmonia faction tracks — see docs/SUNO_PROMPTS.md
  | "menu_main"
  | "heg_tactical"
  | "heg_combat"
  | "heg_boss"
  | "heg_victory"
  | "heg_defeat"
  | "conf_tactical"
  | "conf_combat"
  | "conf_boss"
  | "conf_victory"
  | "conf_defeat"
  | "syn_tactical"
  | "syn_combat"
  | "syn_boss"
  | "syn_awakening"
  | "cors_tactical"
  | "cors_combat"
  | "cors_boss"
  | "cors_heist"
  | "asc_tactical"
  | "asc_combat"
  | "asc_boss"
  | "asc_prophecy"
  | "void_encounter"
  | "void_nexus_discovery"
  | "void_campaign_credits"
  | "victory_common"
  | "defeat_common"
  | "arcade_action"
  | "tactical_planning"
  | "survival_ramp"
  | "campaign_briefing";

/** Battle music phase — maps to Harmonia's per-faction track naming (`<prefix>_<phase>`). */
export type BattleMusicPhase = "tactical" | "combat" | "boss";

/** Harmonia track-id prefix per faction — factions without one fall back to the generic combat_* tracks. */
const FACTION_MUSIC_PREFIX: Partial<Record<FactionId, string>> = {
  terran_hegemony: "heg",
  free_confederation: "conf",
  synthetic_collective: "syn",
  void_corsairs: "cors",
  ascendant_empire: "asc",
};

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
  private currentMusicTrack: MusicTrack | null = null;
  /** Pending next bar of the procedural loop, so stopMusic can cancel it. */
  private musicLoopTimer: ReturnType<typeof setTimeout> | null = null;
  private combatIntensity: number = 0; // 0-1

  // Sound effect cache
  // File-based music buffers cached after first fetch/decode
  private musicBuffers: Map<string, AudioBuffer> = new Map();
  // Tracks known to have no mp3 file (avoid retrying failed fetches)
  private missingMusicFiles: Set<string> = new Set();
  // Last time each effect was triggered, for the retrigger guard
  private lastPlayedAtMs: Map<SoundEffectType, number> = new Map();
  private listener: ListenerPose = { ...DEFAULT_LISTENER };
  // Fires on real-file playback so the caller can toggle procedural fallbacks
  private static readonly MUSIC_URL_PREFIX = "assets/audio/music/";

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
   * Play background music. Attempts to load an mp3 from
   * public/assets/audio/music/<track>.mp3 first; on 404 or decode failure,
   * falls back to the procedural synth (only for legacy generic names).
   */
  playMusic(track: MusicTrack): void {
    if (!this.context || !this.musicGain) return;

    this.stopMusic();
    this.currentMusicTrack = track;

    if (this.missingMusicFiles.has(track)) {
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
   * Play the faction-flavored battle track for the given phase (tactical/
   * combat/boss), falling back to the generic combat_* tracks for factions
   * without their own Harmonia catalogue entry.
   */
  playFactionMusic(
    factionId: FactionId,
    phase: BattleMusicPhase = "combat",
  ): void {
    const prefix = FACTION_MUSIC_PREFIX[factionId];
    if (!prefix) {
      const fallback: MusicTrack =
        phase === "boss"
          ? "combat_high"
          : phase === "tactical"
            ? "combat_low"
            : "combat_medium";
      this.playMusic(fallback);
      return;
    }
    this.playMusic(`${prefix}_${phase}` as MusicTrack);
  }

  /**
   * Play the faction-flavored victory/defeat stinger, falling back to the
   * shared common sting for factions without their own.
   */
  playFactionStinger(
    factionId: FactionId,
    outcome: "victory" | "defeat",
  ): void {
    const prefix = FACTION_MUSIC_PREFIX[factionId];
    if (prefix === "heg" || prefix === "conf") {
      this.playMusic(`${prefix}_${outcome}` as MusicTrack);
      return;
    }
    this.playMusic(outcome === "victory" ? "victory_common" : "defeat_common");
  }

  private loadAndPlayMusicFile(track: MusicTrack): void {
    const url = `${AudioManager.MUSIC_URL_PREFIX}${track}.mp3`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buf) => this.context!.decodeAudioData(buf))
      .then((audioBuf) => {
        this.musicBuffers.set(track, audioBuf);
        // Only play if this is still the current track (user may have switched)
        if (this.currentMusicTrack === track) {
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
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.musicGain);
    source.start(0);
    this.currentMusicSource = source;
    this.currentMusicTrack = track;
  }

  /**
   * Stop current music
   */
  stopMusic(): void {
    // Cancel the pending bar before anything else. Without this the callback
    // survives the switch, sees the *new* track in currentMusicTrack, and
    // keeps rescheduling the old track's chord alongside it forever.
    if (this.musicLoopTimer !== null) {
      clearTimeout(this.musicLoopTimer);
      this.musicLoopTimer = null;
    }
    if (this.currentMusicSource) {
      try {
        this.currentMusicSource.stop();
      } catch (e) {
        // Ignore if already stopped
      }
      this.currentMusicSource = null;
    }
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
      const saved = localStorage.getItem("audio_settings");
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn("[AudioManager] Failed to load settings");
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem("audio_settings", JSON.stringify(this.settings));
    } catch (e) {
      console.warn("[AudioManager] Failed to save settings");
    }
  }
}

// Singleton export
export const audioManager = AudioManager.getInstance();
