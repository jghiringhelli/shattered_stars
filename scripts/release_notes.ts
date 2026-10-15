/**
 * Prints the CHANGELOG.md notes of one version (release workflow): exits 1 when the version has no section.
 *   tsx scripts/release_notes.ts 0.2.0-beta.1 > release-notes.md
 */
import { readFileSync } from "node:fs";
import { extractReleaseNotes } from "./lib/changelog";

const version = process.argv[2]?.replace(/^v/, "");
if (!version) {
  console.error("usage: release_notes.ts <version>");
  process.exit(1);
}
const notes = extractReleaseNotes(readFileSync("CHANGELOG.md", "utf8"), version);
if (!notes) {
  console.error(`CHANGELOG.md has no filled-in section for [${version}]`);
  process.exit(1);
}
console.log(notes);
