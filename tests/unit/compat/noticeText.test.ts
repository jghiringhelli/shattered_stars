import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  bannerTextFor,
  blockedDetailFor,
  DEVICE_NOTICE_TEXT,
  minimumVersionsText,
  ROTATE_HINT_TEXT,
} from "../../../src/compat/noticeText";
import { detectSupport, REQUIRED_API_NAMES } from "../../../src/compat/browserSupport";

const CHROME_89 =
  "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.0.0 Safari/537.36";
const apis = Object.fromEntries(REQUIRED_API_NAMES.map((n) => [n, true]));

function report(over: Partial<Parameters<typeof detectSupport>[0]> = {}) {
  return detectSupport({
    userAgent: CHROME_89,
    webgl: true,
    canvas2d: true,
    apis,
    forceCanvas: false,
    ...over,
  });
}

describe("minimumVersionsText", () => {
  it("lists every supported browser with its minimum major", () => {
    expect(minimumVersionsText()).toBe("Chrome 90, Edge 90, Firefox 90, Safari 15");
  });
});

describe("blockedDetailFor", () => {
  it("names the browser and the missing graphics layer", () => {
    const text = blockedDetailFor(report({ webgl: false, canvas2d: false }));
    expect(text).toContain("Chrome 89");
    expect(text).toContain("WebGL");
    expect(text).toContain("Canvas");
  });

  it("lists missing APIs", () => {
    const text = blockedDetailFor(report({ apis: { ...apis, BigInt: false } }));
    expect(text).toContain("BigInt");
  });
});

describe("bannerTextFor", () => {
  it("explains compatibility mode and slower speed when WebGL is missing", () => {
    const text = bannerTextFor(report({ webgl: false }));
    expect(text).toMatch(/compatibility mode/i);
    expect(text).toMatch(/slower/i);
  });

  it("names the minimum versions for an outdated browser", () => {
    const text = bannerTextFor(report());
    expect(text).toContain("Chrome 89");
    expect(text).toContain("Chrome 90");
  });

  it("is empty when everything is fine", () => {
    expect(bannerTextFor(report({ userAgent: CHROME_89.replace("89", "120") }))).toBe("");
  });
});

describe("device notice copy", () => {
  it("states that phones are not supported in this beta", () => {
    expect(DEVICE_NOTICE_TEXT).toMatch(/phones are not supported in this beta/i);
    expect(DEVICE_NOTICE_TEXT).toMatch(/keyboard or gamepad/i);
  });

  it("asks portrait players to rotate", () => {
    expect(ROTATE_HINT_TEXT).toMatch(/rotate/i);
  });
});

describe("index.html static fallback", () => {
  const html = readFileSync("index.html", "utf8");

  it("repeats the minimum browser versions", () => {
    expect(html).toContain(minimumVersionsText());
  });

  it.each(["compat-blocked", "compat-banner", "device-notice", "rotate-hint"])(
    "ships the hidden #%s container the compat code fills",
    (id) => {
      expect(html).toMatch(new RegExp(`id="${id}"[^>]*hidden`));
    },
  );
});