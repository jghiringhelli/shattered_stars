/**
 * holoSetupKit — building blocks for the duel scenes' setup screens in the
 * holographic style: backdrop, title, BACK, section captions, selectable
 * toggles (HoloButton, primary when selected) and the controls footer.
 *
 * Every object is handed to the scene's `track` callback, which pins it to
 * the screen (scrollFactor 0 on it and its children), sets its depth and
 * destroys it when the screen is rebuilt or the battle starts. Buttons stay
 * direct scene children — see the scenes' track() for the click pitfalls.
 */

import Phaser from "phaser";
import { createHoloButton, type HoloButton } from "../../ui/hud/HoloButton";
import { createHoloPanel, type HoloPanel } from "../../ui/hud/HoloPanel";
import { createHoloText } from "../../ui/hud/holoPrimitives";
import { HOLO_PALETTE, HOLO_SPACING } from "../../ui/theme/HoloTheme";
import { duelControlsLine } from "./duelControls";

/** Registers a setup-screen object (pin, depth, later destroy). */
export type TrackSetupObject = (obj: Phaser.GameObjects.GameObject) => void;

/** Depth of the painted menu background, under every tracked object. */
const BACKGROUND_DEPTH = 1999;
/** Battlefield dim over the painted background. */
const BACKDROP_ALPHA = 0.62;
/** Title / subtitle geometry. */
const TITLE = {
  y: 46,
  sizePx: 44,
  letterSpacing: 12,
  subtitleGap: 34,
} as const;
/** BACK button geometry. */
const BACK = { x: 74, y: 44, width: 108, height: 34 } as const;
/** Footer distance from the bottom edge. */
const FOOTER_BOTTOM = 18;
/** Default toggle label size (px). */
const TOGGLE_FONT_PX = 13;

/** A selectable option button. */
export interface HoloToggleSpec {
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly selected: boolean;
  /** Label size (px); default 13. */
  readonly fontPx?: number;
}

/**
 * Painted background (when loaded) dimmed for legibility.
 *
 * @param scene - The setup scene.
 * @param track - Registers the objects.
 */
export function addSetupBackdrop(
  scene: Phaser.Scene,
  track: TrackSetupObject,
): void {
  const { width, height } = scene.scale;
  if (scene.textures.exists("tex_menu_bg")) {
    const image = scene.add
      .image(width / 2, height / 2, "tex_menu_bg")
      .setDisplaySize(width, height);
    track(image);
    image.setDepth(BACKGROUND_DEPTH);
  }
  track(
    scene.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      HOLO_PALETTE.panelFill,
      BACKDROP_ALPHA,
    ),
  );
}

/**
 * Screen title with a caption subtitle under it.
 *
 * @param scene - The setup scene.
 * @param title - e.g. "DOGFIGHT".
 * @param subtitle - e.g. "1v1 quick duels".
 * @param track - Registers the objects.
 */
export function addSetupTitle(
  scene: Phaser.Scene,
  title: string,
  subtitle: string,
  track: TrackSetupObject,
): void {
  const centerX = scene.scale.width / 2;
  track(
    createHoloText(scene, centerX, TITLE.y, title.toUpperCase(), "title")
      .setFontSize(TITLE.sizePx)
      .setLetterSpacing(TITLE.letterSpacing),
  );
  track(
    createHoloText(
      scene,
      centerX,
      TITLE.y + TITLE.subtitleGap,
      subtitle.toUpperCase(),
      "caption",
      HOLO_PALETTE.accent,
    ),
  );
}

/**
 * BACK button in the top-left corner.
 *
 * @param scene - The setup scene.
 * @param onBack - Leaves the screen.
 * @param track - Registers the button.
 * @returns The button.
 */
export function addBackButton(
  scene: Phaser.Scene,
  onBack: () => void,
  track: TrackSetupObject,
): HoloButton {
  const button = createHoloButton(
    scene,
    BACK.x,
    BACK.y,
    { width: BACK.width, height: BACK.height, label: "\u2039 Back" },
    onBack,
  );
  sizeHoloLabel(button, TOGGLE_FONT_PX);
  track(button);
  return button;
}

/**
 * A section caption (e.g. "AI DIFFICULTY").
 *
 * @param scene - The setup scene.
 * @param x - Centre x.
 * @param y - Centre y.
 * @param text - Caption text.
 * @param track - Registers the text.
 */
export function addSectionCaption(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  track: TrackSetupObject,
): void {
  track(
    createHoloText(
      scene,
      x,
      y,
      text.toUpperCase(),
      "caption",
      HOLO_PALETTE.textSecondary,
    ),
  );
}

/**
 * A selectable option: primary variant when selected, secondary otherwise.
 *
 * @param scene - The setup scene.
 * @param position - Centre of the button.
 * @param spec - Size, label, selection and label size.
 * @param onSelect - Called when clicked.
 * @param track - Registers the button.
 * @returns The button.
 */
export function addHoloToggle(
  scene: Phaser.Scene,
  position: { readonly x: number; readonly y: number },
  spec: HoloToggleSpec,
  onSelect: () => void,
  track: TrackSetupObject,
): HoloButton {
  const button = createHoloButton(
    scene,
    position.x,
    position.y,
    {
      width: spec.width,
      height: spec.height,
      label: spec.label,
      variant: spec.selected ? "primary" : "secondary",
    },
    onSelect,
  );
  sizeHoloLabel(button, spec.fontPx ?? TOGGLE_FONT_PX);
  track(button);
  return button;
}

/**
 * A titled section panel (a backdrop only — buttons are not reparented in).
 *
 * @param scene - The setup scene.
 * @param rect - Centre and size.
 * @param config - Header title and accent colour.
 * @param track - Registers the panel.
 * @returns The panel.
 */
export function addSetupPanel(
  scene: Phaser.Scene,
  rect: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  },
  config: { readonly title?: string; readonly accent: number },
  track: TrackSetupObject,
): HoloPanel {
  const panel = createHoloPanel(scene, rect.x, rect.y, {
    width: rect.width,
    height: rect.height,
    accentColor: config.accent,
    ...(config.title === undefined ? {} : { title: config.title }),
  });
  track(panel);
  return panel;
}

/**
 * Controls summary along the bottom edge.
 *
 * @param scene - The setup scene.
 * @param track - Registers the text.
 */
export function addControlsFooter(
  scene: Phaser.Scene,
  track: TrackSetupObject,
): void {
  const { width, height } = scene.scale;
  track(
    createHoloText(
      scene,
      width / 2,
      height - FOOTER_BOTTOM,
      duelControlsLine(),
      "caption",
      HOLO_PALETTE.textMuted,
    ).setLetterSpacing(HOLO_SPACING.xxs / 2),
  );
}

/**
 * Resize a HoloButton's label, keeping the holo font family and weight
 * (HoloButton's `font` option goes through Phaser's setFont, whose string
 * parser keeps only the first word of a multi-word family).
 *
 * @param button - The button.
 * @param px - Label size in pixels.
 * @returns The button.
 */
export function sizeHoloLabel(button: HoloButton, px: number): HoloButton {
  for (const child of button.list) {
    if (child instanceof Phaser.GameObjects.Text) child.setFontSize(px);
  }
  return button;
}
