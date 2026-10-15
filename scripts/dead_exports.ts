/**
 * dead_exports — lists exports of `src/` that nothing in the shipped game
 * uses: "unused" (no importer anywhere: src, tests, scripts, server) and
 * "test-only" (imported only by tests / scripts). Also lists whole modules
 * nothing in `src/` imports.
 *
 *   npx tsx scripts/dead_exports.ts            # human report
 *   npx tsx scripts/dead_exports.ts --json     # machine report
 *
 * Name based and conservative: `import * as ns` and `export *` count every
 * export of the target as used, dynamic `import()` counts the module as used.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE_DIRS = ["src"];
const OTHER_DIRS = ["tests", "scripts", "server"];
const ENTRY_FILES = new Set([path.join(ROOT, "src", "main.ts")]);

type UserKind = "src" | "other";

interface ModuleInfo {
  readonly file: string;
  readonly exports: string[];
  readonly usedBy: Map<string, Set<UserKind>>;
  /** Importers of the module as a whole, any kind. */
  readonly importers: Map<string, Set<UserKind>>;
}

function listTypeScript(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts"))
        out.push(full);
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out;
}

function exportedNames(sf: ts.SourceFile): string[] {
  const names: string[] = [];
  const hasExport = (node: ts.Node): boolean =>
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some(
      (m) => m.kind === ts.SyntaxKind.ExportKeyword,
    );
  for (const node of sf.statements) {
    if (ts.isVariableStatement(node) && hasExport(node)) {
      for (const d of node.declarationList.declarations)
        if (ts.isIdentifier(d.name)) names.push(d.name.text);
    } else if (
      (ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isEnumDeclaration(node)) &&
      hasExport(node) &&
      node.name
    ) {
      names.push(node.name.text);
    } else if (
      ts.isExportDeclaration(node) &&
      !node.moduleSpecifier &&
      node.exportClause &&
      ts.isNamedExports(node.exportClause)
    ) {
      for (const el of node.exportClause.elements) names.push(el.name.text);
    }
  }
  return names;
}

function resolve(
  from: string,
  specifier: string,
  options: ts.CompilerOptions,
): string | null {
  if (!specifier.startsWith(".")) return null;
  const resolved = ts.resolveModuleName(specifier, from, options, ts.sys);
  const name = resolved.resolvedModule?.resolvedFileName;
  return name ? path.resolve(name) : null;
}

function record(
  modules: Map<string, ModuleInfo>,
  target: string,
  name: string,
  by: string,
  kind: UserKind,
): void {
  const info = modules.get(target);
  if (!info || target === by) return;
  const users = info.usedBy.get(name) ?? new Set<UserKind>();
  users.add(kind);
  info.usedBy.set(name, users);
}

function scanImports(
  modules: Map<string, ModuleInfo>,
  file: string,
  kind: UserKind,
  options: ts.CompilerOptions,
): void {
  const sf = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const markModule = (target: string): void => {
    const info = modules.get(target);
    if (!info || target === file) return;
    const users = info.importers.get(file) ?? new Set<UserKind>();
    users.add(kind);
    info.importers.set(file, users);
  };
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const target = resolve(file, node.moduleSpecifier.text, options);
      if (target) handleDeclaration(node, target);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const arg = node.arguments[0];
      const target =
        arg && ts.isStringLiteral(arg) ? resolve(file, arg.text, options) : null;
      if (target) useAll(target);
    }
    ts.forEachChild(node, visit);
  };
  const useAll = (target: string): void => {
    markModule(target);
    for (const name of modules.get(target)?.exports ?? [])
      record(modules, target, name, file, kind);
  };
  const handleDeclaration = (
    node: ts.ImportDeclaration | ts.ExportDeclaration,
    target: string,
  ): void => {
    markModule(target);
    const clause = ts.isImportDeclaration(node)
      ? node.importClause?.namedBindings
      : node.exportClause;
    if (clause && (ts.isNamedImports(clause) || ts.isNamedExports(clause))) {
      for (const el of clause.elements)
        record(modules, target, (el.propertyName ?? el.name).text, file, kind);
      return;
    }
    if (ts.isImportDeclaration(node) && node.importClause?.name)
      record(modules, target, "default", file, kind);
    if (!clause || ts.isNamespaceImport(clause) || ts.isNamespaceExport(clause))
      useAll(target);
  };
  visit(sf);
}

function main(): void {
  const options: ts.CompilerOptions = {
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  };
  const srcFiles = SOURCE_DIRS.flatMap((d) => listTypeScript(path.join(ROOT, d)));
  const otherFiles = OTHER_DIRS.flatMap((d) => listTypeScript(path.join(ROOT, d)));
  const modules = new Map<string, ModuleInfo>();
  for (const file of srcFiles) {
    const sf = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    modules.set(file, {
      file,
      exports: exportedNames(sf),
      usedBy: new Map(),
      importers: new Map(),
    });
  }
  for (const file of srcFiles) scanImports(modules, file, "src", options);
  for (const file of otherFiles) scanImports(modules, file, "other", options);

  const unused: string[] = [];
  const testOnly: string[] = [];
  const orphanModules: string[] = [];
  for (const info of modules.values()) {
    const rel = path.relative(ROOT, info.file).split("\\").join("/");
    const kinds = [...info.importers.values()].flatMap((k) => [...k]);
    if (!ENTRY_FILES.has(info.file) && info.exports.length > 0) {
      if (!kinds.includes("src"))
        orphanModules.push(`${rel}${kinds.length ? " (tests/scripts only)" : ""}`);
    }
    for (const name of info.exports) {
      const users = info.usedBy.get(name);
      if (!users) unused.push(`${rel}: ${name}`);
      else if (!users.has("src")) testOnly.push(`${rel}: ${name}`);
    }
  }
  const report = { unused, testOnly, orphanModules };
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  for (const [title, items] of Object.entries(report)) {
    console.log(`\n## ${title} (${items.length})`);
    for (const item of items.sort()) console.log(item);
  }
}

main();
