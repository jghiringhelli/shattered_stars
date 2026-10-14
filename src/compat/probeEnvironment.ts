/**
 * Impure side of compatibility detection: probes a real window/document and
 * hands plain data to the pure decision code in browserSupport.ts and
 * deviceProfile.ts.
 */

import { REQUIRED_API_NAMES, type SupportEnvironment } from "./browserSupport";
import type { DeviceSignals } from "./deviceProfile";

/**
 * @param win - The browser window.
 * @returns True when Canvas is a choice rather than a fallback:
 *   `?renderer=canvas`, or an automation driver (Playwright/WebDriver), which
 *   renders on a software GL where Canvas is steadier.
 */
export function isCanvasForced(win: Window): boolean {
  const navigatorRef = win.navigator as Navigator | undefined;
  return (
    win.location.search.includes("renderer=canvas") ||
    navigatorRef?.webdriver === true
  );
}

/**
 * @param doc - The document to create a probe canvas in.
 * @returns True when a WebGL context can be created (released again at once).
 */
export function probeWebGL(doc: Document): boolean {
  try {
    const canvas = doc.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ??
      canvas.getContext("webgl")) as WebGLRenderingContext | null;
    // Not released with WEBGL_lose_context: that logs a console warning and
    // raced Phaser's own context creation on software GL.
    return gl !== null;
  } catch {
    return false;
  }
}

/**
 * @param doc - The document to create a probe canvas in.
 * @returns True when a Canvas 2D context can be created.
 */
export function probeCanvas2d(doc: Document): boolean {
  try {
    return doc.createElement("canvas").getContext("2d") !== null;
  } catch {
    return false;
  }
}

/**
 * @param root - Object the dotted names resolve against (the global object).
 * @param names - Dotted API paths such as "Promise.allSettled".
 * @returns For each name, whether it resolves to a non-undefined value.
 */
export function probeApis(
  root: object,
  names: readonly string[] = REQUIRED_API_NAMES,
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const name of names) {
    let cursor: unknown = root;
    for (const part of name.split(".")) {
      cursor = (cursor as Record<string, unknown> | null | undefined)?.[part];
    }
    result[name] = cursor !== undefined && cursor !== null;
  }
  return result;
}

/**
 * @param win - The browser window.
 * @returns Everything {@link detectSupport} needs to decide.
 */
export function probeSupportEnvironment(win: Window): SupportEnvironment {
  const forceCanvas = isCanvasForced(win);
  return {
    userAgent: win.navigator.userAgent,
    // A forced-Canvas run never creates a WebGL context, so none is probed.
    webgl: forceCanvas ? false : probeWebGL(win.document),
    canvas2d: probeCanvas2d(win.document),
    apis: probeApis(win),
    forceCanvas,
  };
}

/**
 * @param win - The browser window.
 * @param query - A CSS media query.
 * @returns Whether it matches; false when matchMedia is unavailable.
 */
function matches(win: Window, query: string): boolean {
  return typeof win.matchMedia === "function" && win.matchMedia(query).matches;
}

/**
 * @param win - The browser window.
 * @returns Pointer capabilities and viewport size for {@link classifyDevice}.
 */
export function readDeviceSignals(win: Window): DeviceSignals {
  return {
    maxTouchPoints: win.navigator.maxTouchPoints ?? 0,
    coarsePointer: matches(win, "(pointer: coarse)"),
    anyFinePointer: matches(win, "(any-pointer: fine)"),
    canHover: matches(win, "(hover: hover)"),
    viewportWidth: win.innerWidth,
    viewportHeight: win.innerHeight,
  };
}
