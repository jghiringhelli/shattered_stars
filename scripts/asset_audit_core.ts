/**
 * Asset audit core (pure): decide which files under `public/assets` the
 * running game can reference. Used by scripts/audit_assets.ts.
 *
 * References come from two places:
 *  - the asset manifest (src/assets/assetManifest.ts), enumerated exactly —
 *    its `${faction}/${id}` templates are expanded over every ship, faction
 *    and portrait, so only real combinations count;
 *  - every other quoted string containing `assets/` in src/ and index.html,
 *    treated conservatively: `${...}` and `<...>` become wildcards and a path
 *    without an extension matches everything below it.
 */

/** A compiled reference: a regex over public-relative paths. */
export interface AssetReference {
  readonly source: string;
  readonly pattern: RegExp;
}

const QUOTED =
  /(["'`])((?:(?!\1)[^\\\n]|\\.)*?assets\/(?:(?!\1)[^\\\n]|\\.)*?)\1/g;
const HAS_EXTENSION = /\.[a-z0-9]{2,5}$/i;

/** @returns `text` with regex specials escaped. */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @param literal - A quoted string containing `assets/`.
 * @returns Its reference, normalised to start at `assets/`.
 */
export function compileReference(literal: string): AssetReference {
  const path = literal.slice(literal.indexOf("assets/"));
  const wildcards = path.replace(/\$\{[^}]*\}|<[^>]*>/g, "\u0000");
  const body = escapeRegex(wildcards).replace(/\u0000/g, "[^/]*");
  const exact = HAS_EXTENSION.test(path) && !path.endsWith("/");
  const tail = exact ? "$" : path.endsWith("/") ? "" : "(?:[/.].*)?$";
  return { source: literal, pattern: new RegExp(`^${body}${tail}`) };
}

/**
 * @param text - Source code or markup.
 * @returns Every `assets/` reference quoted in it.
 */
export function findReferences(text: string): AssetReference[] {
  const refs: AssetReference[] = [];
  for (const match of text.matchAll(QUOTED))
    refs.push(compileReference(match[2]!));
  return refs;
}

/**
 * @param url - An exact public-relative URL from the manifest.
 * @returns A reference matching only that file.
 */
export function exactReference(url: string): AssetReference {
  return { source: url, pattern: new RegExp(`^${escapeRegex(url)}$`) };
}

/**
 * @param files - Public-relative paths (forward slashes) of every asset file.
 * @param refs - All references.
 * @returns The files no reference matches.
 */
export function findUnreferenced(
  files: readonly string[],
  refs: readonly AssetReference[],
): string[] {
  return files.filter((file) => !refs.some((ref) => ref.pattern.test(file)));
}
