/**
 * Release notes from a Keep a Changelog file: the body of the `## [version]` section.
 * Pure; scripts/release_notes.ts is the CLI used by .github/workflows/release.yml.
 */

/**
 * @param changelog - Full CHANGELOG.md text.
 * @param version - Version without the leading "v" (e.g. "0.2.0-beta.1").
 * @returns The section body (trimmed), or undefined when the version has no section.
 */
export function extractReleaseNotes(changelog: string, version: string): string | undefined {
  const lines = changelog.split(/\r?\n/);
  const heading = (line: string): string | undefined => /^##\s+\[([^\]]+)\]/.exec(line)?.[1];
  const start = lines.findIndex((line) => heading(line) === version);
  if (start < 0) return undefined;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s/.test(line));
  const body = (end < 0 ? rest : rest.slice(0, end))
    // Reference-style link definitions at the bottom belong to the file, not to a release.
    .filter((line) => !/^\[[^\]]+\]:\s/.test(line))
    .join("\n")
    .trim();
  return body === "" ? undefined : body;
}
