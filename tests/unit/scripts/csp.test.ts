import { describe, expect, it } from "vitest";
import {
  buildCsp,
  buildHeadersFile,
  injectSecurityMeta,
  inlineScriptHashes,
  relayConnectSource,
} from "../../../scripts/lib/csp";

describe("relayConnectSource", () => {
  it.each([
    ["wss://relay.fly.dev/ws", "wss://relay.fly.dev"],
    ["relay.fly.dev", "wss://relay.fly.dev"],
    ["https://relay.example.com:8443/ws", "wss://relay.example.com:8443"],
    ["ws://relay.local:8080", "ws://relay.local:8080"],
  ])("derives_%s_to_%s", (raw, expected) => {
    expect(relayConnectSource(raw)).toBe(expected);
  });

  it("returns_nothing_for_empty_or_unusable_values", () => {
    expect(relayConnectSource(undefined)).toBeUndefined();
    expect(relayConnectSource("  ")).toBeUndefined();
    expect(relayConnectSource("ftp://files.example.com")).toBeUndefined();
  });
});

describe("buildCsp", () => {
  it("allows_scripts_only_from_self_and_listed_hashes", () => {
    const csp = buildCsp({ scriptHashes: ["'sha256-abc'"] });
    expect(csp).toContain("script-src 'self' 'sha256-abc'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });

  it("limits_connections_to_self_and_the_relay", () => {
    expect(buildCsp({ onlineUrl: "relay.fly.dev" })).toContain("connect-src 'self' blob: data: wss://relay.fly.dev;");
    expect(buildCsp({})).not.toContain("wss://");
  });

  it("lets_images_load_from_data_and_blob", () => {
    expect(buildCsp()).toContain("img-src 'self' data: blob:");
  });

  it("adds_frame_ancestors_only_in_header_form", () => {
    expect(buildCsp({}, true)).toContain("frame-ancestors 'none'");
    expect(buildCsp({}, false)).not.toContain("frame-ancestors");
  });

  it("blocks_plugins_and_base_tag_injection", () => {
    const csp = buildCsp();
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
  });
});

describe("inlineScriptHashes", () => {
  it("hashes_inline_scripts_and_skips_external_and_empty_ones", () => {
    const html = '<script>var a=1;</script><script src="/x.js"></script><script type="module" src="/m.js"></script><script> </script>';
    const hashes = inlineScriptHashes(html);
    expect(hashes).toHaveLength(1);
    expect(hashes[0]).toMatch(/^'sha256-[A-Za-z0-9+/]+=*'$/);
  });
  it("hashes_crlf_scripts_like_the_browser_does_after_newline_normalisation", () => {
    const lf = inlineScriptHashes("<script>a;\nb;</script>");
    const crlf = inlineScriptHashes("<script>a;\r\nb;</script>");
    expect(crlf).toEqual(lf);
  });
});

describe("injectSecurityMeta", () => {
  const html = '<head>\n    <meta charset="UTF-8" />\n    <title>t</title><script>boot()</script></head>';

  it("adds_the_csp_meta_with_the_inline_script_hash_and_a_referrer_policy", () => {
    const out = injectSecurityMeta(html, { onlineUrl: "relay.fly.dev" });
    expect(out).toContain('http-equiv="Content-Security-Policy"');
    expect(out).toContain("'sha256-");
    expect(out).toContain('name="referrer" content="no-referrer"');
  });

  it("places_the_policy_before_any_script", () => {
    const out = injectSecurityMeta(html, {});
    expect(out.indexOf("Content-Security-Policy")).toBeLessThan(out.indexOf("<script>"));
  });
});

describe("buildHeadersFile", () => {
  it("contains_the_header_policy_and_immutable_asset_caching", () => {
    const file = buildHeadersFile({ onlineUrl: "relay.fly.dev" });
    expect(file).toContain("Content-Security-Policy:");
    expect(file).toContain("frame-ancestors 'none'");
    expect(file).toContain("Referrer-Policy: no-referrer");
    expect(file).toContain("/assets/*");
  });
});
