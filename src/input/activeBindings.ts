/**
 * activeBindings — applies a keyboard profile's overrides to InputManager.
 *
 * Scenes build their KeyboardAdapter from InputManager's profile in
 * setupSceneInput(), so a new profile applies from the next scene start
 * (or immediately via {@link rebuildSceneInput}).
 */

import type Phaser from "phaser";
import {
  DEFAULT_INPUT_PROFILE,
  DEFAULT_KEYBOARD_BINDINGS,
} from "./DefaultBindings";
import { InputManager } from "./InputManager";
import { applyKeyOverrides, type KeyOverrides } from "./KeyBindings";
import { setupSceneInput } from "./setupSceneInput";

export { activeKeyboardBindings, boundKeyLabel } from "./boundKeyLabel";

/**
 * Make `overrides` the live keyboard profile.
 *
 * @param overrides - Active profile overrides.
 */
export function applyKeyboardOverrides(overrides: KeyOverrides): void {
  InputManager.setProfile({
    ...DEFAULT_INPUT_PROFILE,
    keyboard: applyKeyOverrides(DEFAULT_KEYBOARD_BINDINGS, overrides),
  });
}

/**
 * Re-create a running scene's input adapters from the live profile (after
 * rebinding from a Settings overlay launched over that scene).
 *
 * @param scene - The scene whose adapters to rebuild.
 */
export function rebuildSceneInput(scene: Phaser.Scene): void {
  if (!scene.sys.isActive() && !scene.sys.isPaused()) return;
  setupSceneInput(scene);
}
