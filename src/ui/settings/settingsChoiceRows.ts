/**
 * More settings rows: a choice row (cycles a list of labelled options with
 * ←/→, ENTER or click) and a key-binding row (ENTER/click arms key capture;
 * the scene feeds the captured chord back).
 */

import Phaser from "phaser";
import { holoFont } from "../theme/holoFont";
import { HOLO_BORDER, HOLO_PALETTE, HOLO_RADIUS } from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";
import { drawHoloFrame } from "../menu/holoChrome";
import { playUiPress } from "../menu/menuTransitions";
import {
  SETTINGS_ROW,
  SettingsRowBase,
  type SettingsRowConfig,
} from "./settingsRows";

/** Choice/key row geometry. */
const CHIP = { minWidth: 96, height: 24, padding: 10, valueSize: 13 } as const;
/** Label size for compact rows. */
const COMPACT_LABEL_SIZE = 13;

/** One option of a choice row. */
export interface ChoiceOption<T> {
  readonly value: T;
  readonly label: string;
}

/** Cycles through labelled options. */
export class SettingsChoiceRow<T> extends SettingsRowBase {
  private readonly valueText: Phaser.GameObjects.Text;
  private index: number;

  /**
   * @param scene - Settings scene.
   * @param config - Placement and label.
   * @param options - Options in order.
   * @param initial - Selected value.
   * @param onChange - Called with each new value.
   */
  constructor(
    scene: Phaser.Scene,
    config: SettingsRowConfig,
    private readonly options: readonly ChoiceOption<T>[],
    initial: T,
    private readonly onChange: (value: T) => void,
  ) {
    super(scene, config);
    const midY = config.y + this.rowHeight / 2;
    this.labelText.setY(midY).setOrigin(0, 0.5);
    this.index = Math.max(
      0,
      options.findIndex((o) => o.value === initial),
    );
    this.valueText = scene.add
      .text(config.x + config.width - SETTINGS_ROW.padding, midY, "", {
        ...holoFont(SETTINGS_ROW.valueSize, "600"),
        color: toCssColor(HOLO_PALETTE.accent),
      })
      .setOrigin(1, 0.5);
    const rect = this.rowRect();
    const hit = scene.add
      .rectangle(rect.x + rect.width / 2, midY, rect.width, rect.height, 0, 0)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.rightButtonDown()) this.adjust(1);
    });
    hit.on("pointerover", () => this.setHovered(true));
    hit.on("pointerout", () => this.setHovered(false));
    this.render();
  }

  /** ENTER: next option. */
  activate(): void {
    this.adjust(1);
  }

  /**
   * Step through the options (wraps).
   *
   * @param steps - +1 / -1.
   */
  adjust(steps: number): void {
    const count = this.options.length;
    this.index = (this.index + steps + count) % count;
    playUiPress();
    this.render();
    const option = this.options[this.index];
    if (option) this.onChange(option.value);
  }

  private render(): void {
    const label = this.options[this.index]?.label ?? "";
    this.valueText.setText(`◀  ${label.toUpperCase()}  ▶`);
  }
}

/** A rebindable intent's row: label + key chip. */
export class SettingsKeyRow extends SettingsRowBase {
  private readonly chip: Phaser.GameObjects.Graphics;
  private readonly keyText: Phaser.GameObjects.Text;
  private keyLabel: string;
  private capturing = false;

  /**
   * @param scene - Settings scene.
   * @param config - Placement and label (compact height).
   * @param keyLabel - Current key label.
   * @param onRequestCapture - Called when the player wants to rebind.
   * @param captureLabel - Chip text while waiting for input.
   */
  constructor(
    scene: Phaser.Scene,
    config: SettingsRowConfig,
    keyLabel: string,
    private readonly onRequestCapture: (row: SettingsKeyRow) => void,
    private readonly captureLabel = "PRESS A KEY",
  ) {
    super(scene, config);
    const midY = config.y + this.rowHeight / 2;
    this.labelText.setY(midY).setOrigin(0, 0.5).setFontSize(COMPACT_LABEL_SIZE);
    this.keyLabel = keyLabel;
    this.chip = scene.add.graphics();
    this.keyText = scene.add
      .text(this.chipCenterX(), midY, "", holoFont(CHIP.valueSize, "600"))
      .setOrigin(0.5);
    const rect = this.rowRect();
    const hit = scene.add
      .rectangle(rect.x + rect.width / 2, midY, rect.width, rect.height, 0, 0)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.rightButtonDown()) this.activate();
    });
    hit.on("pointerover", () => this.setHovered(true));
    hit.on("pointerout", () => this.setHovered(false));
    this.render();
  }

  /** ENTER / click: arm key capture. */
  activate(): void {
    playUiPress();
    this.onRequestCapture(this);
  }

  /**
   * @param capturing - Whether this row waits for a key.
   */
  setCapturing(capturing: boolean): void {
    this.capturing = capturing;
    this.render();
  }

  /**
   * @param label - New key label.
   */
  setKeyLabel(label: string): void {
    this.keyLabel = label;
    this.render();
  }

  private chipCenterX(): number {
    const { x, width } = this.config;
    return x + width - SETTINGS_ROW.padding - CHIP.minWidth / 2;
  }

  private render(): void {
    const text = this.capturing ? this.captureLabel : this.keyLabel;
    this.keyText
      .setText(text)
      .setColor(
        toCssColor(
          this.capturing ? HOLO_PALETTE.warning : HOLO_PALETTE.textPrimary,
        ),
      );
    const width = Math.max(
      CHIP.minWidth,
      this.keyText.width + CHIP.padding * 2,
    );
    const midY = this.config.y + this.rowHeight / 2;
    this.chip.clear();
    drawHoloFrame(
      this.chip,
      {
        x: this.chipCenterX() + CHIP.minWidth / 2 - width,
        y: midY - CHIP.height / 2,
        width,
        height: CHIP.height,
      },
      {
        fill: HOLO_PALETTE.panelFillRaised,
        fillAlpha: 0.9,
        accent: this.capturing ? HOLO_PALETTE.warning : HOLO_PALETTE.border,
        borderWidth: this.capturing ? HOLO_BORDER.focus : HOLO_BORDER.hairline,
        borderAlpha: 1,
        radius: HOLO_RADIUS.sm,
      },
    );
    this.keyText.setX(this.chipCenterX() + CHIP.minWidth / 2 - width / 2);
  }
}
