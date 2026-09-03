/**
 * Wires the three real input adapters (keyboard, gamepad, touch) into
 * InputManager for a scene. Call setupSceneInput() once in create(), then
 * InputManager.update() once per frame in update(), and teardownSceneInput()
 * in the scene's shutdown().
 */

import type Phaser from "phaser";
import { InputManager } from "./InputManager";
import { KeyboardAdapter } from "./adapters/KeyboardAdapter";
import { GamepadAdapter } from "./adapters/GamepadAdapter";
import { TouchAdapter } from "./adapters/TouchAdapter";

export function setupSceneInput(scene: Phaser.Scene): void {
  const profile = InputManager.getProfile();
  InputManager.registerAdapter(new KeyboardAdapter(scene, profile.keyboard));
  InputManager.registerAdapter(new GamepadAdapter(scene, profile.gamepad));
  InputManager.registerAdapter(new TouchAdapter(scene, profile.touch));
}

export function teardownSceneInput(): void {
  InputManager.unregisterAdapter("keyboard");
  InputManager.unregisterAdapter("gamepad");
  InputManager.unregisterAdapter("touch");
}
