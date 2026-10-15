/**
 * Static import-cycle detection (Tarjan SCC) over a set of TypeScript files.
 * Pure: callers provide file texts. Type-only imports and dynamic `import()`
 * are ignored because neither creates a load-order cycle at runtime.
 */
import ts from "typescript";

export interface SourceFileText {
  readonly path: string;
  readonly text: string;
}

const EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"];

function normalize(parts: readonly string[]): string {
  const out: string[] = [];
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

function resolveImport(fromPath: string, specifier: string, known: ReadonlySet<string>): string | undefined {
  if (!specifier.startsWith(".")) return undefined;
  const base = normalize([...fromPath.split("/").slice(0, -1), ...specifier.split("/")]);
  const stripped = base.replace(/\.(js|ts|tsx)$/, "");
  for (const candidate of [base, ...EXTENSIONS.map((ext) => stripped + ext)]) {
    if (known.has(candidate)) return candidate;
  }
  return undefined;
}

function staticSpecifiers(file: SourceFileText): string[] {
  const source = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.ES2020, false);
  const specifiers: string[] = [];
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && !statement.importClause?.isTypeOnly) {
      if (ts.isStringLiteral(statement.moduleSpecifier)) specifiers.push(statement.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(statement) && !statement.isTypeOnly && statement.moduleSpecifier) {
      if (ts.isStringLiteral(statement.moduleSpecifier)) specifiers.push(statement.moduleSpecifier.text);
    }
  }
  return specifiers;
}

/** Builds the runtime import graph (path → imported paths) of the given files. */
export function buildImportGraph(files: readonly SourceFileText[]): Map<string, string[]> {
  const known = new Set(files.map((file) => file.path));
  const graph = new Map<string, string[]>();
  for (const file of files) {
    const targets = staticSpecifiers(file)
      .map((specifier) => resolveImport(file.path, specifier, known))
      .filter((target): target is string => target !== undefined);
    graph.set(file.path, targets);
  }
  return graph;
}

/** Strongly connected components with more than one file, or a self-import. */
export function findCycles(graph: ReadonlyMap<string, readonly string[]>): string[][] {
  let counter = 0;
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];

  const strongConnect = (root: string): void => {
    // Iterative Tarjan: the graph has ~1000 nodes but chains can be deep.
    const work: Array<{ node: string; next: number }> = [{ node: root, next: 0 }];
    index.set(root, counter);
    low.set(root, counter++);
    stack.push(root);
    onStack.add(root);
    while (work.length > 0) {
      const frame = work[work.length - 1]!;
      const edges = graph.get(frame.node) ?? [];
      if (frame.next < edges.length) {
        const target = edges[frame.next++]!;
        if (!index.has(target)) {
          index.set(target, counter);
          low.set(target, counter++);
          stack.push(target);
          onStack.add(target);
          work.push({ node: target, next: 0 });
        } else if (onStack.has(target)) {
          low.set(frame.node, Math.min(low.get(frame.node)!, index.get(target)!));
        }
        continue;
      }
      work.pop();
      const parent = work[work.length - 1];
      if (parent) low.set(parent.node, Math.min(low.get(parent.node)!, low.get(frame.node)!));
      if (low.get(frame.node) !== index.get(frame.node)) continue;
      const component: string[] = [];
      let member: string;
      do {
        member = stack.pop()!;
        onStack.delete(member);
        component.push(member);
      } while (member !== frame.node);
      const selfImport = component.length === 1 && (graph.get(component[0]!) ?? []).includes(component[0]!);
      if (component.length > 1 || selfImport) cycles.push(component.sort());
    }
  };

  for (const node of graph.keys()) {
    if (!index.has(node)) strongConnect(node);
  }
  return cycles;
}
