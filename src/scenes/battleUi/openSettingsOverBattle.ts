/**
 * openSettingsOverBattle — open Settings from a battle's pause menu.
 *
 * Settings is registered before the battle scenes, so a plain `launch`
 * rendered it *under* the paused battle, and clicks fell through to the pause
 * menu. This brings Settings to the top and pauses the battle scene (no
 * update, no input) until Settings closes; SettingsScene resumes it on back,
 * which lands the player on the still-open pause menu.
 */

import type Phaser from "phaser";

/** Scene key of the settings screen. */
export const SETTINGS_SCENE_KEY = "SettingsScene";

/**
 * @param battle - The paused battle scene whose pause menu asked for Settings.
 */
export function openSettingsOverBattle(battle: Phaser.Scene): void {
  const returnScene = battle.scene.key;
  battle.scene.launch(SETTINGS_SCENE_KEY, { returnScene });
  battle.scene.bringToTop(SETTINGS_SCENE_KEY);
  battle.scene.pause();
}
