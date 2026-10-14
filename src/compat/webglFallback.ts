/**
 * WebGL start-up fallback: a browser can hand out a WebGL context that then
 * fails while Phaser builds its first framebuffers ("Framebuffer status:
 * Framebuffer Unsupported", a lost context). The error is thrown inside
 * Phaser's boot, so the game never starts and the page stays black. This
 * module spots such an error before the game reports READY and asks main.ts to
 * start again on Canvas, with the compatibility banner.
 */

import { detectSupport } from "./browserSupport";
import { showSupportBanner } from "./compatNotice";
import { probeSupportEnvironment } from "./probeEnvironment";

const WEBGL_STARTUP_FAILURE = /framebuffer status|webgl|gl context/i;

/** The slice of Phaser's game events this guard needs. */
export interface ReadyEvents {
  once(event: string, listener: () => void): unknown;
}

/** Name of Phaser's "boot finished" game event (Phaser.Core.Events.READY). */
export const GAME_READY_EVENT = "ready";

/**
 * @param message - An uncaught error's message.
 * @returns True when it looks like a WebGL initialisation failure.
 */
export function isWebGlStartupFailure(message: string): boolean {
  return WEBGL_STARTUP_FAILURE.test(message);
}

/**
 * Watch for a WebGL failure until the game is READY; on the first one, show
 * the compatibility banner and call `restartOnCanvas` once.
 *
 * @param win - The page window.
 * @param events - The game's event emitter (to learn when boot finished).
 * @param restartOnCanvas - Destroys the failed game and starts a Canvas one.
 */
export function guardWebGlStartup(
  win: Window,
  events: ReadyEvents,
  restartOnCanvas: () => void,
): void {
  const onError = (event: ErrorEvent): void => {
    if (!isWebGlStartupFailure(event.message)) return;
    win.removeEventListener("error", onError);
    const report = detectSupport({ ...probeSupportEnvironment(win), webgl: false });
    showSupportBanner(win.document, report);
    restartOnCanvas();
  };
  win.addEventListener("error", onError);
  events.once(GAME_READY_EVENT, () => win.removeEventListener("error", onError));
}
