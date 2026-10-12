/**
 * menuTransitions — the one place menu screens get their motion, sound and
 * "back" behaviour, so every screen feels and navigates the same:
 * - transitions: a short fade out → scene start → fade in, one easing,
 *   total under {@link MENU_TRANSITION_BUDGET_MS};
 * - UI sounds: hover / press / back on the UI audio bus (procedural voices);
 * - back: ESC, gamepad B and right-click all do the screen's single back
 *   action (the on-screen BACK button calls the same handler).
 */

import Phaser from "phaser";
import { audioManager } from "../../audio/AudioManager";

/** Menu transition timings (ms) and easing. */
export const MENU_TRANSITION = {
  fadeOutMs: 140,
  fadeInMs: 200,
  ease: "Cubic.Out",
} as const;

/** Upper bound on any menu transition (P0-5 acceptance criterion). */
export const MENU_TRANSITION_BUDGET_MS = 400;

/** UI sound levels on the UI bus. */
const UI_SOUND = { hover: 0.45, press: 0.7, back: 0.6 } as const;
/** Gamepad button index of B / Circle. */
export const GAMEPAD_BACK_BUTTON = 1;
/** Menu clear colour channels for fades (MENU_CLEAR_COLOR 0x03070d). */
const FADE_RGB = [3, 7, 13] as const;
/** Scene data key marking a transition in flight. */
const LEAVING_KEY = "__menuLeaving";

/** Hover / focus-move feedback sound. */
export function playUiHover(): void {
  audioManager.playUiSound("ui_hover", UI_SOUND.hover);
}

/** Press / confirm feedback sound. */
export function playUiPress(): void {
  audioManager.playUiSound("ui_select", UI_SOUND.press);
}

/** Back / cancel feedback sound. */
export function playUiBack(): void {
  audioManager.playUiSound("ui_back", UI_SOUND.back);
}

/**
 * Fade a menu screen in (call at the end of create()).
 *
 * @param scene - Menu scene.
 */
export function fadeInMenu(scene: Phaser.Scene): void {
  scene.data?.set(LEAVING_KEY, false);
  scene.cameras.main.fadeIn(MENU_TRANSITION.fadeInMs, ...FADE_RGB);
}

/**
 * Fade out and start another scene. Repeated calls while leaving are
 * ignored, so a double click can never start two scenes.
 *
 * @param scene - Current scene.
 * @param key - Scene to start.
 * @param data - Data for the target scene.
 */
export function goToScene(
  scene: Phaser.Scene,
  key: string,
  data?: object,
): void {
  if (scene.data?.get(LEAVING_KEY) === true) return;
  scene.data?.set(LEAVING_KEY, true);
  const camera = scene.cameras.main;
  camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
    scene.scene.start(key, data),
  );
  camera.fadeOut(MENU_TRANSITION.fadeOutMs, ...FADE_RGB);
}

/** {@link bindMenuBack} options. */
export interface MenuBackOptions {
  /** Gate (e.g. ignore while a modal / overlay is open). Default: always. */
  readonly isActive?: () => boolean;
  /**
   * Bind ESC too. Default true; false for screens whose ESC first closes a
   * prompt (they call the same back handler themselves).
   */
  readonly escape?: boolean;
}

/**
 * Bind the screen's single back action to ESC, gamepad B and right-click
 * (the browser context menu is suppressed on the canvas). Plays the back
 * sound. Listeners are scene-scoped and die with the scene.
 *
 * @param scene - Menu scene.
 * @param onBack - The back action (same handler as the BACK button).
 * @param options - Gate and whether ESC is bound here.
 */
export function bindMenuBack(
  scene: Phaser.Scene,
  onBack: () => void,
  options: MenuBackOptions = {},
): void {
  const isActive = options.isActive ?? (() => true);
  const back = (): void => {
    if (!isActive() || scene.data?.get(LEAVING_KEY) === true) return;
    playUiBack();
    onBack();
  };
  if (options.escape !== false) scene.input.keyboard?.on("keydown-ESC", back);
  scene.input.mouse?.disableContextMenu();
  scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    if (pointer.rightButtonDown()) back();
  });
  scene.input.gamepad?.on(
    "down",
    (
      _pad: Phaser.Input.Gamepad.Gamepad,
      button: Phaser.Input.Gamepad.Button,
    ) => {
      if (button.index === GAMEPAD_BACK_BUTTON) back();
    },
  );
}
