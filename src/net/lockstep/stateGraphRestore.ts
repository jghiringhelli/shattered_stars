/**
 * stateGraphRestore — puts a captured graph (stateGraphCapture) back into
 * the live simulation:
 * - class instances, Maps and Sets are restored IN PLACE when the live graph
 *   has a counterpart of the same class at the same position (references
 *   held elsewhere stay valid: a tempo ledger shared by two systems);
 * - plain records and arrays are always rebuilt fresh, so a shared frozen
 *   default (INITIAL_STRESS...) is never written into;
 * - functions and opaque objects keep their live value; new instances get
 *   their function fields from a live instance of the same class (donor);
 * - registered constants come back by identity.
 * Pure.
 */

import {
  classTag,
  graphKeys,
  isOpaqueValue,
  isPlainRecord,
  type EncodedGraph,
  type EncodedNode,
  type EncodedValue,
  type GraphOptions,
} from "./stateGraphTypes";

/** What a restore did. */
export interface RestoreResult {
  /** The restored root (reassign the scene's fields from it). */
  readonly root: unknown;
  /** Class tags restore had to fake as plain records (no live donor, not registered). */
  readonly missingClasses: readonly string[];
}

type Indexed = Record<string, unknown>;

class GraphReader {
  readonly missing = new Set<string>();
  private readonly built = new Map<number, object>();
  private readonly donors = new Map<string, object>();

  constructor(
    private readonly graph: EncodedGraph,
    private readonly options: GraphOptions,
    live: unknown,
  ) {
    for (const cls of options.classes ?? [])
      this.donors.set(
        classTag(cls.prototype as object),
        cls.prototype as object,
      );
    this.collectDonors(live, new Set());
  }

  value(live: unknown, encoded: EncodedValue): unknown {
    if (encoded === null || typeof encoded !== "object") return encoded;
    if ("u" in encoded) return undefined;
    if ("f" in encoded) return decodeNumber(encoded.f);
    if ("o" in encoded) return live;
    if ("k" in encoded) return this.options.constants?.[encoded.k];
    const node = this.graph.nodes[encoded.r];
    if (!node) return undefined;
    return this.built.get(encoded.r) ?? this.node(live, encoded.r, node);
  }

  private node(live: unknown, id: number, node: EncodedNode): object {
    switch (node.t) {
      case "a": {
        const out: unknown[] = [];
        this.built.set(id, out);
        const liveArray = Array.isArray(live) ? live : [];
        node.v.forEach((item, i) => out.push(this.value(liveArray[i], item)));
        return out;
      }
      case "m":
        return this.map(live, id, node.e);
      case "s":
        return this.set(live, id, node.v);
      case "p":
        return this.plain(live, id, node);
      case "c":
        return this.instance(live, id, node.c, node.f);
    }
  }

  private map(
    live: unknown,
    id: number,
    entries: readonly [EncodedValue, EncodedValue][],
  ): Map<unknown, unknown> {
    const target = live instanceof Map ? live : new Map<unknown, unknown>();
    this.built.set(id, target);
    const restored = entries.map(([k, v]) => {
      const key = this.value(undefined, k);
      return [key, this.value(target.get(key), v)] as const;
    });
    target.clear();
    for (const [key, value] of restored) target.set(key, value);
    return target;
  }

  private set(
    live: unknown,
    id: number,
    items: readonly EncodedValue[],
  ): Set<unknown> {
    const target = live instanceof Set ? live : new Set<unknown>();
    this.built.set(id, target);
    const restored = items.map((item) => this.value(undefined, item));
    target.clear();
    for (const item of restored) target.add(item);
    return target;
  }

  private plain(
    live: unknown,
    id: number,
    node: Extract<EncodedNode, { t: "p" }>,
  ): object {
    const target = (node.n ? Object.create(null) : {}) as Indexed;
    this.built.set(id, target);
    const counterpart =
      live && typeof live === "object" && isPlainRecord(live)
        ? (live as Indexed)
        : null;
    for (const key of this.options.skipKeys ?? [])
      if (counterpart && key in counterpart) target[key] = counterpart[key];
    for (const [key, value] of Object.entries(node.f))
      target[key] = this.value(counterpart?.[key], value);
    return target;
  }

  private instance(
    live: unknown,
    id: number,
    tag: string,
    fields: Record<string, EncodedValue>,
  ): object {
    const reusable =
      live !== null &&
      typeof live === "object" &&
      !Object.isFrozen(live) &&
      classTag(Object.getPrototypeOf(live) as object) === tag;
    const target = (reusable ? live : this.create(tag)) as Indexed;
    this.built.set(id, target);
    for (const [key, value] of Object.entries(fields))
      target[key] = this.value(target[key], value);
    for (const key of graphKeys(target, this.options))
      if (!(key in fields) && typeof target[key] !== "function")
        delete target[key];
    return target;
  }

  private create(tag: string): object {
    const donor = this.donors.get(tag);
    if (!donor) {
      this.missing.add(tag);
      return {};
    }
    const proto = isDonorPrototype(donor)
      ? donor
      : Object.getPrototypeOf(donor);
    const fresh = Object.create(proto as object) as Indexed;
    if (!isDonorPrototype(donor))
      for (const [key, value] of Object.entries(donor))
        if (typeof value === "function") fresh[key] = value;
    return fresh;
  }

  private collectDonors(value: unknown, seen: Set<object>): void {
    if (typeof value !== "object" || value === null || seen.has(value)) return;
    if (isOpaqueValue(value, this.options)) return;
    seen.add(value);
    if (value instanceof Map) {
      for (const [k, v] of value) {
        this.collectDonors(k, seen);
        this.collectDonors(v, seen);
      }
      return;
    }
    if (value instanceof Set || Array.isArray(value)) {
      for (const item of value) this.collectDonors(item, seen);
      return;
    }
    if (!isPlainRecord(value)) {
      const tag = classTag(Object.getPrototypeOf(value) as object);
      const current = this.donors.get(tag);
      if (!current || isDonorPrototype(current)) this.donors.set(tag, value);
    }
    for (const key of graphKeys(value, this.options))
      this.collectDonors((value as Indexed)[key], seen);
  }
}

/** A registered class's prototype (no instance fields to copy). */
function isDonorPrototype(donor: object): boolean {
  return Object.prototype.hasOwnProperty.call(donor, "constructor");
}

function decodeNumber(marker: string): number {
  if (marker === "NaN") return Number.NaN;
  if (marker === "Infinity") return Number.POSITIVE_INFINITY;
  if (marker === "-Infinity") return Number.NEGATIVE_INFINITY;
  return -0;
}

/**
 * Restore a captured graph into the live one.
 *
 * @param live - The live root (same shape as the captured root).
 * @param data - JSON text from {@link captureGraph}.
 * @param options - The capture's options plus classes restore may create.
 * @returns The restored root and any classes it could not recreate.
 */
export function restoreGraph(
  live: unknown,
  data: string,
  options: GraphOptions = {},
): RestoreResult {
  const graph = JSON.parse(data) as EncodedGraph;
  const reader = new GraphReader(graph, options, live);
  const root = reader.value(live, graph.root);
  return { root, missingClasses: [...reader.missing] };
}
