/**
 * Browser-side collection for feedback: the facts of `FeedbackEnvironment`
 * read from the page and the running Phaser game. Nothing here identifies a
 * person (no IP, no account, no storage dump).
 */

import type { FeedbackEnvironment } from "./feedbackBundle";

/** Phaser renderer type constants (Phaser.CANVAS / Phaser.WEBGL). */
const PHASER_CANVAS = 1;
const PHASER_WEBGL = 2;

/** The slice of Phaser.Game feedback reads (structural, so tests need no Phaser). */
export interface FeedbackGame {
  readonly loop?: { readonly actualFps?: number };
  readonly renderer?: { readonly type?: number; readonly gl?: unknown };
  readonly scene?: {
    getScenes(isActive?: boolean): ReadonlyArray<{
      readonly scene: { readonly key: string };
    }>;
  };
}

/** @returns The unmasked GPU string when the browser exposes it. */
function gpuName(gl: unknown): string | null {
  try {
    const context = gl as WebGLRenderingContext | undefined;
    const info = context?.getExtension("WEBGL_debug_renderer_info");
    if (!context || !info) return null;
    const value: unknown = context.getParameter(info.UNMASKED_RENDERER_WEBGL);
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

/**
 * @param game - The running game (may be absent very early).
 * @returns Keys of the scenes currently running.
 */
export function activeSceneKeys(game: FeedbackGame | undefined): string[] {
  return game?.scene?.getScenes(true).map((s) => s.scene.key) ?? [];
}

/**
 * @param game - The running game.
 * @param win - The page window.
 * @returns Browser, screen, renderer, GPU and FPS facts.
 */
export function collectEnvironment(
  game: FeedbackGame | undefined,
  win: Window = window,
): FeedbackEnvironment {
  const type = game?.renderer?.type;
  const fps = game?.loop?.actualFps;
  const nav = win.navigator;
  return {
    userAgent: nav.userAgent,
    language: nav.language,
    screen: {
      width: win.screen.width,
      height: win.screen.height,
      pixelRatio: win.devicePixelRatio,
    },
    viewport: { width: win.innerWidth, height: win.innerHeight },
    renderer:
      type === PHASER_WEBGL
        ? "webgl"
        : type === PHASER_CANVAS
          ? "canvas"
          : "unknown",
    gpu: type === PHASER_WEBGL ? gpuName(game?.renderer?.gl) : null,
    fps: typeof fps === "number" ? Math.round(fps * 10) / 10 : null,
    touch: nav.maxTouchPoints > 0,
    hardwareConcurrency: nav.hardwareConcurrency ?? null,
  };
}
