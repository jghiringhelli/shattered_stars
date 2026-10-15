import { describe, expect, it } from "vitest";
import {
  buildBaseline,
  describeViolation,
  findRegressions,
  scanViolations,
  type QualityLimits,
} from "../../../scripts/lib/qualityScan";

const TIGHT: QualityLimits = { maxFileLines: 10, maxFunctionLines: 4, maxParams: 2 };

function body(lines: number): string {
  return Array.from({ length: lines }, (_, i) => `  const v${i} = ${i};`).join("\n");
}

describe("qualityScan", () => {
  it("reports_a_function_longer_than_the_limit", () => {
    const text = `export function big(): void {\n${body(5)}\n}\n`;
    const found = scanViolations("src/a.ts", text, TIGHT);
    expect(found).toEqual([
      { kind: "function-lines", key: "src/a.ts::big", value: 7, limit: 4, line: 1 },
    ]);
  });

  it("accepts_a_function_exactly_at_the_limit", () => {
    const text = `export function ok(): void {\n${body(2)}\n}\n`;
    expect(scanViolations("src/a.ts", text, TIGHT)).toEqual([]);
  });

  it("reports_too_many_parameters_and_ignores_this", () => {
    const text = "export function many(this: unknown, a: 1, b: 2, c: 3): void {}\n";
    const [violation] = scanViolations("src/a.ts", text, TIGHT);
    expect(violation).toMatchObject({ kind: "params", key: "src/a.ts::many", value: 3 });
  });

  it("names_class_methods_and_arrow_properties_with_their_container", () => {
    const text = `class Box {\n  run = (): void => {\n${body(4)}\n  };\n  go(): void {\n${body(4)}\n  }\n}\n`;
    const keys = scanViolations("src/b.ts", text, TIGHT)
      .filter((v) => v.kind === "function-lines")
      .map((v) => v.key);
    expect(keys).toEqual(["src/b.ts::Box.run", "src/b.ts::Box.go"]);
  });

  it("gives_same_named_functions_distinct_keys", () => {
    const one = `function f(): void {\n${body(4)}\n}\n`;
    const keys = scanViolations("src/c.ts", `${one}${one}`, TIGHT)
      .filter((v) => v.kind === "function-lines")
      .map((v) => v.key);
    expect(keys).toEqual(["src/c.ts::f", "src/c.ts::f#2"]);
  });

  it("reports_a_file_longer_than_the_limit", () => {
    const text = Array.from({ length: 11 }, () => "const x = 1;").join("\n");
    expect(scanViolations("src/d.ts", text, TIGHT)).toEqual([
      { kind: "file-lines", key: "src/d.ts", value: 11, limit: 10, line: 1 },
    ]);
  });

  it("does_not_count_the_trailing_newline", () => {
    const text = `${Array.from({ length: 10 }, () => "const x = 1;").join("\n")}\n`;
    expect(scanViolations("src/d.ts", text, TIGHT)).toEqual([]);
  });

  describe("ratchet", () => {
    const text = `export function big(): void {\n${body(5)}\n}\n`;
    const baseline = buildBaseline(scanViolations("src/a.ts", text, TIGHT), TIGHT);

    it("tolerates_a_recorded_violation_that_did_not_grow", () => {
      expect(findRegressions(scanViolations("src/a.ts", text, TIGHT), baseline)).toEqual([]);
    });

    it("tolerates_a_recorded_violation_that_shrank", () => {
      const shorter = `export function big(): void {\n${body(4)}\n}\n`;
      expect(findRegressions(scanViolations("src/a.ts", shorter, TIGHT), baseline)).toEqual([]);
    });

    it("fails_a_recorded_violation_that_grew", () => {
      const longer = `export function big(): void {\n${body(6)}\n}\n`;
      expect(findRegressions(scanViolations("src/a.ts", longer, TIGHT), baseline)).toHaveLength(1);
    });

    it("fails_a_new_violation", () => {
      const fresh = `export function other(): void {\n${body(5)}\n}\n`;
      expect(findRegressions(scanViolations("src/z.ts", fresh, TIGHT), baseline)).toHaveLength(1);
    });
  });

  it("describes_a_violation_with_path_line_and_symbol", () => {
    const [violation] = scanViolations("src/a.ts", `export function big(): void {\n${body(5)}\n}\n`, TIGHT);
    expect(describeViolation(violation!)).toBe("src/a.ts:1 big — 7 lines (max 4)");
  });
});
