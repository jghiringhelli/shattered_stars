/**
 * BattlePauseMenu — THE pause menu of every battle scene (replaces the four
 * per-scene layouts): RESUME, RESTART, SETTINGS (opens above the frozen
 * battle and returns here), CONTROLS (hotkey legend), SEND FEEDBACK and
 * QUIT TO MENU with confirmation. ↑/↓ + ENTER / D-pad + A navigate
 * (MenuFocus), R restarts, F1 / `?` open the legend from anywhere in the
 * battle. The caller resets camera zoom to 1.0 before showing it
 * (scrollFactor(0) hit-testing breaks under zoom).
 */

import Phaser from "phaser";
import type { FactionId } from "../../config";
import { createHoloButton, type HoloButton } from "../../ui/hud/HoloButton";
import { createHoloPanel } from "../../ui/hud/HoloPanel";
import { HOLO_DEPTH, HOLO_SPACING } from "../../ui/theme/HoloTheme";
import { showConfirmDialog } from "../../ui/ConfirmDialog";
import { MenuFocus } from "../../ui/menu/MenuFocus";
import { openFeedbackDialog } from "../../ui/feedback/feedbackDialog";
import { openHotkeyLegend } from "../../ui/legend/hotkeyLegend";
import type { LegendContext } from "../../ui/legend/hotkeyLegendModel";
import { openSettingsOverBattle } from "./openSettingsOverBattle";
import {
  pauseEntries,
  QUIT_CONFIRM_MESSAGE,
  type PauseEntryId,
} from "./pauseMenuModel";

/** Battlefield dimming behind the menu. */
const DIM_ALPHA = 0.65;
/** Panel and button geometry. */
const LAYOUT = {
  panelWidth: 340,
  buttonWidth: 260,
  buttonHeight: 42,
  buttonPitch: 52,
  headerAllowance: 44,
} as const;

/** Callbacks and look of the pause menu. */
export interface BattlePauseMenuConfig {
  readonly scene: Phaser.Scene;
  /** Faction whose accent borders the panel. */
  readonly faction?: FactionId;
  /** Online matches show LEAVE MATCH and never freeze the battle. */
  readonly online?: boolean;
  /** Which controls the hotkey legend lists. */
  readonly legend: LegendContext;
  /** The menu closed through RESUME. */
  readonly onResume: () => void;
  /** Start the battle over (rematch). */
  readonly onRestart: () => void;
  /** Leave to the main menu (after confirmation). */
  readonly onQuit: () => void;
  /** Freeze the battle (when it is running) so the legend hotkey can open. */
  readonly ensurePaused?: () => void;
}

/** The shared battle pause menu, hidden until {@link BattlePauseMenu.show}. */
export class BattlePauseMenu {
  private readonly root: Phaser.GameObjects.Container;
  private readonly focus: MenuFocus;
  private readonly detach: () => void;
  private destroyed = false;

  /** @param config - Owning scene, accent and callbacks. */
  constructor(private readonly config: BattlePauseMenuConfig) {
    const { scene } = config;
    const { width, height } = scene.scale;
    const entries = pauseEntries(config.online === true);
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
    const buttons: HoloButton[] = entries.map((entry, index) =>
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
        () => this.run(entry.id),
      ),
    );
    this.root = scene.add
      .container(0, 0, [dim, panel, ...buttons])
      .setDepth(HOLO_DEPTH.menuPanel)
      .setScrollFactor(0, 0, true)
      .setVisible(false);
    this.focus = new MenuFocus(scene, buttons, {
      isActive: () => this.root.visible,
    });
    this.detach = this.bindHotkeys(scene);
    this.root.once(Phaser.GameObjects.Events.DESTROY, () => this.teardown());
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
    this.focus.clear();
    this.root.setVisible(false);
  }

  /** Open the hotkey legend (the battle is frozen first when offline). */
  openLegend(): void {
    if (!this.root.visible) this.config.ensurePaused?.();
    openHotkeyLegend({ context: this.config.legend });
  }

  /** Remove listeners and the menu's objects. */
  destroy(): void {
    this.teardown();
    if (this.root.scene) this.root.destroy();
  }

  /** Release listeners (runs once, also when the scene destroys the menu). */
  private teardown(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.detach();
    this.focus.destroy();
  }

  private run(id: PauseEntryId): void {
    const { scene } = this.config;
    switch (id) {
      case "resume":
        this.hide();
        this.config.onResume();
        return;
      case "restart":
        this.config.onRestart();
        return;
      case "settings":
        openSettingsOverBattle(scene);
        return;
      case "controls":
        this.openLegend();
        return;
      case "feedback":
        openFeedbackDialog({ game: scene.game, sceneKey: scene.scene.key });
        return;
      case "quit":
      case "leave":
        showConfirmDialog({
          scene,
          message: QUIT_CONFIRM_MESSAGE,
          onConfirm: this.config.onQuit,
        });
    }
  }

  /** @returns Unsubscribe for the F1 / `?` / R keys. */
  private bindHotkeys(scene: Phaser.Scene): () => void {
    const keyboard = scene.input.keyboard;
    if (!keyboard) return () => undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "F1" || event.key === "?") {
        event.preventDefault();
        this.openLegend();
        return;
      }
      const restartable = pauseEntries(this.config.online === true).some(
        (entry) => entry.id === "restart",
      );
      if (event.key.toLowerCase() === "r" && this.root.visible && restartable)
        this.config.onRestart();
    };
    keyboard.on("keydown", onKey);
    return () => keyboard.off("keydown", onKey);
  }
}
