/**
 * audit_assets — list files under public/assets that the game never loads,
 * and optionally move them to art-archive/ (kept in git, not shipped).
 *
 *   npx tsx scripts/audit_assets.ts          # report only
 *   npx tsx scripts/audit_assets.ts --move   # move unreferenced files
 *
 * See scripts/asset_audit_core.ts for how references are found. Audio is
 * never moved (its manifest is owned by the music pipeline).
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { allManifestAssets } from "../src/assets/assetManifest";
import {
  exactReference,
  findReferences,
  findUnreferenced,
  type AssetReference,
} from "./asset_audit_core";

const ROOT = process.cwd();
const PUBLIC = join(ROOT, "public");
const ARCHIVE = join(ROOT, "art-archive");
const MANIFEST_FILE = join(ROOT, "src", "assets", "assetManifest.ts");
const SCANNED_EXTENSIONS = [".ts", ".css", ".html", ".json"];
/** Audio is owned by the music pipeline (its own manifest + lazy loading). */
const NEVER_ARCHIVE = /(^|\/)audio\//;
const BYTES_PER_MB = 1024 * 1024;

/** @returns Every file below `dir` (absolute paths). */
function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const toPublicPath = (abs: string): string =>
  relative(PUBLIC, abs).split(sep).join("/");

/** @returns References quoted in src/ and index.html (manifest excluded). */
function codeReferences(): AssetReference[] {
  const sources = [
    ...walk(join(ROOT, "src")).filter(
      (f) =>
        f !== MANIFEST_FILE && SCANNED_EXTENSIONS.some((e) => f.endsWith(e)),
    ),
    join(ROOT, "index.html"),
  ];
  return sources.flatMap((file) => findReferences(readFileSync(file, "utf8")));
}

/** @returns Exact references for atlas images named inside referenced JSON. */
function atlasImageReferences(jsonPaths: readonly string[]): AssetReference[] {
  return jsonPaths.flatMap((path) => {
    try {
      const meta = (
        JSON.parse(readFileSync(join(PUBLIC, path), "utf8")) as {
          meta?: { image?: string };
        }
      ).meta;
      if (!meta?.image) return [];
      return [exactReference(`${dirname(path)}/${meta.image}`)];
    } catch {
      return [];
    }
  });
}

/** Group sizes by the first two path segments, for the report. */
function summarize(files: readonly string[]): void {
  const groups = new Map<string, number>();
  for (const file of files) {
    const group = file.split("/").slice(0, 2).join("/");
    groups.set(
      group,
      (groups.get(group) ?? 0) + statSync(join(PUBLIC, file)).size,
    );
  }
  const total = [...groups.values()].reduce((a, b) => a + b, 0);
  for (const [group, bytes] of [...groups].sort((a, b) => b[1] - a[1]))
    console.log(
      `${(bytes / BYTES_PER_MB).toFixed(2).padStart(8)} MB  ${group}`,
    );
  console.log(
    `${(total / BYTES_PER_MB).toFixed(2).padStart(8)} MB  TOTAL (${files.length} files)`,
  );
}

/** Move each file from public/ to the same relative path under art-archive/. */
function moveToArchive(files: readonly string[]): void {
  for (const file of files) {
    const target = join(ARCHIVE, file);
    mkdirSync(dirname(target), { recursive: true });
    renameSync(join(PUBLIC, file), target);
  }
  console.log(`Moved ${files.length} files to ${relative(ROOT, ARCHIVE)}/`);
}

function main(): void {
  const files = walk(join(PUBLIC, "assets")).map(toPublicPath);
  const manifestRefs = allManifestAssets().flatMap((entry) =>
    entry.kind === "atlas" ? [entry.url, entry.atlasUrl] : [entry.url],
  );
  const refs = [...manifestRefs.map(exactReference), ...codeReferences()];
  const referencedJson = files.filter(
    (f) => f.endsWith(".json") && refs.some((r) => r.pattern.test(f)),
  );
  refs.push(...atlasImageReferences(referencedJson));
  const unreferenced = findUnreferenced(files, refs).filter(
    (f) => !NEVER_ARCHIVE.test(f),
  );
  summarize(unreferenced);
  if (process.argv.includes("--list"))
    unreferenced.forEach((f) => console.log(f));
  if (process.argv.includes("--move")) moveToArchive(unreferenced);
}

main();
