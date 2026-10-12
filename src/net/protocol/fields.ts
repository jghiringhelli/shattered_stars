/**
 * Small field readers for validating untrusted JSON. Each returns the typed
 * value or `undefined` when the field is missing or malformed. Pure.
 */

/** A plain JSON object. */
export type JsonRecord = Readonly<Record<string, unknown>>;

/**
 * @param value - Anything.
 * @returns Whether it is a non-array object.
 */
export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param value - Anything.
 * @param maxLength - Longest accepted string.
 * @returns The string, or undefined when not a string or too long.
 */
export function readString(
  value: unknown,
  maxLength: number,
): string | undefined {
  return typeof value === "string" && value.length <= maxLength
    ? value
    : undefined;
}

/**
 * @param value - Anything.
 * @param min - Smallest accepted value.
 * @param max - Largest accepted value.
 * @returns The integer, or undefined when not a safe integer in range.
 */
export function readInt(
  value: unknown,
  min: number,
  max: number,
): number | undefined {
  if (typeof value !== "number" || !Number.isSafeInteger(value))
    return undefined;
  return value >= min && value <= max ? value : undefined;
}

/**
 * @param value - Anything.
 * @param min - Smallest accepted value.
 * @param max - Largest accepted value.
 * @returns The finite number, or undefined.
 */
export function readNumber(
  value: unknown,
  min: number,
  max: number,
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value >= min && value <= max ? value : undefined;
}

/**
 * @param value - Anything.
 * @returns The boolean, or undefined.
 */
export function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

/**
 * @param value - Anything.
 * @param maxLength - Longest accepted array.
 * @param readItem - Reads one item (undefined rejects the whole array).
 * @returns The typed array, or undefined.
 */
export function readArray<T>(
  value: unknown,
  maxLength: number,
  readItem: (item: unknown) => T | undefined,
): T[] | undefined {
  if (!Array.isArray(value) || value.length > maxLength) return undefined;
  const items: T[] = [];
  for (const raw of value) {
    const item = readItem(raw);
    if (item === undefined) return undefined;
    items.push(item);
  }
  return items;
}

/**
 * Display names: trimmed, control characters stripped, length-capped.
 *
 * @param value - Anything.
 * @param maxLength - Longest kept name.
 * @returns The cleaned name, or undefined when empty / not a string.
 */
export function readDisplayText(
  value: unknown,
  maxLength: number,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxLength);
  return cleaned.length > 0 ? cleaned : undefined;
}
