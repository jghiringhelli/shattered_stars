/**
 * stateGraphTypes — the wire shape of a captured simulation graph and the
 * options shared by capture and restore (see StateGraph). Pure.
 */

/** A class constructor (any arity). */
export type ClassRef = abstract new (...args: never[]) => unknown;

/** How a graph is walked. */
export interface GraphOptions {
  /** Objects kept as live references, never captured (functions always are). */
  readonly isOpaque?: (value: object) => boolean;
  /** Property names neither captured nor restored (presentation links). */
  readonly skipKeys?: ReadonlySet<string>;
  /** Classes restore may instantiate when the live graph holds none. */
  readonly classes?: readonly ClassRef[];
  /** Shared constants kept by identity (frozen defaults, neutral sheets). */
  readonly constants?: readonly object[];
}

/** A captured value: a JSON number/string/boolean/null or a tagged marker. */
export type EncodedValue =
  | number
  | string
  | boolean
  | null
  | { readonly u: 1 }
  | { readonly f: SpecialNumber }
  | { readonly r: number }
  | { readonly o: 1 }
  | { readonly k: number };

/** Numbers JSON cannot carry. */
export type SpecialNumber = "NaN" | "Infinity" | "-Infinity" | "-0";

/** One captured object. */
export type EncodedNode =
  | { readonly t: "a"; readonly v: EncodedValue[] }
  | {
      readonly t: "p";
      readonly f: Record<string, EncodedValue>;
      readonly n?: 1;
    }
  | {
      readonly t: "c";
      readonly c: string;
      readonly f: Record<string, EncodedValue>;
    }
  | { readonly t: "m"; readonly e: [EncodedValue, EncodedValue][] }
  | { readonly t: "s"; readonly v: EncodedValue[] };

/** A captured graph. */
export interface EncodedGraph {
  readonly v: 1;
  readonly root: EncodedValue;
  readonly nodes: EncodedNode[];
}

const tagCache = new WeakMap<object, string>();

/**
 * A class's identity that survives minification on both clients of one
 * build: its name plus its own method names.
 *
 * @param proto - A prototype.
 * @returns The class tag.
 */
export function classTag(proto: object): string {
  const cached = tagCache.get(proto);
  if (cached) return cached;
  const ctor = (proto as { constructor?: { name?: string } }).constructor;
  const methods = Object.getOwnPropertyNames(proto)
    .filter((name) => name !== "constructor")
    .sort()
    .join(",");
  const tag = `${ctor?.name ?? "?"}|${methods}`;
  tagCache.set(proto, tag);
  return tag;
}

/**
 * @param value - An object.
 * @returns Whether it is a plain object or array (never restored in place).
 */
export function isPlainRecord(value: object): boolean {
  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === null || proto === Object.prototype;
}

/**
 * @param value - Any value.
 * @param options - Graph options.
 * @returns Whether the value is kept live (functions, opaque objects, typed arrays).
 */
export function isOpaqueValue(value: unknown, options: GraphOptions): boolean {
  if (typeof value === "function") return true;
  if (typeof value !== "object" || value === null) return false;
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return true;
  return options.isOpaque?.(value) ?? false;
}

/**
 * @param target - An object.
 * @param options - Graph options.
 * @returns Its own enumerable string keys that the graph follows.
 */
export function graphKeys(target: object, options: GraphOptions): string[] {
  const skip = options.skipKeys;
  return Object.keys(target).filter((key) => !skip?.has(key));
}
