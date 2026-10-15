/**
 * Proposes catalog entries for the player-facing text in src/data (report only).
 *   npm run i18n:extract                      summary per file
 *   npm run i18n:extract -- --json out.json   full { key: text } catalog proposal
 */
import { writeFileSync } from "node:fs";
import { extractTexts } from "./lib/i18nExtract";
import { readSourceTree } from "./lib/sourceTree";

const root = process.cwd();
const files = readSourceTree(root, ["src/data"]);
const catalog: Record<string, string> = {};
const perFile: Array<[string, number]> = [];

for (const file of files) {
  const texts = extractTexts(file.path.replace(/^src\/data\//, ""), file.text);
  if (texts.length > 0) perFile.push([file.path, texts.length]);
  for (const entry of texts) catalog[entry.key] = entry.text;
}

const jsonIndex = process.argv.indexOf("--json");
if (jsonIndex > 0) {
  const out = process.argv[jsonIndex + 1] ?? "i18n-proposal.json";
  writeFileSync(out, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(catalog).length} entries to ${out}`);
} else {
  for (const [path, count] of perFile.sort((a, b) => b[1] - a[1])) console.log(`${String(count).padStart(5)}  ${path}`);
  console.log(`\n${Object.keys(catalog).length} player-facing strings in ${perFile.length} of ${files.length} data files.`);
}
