/**
 * MenuScaffold — the shared frame every non-battle screen is built on:
 * a dimmed painted-space backdrop, a centred header (title, subtitle,
 * accent rule), a top-left BACK button and a muted footer hint line.
 *
 * Layout grid (1280×720): 32-px outer margin, header band 0–88, content
 * from 104 down to the footer band (last 72 px). Primary actions sit
 * bottom-centre; BACK is always top-left.
 */

import Phaser from "phaser";
import { addPaintedSpaceBackground } from "../TexturedPanel";
import { createHoverButton } from "../ButtonFactory";
import type { HoloPressButton } from "./HoloPressButton";
import { drawAccentRule } from "./holoChrome";
import { holoFont } from "../theme/holoFont";
import {
  HOLO_PALETTE,
  HOLO_SPACING,
  HOLO_TYPE_SCALE,
} from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";

/** Shared layout grid for menu screens. */
export const MENU_LAYOUT = {
  /** Outer margin on every side. */
  margin: HOLO_SPACING.xxl,
  /** Header title baseline centre. */
  titleY: 34,
  /** Subtitle centre. */
  subtitleY: 62,
  /** Accent rule under the header. */
  ruleY: 84,
  /** First content row. */
  contentTop: 104,
  /** Footer hint centre (distance from bottom). */
  footerInset: 16,
  /** Primary-action centre (distance from bottom). */
  primaryInset: 52,
  /** BACK button size. */
  backWidth: 112,
  backHeight: 34,
} as const;

/** Header title type (screen titles are larger than the panel title step). */
export const SCREEN_TITLE = {
  size: 30,
  weight: "300",
  letterSpacing: 8,
} as const;

/** Camera clear colour behind every menu. */
export const MENU_CLEAR_COLOR = 0x03070d;
/** Default opacity of the scrim laid over painted backgrounds. */
const DEFAULT_SCRIM_ALPHA = 0.55;
/** Height of the darker bands at top and bottom (vignette). */
const VIGNETTE_BAND = 120;
const VIGNETTE_ALPHA = 0.6;
/** Number of stacked strips approximating the vignette fade. */
const VIGNETTE_STEPS = 12;
/** Procedural fallback stars when no painted background is loaded. */
const FALLBACK_STAR_COUNT = 140;
const FALLBACK_STAR_SEED = "holo-menu";

/** Backdrop options. */
export interface MenuBackdropOptions {
  /** Painted background id (BootScene `bg_<id>`), e.g. "nebula_purple". */
  readonly textureId?: string;
  /** Scrim opacity over the painting (0 = untouched). */
  readonly scrimAlpha?: number;
}

/**
 * Paint a dimmed space backdrop: painted background (or a seeded starfield
 * fallback), a uniform scrim and darker top/bottom vignette bands.
 *
 * @param scene - Menu scene (camera at zoom 1).
 * @param options - Background id and scrim strength.
 */
export function addMenuBackdrop(
  scene: Phaser.Scene,
  options: MenuBackdropOptions = {},
): void {
  const { width, height } = scene.scale;
  scene.cameras.main.setBackgroundColor(MENU_CLEAR_COLOR);
  const key = options.textureId ? `bg_${options.textureId}` : "";
  if (options.textureId) addPaintedSpaceBackground(scene, options.textureId);
  if (!key || !scene.textures.exists(key)) addFallbackStars(scene);
  const scrim = scene.add.graphics().setDepth(-1);
  scrim.fillStyle(MENU_CLEAR_COLOR, options.scrimAlpha ?? DEFAULT_SCRIM_ALPHA);
  scrim.fillRect(0, 0, width, height);
  drawVignetteBands(scrim, width, height);
}

/**
 * Darken the top and bottom edges with stacked translucent strips. Strips
 * (not fillGradientStyle) because the Canvas renderer — used under
 * automation — ignores gradient fills and would draw a hard band.
 *
 * @param g - Scrim graphics.
 * @param width - Screen width.
 * @param height - Screen height.
 */
function drawVignetteBands(
  g: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
): void {
  const strip = VIGNETTE_BAND / VIGNETTE_STEPS;
  const perStepAlpha = VIGNETTE_ALPHA / VIGNETTE_STEPS;
  for (let i = 0; i < VIGNETTE_STEPS; i++) {
    const reach = VIGNETTE_BAND - i * strip;
    g.fillStyle(MENU_CLEAR_COLOR, perStepAlpha);
    g.fillRect(0, 0, width, reach);
    g.fillRect(0, height - reach, width, reach);
  }
}

/**
 * Seeded static starfield used when the painted background is missing.
 *
 * @param scene - Owning scene.
 */
function addFallbackStars(scene: Phaser.Scene): void {
  const { width, height } = scene.scale;
  const rng = new Phaser.Math.RandomDataGenerator([FALLBACK_STAR_SEED]);
  const g = scene.add.graphics().setDepth(-2);
  for (let i = 0; i < FALLBACK_STAR_COUNT; i++) {
    g.fillStyle(HOLO_PALETTE.track, rng.realInRange(0.15, 0.6));
    g.fillCircle(
      rng.between(0, width),
      rng.between(0, height),
      rng.realInRange(0.5, 1.4),
    );
  }
}

/** Header options. */
export interface MenuHeaderOptions {
  readonly title: string;
  readonly subtitle?: string;
  /** Accent for the header rule (faction accent when one is in context). */
  readonly accent?: number;
}

/** Objects created by {@link addMenuHeader}. */
export interface MenuHeader {
  readonly title: Phaser.GameObjects.Text;
  readonly subtitle: Phaser.GameObjects.Text | null;
  readonly rule: Phaser.GameObjects.Graphics;
}

/**
 * Centred screen header: wide-tracked light title, optional subtitle and an
 * accent rule spanning the content width.
 *
 * @param scene - Menu scene.
 * @param options - Title, subtitle, accent.
 * @returns The created objects.
 */
export function addMenuHeader(
  scene: Phaser.Scene,
  options: MenuHeaderOptions,
): MenuHeader {
  const { width } = scene.scale;
  const centerX = width / 2;
  const title = scene.add
    .text(centerX, MENU_LAYOUT.titleY, options.title.toUpperCase(), {
      ...holoFont(SCREEN_TITLE.size, SCREEN_TITLE.weight),
      color: toCssColor(HOLO_PALETTE.textPrimary),
    })
    .setLetterSpacing(SCREEN_TITLE.letterSpacing)
    .setOrigin(0.5);
  const subtitle = options.subtitle
    ? scene.add
        .text(centerX, MENU_LAYOUT.subtitleY, options.subtitle, {
          ...holoFont(HOLO_TYPE_SCALE.body.size, HOLO_TYPE_SCALE.body.weight),
          color: toCssColor(HOLO_PALETTE.textSecondary),
        })
        .setLetterSpacing(HOLO_TYPE_SCALE.body.letterSpacing)
        .setOrigin(0.5)
    : null;
  const rule = scene.add.graphics();
  drawAccentRule(
    rule,
    {
      x: MENU_LAYOUT.margin,
      y: MENU_LAYOUT.ruleY,
      width: width - MENU_LAYOUT.margin * 2,
      height: 0,
    },
    options.accent ?? HOLO_PALETTE.accent,
  );
  return { title, subtitle, rule };
}

/**
 * Standard top-left BACK button (chevron icon + label, secondary variant).
 *
 * @param scene - Menu scene.
 * @param onBack - Invoked on press.
 * @param label - Label text. Default "BACK".
 * @returns The button.
 */
export function addBackButton(
  scene: Phaser.Scene,
  onBack: () => void,
  label = "BACK",
): HoloPressButton {
  return createHoverButton(
    scene,
    MENU_LAYOUT.margin + MENU_LAYOUT.backWidth / 2,
    MENU_LAYOUT.titleY,
    {
      width: MENU_LAYOUT.backWidth,
      height: MENU_LAYOUT.backHeight,
      color: HOLO_PALETTE.panelFill,
      variant: "secondary",
      label,
      font: "600 14px",
      icon: "back",
    },
    onBack,
  );
}

/**
 * Muted single-line hint centred in the footer band.
 *
 * @param scene - Menu scene.
 * @param text - Hint text.
 * @returns The text object.
 */
export function addFooterHint(
  scene: Phaser.Scene,
  text: string,
): Phaser.GameObjects.Text {
  const { width, height } = scene.scale;
  return scene.add
    .text(width / 2, height - MENU_LAYOUT.footerInset, text, {
      ...holoFont(HOLO_TYPE_SCALE.caption.size, "400"),
      color: toCssColor(HOLO_PALETTE.textMuted),
    })
    .setLetterSpacing(HOLO_TYPE_SCALE.caption.letterSpacing / 2)
    .setOrigin(0.5);
}
