/**
 * KeyNames — the keys a player may bind, by their Phaser KeyCodes name.
 *
 * Phaser's keyboard plugin keys on the DOM `keyCode`, and its KeyCodes table
 * uses the same numbers; this table mirrors the subset that makes sense as a
 * game binding (modifiers on their own, lock keys and OS keys are excluded),
 * so rebinding and its validation stay pure — no Phaser import.
 */

/** A bindable key: Phaser KeyCodes name, DOM keyCode and display label. */
export interface KeyName {
  readonly name: string;
  readonly keyCode: number;
  readonly label: string;
}

const LETTER_A = 65;
const DIGIT_ZERO = 48;
const NUMPAD_ZERO = 96;
const F1 = 112;
const LETTER_COUNT = 26;
const FUNCTION_KEY_COUNT = 12;

const DIGIT_NAMES = [
  "ZERO",
  "ONE",
  "TWO",
  "THREE",
  "FOUR",
  "FIVE",
  "SIX",
  "SEVEN",
  "EIGHT",
  "NINE",
] as const;

/** Named (non letter/digit/function) keys. */
const NAMED_KEYS: readonly KeyName[] = [
  { name: "UP", keyCode: 38, label: "↑" },
  { name: "DOWN", keyCode: 40, label: "↓" },
  { name: "LEFT", keyCode: 37, label: "←" },
  { name: "RIGHT", keyCode: 39, label: "→" },
  { name: "SPACE", keyCode: 32, label: "Space" },
  { name: "TAB", keyCode: 9, label: "Tab" },
  { name: "ENTER", keyCode: 13, label: "Enter" },
  { name: "ESC", keyCode: 27, label: "Esc" },
  { name: "BACKSPACE", keyCode: 8, label: "Backspace" },
  { name: "INSERT", keyCode: 45, label: "Ins" },
  { name: "DELETE", keyCode: 46, label: "Del" },
  { name: "HOME", keyCode: 36, label: "Home" },
  { name: "END", keyCode: 35, label: "End" },
  { name: "PAGE_UP", keyCode: 33, label: "PgUp" },
  { name: "PAGE_DOWN", keyCode: 34, label: "PgDn" },
  { name: "PLUS", keyCode: 187, label: "+" },
  { name: "MINUS", keyCode: 189, label: "-" },
  { name: "COMMA", keyCode: 188, label: "," },
  { name: "PERIOD", keyCode: 190, label: "." },
  { name: "FORWARD_SLASH", keyCode: 191, label: "/" },
  { name: "BACK_SLASH", keyCode: 220, label: "\\" },
  { name: "SEMICOLON", keyCode: 186, label: ";" },
  { name: "QUOTES", keyCode: 222, label: "'" },
  { name: "BACKTICK", keyCode: 192, label: "`" },
  { name: "OPEN_BRACKET", keyCode: 219, label: "[" },
  { name: "CLOSED_BRACKET", keyCode: 221, label: "]" },
  { name: "NUMPAD_ADD", keyCode: 107, label: "Num +" },
  { name: "NUMPAD_SUBTRACT", keyCode: 109, label: "Num -" },
];

function buildKeyNames(): readonly KeyName[] {
  const letters = Array.from({ length: LETTER_COUNT }, (_, i) => {
    const char = String.fromCharCode(LETTER_A + i);
    return { name: char, keyCode: LETTER_A + i, label: char };
  });
  const digits = DIGIT_NAMES.map((name, i) => ({
    name,
    keyCode: DIGIT_ZERO + i,
    label: String(i),
  }));
  const numpad = DIGIT_NAMES.map((name, i) => ({
    name: `NUMPAD_${name}`,
    keyCode: NUMPAD_ZERO + i,
    label: `Num ${i}`,
  }));
  const functionKeys = Array.from({ length: FUNCTION_KEY_COUNT }, (_, i) => ({
    name: `F${i + 1}`,
    keyCode: F1 + i,
    label: `F${i + 1}`,
  }));
  return [...letters, ...digits, ...numpad, ...functionKeys, ...NAMED_KEYS];
}

/** Every bindable key. */
export const KEY_NAMES: readonly KeyName[] = buildKeyNames();

const BY_NAME: ReadonlyMap<string, KeyName> = new Map(
  KEY_NAMES.map((k) => [k.name, k]),
);
const BY_CODE: ReadonlyMap<number, KeyName> = new Map(
  KEY_NAMES.map((k) => [k.keyCode, k]),
);

/**
 * @param name - Phaser KeyCodes name, e.g. "Q" or "UP".
 * @returns Whether the key can be bound.
 */
export function isKnownKey(name: string): boolean {
  return BY_NAME.has(name);
}

/**
 * @param keyCode - DOM keyCode.
 * @returns The bindable key name, or null (modifier, lock key, unknown).
 */
export function keyNameFromCode(keyCode: number): string | null {
  return BY_CODE.get(keyCode)?.name ?? null;
}

/**
 * @param name - Phaser KeyCodes name.
 * @returns Its short display label ("↑", "Space", "Q"); unknown names as-is.
 */
export function keyLabel(name: string): string {
  return BY_NAME.get(name)?.label ?? name;
}
