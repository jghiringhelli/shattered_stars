/**
 * HoloPauseOverlay — the holographic pause menu for battle scenes: a dimmed
 * battlefield, a HoloPanel and HoloButtons (resume, restart, settings, quit
 * with confirmation, bug report). The caller resets camera zoom to 1.0
 * before showing it (scrollFactor(0) hit-testing breaks under zoom).
 */

import Phaser from "phaser";
import type { FactionId } from "../../config";
import {
  createHoloButton,
  type HoloButtonVariant,
} from "../../ui/hud/HoloButton";
import { createHoloPanel } from "../../ui/hud/HoloPanel";
import { HOLO_DEPTH, HOLO_SPACING } from "../../ui/theme/HoloTheme";
import { showConfirmDialog } from "../../ui/ConfirmDialog";
import { openBugReport } from "../../utils/BugReport";

/** Battlefield dimming behind the menu. */
const DIM_ALPHA = 0.6;
/** Panel and button geometry. */
const LAYOUT = {
  panelWidth: 320,
  buttonWidth: 240,
  buttonHeight: 44,
  buttonPitch: 56,
  headerAllowance: 40,
} as const;

/** Callbacks and look of a pause overlay. */
export interface HoloPauseOverlayConfig {
  readonly scene: Phaser.Scene;
  /** Faction whose accent borders the panel. */
  readonly faction?: FactionId;
  readonly onResume: () => void;
  readonly onRestart: () => void;
  readonly onSettings: () => void;
  readonly onQuit: () => void;
}

/** One pause-menu entry. */
interface PauseEntry {
  readonly label: string;
  readonly variant: HoloButtonVariant;
  readonly onClick: () => void;
}

/** Holographic pause menu, hidden until {@link HoloPauseOverlay.show}. */
export class HoloPauseOverlay {
  private readonly root: Phaser.GameObjects.Container;

  /**
   * @param config - Owning scene, accent and menu callbacks.
   */
  constructor(config: HoloPauseOverlayConfig) {
    const { scene } = config;
    const { width, height } = scene.scale;
    const entries = this.entries(config);
    const panelHeight =
      LAYOUT.headerAllowance +
      entries.length * LAYOUT.buttonPitch +
      HOLO_SPACING.lg;
    const dim = scene.add
      .rectangle(0, 0, width, height, 0x000000, DIM_ALPHA)
      .setOrigin(0)
      .setInteractive();
    const panel = createHoloPanel(scene, width / 2, height / 2, {
      width: LAYOUT.panelWidth,
      height: panelHeight,
      title: "Paused",
      ...(config.faction ? { faction: config.faction } : {}),
    });
    const firstY =
      height / 2 -
      panelHeight / 2 +
      LAYOUT.headerAllowance +
      LAYOUT.buttonPitch / 2;
    const buttons = entries.map((entry, index) =>
      createHoloButton(
        scene,
        width / 2,
        firstY + index * LAYOUT.buttonPitch,
        {
          width: LAYOUT.buttonWidth,
          height: LAYOUT.buttonHeight,
          label: entry.label,
          variant: entry.variant,
        },
        entry.onClick,
      ),
    );
    this.root = scene.add
      .container(0, 0, [dim, panel, ...buttons])
      .setDepth(HOLO_DEPTH.menuPanel)
      .setScrollFactor(0, 0, true)
      .setVisible(false);
  }

  /** Whether the menu is showing. */
  get isVisible(): boolean {
    return this.root.visible;
  }

  /** Show the menu. */
  show(): void {
    this.root.setVisible(true);
  }

  /** Hide the menu. */
  hide(): void {
    this.root.setVisible(false);
  }

  private entries(config: HoloPauseOverlayConfig): PauseEntry[] {
    const { scene } = config;
    return [
      {
        label: "Resume",
        variant: "primary",
        onClick: () => {
          this.hide();
          config.onResume();
        },
      },
      { label: "Restart", variant: "secondary", onClick: config.onRestart },
      { label: "Settings", variant: "secondary", onClick: config.onSettings },
      {
        label: "Quit to menu",
        variant: "danger",
        onClick: () =>
          showConfirmDialog({
            scene,
            message: "Quit to menu? Battle progress will be lost.",
            onConfirm: config.onQuit,
          }),
      },
      {
        label: "Report bug",
        variant: "secondary",
        onClick: () => openBugReport({ sceneKey: scene.scene.key }),
      },
    ];
  }
}
