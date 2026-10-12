/**
 * stateGraphCapture — serializes a simulation's object graph (plain
 * records, arrays, Maps, Sets and class instances with their private
 * fields) to JSON: shared references and cycles become node ids, functions
 * and opaque objects become "keep live" markers. Pure.
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

class GraphWriter {
  readonly nodes: EncodedNode[] = [];
  private readonly ids = new Map<object, number>();
  private readonly constantIds: ReadonlyMap<object, number>;

  constructor(private readonly options: GraphOptions) {
    this.constantIds = new Map(
      (options.constants ?? []).map((value, index) => [value, index]),
    );
  }

  value(value: unknown): EncodedValue {
    if (value === undefined) return { u: 1 };
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "string") return value;
    if (typeof value === "number") return encodeNumber(value);
    if (typeof value === "bigint" || typeof value === "symbol") return { o: 1 };
    if (isOpaqueValue(value, this.options)) return { o: 1 };
    const constant = this.constantIds.get(value as object);
    if (constant !== undefined) return { k: constant };
    return { r: this.node(value as object) };
  }

  private node(target: object): number {
    const known = this.ids.get(target);
    if (known !== undefined) return known;
    const id = this.nodes.length;
    this.ids.set(target, id);
    this.nodes.push({ t: "a", v: [] });
    this.nodes[id] = this.encodeNode(target);
    return id;
  }

  private encodeNode(target: object): EncodedNode {
    if (Array.isArray(target))
      return { t: "a", v: target.map((item) => this.value(item)) };
    if (target instanceof Map)
      return {
        t: "m",
        e: [...target.entries()].map(([k, v]) => [
          this.value(k),
          this.value(v),
        ]),
      };
    if (target instanceof Set)
      return { t: "s", v: [...target].map((item) => this.value(item)) };
    const fields = this.fields(target);
    if (isPlainRecord(target))
      return Object.getPrototypeOf(target) === null
        ? { t: "p", f: fields, n: 1 }
        : { t: "p", f: fields };
    return {
      t: "c",
      c: classTag(Object.getPrototypeOf(target) as object),
      f: fields,
    };
  }

  private fields(target: object): Record<string, EncodedValue> {
    const fields: Record<string, EncodedValue> = {};
    const record = target as Record<string, unknown>;
    for (const key of graphKeys(target, this.options))
      fields[key] = this.value(record[key]);
    return fields;
  }
}

/**
 * @param value - A number.
 * @returns It as JSON, or a marker for NaN, ±Infinity and -0.
 */
function encodeNumber(value: number): EncodedValue {
  if (Number.isNaN(value)) return { f: "NaN" };
  if (value === Number.POSITIVE_INFINITY) return { f: "Infinity" };
  if (value === Number.NEGATIVE_INFINITY) return { f: "-Infinity" };
  if (Object.is(value, -0)) return { f: "-0" };
  return value;
}

/**
 * Serialize a simulation graph.
 *
 * @param root - The graph's root (usually a plain record of the scene's
 *   simulation components).
 * @param options - Opaque objects, skipped keys, constants.
 * @returns JSON text for {@link restoreGraph}.
 */
export function captureGraph(
  root: unknown,
  options: GraphOptions = {},
): string {
  const writer = new GraphWriter(options);
  const encodedRoot = writer.value(root);
  const graph: EncodedGraph = { v: 1, root: encodedRoot, nodes: writer.nodes };
  return JSON.stringify(graph);
}
