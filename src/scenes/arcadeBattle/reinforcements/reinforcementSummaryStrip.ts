/**
 * reinforcementSummaryStrip — in a reinforced scenario the scenario's own
 * result screen decides and shows the match; this strip adds the
 * reinforcement summary (ships deployed, pool left) under it, above the
 * result screen's dimming.
 */

import Phaser from "phaser";
import { HoloPanel } from "../../../ui/hud/HoloPanel";
import {
  addPinned,
  createHoloText,
  createScreenContainer,
} from "../../../ui/hud/holoPrimitives";
import {
  HOLO_DEPTH,
  HOLO_PALETTE,
  HOLO_SPACING,
} from "../../../ui/theme/HoloTheme";

const STRIP = { width: 480, lineHeight: 18 } as const;
/** Gap between the strip and the bottom of the screen (px). */
const BOTTOM_GAP = 24;

/**
 * @param scene - The battle scene (camera at zoom 1).
 * @param lines - Summary lines.
 * @returns The strip (destroyed with the scene).
 */
export function showSummaryStrip(
  scene: Phaser.Scene,
  lines: readonly string[],
): Phaser.GameObjects.Container {
  const root = createScreenContainer(scene).setDepth(HOLO_DEPTH.menuPanel + 1);
  const height = HOLO_SPACING.md * 2 + lines.length * STRIP.lineHeight;
  const panel = new HoloPanel(
    scene,
    scene.scale.width / 2,
    scene.scale.height - BOTTOM_GAP - height / 2,
    { width: STRIP.width, height },
  );
  panel.setScrollFactor(0, 0, true);
  root.add(panel);
  lines.forEach((line, i) => {
    const y = -height / 2 + HOLO_SPACING.md + (i + 0.5) * STRIP.lineHeight;
    addPinned(
      panel,
      createHoloText(scene, 0, y, line, "caption", HOLO_PALETTE.textSecondary),
    );
  });
  return root;
}
