/**
 * Import-cycle gate: exits 1 when the runtime import graph of src/ and
 * server/src/ has a cycle. Offline replacement for `npx madge --circular`.
 *   npm run check:cycles
 */
import { buildImportGraph, findCycles } from "./lib/importCycles";
import { readSourceTree } from "./lib/sourceTree";

const root = process.cwd();
const files = readSourceTree(root, ["src", "server/src"]);
const cycles = findCycles(buildImportGraph(files));

if (cycles.length > 0) {
  console.error(`Circular imports found (${cycles.length}):`);
  for (const cycle of cycles) console.error(`  ${cycle.join(" <-> ")}`);
  process.exit(1);
}
console.log(`No circular imports (${files.length} files checked).`);
