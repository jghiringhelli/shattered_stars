/**
 * Turns a `VoiceSpec` into a live Web Audio graph.
 *
 * The signal path per voice:
 *
 *   oscillator(s) ─┐
 *                  ├─→ filter ─→ envelope ─→ panner ─→ destination
 *   noise ─────────┘
 *
 * Both the oscillator pitch and the filter cutoff sweep across the sound's
 * lifetime; that movement is what separates a laser from a buzzer.
 */

import { voiceDuration, type VoiceSpec } from "./SoundDesign";

/**
 * Length of the shared white-noise buffer.
 *
 * Long enough that the longest effect never reaches the end, so no effect
 * hears the buffer restart. One buffer is generated per audio context and
 * reused by every voice — regenerating it per explosion was a multi-hundred-
 * kilobyte allocation in the middle of a fight.
 */
export const NOISE_BUFFER_SECONDS = 2;

/** Floor for exponential ramps, which cannot legally reach zero. */
const SILENCE = 0.0001;

/** Noise plays back slightly detuned per voice so repeats do not sound identical. */
const NOISE_RATE_JITTER = 0.15;

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

/**
 * The shared white-noise buffer for a context, generated on first use.
 *
 * @param context - Audio context to allocate against.
 * @returns A mono buffer of white noise.
 */
function noiseBufferFor(context: BaseAudioContext): AudioBuffer {
  const cached = noiseBuffers.get(context);
  if (cached) return cached;

  const frames = Math.floor(context.sampleRate * NOISE_BUFFER_SECONDS);
  const buffer = context.createBuffer(1, frames, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = Math.random() * 2 - 1;
  }
  noiseBuffers.set(context, buffer);
  return buffer;
}

/**
 * Sweep an audio param from one value to another across the voice.
 *
 * @param param - Param to sweep.
 * @param from - Value at the start.
 * @param to - Value at the end.
 * @param startTime - When the sweep begins.
 * @param duration - How long the sweep takes.
 */
function sweep(
  param: AudioParam,
  from: number,
  to: number,
  startTime: number,
  duration: number,
): void {
  param.setValueAtTime(from, startTime);
  param.exponentialRampToValueAtTime(
    Math.max(to, SILENCE),
    startTime + duration,
  );
}

/**
 * Build the attack/hold/release envelope for a voice.
 *
 * The release is exponential because a linear fade to zero is audible as a
 * click at the end of every shot.
 *
 * @param context - Audio context.
 * @param spec - Voice being shaped.
 * @param peak - Envelope peak amplitude.
 * @param startTime - When the voice begins.
 * @returns The envelope gain node.
 */
function buildEnvelope(
  context: AudioContext,
  spec: VoiceSpec,
  peak: number,
  startTime: number,
): GainNode {
  const envelope = context.createGain();
  const sustainUntil = startTime + spec.attackSeconds + spec.holdSeconds;
  envelope.gain.setValueAtTime(SILENCE, startTime);
  envelope.gain.linearRampToValueAtTime(peak, startTime + spec.attackSeconds);
  envelope.gain.setValueAtTime(peak, sustainUntil);
  envelope.gain.exponentialRampToValueAtTime(
    SILENCE,
    sustainUntil + spec.releaseSeconds,
  );
  return envelope;
}

/**
 * Attach the tonal half of a voice: one oscillator, or two when detuned.
 *
 * @param context - Audio context.
 * @param spec - Voice being built.
 * @param target - Node the oscillators feed.
 * @param startTime - When the voice begins.
 * @param duration - Voice length in seconds.
 */
function addOscillators(
  context: AudioContext,
  spec: VoiceSpec,
  target: AudioNode,
  startTime: number,
  duration: number,
): void {
  const level = context.createGain();
  level.gain.value = 1 - spec.noiseMix;
  level.connect(target);

  const detunes = spec.detuneCents === 0 ? [0] : [0, spec.detuneCents];
  for (const cents of detunes) {
    const oscillator = context.createOscillator();
    oscillator.type = spec.oscillator;
    oscillator.detune.value = cents;
    sweep(
      oscillator.frequency,
      spec.startFrequency,
      spec.endFrequency,
      startTime,
      duration,
    );
    oscillator.connect(level);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  }
}

/**
 * Attach the noise half of a voice.
 *
 * @param context - Audio context.
 * @param spec - Voice being built.
 * @param target - Node the noise feeds.
 * @param startTime - When the voice begins.
 * @param duration - Voice length in seconds.
 */
function addNoise(
  context: AudioContext,
  spec: VoiceSpec,
  target: AudioNode,
  startTime: number,
  duration: number,
): void {
  const level = context.createGain();
  level.gain.value = spec.noiseMix;
  level.connect(target);

  const source = context.createBufferSource();
  source.buffer = noiseBufferFor(context);
  source.playbackRate.value = 1 + (Math.random() * 2 - 1) * NOISE_RATE_JITTER;
  source.connect(level);
  source.start(startTime);
  source.stop(startTime + duration);
}

/**
 * Play one sound effect voice.
 *
 * @param context - Audio context to play into.
 * @param destination - Node to route the finished voice at, normally an SFX bus.
 * @param spec - Sound design to render.
 * @param volume - Peak amplitude in [0, 1]. Zero builds no graph at all.
 * @param pan - Stereo placement in [-1, 1].
 */
export function playVoice(
  context: AudioContext,
  destination: AudioNode,
  spec: VoiceSpec,
  volume: number,
  pan: number,
): void {
  if (volume <= 0) return;

  const startTime = context.currentTime;
  const duration = voiceDuration(spec);

  const panner = context.createStereoPanner();
  panner.pan.value = pan;
  panner.connect(destination);

  const envelope = buildEnvelope(context, spec, volume, startTime);
  envelope.connect(panner);

  const filter = context.createBiquadFilter();
  filter.type = spec.filterType;
  filter.Q.value = spec.resonance;
  sweep(
    filter.frequency,
    spec.filterStartHz,
    spec.filterEndHz,
    startTime,
    duration,
  );
  filter.connect(envelope);

  if (spec.noiseMix < 1) {
    addOscillators(context, spec, filter, startTime, duration);
  }
  if (spec.noiseMix > 0) {
    addNoise(context, spec, filter, startTime, duration);
  }
}
