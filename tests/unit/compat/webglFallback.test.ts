import { describe, expect, it } from "vitest";
import { isWebGlStartupFailure } from "../../../src/compat/webglFallback";

describe("isWebGlStartupFailure", () => {
  it.each([
    "Uncaught Error: Framebuffer status: Framebuffer Unsupported",
    "Framebuffer status: Framebuffer Incomplete Attachment",
    "Error creating WebGL context.",
    "WebGL: INVALID_OPERATION: texImage2D: no texture bound",
    "Failed to create a WebGL2 context",
  ])("recognises %s", (message) => {
    expect(isWebGlStartupFailure(message)).toBe(true);
  });

  it.each([
    "",
    "TypeError: Cannot read properties of undefined (reading 'scene')",
    "ResizeObserver loop completed with undelivered notifications.",
    "Script error.",
  ])("ignores unrelated error %j", (message) => {
    expect(isWebGlStartupFailure(message)).toBe(false);
  });
});
