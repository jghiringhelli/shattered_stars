/**
 * HoloResultScreen — the holographic end-of-battle screen: VICTORY / DEFEAT
 * title, a subtitle, stat rows and a row of HoloButtons, in a HoloPanel over
 * the dimmed battlefield. Resets camera zoom to 1.0 so the buttons hit-test.
 */

import Phaser from "phaser";
import {
  createHoloButton,
  type HoloButtonVariant,
} from "../../ui/hud/HoloButton";
import { createHoloPanel } from "../../ui/hud/HoloPanel";
import { createHoloText } from "../../ui/hud/holoPrimitives";
import {
  HOLO_DEPTH,
  HOLO_PALETTE,
  HOLO_SPACING,
} from "../../ui/theme/HoloTheme";

/** Battlefield dimming behind the panel. */
const DIM_ALPHA = 0.7;
/** Panel geometry. */
const LAYOUT = {
  width: 520,
  titleBlock: 110,
  statPitch: 30,
  buttonBlock: 90,
  buttonWidth: 180,
  buttonHeight: 48,
  statInset: 60,
} as const;
/** Title size boost over the type scale's "title" role. */
const TITLE_SCALE = 1.6;

/** One stat row. */
export interface ResultStat {
  readonly label: string;
  readonly value: string;
}

/** One action button. */
export interface ResultAction {
  readonly label: string;
  readonly variant: HoloButtonVariant;
  readonly onClick: () => void;
}

/** Everything the result screen shows. */
export interface HoloResultScreenConfig {
  readonly scene: Phaser.Scene;
  readonly victory: boolean;
  readonly subtitle: string;
  readonly stats: readonly ResultStat[];
  readonly actions: readonly ResultAction[];
}

/**
 * Show the end-of-battle screen.
 *
 * @param config - Outcome, stats and actions.
 * @returns The screen's root container (screen space).
 */
export function showHoloResultScreen(
  config: HoloResultScreenConfig,
): Phaser.GameObjects.Container {
  const { scene } = config;
  scene.cameras.main.setZoom(1);
  const { width, height } = scene.scale;
  const panelHeight =
    LAYOUT.titleBlock +
    config.stats.length * LAYOUT.statPitch +
    LAYOUT.buttonBlock;
  const top = height / 2 - panelHeight / 2;
  const dim = scene.add
    .rectangle(0, 0, width, height, 0x000000, DIM_ALPHA)
    .setOrigin(0)
    .setInteractive();
  const panel = createHoloPanel(scene, width / 2, height / 2, {
    width: LAYOUT.width,
    height: panelHeight,
    accentColor: config.victory ? HOLO_PALETTE.success : HOLO_PALETTE.danger,
  });
  const root = scene.add.container(0, 0, [dim, panel]);
  root.add(titleTexts(config, width / 2, top));
  root.add(statTexts(config, width / 2, top + LAYOUT.titleBlock));
  root.add(
    actionButtons(
      config,
      width / 2,
      top + panelHeight - LAYOUT.buttonBlock / 2,
    ),
  );
  return root.setDepth(HOLO_DEPTH.menuPanel).setScrollFactor(0, 0, true);
}

function titleTexts(
  config: HoloResultScreenConfig,
  centerX: number,
  top: number,
): Phaser.GameObjects.Text[] {
  const color = config.victory ? HOLO_PALETTE.success : HOLO_PALETTE.danger;
  const title = createHoloText(
    config.scene,
    centerX,
    top + HOLO_SPACING.xxl + HOLO_SPACING.sm,
    config.victory ? "VICTORY" : "DEFEAT",
    "title",
    color,
  );
  title.setScale(TITLE_SCALE);
  const subtitle = createHoloText(
    config.scene,
    centerX,
    top + LAYOUT.titleBlock - HOLO_SPACING.xl,
    config.subtitle,
    "body",
    HOLO_PALETTE.textSecondary,
  );
  return [title, subtitle];
}

function statTexts(
  config: HoloResultScreenConfig,
  centerX: number,
  top: number,
): Phaser.GameObjects.Text[] {
  const left = centerX - LAYOUT.width / 2 + LAYOUT.statInset;
  const right = centerX + LAYOUT.width / 2 - LAYOUT.statInset;
  return config.stats.flatMap((stat, index) => {
    const y = top + index * LAYOUT.statPitch + LAYOUT.statPitch / 2;
    return [
      createHoloText(
        config.scene,
        left,
        y,
        stat.label.toUpperCase(),
        "caption",
        HOLO_PALETTE.textSecondary,
      ).setOrigin(0, 0.5),
      createHoloText(config.scene, right, y, stat.value, "numeric").setOrigin(
        1,
        0.5,
      ),
    ];
  });
}

function actionButtons(
  config: HoloResultScreenConfig,
  centerX: number,
  y: number,
): Phaser.GameObjects.Container[] {
  const pitch = LAYOUT.buttonWidth + HOLO_SPACING.lg;
  const firstX = centerX - ((config.actions.length - 1) * pitch) / 2;
  return config.actions.map((action, index) =>
    createHoloButton(
      config.scene,
      firstX + index * pitch,
      y,
      {
        width: LAYOUT.buttonWidth,
        height: LAYOUT.buttonHeight,
        label: action.label,
        variant: action.variant,
      },
      action.onClick,
    ),
  );
}
