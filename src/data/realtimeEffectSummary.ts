/**
 * realtimeEffectSummary — reads a real-time effect (pilot ability or upgrade
 * card) as short, player-facing phrases: "+1 laser dmg from behind the
 * target", "boost recharges 40% faster", "projects faction aura".
 *
 * Derived from the effect knobs (src/core/CombatModifiers.ts), never authored,
 * so the text can never disagree with what the effect actually does in
 * combat. Pure: no state, no Phaser.
 */

import type { CombatModifiers, RealtimeEffect } from "../core/CombatModifiers";

/** Phrases one knob's value, or null when the value is neutral. */
type KnobPhrase = (value: number) => string | null;

/** Decimal places kept when printing fractional rates (0.15 shields/s). */
const RATE_DECIMALS = 2;

/** Separator between phrases in a one-line summary. */
const PHRASE_SEPARATOR = ", ";

/**
 * A number without float noise: 0.15000000000000002 → "0.15".
 * @param value - The number to print.
 * @returns Its shortest readable form.
 */
function formatNumber(value: number): string {
  return String(Number(value.toFixed(RATE_DECIMALS)));
}

/**
 * A whole percentage of a fraction: 0.4 → "40".
 * @param fraction - The fraction (0.4 = 40%).
 * @returns The rounded percentage, as text.
 */
function percent(fraction: number): string {
  return String(Math.round(Math.abs(fraction) * 100));
}

/**
 * Phrase builder for an additive knob: silent at 0.
 * @param phrase - Builds the text from a non-zero value.
 * @returns The knob's phrase function.
 */
function additive(phrase: (value: number) => string): KnobPhrase {
  return (value) => (value === 0 ? null : phrase(value));
}

/**
 * "+1" / "-1" for a signed amount.
 * @param value - The amount.
 * @returns The amount with its sign.
 */
function signed(value: number): string {
  return `${value > 0 ? "+" : "-"}${formatNumber(Math.abs(value))}`;
}

/**
 * Phrase builder for a laser-damage knob with an optional condition.
 * @param condition - When the bonus applies ("" for always).
 * @returns The knob's phrase function.
 */
function laserBonus(condition: string): KnobPhrase {
  const suffix = condition ? ` ${condition}` : "";
  return additive((value) => `${signed(value)} laser dmg${suffix}`);
}

/**
 * Phrase builder for a multiplicative knob: silent at 1.
 * @param phrase - Builds the text from a percentage and "less"/"more".
 * @returns The knob's phrase function.
 */
function scaled(
  phrase: (amount: string, lessOrMore: "less" | "more") => string,
): KnobPhrase {
  return (value) =>
    value === 1
      ? null
      : phrase(percent(1 - value), value < 1 ? "less" : "more");
}

/**
 * Phrase builder for a recharge-time multiplier: shorter reads "faster".
 * @param subject - What recharges ("boost recharges", "turret fires").
 * @returns The knob's phrase function.
 */
function recharge(subject: string): KnobPhrase {
  return scaled(
    (amount, lessOrMore) =>
      `${subject} ${amount}% ${lessOrMore === "less" ? "faster" : "slower"}`,
  );
}

/**
 * How every knob reads, in the order phrases are listed: damage first, then
 * defence, stress, mobility, weapons, support and the rest. Typed over every
 * CombatModifiers key so a new knob cannot ship without its phrase.
 */
const KNOB_PHRASES: Readonly<Record<keyof CombatModifiers, KnobPhrase>> = {
  laserDamageBonus: laserBonus(""),
  calmLaserDamageBonus: laserBonus("while unstressed"),
  closeRangeLaserBonus: laserBonus("at range 1"),
  rearArcLaserBonus: laserBonus("from behind the target"),
  bullseyeLaserBonus: laserBonus("in the bullseye"),
  wingmanLaserBonus: laserBonus("with a wingman near"),
  stressedLaserBonus: laserBonus("while stressed"),
  damagedLaserBonus: laserBonus("once the hull is damaged"),
  killFrenzyLaserBonus: laserBonus("for a moment after a kill"),
  bonusDamageVsUnshielded: laserBonus("vs unshielded targets"),
  damageTakenMultiplier: scaled((n, dir) => `takes ${n}% ${dir} damage`),
  wingmanDamageTakenMultiplier: scaled(
    (n, dir) => `takes ${n}% ${dir} damage with a wingman near`,
  ),
  shieldRegenPerSecond: additive(
    (v) => `regenerates ${formatNumber(v)} shields/s`,
  ),
  hullRepairPerSecond: additive(
    (v) => `repairs ${formatNumber(v)} hull/s out of fire`,
  ),
  shieldsPerKill: additive((v) => `${signed(v)} shields per kill`),
  stressRateMultiplier: scaled((n, dir) => `${n}% ${dir} maneuver stress`),
  stressReliefTiers: additive(
    (v) => `maneuvers ${formatNumber(v)} tier easier on stress`,
  ),
  maxSpeedBonus: additive((v) => `${signed(v)} top speed`),
  boostCooldownMultiplier: recharge("boost recharges"),
  barrelRollCooldownMultiplier: recharge("barrel roll recharges"),
  kturnCooldownMultiplier: recharge("K-turn recharges"),
  cloakDurationBonus: additive((v) => `cloak lasts ${signed(v)}s`),
  turretCooldownMultiplier: recharge("turret fires"),
  ordnanceCooldownMultiplier: recharge("ordnance reloads"),
  ordnanceBonusCharges: additive((v) => `${signed(v)} ordnance charges`),
  homingTurnBonus: additive((v) => `homing shots steer ${signed(v)}°`),
  stressOnHit: additive(
    (v) => `laser hits add ${percent(v)}% stress to the target`,
  ),
  projectsAura: additive(() => "projects faction aura"),
  auraRadiusBonus: additive((v) => `aura radius +${percent(v)}%`),
  deathBlastDamage: additive(
    (v) => `explodes for ${formatNumber(v)} dmg when destroyed`,
  ),
};

/**
 * Every active knob of an effect as its own phrase, in a fixed order.
 *
 * @param effect - A pilot ability's or upgrade card's real-time effect.
 * @returns One phrase per non-neutral knob (empty when the effect does nothing).
 */
export function describeRealtimeEffect(effect: RealtimeEffect): string[] {
  const phrases: string[] = [];
  for (const [key, phrase] of Object.entries(KNOB_PHRASES)) {
    const raw = effect[key as keyof CombatModifiers];
    if (raw === undefined) continue;
    const text = phrase(typeof raw === "boolean" ? Number(raw) : raw);
    if (text) phrases.push(text);
  }
  return phrases;
}

/**
 * An effect as one line: its phrases joined by commas.
 *
 * @param effect - A pilot ability's or upgrade card's real-time effect.
 * @returns e.g. "+1 laser dmg from behind the target" ("" when it does nothing).
 */
export function summarizeRealtimeEffect(effect: RealtimeEffect): string {
  return describeRealtimeEffect(effect).join(PHRASE_SEPARATOR);
}
