/**
 * controlsHint — the quiet flight-controls reminder under the top edge of
 * squad battle screens (Survival, Campaign), in the holo caption style.
 */

import type Phaser from "phaser";
import { HOLO_PALETTE, HOLO_SPACING } from "../theme/HoloTheme";
import { createHoloText } from "../hud/holoPrimitives";

/** Flight controls reminder (two centred lines). */
export const FLIGHT_CONTROLS_HINT =
  "UP/DOWN SPEED · 2×UP BOOST · LEFT/RIGHT TAP DRIFT, HOLD BANK\n" +
  "Q/E HARD TURN · Z SNAP · WEAPONS AUTOFIRE · ESC PAUSE";

/** Hint opacity — present but readable over nebulae and hazard zones. */
const HINT_ALPHA = 0.9;

/**
 * @param scene - Owning scene.
 * @returns The hint text, top centre (add it to a screen-space root).
 */
export function createControlsHint(
  scene: Phaser.Scene,
): Phaser.GameObjects.Text {
  return createHoloText(
    scene,
    scene.scale.width / 2,
    HOLO_SPACING.lg,
    FLIGHT_CONTROLS_HINT,
    "caption",
    HOLO_PALETTE.textSecondary,
  )
    .setOrigin(0.5, 0)
    .setAlign("center")
    .setAlpha(HINT_ALPHA);
}
