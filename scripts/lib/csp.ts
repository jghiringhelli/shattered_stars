/**
 * Content-Security-Policy for the static game (GitHub Pages cannot set headers, so the policy is
 * also injected as a <meta> tag; hosts that honour a `_headers` file get the stronger header form).
 * Pure: the Vite plugin in vite.config.ts feeds it the built index.html and the build-time env.
 */
import { createHash } from "node:crypto";

/** Build-time inputs of the policy. */
export interface CspOptions {
  /** Raw `VITE_ONLINE_URL` (host, http(s):// or ws(s):// URL, with or without path); empty = no relay. */
  readonly onlineUrl?: string | undefined;
  /** `sha256-…` sources of the inline scripts of index.html. */
  readonly scriptHashes?: readonly string[];
}

/** The relay's WebSocket origin, or undefined when none is configured or the value is unusable. */
export function relayConnectSource(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `wss://${value}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return undefined;
  }
  const secure = url.protocol === "wss:" || url.protocol === "https:";
  const insecure = url.protocol === "ws:" || url.protocol === "http:";
  if (!secure && !insecure) return undefined;
  return `${secure ? "wss" : "ws"}://${url.host}`;
}

/** `'sha256-…'` source expressions for every inline (src-less) script of an HTML document. */
export function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attributes = match[1] ?? "";
    // The HTML parser normalises CR/LF to LF before the browser hashes the script text.
    const body = (match[2] ?? "").replace(/\r\n?/g, "\n");
    if (/\bsrc\s*=/.test(attributes) || body.trim() === "") continue;
    hashes.push(`'sha256-${createHash("sha256").update(body).digest("base64")}'`);
  }
  return hashes;
}

/**
 * @param options - Relay URL and inline script hashes.
 * @param forHeader - Include directives that only work as an HTTP header (`frame-ancestors`).
 * @returns The policy string.
 */
export function buildCsp(options: CspOptions = {}, forHeader = false): string {
  const relay = relayConnectSource(options.onlineUrl);
  const directives: Array<[string, readonly string[]]> = [
    ["default-src", ["'self'"]],
    ["script-src", ["'self'", ...(options.scriptHashes ?? [])]],
    // Phaser and index.html set inline styles.
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:"]],
    ["media-src", ["'self'", "blob:", "data:"]],
    ["font-src", ["'self'", "data:"]],
    // The loader fetches assets (and decodes blob:/data: URLs); the relay is the only external origin.
    ["connect-src", ["'self'", "blob:", "data:", ...(relay ? [relay] : [])]],
    ["worker-src", ["'self'", "blob:"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'none'"]],
    ["form-action", ["'self'"]],
  ];
  if (forHeader) directives.push(["frame-ancestors", ["'none'"]]);
  return directives.map(([name, sources]) => `${name} ${sources.join(" ")}`).join("; ");
}

/** Headers for hosts that support a `_headers` file (Netlify, Cloudflare Pages); GitHub Pages ignores it. */
export function buildHeadersFile(options: CspOptions = {}): string {
  return [
    "/*",
    `  Content-Security-Policy: ${buildCsp(options, true)}`,
    "  Referrer-Policy: no-referrer",
    "  X-Content-Type-Options: nosniff",
    "  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()",
    "/assets/*",
    "  Cache-Control: public, max-age=31536000, immutable",
    "",
  ].join("\n");
}

/** Injects the CSP and referrer `<meta>` tags at the start of `<head>`. */
export function injectSecurityMeta(html: string, options: CspOptions): string {
  const csp = buildCsp({ ...options, scriptHashes: inlineScriptHashes(html) });
  const tags =
    `<meta http-equiv="Content-Security-Policy" content="${csp}" />\n    ` +
    `<meta name="referrer" content="no-referrer" />\n    `;
  return html.replace(/<meta charset="UTF-8"\s*\/>\s*/i, (charset) => `${charset}${tags}`);
}
