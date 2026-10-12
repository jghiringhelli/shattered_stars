/**
 * snapshotPacking — LZ77 compression of a resync snapshot into a JSON-safe
 * 64-character alphabet. StateGraph JSON repeats long runs (every bot's
 * perception history holds the same ship snapshots; record shapes and ids
 * recur everywhere), so back-references shrink it many times over and even
 * a large reinforcement battle fits the relay's snapshot cap. Tokens:
 * `0` + literal (`0`+7 bits ASCII, `1`+16 bits otherwise), or `1` + Elias-
 * gamma length + Elias-gamma distance. Pure.
 */

/** Marks packed data (and its format version). */
const PACK_PREFIX = "z2:";
/** 6-bit digits that need no escaping inside JSON. */
const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-";
const DIGIT_BITS = 6;
const DIGIT_VALUES = new Map([...ALPHABET].map((c, i) => [c, i]));
/** Shortest back-reference worth a token. */
const MIN_MATCH = 4;
/** Longest back-reference (keeps gamma codes small). */
const MAX_MATCH = 0xffff;
/** Candidates tried per position (speed vs. ratio). */
const MAX_CHAIN = 24;
const ASCII_LIMIT = 0x80;
const ASCII_BITS = 7;
const UNIT_BITS = 16;

class BitWriter {
  private readonly digits: string[] = [];
  private acc = 0;
  private filled = 0;

  write(value: number, width: number): void {
    for (let i = 0; i < width; i++) {
      this.acc |= ((value >>> i) & 1) << this.filled;
      if (++this.filled === DIGIT_BITS) this.flushDigit();
    }
  }

  /** Elias gamma (n ≥ 1): ⌊log2 n⌋ zeros, then n's bits from the top. */
  gamma(n: number): void {
    const bits = 32 - Math.clz32(n);
    this.write(0, bits - 1);
    for (let i = bits - 1; i >= 0; i--) this.write((n >>> i) & 1, 1);
  }

  finish(): string {
    if (this.filled > 0) this.flushDigit();
    return this.digits.join("");
  }

  private flushDigit(): void {
    this.digits.push(ALPHABET[this.acc]!);
    this.acc = 0;
    this.filled = 0;
  }
}

class BitReader {
  private index = 0;
  private acc = 0;
  private left = 0;

  constructor(private readonly text: string) {}

  read(width: number): number {
    let value = 0;
    for (let i = 0; i < width; i++) {
      if (this.left === 0) this.nextDigit();
      value |= (this.acc & 1) << i;
      this.acc >>>= 1;
      this.left--;
    }
    return value >>> 0;
  }

  gamma(): number {
    let zeros = 0;
    while (this.read(1) === 0) zeros++;
    let n = 1;
    for (let i = 0; i < zeros; i++) n = (n << 1) | this.read(1);
    return n;
  }

  private nextDigit(): void {
    const digit = DIGIT_VALUES.get(this.text[this.index++] ?? "");
    if (digit === undefined) throw new Error("Snapshot data is truncated");
    this.acc = digit;
    this.left = DIGIT_BITS;
  }
}

function hashAt(text: string, i: number): number {
  return (
    (text.charCodeAt(i) * 31 + text.charCodeAt(i + 1)) * 961 +
    text.charCodeAt(i + 2) * 31 +
    text.charCodeAt(i + 3)
  );
}

function longestMatch(
  text: string,
  at: number,
  chain: readonly number[] | undefined,
): { length: number; distance: number } {
  let best = { length: 0, distance: 0 };
  if (!chain) return best;
  const limit = Math.min(MAX_MATCH, text.length - at);
  for (
    let c = chain.length - 1, tries = 0;
    c >= 0 && tries < MAX_CHAIN;
    c--, tries++
  ) {
    const from = chain[c]!;
    let length = 0;
    while (length < limit && text[from + length] === text[at + length])
      length++;
    if (length > best.length) best = { length, distance: at - from };
    if (length === limit) break;
  }
  return best;
}

/**
 * @param text - Snapshot JSON.
 * @returns The packed text (prefix + 6-bit digits).
 */
export function packSnapshot(text: string): string {
  const out = new BitWriter();
  const chains = new Map<number, number[]>();
  const remember = (i: number): void => {
    if (i + MIN_MATCH > text.length) return;
    const key = hashAt(text, i);
    const chain = chains.get(key);
    if (chain) chain.push(i);
    else chains.set(key, [i]);
  };
  out.gamma(text.length + 1);
  let i = 0;
  while (i < text.length) {
    const match =
      i + MIN_MATCH <= text.length
        ? longestMatch(text, i, chains.get(hashAt(text, i)))
        : { length: 0, distance: 0 };
    if (match.length >= MIN_MATCH) {
      out.write(1, 1);
      out.gamma(match.length - MIN_MATCH + 1);
      out.gamma(match.distance);
      for (let k = 0; k < match.length; k++) remember(i + k);
      i += match.length;
      continue;
    }
    const code = text.charCodeAt(i);
    out.write(0, 1);
    writeLiteral(out, code);
    remember(i);
    i++;
  }
  return PACK_PREFIX + out.finish();
}

function writeLiteral(out: BitWriter, code: number): void {
  if (code < ASCII_LIMIT) {
    out.write(0, 1);
    out.write(code, ASCII_BITS);
    return;
  }
  out.write(1, 1);
  out.write(code, UNIT_BITS);
}

/**
 * @param packed - Text from {@link packSnapshot}.
 * @returns The snapshot JSON.
 */
export function unpackSnapshot(packed: string): string {
  if (!packed.startsWith(PACK_PREFIX))
    throw new Error("Snapshot data is not packed");
  const reader = new BitReader(packed.slice(PACK_PREFIX.length));
  const length = reader.gamma() - 1;
  const units: number[] = [];
  while (units.length < length) {
    if (reader.read(1) === 0) {
      const ascii = reader.read(1) === 0;
      units.push(reader.read(ascii ? ASCII_BITS : UNIT_BITS));
      continue;
    }
    const count = reader.gamma() + MIN_MATCH - 1;
    const distance = reader.gamma();
    const from = units.length - distance;
    if (from < 0) throw new Error("Snapshot data is corrupt");
    for (let k = 0; k < count; k++) units.push(units[from + k]!);
  }
  return decodeUnits(units);
}

function decodeUnits(units: readonly number[]): string {
  const chunk = 0x2000;
  const parts: string[] = [];
  for (let i = 0; i < units.length; i += chunk)
    parts.push(String.fromCharCode(...units.slice(i, i + chunk)));
  return parts.join("");
}
