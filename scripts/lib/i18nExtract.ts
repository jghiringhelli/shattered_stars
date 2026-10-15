/**
 * Finds player-facing text in data files: string literals assigned to text-like properties
 * (`name`, `description`, `title`, ...). Report only: it proposes catalog keys, it never rewrites code.
 * docs/I18N.md describes how the report becomes `locales/en/*.json`.
 */
import ts from "typescript";

/** Property names whose string values are shown to players. */
export const TEXT_PROPERTIES: ReadonlySet<string> = new Set([
  "name",
  "title",
  "description",
  "desc",
  "text",
  "label",
  "summary",
  "flavor",
  "flavorText",
  "lore",
  "briefing",
  "tooltip",
  "hint",
  "tagline",
  "subtitle",
  "message",
  "objective",
]);

/** One extracted string. */
export interface ExtractedText {
  /** Proposed catalog key: `<file path>.<owner id>.<property>`, dotted and lower case. */
  readonly key: string;
  readonly text: string;
  readonly line: number;
}

function slug(part: string): string {
  return part
    .replace(/\.[tj]sx?$/, "")
    .replace(/[^a-zA-Z0-9_]+/g, ".")
    .replace(/(^\.|\.$)/g, "")
    .toLowerCase();
}

/** The `id` (or `key`) string literal of the object literal a property belongs to, when it has one. */
function ownerId(literal: ts.ObjectLiteralExpression): string | undefined {
  for (const property of literal.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = property.name.getText();
    if ((name === "id" || name === "key") && ts.isStringLiteralLike(property.initializer)) {
      return property.initializer.text;
    }
  }
  return undefined;
}

/** True for prose (contains a space or starts with a capital), false for ids, urls and asset paths. */
function looksLikeProse(value: string): boolean {
  if (value.length < 2 || /^[a-z0-9_]+$/.test(value) || /^(https?:|\/|\.{1,2}\/)/.test(value)) return false;
  return /\s/.test(value) || /^[A-Z]/.test(value);
}

/**
 * @param path - File path (becomes the key prefix, relative to the data root).
 * @param text - File content.
 * @returns Player-facing strings with proposed keys (duplicates of a key get a numeric suffix).
 */
export function extractTexts(path: string, text: string): ExtractedText[] {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.ES2020, true);
  const found: ExtractedText[] = [];
  const seen = new Map<string, number>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node) &&
      TEXT_PROPERTIES.has(node.name.getText()) &&
      ts.isStringLiteralLike(node.initializer) &&
      looksLikeProse(node.initializer.text) &&
      ts.isObjectLiteralExpression(node.parent)
    ) {
      const owner = ownerId(node.parent);
      const base = [slug(path), owner ? slug(owner) : undefined, node.name.getText().toLowerCase()]
        .filter(Boolean)
        .join(".");
      const count = (seen.get(base) ?? 0) + 1;
      seen.set(base, count);
      found.push({
        key: count === 1 ? base : `${base}.${count}`,
        text: node.initializer.text,
        line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}
