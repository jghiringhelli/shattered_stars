/**
 * ButtonFactory — shared UI button constructors, rendered in the holographic
 * menu style (HoloTheme tokens, same variant table as HoloButton).
 *
 * Provides two generic button primitives:
 *  - createHoverButton  — action button; the legacy fill `color` picks the
 *                         holo variant (green → primary, red → danger,
 *                         anything else → secondary) unless `variant` is set
 *  - createToggleButton — two-state (selected/unselected) option button; the
 *                         selected state is tinted with `selectedColor`
 *
 * Contract kept from the legacy factory: buttons fire on pointer *press*, hit
 * areas are rectangles centred on the container, and the returned containers
 * are added to the scene root — re-parent with `parentContainer.add(btn)`.
 * Keep them on screens at camera zoom 1 (scrollFactor(0) hit-test pitfall).
 */

import Phaser from "phaser";
import { punch } from "./UIJuice";
import { HoloPressButton } from "./menu/HoloPressButton";
import type { MenuIconName } from "./menu/MenuIcons";
import { drawHoloFrame } from "./menu/holoChrome";
import type { HoloButtonVariant } from "./hud/holoButtonStyle";
import { variantForColor } from "./theme/buttonVariant";
import { holoFont, parseCssFont } from "./theme/holoFont";
import { HOLO_BORDER, HOLO_PALETTE, HOLO_RADIUS } from "./theme/HoloTheme";
import { liftColor, toCssColor } from "./theme/colorMath";

/** Configuration for {@link createHoverButton}. */
export interface HoverButtonConfig {
  /** Button width in pixels. */
  readonly width: number;
  /** Button height in pixels. */
  readonly height: number;
  /** Corner radius. Default: HOLO_RADIUS.md. */
  readonly radius?: number;
  /** Legacy fill colour — selects the holo variant when `variant` is unset. */
  readonly color: number;
  /** Ignored (legacy); hover styling comes from the holo variant. */
  readonly hoverColor?: number;
  /** Button label (kept verbatim). */
  readonly label: string;
  /** CSS font shorthand; only size and weight are used. Default 'bold 18px'. */
  readonly font?: string;
  /** Ignored (legacy); label colour comes from the holo variant. */
  readonly textColor?: string;
  /** Text scale multiplier applied on hover. Default: 1 (no scale change). */
  readonly hoverScale?: number;
  /** Explicit holo variant; overrides the colour mapping. */
  readonly variant?: HoloButtonVariant;
  /** Optional glyph drawn left of the label. */
  readonly icon?: MenuIconName;
}

/** Default label font of the legacy factory. */
const DEFAULT_BUTTON_FONT = "bold 18px Arial";
/** "bold" renders as the holo semibold weight. */
const HOLO_BOLD = "600";

/**
 * Map legacy weight keywords onto the holo weights.
 *
 * @param weight - Weight keywords from the CSS shorthand.
 * @returns The weight to render with.
 */
function holoWeight(weight: string): string {
  return weight.replace(/\bbold\b/, HOLO_BOLD);
}

/**
 * Create a holographic action button Container positioned at (x, y).
 *
 * @param scene   - The Phaser scene to create objects in.
 * @param x       - Center X in the parent coordinate space.
 * @param y       - Center Y in the parent coordinate space.
 * @param config  - Size, label and (legacy) colour / explicit variant.
 * @param onClick - Callback invoked on pointerdown.
 * @returns An interactive button container (focus/enabled/label setters).
 */
export function createHoverButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  config: HoverButtonConfig,
  onClick: () => void,
): HoloPressButton {
  const { size, weight } = parseCssFont(config.font ?? DEFAULT_BUTTON_FONT);
  const button = new HoloPressButton(
    scene,
    x,
    y,
    {
      width: config.width,
      height: config.height,
      label: config.label,
      variant: config.variant ?? variantForColor(config.color),
      radius: config.radius ?? HOLO_RADIUS.md,
      fontSize: size,
      fontWeight: holoWeight(weight),
      hoverScale: config.hoverScale ?? 1,
      ...(config.icon !== undefined && { icon: config.icon }),
    },
    onClick,
  );
  return scene.add.existing(button);
}

/** Configuration for {@link createToggleButton}. */
export interface ToggleButtonConfig {
  /** Button width in pixels. */
  readonly width: number;
  /** Button height in pixels. */
  readonly height: number;
  /** Corner radius. Default: HOLO_RADIUS.sm. */
  readonly radius?: number;
  /** Tint of the selected state (lifted for legibility, e.g. a faction colour). */
  readonly selectedColor: number;
  /** Ignored (legacy); unselected buttons use the neutral panel fill. */
  readonly normalColor: number;
  /** Border colour when selected. Default: lifted `selectedColor`. */
  readonly strokeColor?: number;
  /** Font used when not selected. Default: '12px'. */
  readonly font?: string;
  /** Font used when selected. Default: 'bold 12px'. */
  readonly selectedFont?: string;
}

/** How far a selected toggle's tint is lifted toward white. */
const TOGGLE_ACCENT_LIFT = 0.35;
/** Fill opacity of a selected toggle's tint. */
const TOGGLE_SELECTED_FILL_ALPHA = 0.4;
/** Punch tween applied on press. */
const TOGGLE_PUNCH = { scale: 1.06, durationMs: 160 } as const;

/**
 * Create a two-state selection button whose appearance reflects selected vs.
 * unselected. Used for option pickers (faction, difficulty, pilot, etc.).
 *
 * @param scene    - The Phaser scene to create objects in.
 * @param x        - Center X in the parent coordinate space.
 * @param y        - Center Y in the parent coordinate space.
 * @param label    - Button label text.
 * @param selected - Initial selected state controlling fill, border and text.
 * @param config   - Visual configuration.
 * @param onClick  - Callback invoked on pointerdown.
 * @returns An interactive Container ([bg, text, hitArea]).
 */
export function createToggleButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  selected: boolean,
  config: ToggleButtonConfig,
  onClick: () => void,
): Phaser.GameObjects.Container {
  const { width, height } = config;
  const accent = liftColor(
    config.strokeColor ?? config.selectedColor,
    TOGGLE_ACCENT_LIFT,
  );
  const container = scene.add.container(x, y);
  const bg = scene.add.graphics();
  const draw = (hover: boolean): void => {
    bg.clear();
    drawToggleFace(bg, { width, height, accent, selected, hover }, config);
  };
  draw(false);

  const font = parseCssFont(
    selected ? (config.selectedFont ?? "bold 12px") : (config.font ?? "12px"),
  );
  const text = scene.add
    .text(0, 0, label, {
      ...holoFont(font.size, holoWeight(font.weight)),
      color: toCssColor(
        selected ? HOLO_PALETTE.textPrimary : HOLO_PALETTE.textSecondary,
      ),
    })
    .setLetterSpacing(0.5)
    .setOrigin(0.5);

  const hitArea = scene.add
    .rectangle(0, 0, width, height)
    .setInteractive({ useHandCursor: true });
  container.add([bg, text, hitArea]);
  hitArea.on("pointerover", () => draw(true));
  hitArea.on("pointerout", () => draw(false));
  hitArea.on("pointerdown", () => {
    punch(scene, container, TOGGLE_PUNCH);
    onClick();
  });

  return container;
}

/** Inputs for {@link drawToggleFace}. */
interface ToggleFaceState {
  readonly width: number;
  readonly height: number;
  readonly accent: number;
  readonly selected: boolean;
  readonly hover: boolean;
}

/**
 * Draw a toggle's face centred on the origin.
 *
 * @param g - Target graphics (already cleared).
 * @param state - Size, accent and interaction state.
 * @param config - Toggle config (radius).
 */
function drawToggleFace(
  g: Phaser.GameObjects.Graphics,
  state: ToggleFaceState,
  config: ToggleButtonConfig,
): void {
  const { width, height, accent, selected, hover } = state;
  const rect = { x: -width / 2, y: -height / 2, width, height };
  const radius = config.radius ?? HOLO_RADIUS.sm;
  if (selected) {
    drawHoloFrame(g, rect, {
      radius,
      fill: accent,
      fillAlpha: TOGGLE_SELECTED_FILL_ALPHA,
      accent,
      borderWidth: HOLO_BORDER.regular,
      borderAlpha: 1,
    });
    return;
  }
  drawHoloFrame(g, rect, {
    radius,
    accent: hover ? HOLO_PALETTE.accent : HOLO_PALETTE.border,
    fill: hover ? HOLO_PALETTE.panelFillRaised : HOLO_PALETTE.panelFill,
  });
}
