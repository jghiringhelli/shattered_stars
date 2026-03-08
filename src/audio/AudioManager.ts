/**
 * Audio Manager
 *
 * Handles all sound effects and music playback:
 * - Procedurally generated sound effects using Web Audio API
 * - Dynamic music intensity based on combat state
 * - Spatial audio for positional sounds
 * - Volume controls and settings persistence
 */

import Phaser from 'phaser';

// Sound effect types
export type SoundEffectType =
  | 'laser_fire'
  | 'missile_launch'
  | 'explosion_small'
  | 'explosion_medium'
  | 'explosion_large'
  | 'shield_hit'
  | 'hull_hit'
  | 'engine_thrust'
  | 'ui_click'
  | 'ui_hover'
  | 'ui_select'
  | 'ui_back'
  | 'powerup'
  | 'alert'
  | 'victory'
  | 'defeat';

// Music tracks
export type MusicTrack =
  | 'menu_theme'
  | 'combat_low'
  | 'combat_medium'
  | 'combat_high'
  | 'victory_sting'
  | 'defeat_sting';

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
      this.context = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

      // Create gain nodes for volume control
      this.masterGain = this.context.createGain();
      this.masterGain.connect(this.context.destination);
      this.masterGain.gain.value = this.settings.muted ? 0 : this.settings.masterVolume;

      this.sfxGain = this.context.createGain();
      this.sfxGain.connect(this.masterGain);
      this.sfxGain.gain.value = this.settings.sfxVolume;

      this.musicGain = this.context.createGain();
      this.musicGain.connect(this.masterGain);
      this.musicGain.gain.value = this.settings.musicVolume;

      console.log('[AudioManager] Initialized');
    } catch (e) {
      console.warn('[AudioManager] Failed to initialize:', e);
    }
  }

  /**
   * Resume audio context if suspended (required for Chrome autoplay policy)
   */
  async resume(): Promise<void> {
    if (this.context?.state === 'suspended') {
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
    volume: number = 1
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
        type: 'sawtooth',
        attack: 0.01,
        decay: 0.05,
        sustain: 0.3,
        release: 0.09,
        detune: -200,
        filterFreq: 2000,
        filterType: 'lowpass',
      },
      missile_launch: {
        frequency: 200,
        duration: 0.4,
        type: 'sawtooth',
        attack: 0.02,
        decay: 0.1,
        sustain: 0.5,
        release: 0.28,
        filterFreq: 800,
        filterType: 'lowpass',
      },
      explosion_small: {
        frequency: 100,
        duration: 0.3,
        type: 'sawtooth',
        attack: 0.01,
        decay: 0.15,
        sustain: 0.2,
        release: 0.14,
        filterFreq: 400,
        filterType: 'lowpass',
      },
      explosion_medium: {
        frequency: 60,
        duration: 0.5,
        type: 'sawtooth',
        attack: 0.01,
        decay: 0.2,
        sustain: 0.3,
        release: 0.29,
        filterFreq: 300,
        filterType: 'lowpass',
      },
      explosion_large: {
        frequency: 40,
        duration: 0.8,
        type: 'sawtooth',
        attack: 0.01,
        decay: 0.3,
        sustain: 0.4,
        release: 0.49,
        filterFreq: 200,
        filterType: 'lowpass',
      },
      shield_hit: {
        frequency: 1200,
        duration: 0.2,
        type: 'sine',
        attack: 0.01,
        decay: 0.05,
        sustain: 0.5,
        release: 0.14,
        detune: 100,
        filterFreq: 3000,
        filterType: 'bandpass',
      },
      hull_hit: {
        frequency: 150,
        duration: 0.15,
        type: 'square',
        attack: 0.01,
        decay: 0.05,
        sustain: 0.3,
        release: 0.09,
        filterFreq: 500,
        filterType: 'lowpass',
      },
      engine_thrust: {
        frequency: 80,
        duration: 0.1,
        type: 'sawtooth',
        attack: 0.02,
        decay: 0.03,
        sustain: 0.7,
        release: 0.05,
        filterFreq: 300,
        filterType: 'lowpass',
      },
      ui_click: {
        frequency: 600,
        duration: 0.08,
        type: 'sine',
        attack: 0.005,
        decay: 0.02,
        sustain: 0.3,
        release: 0.055,
      },
      ui_hover: {
        frequency: 800,
        duration: 0.05,
        type: 'sine',
        attack: 0.005,
        decay: 0.015,
        sustain: 0.2,
        release: 0.03,
      },
      ui_select: {
        frequency: 1000,
        duration: 0.12,
        type: 'sine',
        attack: 0.01,
        decay: 0.03,
        sustain: 0.5,
        release: 0.08,
      },
      ui_back: {
        frequency: 400,
        duration: 0.1,
        type: 'sine',
        attack: 0.005,
        decay: 0.02,
        sustain: 0.3,
        release: 0.075,
      },
      powerup: {
        frequency: 440,
        duration: 0.3,
        type: 'sine',
        attack: 0.02,
        decay: 0.1,
        sustain: 0.5,
        release: 0.18,
        detune: 500, // Creates arpeggio effect
      },
      alert: {
        frequency: 880,
        duration: 0.2,
        type: 'square',
        attack: 0.01,
        decay: 0.05,
        sustain: 0.5,
        release: 0.14,
      },
      victory: {
        frequency: 523.25, // C5
        duration: 0.8,
        type: 'sine',
        attack: 0.05,
        decay: 0.2,
        sustain: 0.6,
        release: 0.55,
      },
      defeat: {
        frequency: 196, // G3
        duration: 1.0,
        type: 'sine',
        attack: 0.05,
        decay: 0.3,
        sustain: 0.4,
        release: 0.65,
      },
    };

    return params[type] || null;
  }

  private playProceduralSound(params: SoundParams, volume: number, pan: number): void {
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
    envelope.gain.linearRampToValueAtTime(volume * params.sustain, now + params.attack + params.decay);
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
    if (params.type === 'sawtooth' && params.frequency < 150) {
      this.addNoiseLayer(params.duration, volume * 0.5, pan);
    }
  }

  private addNoiseLayer(duration: number, volume: number, pan: number): void {
    if (!this.context || !this.sfxGain) return;

    const now = this.context.currentTime;

    // Create noise buffer
    const bufferSize = this.context.sampleRate * duration;
    const noiseBuffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.context.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    // Filter the noise
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
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
   * Play background music
   */
  playMusic(track: MusicTrack): void {
    if (!this.context || !this.musicGain) return;

    // Stop current music
    this.stopMusic();

    // Generate procedural music based on track
    this.currentMusicTrack = track;
    this.startProceduralMusic(track);
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

  private getMusicParams(track: MusicTrack): { baseFreq: number; tempo: number; intensity: number } | null {
    const params: Record<MusicTrack, { baseFreq: number; tempo: number; intensity: number }> = {
      menu_theme: { baseFreq: 110, tempo: 0.5, intensity: 0.3 },
      combat_low: { baseFreq: 82.41, tempo: 0.8, intensity: 0.4 },
      combat_medium: { baseFreq: 110, tempo: 1.0, intensity: 0.6 },
      combat_high: { baseFreq: 146.83, tempo: 1.2, intensity: 0.8 },
      victory_sting: { baseFreq: 261.63, tempo: 0.5, intensity: 0.7 },
      defeat_sting: { baseFreq: 98, tempo: 0.3, intensity: 0.5 },
    };

    return params[track] || null;
  }

  private playMusicLoop(params: { baseFreq: number; tempo: number; intensity: number }): void {
    if (!this.context || !this.musicGain || !this.currentMusicTrack) return;

    const now = this.context.currentTime;
    const beatDuration = 60 / (params.tempo * 120); // BPM

    // Play a simple ambient chord
    const notes = [params.baseFreq, params.baseFreq * 1.5, params.baseFreq * 2];

    notes.forEach((freq, i) => {
      const osc = this.context!.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = this.context!.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.1 * params.intensity, now + 0.5);
      gain.gain.linearRampToValueAtTime(0.05 * params.intensity, now + beatDuration * 4 - 0.5);
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
      this.masterGain.gain.value = this.settings.muted ? 0 : this.settings.masterVolume;
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
      const saved = localStorage.getItem('audio_settings');
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('[AudioManager] Failed to load settings');
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem('audio_settings', JSON.stringify(this.settings));
    } catch (e) {
      console.warn('[AudioManager] Failed to save settings');
    }
  }
}

// Singleton export
export const audioManager = AudioManager.getInstance();
