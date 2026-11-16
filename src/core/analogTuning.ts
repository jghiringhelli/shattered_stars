/**
 * analogTuning — the experimental knobs of the analog steering engine, in one
 * typed object (the template engine never reads it). It rides on the ship's
 * capabilities (`FlightCapabilities.analogTuning`); absent = the default.
 *
 * - bankDegrees / turnDegrees: heading change per 500 ms cycle while the key is
 *   held at a speed whose dial prints a bank / a hard turn.
 * - rateScale: multiplier on both rates (lab sweep).
 * - heldTurnAfterMs: "held key flies the hard turn" variant. Where the dial
 *   prints only a bank, a key held this long (continuously, across cycles)
 *   turns at the hard-turn rate from then on, at the speed already flown (no
 *   speed cap); it counts as a hard turn for stress. null = off.
 *
 * Pure: no Phaser.
 */

/** The rate a held key reaches after {@link AnalogTuning.heldTurnAfterMs}. */
export interface HeldBoost {
  /** Continuous hold needed before the boost applies (ms). */
  readonly afterMs: number;
  /** Heading change per cycle once it applies (°). */
  readonly rateDeg: number;
}

/** The analog engine's tunables. */
export interface AnalogTuning {
  /** Heading change per cycle at a bank-only speed (°). */
  readonly bankDegrees: number;
  /** Heading change per cycle at a hard-turn speed (°). */
  readonly turnDegrees: number;
  /** Multiplier on both rates. */
  readonly rateScale: number;
  /** Hold time before a bank-only speed turns at the hard-turn rate (ms); null = never. */
  readonly heldTurnAfterMs: number | null;
}

/** The tabletop angles: a full-cycle hold flies exactly the dial's template. */
export const TABLETOP_ANALOG_TUNING: AnalogTuning = {
  bankDegrees: 45,
  turnDegrees: 90,
  rateScale: 1,
  heldTurnAfterMs: null,
};

/**
 * What an analog ship flies when its capabilities name no tuning: the best
 * setting of the movement lab's battle emulation (docs/balance/movement-lab.md).
 * It departs from the tabletop on purpose: a bank is 70° per cycle, not 45°
 * (most hulls cruise at throttle 3, where the dial prints only a bank, and 45°
 * turned too slowly to line up shots). Only the 'tabletop' preset keeps
 * "a full-cycle hold = the template".
 */
export const DEFAULT_ANALOG_TUNING: AnalogTuning = {
  bankDegrees: 70,
  turnDegrees: 90,
  rateScale: 1,
  heldTurnAfterMs: null,
};

/** Named presets of the dev override and the lab. */
export const ANALOG_PRESETS: Readonly<Record<string, AnalogTuning>> = {
  tabletop: TABLETOP_ANALOG_TUNING,
  default: DEFAULT_ANALOG_TUNING,
};

/** Accepted range of each knob. */
const LIMITS = {
  bankDegrees: [10, 120],
  turnDegrees: [30, 180],
  rateScale: [0.25, 2],
  heldTurnAfterMs: [0, 5000],
} as const;

/** A tuning that cannot be flown (out of range, bank above the hard turn). */
export class AnalogTuningError extends Error {
  /** @param message - What is wrong with which knob. */
  constructor(message: string) {
    super(message);
    this.name = "AnalogTuningError";
  }
}

/**
 * @param capabilities - A ship's capabilities (or anything carrying a tuning).
 * @returns The tuning in force: the ship's own, else the default.
 */
export function analogTuningOf(
  capabilities?: { readonly analogTuning?: AnalogTuning | undefined } | undefined,
): AnalogTuning {
  return capabilities?.analogTuning ?? DEFAULT_ANALOG_TUNING;
}

/**
 * @param tuning - A tuning.
 * @returns The same tuning; throws when a knob is out of range or the bank
 * turns faster than the hard turn.
 */
export function validateAnalogTuning(tuning: AnalogTuning): AnalogTuning {
  for (const key of ["bankDegrees", "turnDegrees", "rateScale"] as const) {
    const [low, high] = LIMITS[key];
    const value = tuning[key];
    if (!Number.isFinite(value) || value < low || value > high)
      throw new AnalogTuningError(`${key} must be within ${low}..${high}, got ${value}`);
  }
  const hold = tuning.heldTurnAfterMs;
  const [low, high] = LIMITS.heldTurnAfterMs;
  if (hold !== null && (!Number.isFinite(hold) || hold < low || hold > high))
    throw new AnalogTuningError(`heldTurnAfterMs must be null or within ${low}..${high}, got ${hold}`);
  if (tuning.bankDegrees > tuning.turnDegrees)
    throw new AnalogTuningError("bankDegrees must not exceed turnDegrees");
  return tuning;
}

/**
 * The boost a held key earns: only on a bank-only speed of a ship that prints
 * a hard turn somewhere, and never for a stressed pilot.
 *
 * @param tuning - The tuning.
 * @param eligible - Whether the speed flown is bank-only on a ship with a hard turn.
 * @param stressed - Whether the pilot is stressed.
 * @returns The boost, or null when none applies.
 */
export function heldBoostOf(
  tuning: AnalogTuning,
  eligible: boolean,
  stressed: boolean,
): HeldBoost | null {
  if (tuning.heldTurnAfterMs === null || !eligible || stressed) return null;
  return {
    afterMs: tuning.heldTurnAfterMs,
    rateDeg: tuning.turnDegrees * tuning.rateScale,
  };
}

/**
 * Parse a dev override such as `bank:60,hold:250` or `preset:tabletop,turn:80`:
 * comma-separated `key:value` pairs applied over `base` in order. Keys: preset
 * (a name of {@link ANALOG_PRESETS}), bank, turn, scale, hold (ms or `off`).
 *
 * @param text - The override text.
 * @param base - Tuning the pairs are applied to (default: the default).
 * @returns The validated tuning; throws {@link AnalogTuningError} on a bad pair.
 */
export function parseAnalogTune(
  text: string,
  base: AnalogTuning = DEFAULT_ANALOG_TUNING,
): AnalogTuning {
  let tuning = base;
  for (const pair of text.split(",").filter((part) => part.trim() !== "")) {
    const [key, value] = pair.split(":").map((part) => part.trim());
    if (key === undefined || value === undefined || value === "")
      throw new AnalogTuningError(`expected key:value, got "${pair}"`);
    tuning = applyPair(tuning, key, value);
  }
  return validateAnalogTuning(tuning);
}

/**
 * @param tuning - Tuning so far.
 * @param key - Knob name of the override text.
 * @param value - Its value text.
 * @returns The tuning with that knob set.
 */
function applyPair(tuning: AnalogTuning, key: string, value: string): AnalogTuning {
  if (key === "preset") {
    const preset = ANALOG_PRESETS[value];
    if (!preset) throw new AnalogTuningError(`unknown preset "${value}"`);
    return preset;
  }
  if (key === "hold")
    return { ...tuning, heldTurnAfterMs: value === "off" ? null : Number(value) };
  if (key === "bank") return { ...tuning, bankDegrees: Number(value) };
  if (key === "turn") return { ...tuning, turnDegrees: Number(value) };
  if (key === "scale") return { ...tuning, rateScale: Number(value) };
  throw new AnalogTuningError(`unknown knob "${key}"`);
}

/**
 * @param tuning - A tuning.
 * @returns A short label such as `bank 60 / hold 250` (scale and turn only when changed).
 */
export function formatAnalogTuning(tuning: AnalogTuning): string {
  const parts = [`bank ${tuning.bankDegrees}`];
  if (tuning.turnDegrees !== TABLETOP_ANALOG_TUNING.turnDegrees)
    parts.push(`turn ${tuning.turnDegrees}`);
  if (tuning.rateScale !== 1) parts.push(`×${tuning.rateScale}`);
  parts.push(
    tuning.heldTurnAfterMs === null ? "hold off" : `hold ${tuning.heldTurnAfterMs}`,
  );
  return parts.join(" / ");
}
