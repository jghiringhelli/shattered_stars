/**
 * Audio Manager
 *
 * Handles all sound effects and music playback:
 * - Procedurally generated sound effects using Web Audio API
 * - Dynamic music intensity based on combat state
 * - Spatial audio for positional sounds
 * - Volume controls and settings persistence
 */

import Phaser from "phaser";
import type { FactionId } from "../config";

// Sound effect types
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
  muted: boolean;
}

// Procedural sound parameters
interface SoundParams {
  frequency: number;
  duration: number;
  type: OscillatorType;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  detune?: number;
  filterFreq?: number;
  filterType?: BiquadFilterType;
}

export class AudioManager {
  private static instance: AudioManager | null = null;
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private settings: AudioSettings = {
    masterVolume: 0.7,
    sfxVolume: 0.8,
    musicVolume: 0.5,
    muted: false,
  };

  // Current music state
  private currentMusicSource: AudioBufferSourceNode | null = null;
  private currentMusicTrack: MusicTrack | null = null;
  private combatIntensity: number = 0; // 0-1

  // Sound effect cache
  private soundBuffers: Map<SoundEffectType, AudioBuffer> = new Map();
  // File-based music buffers cached after first fetch/decode
  private musicBuffers: Map<string, AudioBuffer> = new Map();
  // Tracks known to have no mp3 file (avoid retrying failed fetches)
  private missingMusicFiles: Set<string> = new Set();
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
   * Play a sound effect
   */
  playSound(type: SoundEffectType, volume: number = 1, pan: number = 0): void {
    if (!this.context || !this.sfxGain || this.settings.muted) return;

    // Generate the sound procedurally
    const params = this.getSoundParams(type);
    if (!params) return;

    this.playProceduralSound(params, volume, pan);
  }

  /**
   * Play a positional sound effect (for spatial audio)
   */
  playSoundAt(
    type: SoundEffectType,
    x: number,
    y: number,
    listenerX: number,
    listenerY: number,
    volume: number = 1,
  ): void {
    // Calculate distance-based attenuation
    const distance = Math.sqrt((x - listenerX) ** 2 + (y - listenerY) ** 2);
    const maxDistance = 1000;
    const attenuation = Math.max(0, 1 - distance / maxDistance);

    // Calculate pan based on relative position
    const relativeX = x - listenerX;
    const pan = Math.max(-1, Math.min(1, relativeX / 500));

    this.playSound(type, volume * attenuation, pan);
  }

  private getSoundParams(type: SoundEffectType): SoundParams | null {
    const params: Record<SoundEffectType, SoundParams> = {
      laser_fire: {
        frequency: 800,
        duration: 0.15,
        type: "sawtooth",
        attack: 0.01,
        decay: 0.05,
        sustain: 0.3,
        release: 0.09,
        detune: -200,
        filterFreq: 2000,
        filterType: "lowpass",
      },
      missile_launch: {
        frequency: 200,
        duration: 0.4,
        type: "sawtooth",
        attack: 0.02,
        decay: 0.1,
        sustain: 0.5,
        release: 0.28,
        filterFreq: 800,
        filterType: "lowpass",
      },
      explosion_small: {
        frequency: 100,
        duration: 0.3,
        type: "sawtooth",
        attack: 0.01,
        decay: 0.15,
        sustain: 0.2,
        release: 0.14,
        filterFreq: 400,
        filterType: "lowpass",
      },
      explosion_medium: {
        frequency: 60,
        duration: 0.5,
        type: "sawtooth",
        attack: 0.01,
        decay: 0.2,
        sustain: 0.3,
        release: 0.29,
        filterFreq: 300,
        filterType: "lowpass",
      },
      explosion_large: {
        frequency: 40,
        duration: 0.8,
        type: "sawtooth",
        attack: 0.01,
        decay: 0.3,
        sustain: 0.4,
        release: 0.49,
        filterFreq: 200,
        filterType: "lowpass",
      },
      shield_hit: {
        frequency: 1200,
        duration: 0.2,
        type: "sine",
        attack: 0.01,
        decay: 0.05,
        sustain: 0.5,
        release: 0.14,
        detune: 100,
        filterFreq: 3000,
        filterType: "bandpass",
      },
      hull_hit: {
        frequency: 150,
        duration: 0.15,
        type: "square",
        attack: 0.01,
        decay: 0.05,
        sustain: 0.3,
        release: 0.09,
        filterFreq: 500,
        filterType: "lowpass",
      },
      engine_thrust: {
        frequency: 80,
        duration: 0.1,
        type: "sawtooth",
        attack: 0.02,
        decay: 0.03,
        sustain: 0.7,
        release: 0.05,
        filterFreq: 300,
        filterType: "lowpass",
      },
      ui_click: {
        frequency: 600,
        duration: 0.08,
        type: "sine",
        attack: 0.005,
        decay: 0.02,
        sustain: 0.3,
        release: 0.055,
      },
      ui_hover: {
        frequency: 800,
        duration: 0.05,
        type: "sine",
        attack: 0.005,
        decay: 0.015,
        sustain: 0.2,
        release: 0.03,
      },
      ui_select: {
        frequency: 1000,
        duration: 0.12,
        type: "sine",
        attack: 0.01,
        decay: 0.03,
        sustain: 0.5,
        release: 0.08,
      },
      ui_back: {
        frequency: 400,
        duration: 0.1,
        type: "sine",
        attack: 0.005,
        decay: 0.02,
        sustain: 0.3,
        release: 0.075,
      },
      powerup: {
        frequency: 440,
        duration: 0.3,
        type: "sine",
        attack: 0.02,
        decay: 0.1,
        sustain: 0.5,
        release: 0.18,
        detune: 500, // Creates arpeggio effect
      },
      alert: {
        frequency: 880,
        duration: 0.2,
        type: "square",
        attack: 0.01,
        decay: 0.05,
        sustain: 0.5,
        release: 0.14,
      },
      victory: {
        frequency: 523.25, // C5
        duration: 0.8,
        type: "sine",
        attack: 0.05,
        decay: 0.2,
        sustain: 0.6,
        release: 0.55,
      },
      defeat: {
        frequency: 196, // G3
        duration: 1.0,
        type: "sine",
        attack: 0.05,
        decay: 0.3,
        sustain: 0.4,
        release: 0.65,
      },
    };

    return params[type] || null;
  }

  private playProceduralSound(
    params: SoundParams,
    volume: number,
    pan: number,
  ): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Create oscillator
    const oscillator = this.context.createOscillator();
    oscillator.type = params.type;
    oscillator.frequency.value = params.frequency;
    if (params.detune) {
      oscillator.detune.value = params.detune;
    }

    // Create envelope
    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(volume, now + params.attack);
    envelope.gain.linearRampToValueAtTime(
      volume * params.sustain,
      now + params.attack + params.decay,
    );
    envelope.gain.linearRampToValueAtTime(0, now + params.duration);

    // Create filter if specified
    let lastNode: AudioNode = oscillator;
    if (params.filterFreq && params.filterType) {
      const filter = this.context.createBiquadFilter();
      filter.type = params.filterType;
      filter.frequency.value = params.filterFreq;
      filter.Q.value = 1;
      oscillator.connect(filter);
      lastNode = filter;
    }

    // Create panner for stereo positioning
    const panner = this.context.createStereoPanner();
    panner.pan.value = pan;

    // Connect nodes
    lastNode.connect(envelope);
    envelope.connect(panner);
    panner.connect(this.sfxGain);

    // Start and stop
    oscillator.start(now);
    oscillator.stop(now + params.duration);

    // Add noise layer for explosions
    if (params.type === "sawtooth" && params.frequency < 150) {
      this.addNoiseLayer(params.duration, volume * 0.5, pan);
    }
  }

  private addNoiseLayer(duration: number, volume: number, pan: number): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Create noise buffer
    const bufferSize = this.context.sampleRate * duration;
    const noiseBuffer = this.context.createBuffer(
      1,
      bufferSize,
      this.context.sampleRate,
    );
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.context.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    // Filter the noise
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;

    // Envelope
    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(volume, now);
    envelope.gain.exponentialRampToValueAtTime(0.01, now + duration);

    // Panner
    const panner = this.context.createStereoPanner();
    panner.pan.value = pan;

    // Connect
    noiseSource.connect(filter);
    filter.connect(envelope);
    envelope.connect(panner);
    panner.connect(this.sfxGain);

    noiseSource.start(now);
    noiseSource.stop(now + duration);
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
        now + beatDuration * 4 - 0.5,
      );
      gain.gain.linearRampToValueAtTime(0, now + beatDuration * 4);

      osc.connect(gain);
      gain.connect(this.musicGain!);

      osc.start(now + i * 0.1);
      osc.stop(now + beatDuration * 4);
    });

    // Schedule next loop
    const scheduleNext = () => {
      if (this.currentMusicTrack) {
        this.playMusicLoop(params);
      }
    };

    setTimeout(scheduleNext, beatDuration * 4 * 1000 - 100);
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
