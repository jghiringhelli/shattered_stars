/**
 * Controls Scene — reference screen listing every input intent across
 * keyboard, gamepad, and touch. Row data comes from ControlsReference.ts,
 * which derives the actual key/button/gesture labels live from
 * DefaultBindings.ts so this screen can't drift out of sync with real input.
 */

import Phaser from "phaser";
import { renderMenuStarfield } from "../rendering/Starfield";
import {
  CONTROL_GROUPS,
  keyboardLabelFor,
  gamepadLabelFor,
  touchLabelFor,
} from "../ui/ControlsReference";

const ROW_HEIGHT = 19;
const GROUP_GAP = 10;
const TABLE_TOP = 108;
// Absolute x positions (not centered) — the widest row (camera pan, which
// merges WASD+Arrows on keyboard and D-pad+stick on gamepad) needs real room.
const COL_X = { label: 40, keyboard: 300, gamepad: 620, touch: 940 } as const;

export class ControlsScene extends Phaser.Scene {
  constructor() {
    super({ key: "ControlsScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x050510);
    renderMenuStarfield(this, { starCount: 100, alphaRange: [0.2, 0.6] });

    this.createHeader();
    this.createTable();
    this.createBackButton();
    this.setupInput();
  }

  private createHeader(): void {
    const centerX = this.scale.width / 2;
    this.add
      .text(centerX, 30, "CONTROLS", {
        font: "bold 32px Arial",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.add
      .text(centerX, 58, "Keyboard / Gamepad / Touch — by action", {
        font: "14px Arial",
        color: "#88aacc",
      })
      .setOrigin(0.5);

    const headerY = 82;
    this.add.text(COL_X.keyboard, headerY, "Keyboard", {
      font: "bold 12px Arial",
      color: "#6688cc",
    });
    this.add.text(COL_X.gamepad, headerY, "Gamepad", {
      font: "bold 12px Arial",
      color: "#6688cc",
    });
    this.add.text(COL_X.touch, headerY, "Touch", {
      font: "bold 12px Arial",
      color: "#6688cc",
    });
  }

  private createTable(): void {
    let y = TABLE_TOP;

    for (const group of CONTROL_GROUPS) {
      this.add.text(COL_X.label, y, group.title, {
        font: "bold 14px Arial",
        color: "#ffcc66",
      });
      y += ROW_HEIGHT;

      for (const row of group.rows) {
        this.add.text(COL_X.label, y, row.label, {
          font: "12px Arial",
          color: "#ccddee",
        });
        this.add.text(COL_X.keyboard, y, keyboardLabelFor(row.intents), {
          font: "12px monospace",
          color: "#ffffff",
        });
        this.add.text(COL_X.gamepad, y, gamepadLabelFor(row.intents), {
          font: "12px monospace",
          color: "#ffffff",
        });
        this.add.text(COL_X.touch, y, touchLabelFor(row.intents), {
          font: "12px monospace",
          color: "#ffffff",
        });
        y += ROW_HEIGHT;
      }
      y += GROUP_GAP;
    }
  }

  private createBackButton(): void {
    const btn = this.add.container(100, this.scale.height - 30);

    const bg = this.add.graphics();
    bg.fillStyle(0x333344, 0.8);
    bg.fillRoundedRect(-60, -18, 120, 36, 8);
    btn.add(bg);

    const text = this.add
      .text(0, 0, "BACK", { font: "bold 18px Arial", color: "#ffffff" })
      .setOrigin(0.5);
    btn.add(text);

    btn.setInteractive(
      new Phaser.Geom.Rectangle(-60, -18, 120, 36),
      Phaser.Geom.Rectangle.Contains,
    );
    btn.on("pointerover", () => {
      bg.clear();
      bg.fillStyle(0x444466, 0.9);
      bg.fillRoundedRect(-60, -18, 120, 36, 8);
    });
    btn.on("pointerout", () => {
      bg.clear();
      bg.fillStyle(0x333344, 0.8);
      bg.fillRoundedRect(-60, -18, 120, 36, 8);
    });
    btn.on("pointerdown", () => this.scene.start("MainMenuScene"));
  }

  private setupInput(): void {
    this.input.keyboard!.on("keydown-ESC", () =>
      this.scene.start("MainMenuScene"),
    );
    this.input.keyboard!.on("keydown-SPACE", () =>
      this.scene.start("MainMenuScene"),
    );
  }
}
