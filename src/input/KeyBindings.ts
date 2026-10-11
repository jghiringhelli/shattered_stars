/**
 * KeyBindings — keyboard rebinding over DefaultBindings.
 *
 * A profile stores only overrides (intent → chord, or null = unbound); the
 * effective bindings are always `applyKeyOverrides(defaults, overrides)`, so
 * DefaultBindings stays the single default source. Two intents conflict when
 * they share a chord and a context (see RebindableIntents). Rebinding onto a
 * taken key swaps: the displaced intent takes the rebound intent's old key.
 *
 * Pure: no Phaser.
 */

import type { ActionIntent, KeyboardBinding } from "./InputTypes";
import { isKnownKey, keyLabel, keyNameFromCode } from "./KeyNames";
import { sharesContext } from "./RebindableIntents";

/** A key plus the modifiers that must be held with it. */
export interface KeyChord {
  readonly key: string;
  readonly shift?: boolean;
  readonly ctrl?: boolean;
  readonly alt?: boolean;
}

/** A profile's changes to the default keyboard bindings. */
export type KeyOverrides = Readonly<
  Partial<Record<ActionIntent, KeyChord | null>>
>;

/** Why a chord cannot be bound. */
export type ChordProblem = "reserved" | "unknown_key";

/** Keys that stay on their default intents (ESC = back / pause). */
const RESERVED_KEYS: ReadonlySet<string> = new Set(["ESC"]);

/** Result of {@link rebindIntent}. */
export interface RebindResult {
  readonly overrides: KeyOverrides;
  /** Intents that lost the key (swapped onto the old key, or unbound). */
  readonly displaced: readonly ActionIntent[];
  /** Why the chord was refused; null when applied. */
  readonly rejected: ChordProblem | null;
}

/** Two or more intents sharing a chord in a shared context. */
export interface BindingConflict {
  readonly chord: KeyChord;
  readonly intents: readonly ActionIntent[];
}

/** The fields of a DOM KeyboardEvent a chord is read from. */
export interface KeyEventLike {
  readonly keyCode: number;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
}

/**
 * Build a chord, keeping only modifiers that are set (so chords compare and
 * serialise canonically).
 *
 * @param key - Key name.
 * @param modifiers - Held modifiers.
 * @returns The canonical chord.
 */
export function makeChord(
  key: string,
  modifiers: { shift?: boolean; ctrl?: boolean; alt?: boolean } = {},
): KeyChord {
  return {
    key,
    ...(modifiers.shift ? { shift: true } : {}),
    ...(modifiers.ctrl ? { ctrl: true } : {}),
    ...(modifiers.alt ? { alt: true } : {}),
  };
}

/**
 * @param binding - A keyboard binding.
 * @returns Its chord.
 */
export function chordOf(binding: KeyboardBinding): KeyChord {
  return makeChord(binding.key, binding.modifiers ?? {});
}

/**
 * @param a - A chord.
 * @param b - Another chord.
 * @returns Whether both need the same key and the same modifiers.
 */
export function sameChord(a: KeyChord, b: KeyChord): boolean {
  return (
    a.key === b.key &&
    (a.shift ?? false) === (b.shift ?? false) &&
    (a.ctrl ?? false) === (b.ctrl ?? false) &&
    (a.alt ?? false) === (b.alt ?? false)
  );
}

function bindingFor(intent: ActionIntent, chord: KeyChord): KeyboardBinding {
  const { key, ...mods } = makeChord(chord.key, chord);
  return Object.keys(mods).length > 0
    ? { key, intent, modifiers: mods }
    : { key, intent };
}

function isReserved(binding: KeyboardBinding): boolean {
  return RESERVED_KEYS.has(binding.key);
}

/**
 * Effective bindings: each overridden intent loses its non-reserved default
 * keys and gains its override (in place of its first default binding).
 *
 * @param defaults - Default keyboard bindings.
 * @param overrides - Profile overrides.
 * @returns The bindings the keyboard adapter should use.
 */
export function applyKeyOverrides(
  defaults: readonly KeyboardBinding[],
  overrides: KeyOverrides,
): KeyboardBinding[] {
  const placed = new Set<ActionIntent>();
  const result: KeyboardBinding[] = [];
  for (const binding of defaults) {
    const override = overrides[binding.intent];
    if (override === undefined || isReserved(binding)) {
      result.push(binding);
      continue;
    }
    if (placed.has(binding.intent)) continue;
    placed.add(binding.intent);
    if (override !== null) result.push(bindingFor(binding.intent, override));
  }
  for (const [intent, chord] of Object.entries(overrides)) {
    const typed = intent as ActionIntent;
    if (chord && !placed.has(typed)) result.push(bindingFor(typed, chord));
  }
  return result;
}

/**
 * @param bindings - Effective bindings.
 * @param intent - An intent.
 * @returns The first non-reserved chord bound to it, or null.
 */
export function primaryChord(
  bindings: readonly KeyboardBinding[],
  intent: ActionIntent,
): KeyChord | null {
  const binding = bindings.find((b) => b.intent === intent && !isReserved(b));
  return binding ? chordOf(binding) : null;
}

/**
 * @param bindings - Effective bindings.
 * @param intent - The intent being bound.
 * @param chord - The chord it would take.
 * @returns Other intents on that chord that share a context with it.
 */
export function findConflicts(
  bindings: readonly KeyboardBinding[],
  intent: ActionIntent,
  chord: KeyChord,
): ActionIntent[] {
  const found: ActionIntent[] = [];
  for (const binding of bindings) {
    if (binding.intent === intent || found.includes(binding.intent)) continue;
    if (!sameChord(chordOf(binding), chord)) continue;
    if (sharesContext(intent, binding.intent)) found.push(binding.intent);
  }
  return found;
}

/**
 * @param bindings - Effective bindings.
 * @returns Every chord shared by intents that share a context.
 */
export function findAllConflicts(
  bindings: readonly KeyboardBinding[],
): BindingConflict[] {
  const conflicts: BindingConflict[] = [];
  bindings.forEach((binding, index) => {
    const chord = chordOf(binding);
    const clash = findConflicts(
      bindings.slice(index + 1),
      binding.intent,
      chord,
    );
    if (clash.length > 0)
      conflicts.push({ chord, intents: [binding.intent, ...clash] });
  });
  return conflicts;
}

/**
 * @param chord - A chord.
 * @returns "ok", or why it cannot be bound.
 */
export function validateChord(chord: KeyChord): ChordProblem | "ok" {
  if (RESERVED_KEYS.has(chord.key)) return "reserved";
  return isKnownKey(chord.key) ? "ok" : "unknown_key";
}

/**
 * Bind `intent` to `chord`; any intent that loses the chord takes the
 * rebound intent's previous key (or is unbound if that key clashes too).
 *
 * @param defaults - Default keyboard bindings.
 * @param overrides - Current profile overrides.
 * @param intent - Intent to rebind.
 * @param chord - New chord.
 * @returns New overrides and the displaced intents.
 */
export function rebindIntent(
  defaults: readonly KeyboardBinding[],
  overrides: KeyOverrides,
  intent: ActionIntent,
  chord: KeyChord,
): RebindResult {
  const problem = validateChord(chord);
  if (problem !== "ok") return { overrides, displaced: [], rejected: problem };
  const current = applyKeyOverrides(defaults, overrides);
  const oldChord = primaryChord(current, intent);
  const displaced = findConflicts(current, intent, chord);
  const next: Partial<Record<ActionIntent, KeyChord | null>> = {
    ...overrides,
    [intent]: makeChord(chord.key, chord),
  };
  for (const loser of displaced) {
    next[loser] = oldChord;
    const after = applyKeyOverrides(defaults, next);
    if (oldChord && findConflicts(after, loser, oldChord).length > 0)
      next[loser] = null;
  }
  return { overrides: next, displaced, rejected: null };
}

/**
 * @param event - A keydown event.
 * @returns The chord pressed, or null for a lone modifier / unbindable key.
 */
export function chordFromKeyEvent(event: KeyEventLike): KeyChord | null {
  const key = keyNameFromCode(event.keyCode);
  if (key === null) return null;
  return makeChord(key, {
    shift: event.shiftKey,
    ctrl: event.ctrlKey,
    alt: event.altKey,
  });
}

/**
 * @param chord - A chord, or null when unbound.
 * @returns Display text such as "Shift+Q", "↑" or "Unbound".
 */
export function chordLabel(chord: KeyChord | null): string {
  if (chord === null) return "Unbound";
  const prefix =
    (chord.ctrl ? "Ctrl+" : "") +
    (chord.alt ? "Alt+" : "") +
    (chord.shift ? "Shift+" : "");
  return prefix + keyLabel(chord.key);
}
