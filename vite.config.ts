import { defineConfig, loadEnv, type Plugin } from "vite";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { buildHeadersFile, inlineScriptHashes, injectSecurityMeta } from "./scripts/lib/csp";

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

/** Short commit of this build: CI's GITHUB_SHA, else the local checkout. */
function gitShortSha(): string {
  const fromCi = process.env.GITHUB_SHA;
  if (fromCi) return fromCi.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

/**
 * Production-only security headers: a CSP/referrer <meta> in index.html (GitHub Pages cannot set
 * headers) and a `_headers` file for hosts that can. The relay origin comes from VITE_ONLINE_URL.
 * Dev builds are untouched (Vite's HMR needs inline scripts and websockets).
 */
function securityHeaders(onlineUrl: string | undefined): Plugin {
  return {
    name: "shattered-stars-security-headers",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler: (html) => injectSecurityMeta(html, { onlineUrl }),
    },
    generateBundle() {
      const sourceHtml = readFileSync(new URL("./index.html", import.meta.url), "utf8");
      this.emitFile({
        type: "asset",
        fileName: "_headers",
        source: buildHeadersFile({ onlineUrl, scriptHashes: inlineScriptHashes(sourceHtml) }),
      });
    },
  };
}

/**
 * Chunk layout. Every scene except boot/menu/settings loads on demand (src/scenes/lazy) and Rollup splits the
 * shared modules by itself. Grouping net/campaign/data by directory was measured and made the first menu
 * download them (shared helpers pull the group in), so only Phaser is pinned.
 */
function chunkFor(id: string): string | undefined {
  if (id.includes("/node_modules/phaser/")) return "phaser";
  return undefined;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    // GitHub Pages serves the game under /<repo>/; CI sets BASE_PATH
    // (e.g. "/shattered_stars/"). Relative './' works for any static host.
    base: process.env.BASE_PATH ?? "./",
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __GIT_SHA__: JSON.stringify(gitShortSha()),
      __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    },
    plugins: [securityHeaders(process.env.VITE_ONLINE_URL ?? env.VITE_ONLINE_URL)],
    build: {
      target: "es2020",
      rollupOptions: {
        output: { manualChunks: chunkFor },
      },
    },
    server: {
      port: 3000,
      open: !process.env.CI,
    },
  };
});
