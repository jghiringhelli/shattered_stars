/**
 * Redaction for the feedback bundle: anything that looks like a credential,
 * an e-mail address or a secret-named field is replaced before the bundle is
 * written. Pure — strings and plain JSON values in, new values out.
 */

/** Replacement text for a removed value. */
export const REDACTED = "[redacted]";
/** Longest string kept anywhere in a bundle (longer ones are cut). */
export const MAX_STRING_CHARS = 2000;
/** Deepest object nesting copied (deeper values are dropped). */
const MAX_DEPTH = 8;
/** Shortest run of key-like characters treated as an opaque secret. */
const OPAQUE_SECRET_MIN_LENGTH = 32;

/** Field names whose value is never kept, whatever it holds. */
const SENSITIVE_KEY =
  /(token|secret|passw(or)?d|passphrase|authorization|cookie|credential|api[-_]?key|private[-_]?key)/i;

/** Value patterns, most specific first. */
const SECRET_PATTERNS: readonly RegExp[] = [
  /https?:\/\/[^/\s:@]+:[^@\s]+@\S+/g,
  /eyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]{5,}/g,
  /\bgithub_pat_\w{20,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bBearer\s+[\w.~+/=-]+/gi,
  /\b(?:password|passwd|pwd|token|secret|api[-_]?key)\s*[=:]\s*\S+/gi,
  /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
  new RegExp(
    `(?=[A-Za-z0-9+/_=-]*\\d)(?=[A-Za-z0-9+/_=-]*[A-Za-z])[A-Za-z0-9+/_=-]{${OPAQUE_SECRET_MIN_LENGTH},}`,
    "g",
  ),
];

/**
 * @param text - Any string.
 * @returns The string without credential-like parts, cut to the length cap.
 */
export function redactString(text: string): string {
  let clean = text.slice(0, MAX_STRING_CHARS);
  for (const pattern of SECRET_PATTERNS)
    clean = clean.replace(pattern, REDACTED);
  return clean;
}

/**
 * @param value - A JSON-like value (never mutated).
 * @param depth - Current nesting (internal).
 * @returns A deep copy with strings redacted and secret-named fields masked.
 */
export function redactDeep(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return redactString(value);
  if (value === null || typeof value !== "object") {
    return typeof value === "function" || typeof value === "symbol"
      ? null
      : value;
  }
  if (depth >= MAX_DEPTH) return null;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, depth + 1));
  const clean: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    clean[key] = SENSITIVE_KEY.test(key)
      ? REDACTED
      : redactDeep(child, depth + 1);
  }
  return clean;
}
