import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SourceFileText } from "./importCycles";

const SOURCE_EXTENSION = /\.tsx?$/;

function walk(root: string, relativeDir: string, out: string[]): void {
  for (const entry of readdirSync(join(root, relativeDir), { withFileTypes: true })) {
    const relative = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") walk(root, relative, out);
    } else if (SOURCE_EXTENSION.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      out.push(relative);
    }
  }
}

/** Reads every `.ts/.tsx` file under the given directories (posix-style relative paths). */
export function readSourceTree(root: string, directories: readonly string[]): SourceFileText[] {
  const paths: string[] = [];
  for (const directory of directories) walk(root, directory, paths);
  return paths.sort().map((path) => ({ path, text: readFileSync(join(root, path), "utf8") }));
}
