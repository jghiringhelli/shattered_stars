/**
 * Code-quality ratchet (CLAUDE.md limits: 300 lines per file, 50 lines per
 * function, 5 parameters). Pure: parses text with the TypeScript compiler and
 * compares the offenders with a recorded baseline. Only NEW or WORSENED
 * violations are regressions; existing debt is tolerated until it is touched.
 */
import ts from "typescript";

export interface QualityLimits {
  readonly maxFileLines: number;
  readonly maxFunctionLines: number;
  readonly maxParams: number;
}

export const DEFAULT_LIMITS: QualityLimits = {
  maxFileLines: 300,
  maxFunctionLines: 50,
  maxParams: 5,
};

export type ViolationKind = "file-lines" | "function-lines" | "params";

export interface Violation {
  readonly kind: ViolationKind;
  /** Stable identity: `path` for files, `path::Container.name` for functions. */
  readonly key: string;
  readonly value: number;
  readonly limit: number;
  readonly line: number;
}

export interface Baseline {
  readonly limits: QualityLimits;
  readonly files: Readonly<Record<string, number>>;
  readonly functionLines: Readonly<Record<string, number>>;
  readonly params: Readonly<Record<string, number>>;
}

interface FunctionMetric {
  readonly key: string;
  readonly line: number;
  readonly lines: number;
  readonly params: number;
}

function declaredName(node: ts.Node): string | undefined {
  if (
    (ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isGetAccessor(node) ||
      ts.isSetAccessor(node)) &&
    node.name
  ) {
    return node.name.getText();
  }
  if (ts.isConstructorDeclaration(node)) return "constructor";
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    const parent = node.parent;
    if (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent) || ts.isPropertyDeclaration(parent)) {
      return parent.name.getText();
    }
  }
  return undefined;
}

function containerOf(node: ts.Node): string {
  const names: string[] = [];
  for (let current = node.parent; current; current = current.parent) {
    if ((ts.isClassDeclaration(current) || ts.isClassExpression(current)) && current.name) {
      names.unshift(current.name.getText());
    } else if (ts.isFunctionDeclaration(current) && current.name) {
      names.unshift(current.name.getText());
    }
  }
  return names.join(".");
}

function collectFunctions(source: ts.SourceFile, path: string): FunctionMetric[] {
  const metrics: FunctionMetric[] = [];
  const seen = new Map<string, number>();
  const visit = (node: ts.Node): void => {
    const name = declaredName(node);
    if (name && ts.isFunctionLike(node) && (node as ts.FunctionLikeDeclaration).body) {
      const start = source.getLineAndCharacterOfPosition(node.getStart(source)).line;
      const end = source.getLineAndCharacterOfPosition(node.getEnd()).line;
      const container = containerOf(node);
      const base = `${path}::${container ? `${container}.` : ""}${name}`;
      const occurrence = (seen.get(base) ?? 0) + 1;
      seen.set(base, occurrence);
      const params = node.parameters.filter((p) => p.name.getText() !== "this").length;
      metrics.push({
        key: occurrence === 1 ? base : `${base}#${occurrence}`,
        line: start + 1,
        lines: end - start + 1,
        params,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return metrics;
}

/** Every limit breach in one file (not compared with any baseline). */
export function scanViolations(
  path: string,
  text: string,
  limits: QualityLimits = DEFAULT_LIMITS,
): Violation[] {
  const violations: Violation[] = [];
  const lineCount = text.length === 0 ? 0 : text.replace(/\r?\n$/, "").split(/\r?\n/).length;
  if (lineCount > limits.maxFileLines) {
    violations.push({ kind: "file-lines", key: path, value: lineCount, limit: limits.maxFileLines, line: 1 });
  }
  const scriptKind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.ES2020, true, scriptKind);
  for (const fn of collectFunctions(source, path)) {
    if (fn.lines > limits.maxFunctionLines) {
      violations.push({ kind: "function-lines", key: fn.key, value: fn.lines, limit: limits.maxFunctionLines, line: fn.line });
    }
    if (fn.params > limits.maxParams) {
      violations.push({ kind: "params", key: fn.key, value: fn.params, limit: limits.maxParams, line: fn.line });
    }
  }
  return violations;
}

function recordFor(baseline: Baseline, kind: ViolationKind): Readonly<Record<string, number>> {
  if (kind === "file-lines") return baseline.files;
  return kind === "function-lines" ? baseline.functionLines : baseline.params;
}

/** Violations that are not in the baseline, or got worse than recorded. */
export function findRegressions(violations: readonly Violation[], baseline: Baseline): Violation[] {
  return violations.filter((violation) => {
    const recorded = recordFor(baseline, violation.kind)[violation.key];
    return recorded === undefined || violation.value > recorded;
  });
}

/** Builds a baseline from the current offenders. */
export function buildBaseline(violations: readonly Violation[], limits: QualityLimits = DEFAULT_LIMITS): Baseline {
  const files: Record<string, number> = {};
  const functionLines: Record<string, number> = {};
  const params: Record<string, number> = {};
  const sorted = [...violations].sort((a, b) => a.key.localeCompare(b.key));
  for (const violation of sorted) {
    const target = violation.kind === "file-lines" ? files : violation.kind === "function-lines" ? functionLines : params;
    target[violation.key] = violation.value;
  }
  return { limits, files, functionLines, params };
}

/** One human-readable line per violation. */
export function describeViolation(violation: Violation): string {
  const unit = violation.kind === "params" ? "parameters" : "lines";
  const [path, symbol] = violation.key.split("::");
  const label = symbol === undefined ? "" : `${symbol} — `;
  return `${path}:${violation.line} ${label}${violation.value} ${unit} (max ${violation.limit})`;
}
