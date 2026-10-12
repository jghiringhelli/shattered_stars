/**
 * StateHasher — FNV-1a (32-bit) over a stream of simulation values, the
 * fingerprint clients exchange to detect a desync. Floats are quantized
 * first (default 1/1024 px or rad): bit-identical engines agree exactly, and
 * tiny cross-engine libm differences are only flagged once they grow past
 * the quantum. Pure.
 */

/** FNV-1a 32-bit offset basis. */
const FNV_OFFSET = 0x811c9dc5;
/** FNV-1a 32-bit prime. */
const FNV_PRIME = 0x01000193;
/** Default float quantum: 1/1024. */
export const DEFAULT_HASH_QUANTUM = 1 / 1024;
/** Stand-in for non-finite floats (NaN / ±Infinity hash alike, distinct from numbers). */
const NON_FINITE_MARKER = 0x7fc00000;

export class StateHasher {
  private value = FNV_OFFSET;

  /** @param quantum - Float resolution kept by addFloat. */
  constructor(private readonly quantum: number = DEFAULT_HASH_QUANTUM) {}

  /** @param n - A 32-bit integer (wider values are folded). @returns this. */
  addInt(n: number): this {
    const low = n | 0;
    const high = Math.floor(n / 0x1_0000_0000) | 0;
    this.mixWord(low);
    if (high !== 0 && high !== -1) this.mixWord(high);
    return this;
  }

  /** @param x - A float, quantized before hashing. @returns this. */
  addFloat(x: number): this {
    if (!Number.isFinite(x)) return this.addInt(NON_FINITE_MARKER);
    return this.addInt(Math.round(x / this.quantum));
  }

  /** @param flag - A boolean. @returns this. */
  addBool(flag: boolean): this {
    return this.addInt(flag ? 1 : 0);
  }

  /** @param text - A string (UTF-16 code units). @returns this. */
  addString(text: string): this {
    this.addInt(text.length);
    for (let i = 0; i < text.length; i++)
      this.mixByte(text.charCodeAt(i) & 0xff).mixByte(text.charCodeAt(i) >>> 8);
    return this;
  }

  /** @returns The unsigned 32-bit digest. */
  digest(): number {
    return this.value >>> 0;
  }

  private mixWord(word: number): void {
    this.mixByte(word & 0xff)
      .mixByte((word >>> 8) & 0xff)
      .mixByte((word >>> 16) & 0xff)
      .mixByte((word >>> 24) & 0xff);
  }

  private mixByte(byte: number): this {
    this.value = Math.imul(this.value ^ byte, FNV_PRIME);
    return this;
  }
}
