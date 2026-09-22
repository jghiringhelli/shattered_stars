/**
 * Positional audio maths.
 *
 * Pure functions with no Web Audio dependency, so the curves that decide how
 * a distant explosion sounds can be reasoned about and tested directly.
 */

/**
 * Distance at which a source drops to roughly half amplitude.
 *
 * This is the knob that decides how "close" the mix feels. Small values make
 * the soundscape intimate — only nearby ships register; large values flatten
 * everything toward equal loudness, which is the behaviour this module exists
 * to replace.
 */
export const HALF_VOLUME_DISTANCE = 420;

/**
 * Widest stereo placement allowed, as a fraction of full left/right.
 *
 * Hard-panning a sound entirely into one ear is fatiguing across a long fight
 * and disappears completely on single-speaker setups, so sources stay slightly
 * toward the centre no matter how far off-screen they are.
 */
export const MAX_PAN = 0.75;

/**
 * How loud a source at `distance` should be relative to one on the listener.
 *
 * Two curves multiplied: an inverse rolloff, which is how sound actually
 * behaves and keeps nearby action dominant, and a linear fade to zero at the
 * audible radius, so a source crossing that boundary fades out instead of
 * being cut off mid-sound.
 *
 * @param distance - Distance from listener to source, in world units.
 * @param audibleRadius - Distance past which the source is silent.
 * @returns Amplitude multiplier in [0, 1].
 */
export function attenuationAt(distance: number, audibleRadius: number): number {
  if (audibleRadius <= 0) return 0;
  if (distance <= 0) return 1;
  if (distance >= audibleRadius) return 0;

  const inverseRolloff =
    HALF_VOLUME_DISTANCE / (HALF_VOLUME_DISTANCE + distance);
  const edgeFade = 1 - distance / audibleRadius;
  return inverseRolloff * edgeFade;
}

/**
 * Where to place a source in the stereo field.
 *
 * @param offsetX - Source X minus listener X, in world units. Negative is left.
 * @param halfWidth - Offset at which the source reaches maximum panning.
 * @returns Stereo pan in [-MAX_PAN, MAX_PAN], where 0 is centred.
 */
export function panAt(offsetX: number, halfWidth: number): number {
  if (halfWidth <= 0) return 0;
  const normalized = offsetX / halfWidth;
  return Math.max(-MAX_PAN, Math.min(MAX_PAN, normalized * MAX_PAN));
}
