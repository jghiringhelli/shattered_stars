/**
 * PickerActions — the ship picker's bottom action row: DONE (primary,
 * bottom-centre) and CLEAR ALL (danger, right-aligned under the roster),
 * with arrow/Tab keyboard focus and ENTER to activate.
 */

import Phaser from "phaser";
import { createHoverButton } from "../ButtonFactory";
import { MENU_LAYOUT } from "../menu/MenuScaffold";
import { MenuFocus } from "../menu/MenuFocus";
import { HOLO_PALETTE } from "../theme/HoloTheme";

/** Button sizes. */
const ACTIONS = {
  height: 40,
  doneW: 176,
  clearW: 128,
} as const;

/** Callbacks and placement for {@link addPickerActions}. */
export interface PickerActionsConfig {
  /** Right edge CLEAR ALL aligns to (the roster panel's right edge). */
  readonly clearRight: number;
  readonly onDone: () => void;
  readonly onClear: () => void;
  /** Keyboard focus only works while this is true (e.g. no modal open). */
  readonly isActive: () => boolean;
}

/**
 * Add the action row to a scene.
 *
 * @param scene - Picker scene (camera zoom 1).
 * @param config - Placement and callbacks.
 */
export function addPickerActions(
  scene: Phaser.Scene,
  config: PickerActionsConfig,
): void {
  const { width, height } = scene.scale;
  const y = height - MENU_LAYOUT.primaryInset;
  const done = createHoverButton(
    scene,
    width / 2,
    y,
    {
      width: ACTIONS.doneW,
      height: ACTIONS.height,
      color: HOLO_PALETTE.accent,
      variant: "primary",
      label: "DONE",
      font: "600 16px",
    },
    config.onDone,
  );
  const clear = createHoverButton(
    scene,
    config.clearRight - ACTIONS.clearW / 2,
    y,
    {
      width: ACTIONS.clearW,
      height: ACTIONS.height,
      color: HOLO_PALETTE.danger,
      variant: "danger",
      label: "CLEAR ALL",
      font: "600 14px",
      icon: "close",
    },
    config.onClear,
  );
  const focus = new MenuFocus(scene, [done, clear], {
    columns: 2,
    isActive: config.isActive,
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => focus.destroy());
}
