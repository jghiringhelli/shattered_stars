/**
 * ReinforcementPicker — the quick picker shown while the player's ship is
 * down: up to six rows (the next reserve ship first, marked NEXT; then the
 * reserve's other ships and, in open matches, one ship per role), each a
 * HoloButton numbered for keys 1–6; disabled rows carry the refusal
 * reason. A countdown line says when the default deploys (Enter deploys it
 * now). The battle keeps running underneath; the scene keeps the camera at
 * zoom 1 while it is open so the buttons hit-test correctly.
 */

import Phaser from "phaser";
import type { PickerView } from "../../../arcade/reinforcements";
import { PICKER_MAX_OPTIONS } from "../../../arcade/reinforcements";
import { createHoloButton, type HoloButton } from "../../../ui/hud/HoloButton";
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
import { setText } from "../hudPanelParts";
import { countdownLabel, pickerRowLabel } from "./reinforcementHudModel";

const ROW = { width: 440, height: 28, pitch: 34, font: "600 12px" } as const;
const TITLE_HEIGHT = 28;
const PANEL_WIDTH = ROW.width + HOLO_SPACING.lg * 2;
const PANEL_HEIGHT =
  TITLE_HEIGHT +
  HOLO_SPACING.md * 2 +
  PICKER_MAX_OPTIONS * ROW.pitch +
  HOLO_SPACING.xl;
/** Panel centre as a share of the screen height (below the centre line). */
const PANEL_Y_SHARE = 0.52;
/** Above the HUD and its edge arrows, below pause / end overlays. */
const PICKER_DEPTH = HOLO_DEPTH.hudIndicators + 5;

/** Digit keys → row index. */
const KEY_ROWS: Readonly<Record<string, number>> = {
  "1": 0,
  "2": 1,
  "3": 2,
  "4": 3,
  "5": 4,
  "6": 5,
};

export class ReinforcementPicker {
  private readonly root: Phaser.GameObjects.Container;
  private readonly panel: HoloPanel;
  private readonly buttons: HoloButton[];
  private readonly countdown: Phaser.GameObjects.Text;
  /** Each button's current label (HoloButton keeps its text private). */
  private readonly labels: string[] = [];
  private shown = false;
  private readonly onKey = (event: KeyboardEvent): void =>
    this.handleKey(event);

  /**
   * @param scene - The battle scene.
   * @param onChoose - Called with the row index the player picks.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onChoose: (index: number) => void,
  ) {
    this.root = createScreenContainer(scene)
      .setDepth(PICKER_DEPTH)
      .setVisible(false);
    this.panel = new HoloPanel(
      scene,
      scene.scale.width / 2,
      scene.scale.height * PANEL_Y_SHARE,
      {
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        accentColor: HOLO_PALETTE.warning,
        title: "Ship lost — choose your next ship",
      },
    );
    this.panel.setScrollFactor(0, 0, true);
    this.root.add(this.panel);
    const top =
      -PANEL_HEIGHT / 2 + TITLE_HEIGHT + HOLO_SPACING.md + ROW.height / 2;
    this.buttons = Array.from({ length: PICKER_MAX_OPTIONS }, (_, i) => {
      const button = createHoloButton(
        scene,
        0,
        top + i * ROW.pitch,
        { width: ROW.width, height: ROW.height, label: "", font: ROW.font },
        () => this.onChoose(i),
      );
      button.setScrollFactor(0, 0, true);
      this.panel.add(button);
      return button;
    });
    this.countdown = createHoloText(
      scene,
      0,
      PANEL_HEIGHT / 2 - HOLO_SPACING.lg,
      "",
      "caption",
      HOLO_PALETTE.warning,
    );
    addPinned(this.panel, this.countdown);
  }

  /** Whether the picker is on screen. */
  get isOpen(): boolean {
    return this.shown;
  }

  /** Row labels and the countdown on screen (e2e). */
  get readout(): { rows: string[]; enabled: boolean[]; countdown: string } {
    const visible = this.buttons.flatMap((b, i) => (b.visible ? [i] : []));
    return {
      rows: visible.map((i) => this.labels[i] ?? ""),
      enabled: visible.map((i) => this.buttons[i]!.enabled),
      countdown: this.countdown.text,
    };
  }

  /**
   * Show / refresh the picker, or hide it when there is none.
   * @param view - The director's picker, or null.
   */
  update(view: PickerView | null): void {
    if (!view) {
      this.hide();
      return;
    }
    if (!this.shown) this.show();
    this.buttons.forEach((button, i) => {
      const row = view.options[i];
      button.setVisible(row !== undefined);
      if (!row) return;
      const label = pickerRowLabel(row, i).toUpperCase();
      if (this.labels[i] !== label) {
        this.labels[i] = label;
        button.setLabel(label);
      }
      if (button.enabled !== row.check.allowed)
        button.setEnabled(row.check.allowed);
      button.setVariant(
        row.isDefault && row.check.allowed ? "primary" : "secondary",
      );
    });
    setText(this.countdown, countdownLabel(view));
  }

  /** @param visible - Hide while paused (the picker state is kept). */
  setVisible(visible: boolean): void {
    this.root.setVisible(visible && this.shown);
  }

  /** Remove the picker and its key handler. */
  destroy(): void {
    this.hide();
    this.root.destroy();
  }

  private show(): void {
    this.shown = true;
    this.root.setVisible(true);
    this.scene.input.keyboard?.on("keydown", this.onKey);
  }

  private hide(): void {
    if (!this.shown) return;
    this.shown = false;
    this.root.setVisible(false);
    this.scene.input.keyboard?.off("keydown", this.onKey);
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      this.onChoose(0);
      return;
    }
    const index = KEY_ROWS[event.key];
    if (index !== undefined) this.onChoose(index);
  }
}
