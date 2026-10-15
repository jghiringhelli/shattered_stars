import { describe, expect, it } from "vitest";
import { buildImportGraph, findCycles } from "../../../scripts/lib/importCycles";

const file = (path: string, text: string) => ({ path, text });

describe("importCycles", () => {
  it("finds_a_two_file_cycle", () => {
    const graph = buildImportGraph([
      file("src/a.ts", 'import { b } from "./b";'),
      file("src/b.ts", 'import { a } from "./a";'),
    ]);
    expect(findCycles(graph)).toEqual([["src/a.ts", "src/b.ts"]]);
  });

  it("finds_a_cycle_through_an_index_file_and_parent_paths", () => {
    const graph = buildImportGraph([
      file("src/x/index.ts", 'export * from "./y";'),
      file("src/x/y.ts", 'import { z } from "../z";'),
      file("src/z.ts", 'import { q } from "./x";'),
    ]);
    expect(findCycles(graph)).toHaveLength(1);
  });

  it("reports_a_self_import", () => {
    const graph = buildImportGraph([file("src/a.ts", 'import "./a";')]);
    expect(findCycles(graph)).toEqual([["src/a.ts"]]);
  });

  it("accepts_an_acyclic_graph", () => {
    const graph = buildImportGraph([
      file("src/a.ts", 'import { b } from "./b";'),
      file("src/b.ts", "export const b = 1;"),
    ]);
    expect(findCycles(graph)).toEqual([]);
  });

  it("ignores_type_only_imports", () => {
    const graph = buildImportGraph([
      file("src/a.ts", 'import { b } from "./b";'),
      file("src/b.ts", 'import type { A } from "./a";'),
    ]);
    expect(findCycles(graph)).toEqual([]);
  });

  it("ignores_dynamic_imports_and_packages", () => {
    const graph = buildImportGraph([
      file("src/a.ts", 'import "phaser"; const l = () => import("./b");'),
      file("src/b.ts", 'import { a } from "./a";'),
    ]);
    expect(findCycles(graph)).toEqual([]);
  });
});
