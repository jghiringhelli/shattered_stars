/**
 * PickerWelcomeBanner — one-time explainer shown by the ship picker to a
 * brand-new (0 XP) profile: why most rows look locked. A modal HoloPanel
 * over a dim layer with a primary "GOT IT" button (press to dismiss; ENTER
 * or SPACE also dismiss).
 */

import type Phaser from "phaser";
import { createHoverButton } from "../ButtonFactory";
import { createHoloPanel } from "../hud/HoloPanel";
import { MENU_CLEAR_COLOR } from "../menu/MenuScaffold";
import { HOLO_PALETTE, HOLO_SPACING } from "../theme/HoloTheme";
import { addPickerText } from "./pickerStyle";

/** Banner layout. */
const BANNER = {
  width: 480,
  height: 200,
  depth: 300,
  dimAlpha: 0.55,
  /** Body copy top, below the panel's header strip. */
  bodyTop: 44,
  bodyLineSpacing: 4,
  buttonW: 144,
  buttonH: 40,
  buttonInset: HOLO_SPACING.lg,
} as const;

const WELCOME_TEXT =
  "Your fleet grows as you play. You start with a small roster of\n" +
  "workhorses and light fighters \u2014 the \u2605 STARTER ship is a solid\n" +
  "first pick. Win battles to earn XP and unlock aces, gunships,\n" +
  "support ships, more factions, and eventually capital ships.";

/**
 * Full-screen dim plus an input blocker so the picker underneath stays
 * inert while the banner is up.
 *
 * @param scene - Picker scene.
 * @returns The dim graphics and the blocker.
 */
function modalLayer(scene: Phaser.Scene): Phaser.GameObjects.GameObject[] {
  const { width: w, height: h } = scene.scale;
  const dim = scene.add.graphics();
  dim.fillStyle(MENU_CLEAR_COLOR, BANNER.dimAlpha);
  dim.fillRect(0, 0, w, h);
  const blocker = scene.add
    .rectangle(w / 2, h / 2, w, h, 0, 0)
    .setInteractive();
  return [dim, blocker];
}

/**
 * Show the welcome banner centred on screen.
 *
 * @param scene - Picker scene.
 * @param accent - Faction accent for the panel border/header.
 * @param onDismiss - Called once after the banner is destroyed.
 * @returns The overlay container (destroyed on dismiss).
 */
export function showPickerWelcomeBanner(
  scene: Phaser.Scene,
  accent: number,
  onDismiss: () => void,
): Phaser.GameObjects.Container {
  const { width: w, height: h } = scene.scale;
  const overlay = scene.add.container(0, 0).setDepth(BANNER.depth);
  const panel = createHoloPanel(scene, w / 2, h / 2, {
    width: BANNER.width,
    height: BANNER.height,
    accentColor: accent,
    title: "Welcome, Commander",
    fillAlpha: 0.94,
  });
  const top = h / 2 - BANNER.height / 2;
  const body = addPickerText(
    scene,
    { x: w / 2, y: top + BANNER.bodyTop },
    WELCOME_TEXT,
    "body",
    HOLO_PALETTE.textSecondary,
  )
    .setAlign("center")
    .setLineSpacing(BANNER.bodyLineSpacing)
    .setOrigin(0.5, 0);

  let dismissed = false;
  const dismiss = (): void => {
    if (dismissed) return;
    dismissed = true;
    scene.input.keyboard?.off("keydown-ENTER", dismiss);
    scene.input.keyboard?.off("keydown-SPACE", dismiss);
    overlay.destroy();
    onDismiss();
  };
  const button = createHoverButton(
    scene,
    w / 2,
    top + BANNER.height - BANNER.buttonInset - BANNER.buttonH / 2,
    {
      width: BANNER.buttonW,
      height: BANNER.buttonH,
      color: HOLO_PALETTE.accent,
      variant: "primary",
      label: "GOT IT",
      font: "600 14px",
    },
    dismiss,
  );
  overlay.add([...modalLayer(scene), panel, body, button]);
  scene.input.keyboard?.on("keydown-ENTER", dismiss);
  scene.input.keyboard?.on("keydown-SPACE", dismiss);
  return overlay;
}
