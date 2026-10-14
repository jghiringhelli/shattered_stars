/**
 * Pause Menu Component
 *
 * Overlay menu that appears when game is paused. Can be added to any battle
 * scene. Holo look: dimmed battlefield, translucent panel, wide-tracked
 * title and a column of holo buttons (RESUME primary, QUIT danger). While
 * visible, ↑/↓/Tab move a focus ring and ENTER activates.
 */

import Phaser from "phaser";
import { createHoverButton } from "./ButtonFactory";
import { showConfirmDialog } from "./ConfirmDialog";
import { openFeedbackDialog } from "./feedback/feedbackDialog";
import { HoloPanel } from "./hud/HoloPanel";
import type { HoloPressButton } from "./menu/HoloPressButton";
import type { MenuIconName } from "./menu/MenuIcons";
import { MenuFocus } from "./menu/MenuFocus";
import { drawAccentRule } from "./menu/holoChrome";
import { SCREEN_TITLE, MENU_CLEAR_COLOR } from "./menu/MenuScaffold";
import { holoFont } from "./theme/holoFont";
import { HOLO_DEPTH, HOLO_PALETTE } from "./theme/HoloTheme";
import { toCssColor } from "./theme/colorMath";
import type { HoloButtonVariant } from "./hud/holoButtonStyle";

export interface PauseMenuConfig {
  scene: Phaser.Scene;
  onResume: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onQuit: () => void;
}

/** Panel layout (relative to the panel centre). */
const PAUSE_LAYOUT = {
  width: 360,
  height: 372,
  titleY: -142,
  ruleY: -112,
  ruleWidth: 280,
  firstButtonY: -74,
  buttonPitch: 56,
  buttonWidth: 260,
  buttonHeight: 44,
  dimAlpha: 0.7,
} as const;

/** One pause-menu action. */
interface PauseAction {
  readonly label: string;
  readonly variant: HoloButtonVariant;
  readonly icon?: MenuIconName;
  readonly run: () => void;
}

export class PauseMenu extends Phaser.GameObjects.Container {
  private background: Phaser.GameObjects.Graphics;
  private panel: Phaser.GameObjects.Container;
  private onResume: () => void;
  private onRestart: () => void;
  private onSettings: () => void;
  private onQuit: () => void;
  private readonly focus: MenuFocus;

  constructor(config: PauseMenuConfig) {
    super(config.scene, 0, 0);

    this.onResume = config.onResume;
    this.onRestart = config.onRestart;
    this.onSettings = config.onSettings;
    this.onQuit = config.onQuit;

    const width = config.scene.scale.width;
    const height = config.scene.scale.height;

    this.background = config.scene.add.graphics();
    this.background.fillStyle(MENU_CLEAR_COLOR, PAUSE_LAYOUT.dimAlpha);
    this.background.fillRect(0, 0, width, height);
    this.add(this.background);

    this.panel = new HoloPanel(config.scene, width / 2, height / 2, {
      width: PAUSE_LAYOUT.width,
      height: PAUSE_LAYOUT.height,
    });
    config.scene.add.existing(this.panel);
    this.add(this.panel);
    this.addTitle(config.scene);

    // Each button gets its own scrollFactor(0) explicitly — Phaser's pointer
    // hit-testing does not correctly inherit scrollFactor from an ancestor
    // container when the camera is scrolled/zoomed, so relying only on this
    // container's own setScrollFactor(0) below silently breaks clicks on the
    // nested buttons (verified live).
    const buttons = this.buildActions(config.scene).map((action, i) =>
      this.addButton(config.scene, action, i),
    );
    this.focus = new MenuFocus(config.scene, buttons, {
      isActive: () => this.visible,
    });
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.focus.destroy());

    // Set depth and scroll factor
    this.setDepth(HOLO_DEPTH.menuPanel);
    this.setScrollFactor(0);
    this.panel.setScrollFactor(0);

    // Add to scene
    config.scene.add.existing(this);

    // Start hidden
    this.setVisible(false);
  }

  private addTitle(scene: Phaser.Scene): void {
    const title = scene.add
      .text(0, PAUSE_LAYOUT.titleY, "PAUSED", {
        ...holoFont(SCREEN_TITLE.size, SCREEN_TITLE.weight),
        color: toCssColor(HOLO_PALETTE.textPrimary),
      })
      .setLetterSpacing(SCREEN_TITLE.letterSpacing)
      .setOrigin(0.5);
    const rule = scene.add.graphics();
    drawAccentRule(
      rule,
      {
        x: -PAUSE_LAYOUT.ruleWidth / 2,
        y: PAUSE_LAYOUT.ruleY,
        width: PAUSE_LAYOUT.ruleWidth,
        height: 0,
      },
      HOLO_PALETTE.accent,
    );
    this.panel.add([title, rule]);
  }

  private buildActions(scene: Phaser.Scene): PauseAction[] {
    return [
      {
        label: "RESUME",
        variant: "primary",
        run: () => {
          this.hide();
          this.onResume();
        },
      },
      { label: "RESTART", variant: "secondary", run: () => this.onRestart() },
      {
        label: "SETTINGS",
        variant: "secondary",
        icon: "gear",
        run: () => this.onSettings(),
      },
      {
        label: "QUIT TO MENU",
        variant: "danger",
        run: () =>
          showConfirmDialog({
            scene,
            message: "Quit to menu? Battle progress will be lost.",
            onConfirm: () => this.onQuit(),
          }),
      },
      {
        label: "SEND FEEDBACK",
        variant: "secondary",
        run: () =>
          openFeedbackDialog({ game: scene.game, sceneKey: scene.scene.key }),
      },
    ];
  }

  private addButton(
    scene: Phaser.Scene,
    action: PauseAction,
    index: number,
  ): HoloPressButton {
    const button = createHoverButton(
      scene,
      0,
      PAUSE_LAYOUT.firstButtonY + index * PAUSE_LAYOUT.buttonPitch,
      {
        width: PAUSE_LAYOUT.buttonWidth,
        height: PAUSE_LAYOUT.buttonHeight,
        color: HOLO_PALETTE.panelFill,
        variant: action.variant,
        label: action.label,
        font: "600 17px",
        hoverScale: 1.03,
        ...(action.icon !== undefined && { icon: action.icon }),
      },
      action.run,
    ).setScrollFactor(0);
    this.panel.add(button);
    return button;
  }

  show(): void {
    this.setVisible(true);

    // Animate in
    this.panel.setScale(0.9);
    this.panel.setAlpha(0);
    this.background.setAlpha(0);

    this.scene.tweens.add({
      targets: this.background,
      alpha: 1,
      duration: 200,
    });

    this.scene.tweens.add({
      targets: this.panel,
      scale: 1,
      alpha: 1,
      duration: 260,
      ease: "Cubic.Out",
    });
  }

  hide(): void {
    this.focus.clear();
    this.scene.tweens.add({
      targets: [this.background, this.panel],
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.setVisible(false);
      },
    });
  }
}
