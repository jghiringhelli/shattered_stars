/**
 * Controls Scene — reference screen listing every input intent across
 * keyboard, gamepad, and touch. Row data comes from ControlsReference.ts,
 * which derives the labels live from the bindings — the keyboard column
 * shows the player's ACTIVE profile (defaults + Settings rebinding), so a
 * rebound key shows here immediately. R opens Settings › Controls.
 *
 * Holo layout: one full-width translucent table with icon column headers,
 * accent group captions and zebra-striped rows.
 */

import Phaser from "phaser";
import {
  CONTROL_GROUPS,
  keyboardLabelFor,
  gamepadLabelFor,
  touchLabelFor,
} from "../ui/ControlsReference";
import {
  addBackButton,
  addMenuBackdrop,
  addMenuHeader,
  MENU_LAYOUT,
} from "../ui/menu/MenuScaffold";
import { createHoloPanel } from "../ui/hud/HoloPanel";
import { createHoloButton, type HoloButton } from "../ui/hud/HoloButton";
import { drawMenuIcon, type MenuIconName } from "../ui/menu/MenuIcons";
import {
  bindMenuBack,
  fadeInMenu,
  goToScene,
} from "../ui/menu/menuTransitions";
import { holoFont } from "../ui/theme/holoFont";
import {
  HOLO_PALETTE,
  HOLO_SPACING,
  HOLO_TYPE_SCALE,
} from "../ui/theme/HoloTheme";
import { toCssColor } from "../ui/theme/colorMath";

const ROW_HEIGHT = 32;
const TAB_BUTTON = { width: 190, height: 34, gap: 12, y: 100 } as const;
/** Phaser key names of the 1–4 number keys (tab shortcuts). */
const TAB_KEY_NAMES = ["ONE", "TWO", "THREE", "FOUR"] as const;
const TABLE_TOP = 126;
const TABLE_BOTTOM = 708;
const COLUMN_HEADER_HEIGHT = 26;
const ICON_SIZE = 14;
const ZEBRA_ALPHA = 0.05;
const BODY_SIZE = 14;
// Absolute x positions (not centered) — the widest row (camera pan, which
// merges WASD+Arrows on keyboard and D-pad+stick on gamepad) needs real room.
const COL_X = { label: 56, keyboard: 330, gamepad: 640, touch: 950 } as const;

/** Device columns with their header glyphs. */
const DEVICE_COLUMNS: ReadonlyArray<{
  readonly x: number;
  readonly title: string;
  readonly icon: MenuIconName;
}> = [
  { x: COL_X.keyboard, title: "KEYBOARD", icon: "keyboard" },
  { x: COL_X.gamepad, title: "GAMEPAD", icon: "gamepad" },
  { x: COL_X.touch, title: "TOUCH", icon: "touch" },
];

export class ControlsScene extends Phaser.Scene {
  /** Index of the category tab showing. */
  private activeTab = 0;
  /** The current tab's table objects (destroyed on tab change). */
  private tableObjects: Phaser.GameObjects.GameObject[] = [];
  private tabButtons: HoloButton[] = [];

  constructor() {
    super({ key: "ControlsScene" });
  }

  create(): void {
    addMenuBackdrop(this, { textureId: "starfield_deep" });
    addMenuHeader(this, {
      title: "Controls",
      subtitle:
        "Your current bindings · rebind in Settings › Controls / Gamepad",
    });
    addBackButton(this, () => this.goBack());
    this.activeTab = 0;
    this.createTablePanel();
    this.createColumnHeaders();
    this.createTabs();
    this.createTable();
    this.setupInput();
    fadeInMenu(this);
  }

  private goBack(): void {
    goToScene(this, "MainMenuScene");
  }

  private createTablePanel(): void {
    const { width } = this.scale;
    const panelWidth = width - MENU_LAYOUT.margin * 2;
    createHoloPanel(this, width / 2, (TABLE_TOP + TABLE_BOTTOM) / 2, {
      width: panelWidth,
      height: TABLE_BOTTOM - TABLE_TOP,
    });
  }

  private createColumnHeaders(): void {
    const y = TABLE_TOP + HOLO_SPACING.md + COLUMN_HEADER_HEIGHT / 2;
    const icons = this.add.graphics();
    for (const column of DEVICE_COLUMNS) {
      drawMenuIcon(
        icons,
        column.icon,
        { x: column.x + ICON_SIZE / 2, y },
        ICON_SIZE,
        HOLO_PALETTE.accent,
      );
      this.add
        .text(column.x + ICON_SIZE + HOLO_SPACING.sm, y, column.title, {
          ...holoFont(HOLO_TYPE_SCALE.caption.size, "600"),
          color: toCssColor(HOLO_PALETTE.accent),
        })
        .setLetterSpacing(HOLO_TYPE_SCALE.caption.letterSpacing)
        .setOrigin(0, 0.5);
    }
    const rule = this.add.graphics();
    const ruleY = TABLE_TOP + HOLO_SPACING.md + COLUMN_HEADER_HEIGHT;
    rule.lineStyle(1, HOLO_PALETTE.border, 1);
    rule.lineBetween(
      MENU_LAYOUT.margin + HOLO_SPACING.md,
      ruleY,
      this.scale.width - MENU_LAYOUT.margin - HOLO_SPACING.md,
      ruleY,
    );
  }

  /** One tab button per control category (Flight, Weapons, Squad, Camera & UI). */
  private createTabs(): void {
    const count = CONTROL_GROUPS.length;
    const pitch = TAB_BUTTON.width + TAB_BUTTON.gap;
    const firstX = this.scale.width / 2 - ((count - 1) * pitch) / 2;
    this.tabButtons = CONTROL_GROUPS.map((group, index) =>
      createHoloButton(
        this,
        firstX + index * pitch,
        TAB_BUTTON.y,
        {
          width: TAB_BUTTON.width,
          height: TAB_BUTTON.height,
          label: `${index + 1} ${group.title}`,
          variant: "secondary",
        },
        () => this.selectTab(index),
      ),
    );
    this.refreshTabs();
  }

  private refreshTabs(): void {
    this.tabButtons.forEach((button, index) =>
      button.setVariant(index === this.activeTab ? "primary" : "secondary"),
    );
  }

  /** @param index - Category to show (wraps around). */
  private selectTab(index: number): void {
    const count = CONTROL_GROUPS.length;
    this.activeTab = (index + count) % count;
    this.refreshTabs();
    this.createTable();
  }

  private createTable(): void {
    for (const object of this.tableObjects) object.destroy();
    this.tableObjects = [];
    const group = CONTROL_GROUPS[this.activeTab];
    if (!group) return;
    let y =
      TABLE_TOP + HOLO_SPACING.md + COLUMN_HEADER_HEIGHT + HOLO_SPACING.xs;
    const stripes = this.add.graphics();
    this.tableObjects.push(stripes);
    group.rows.forEach((row, index) => {
      if (index % 2 === 0) this.drawStripe(stripes, y);
      this.addCell(COL_X.label, y, row.label, HOLO_PALETTE.textSecondary);
      this.addCell(COL_X.keyboard, y, keyboardLabelFor(row.intents));
      this.addCell(COL_X.gamepad, y, gamepadLabelFor(row.intents));
      this.addCell(COL_X.touch, y, touchLabelFor(row.intents));
      y += ROW_HEIGHT;
    });
  }

  private drawStripe(g: Phaser.GameObjects.Graphics, y: number): void {
    const left = MENU_LAYOUT.margin + HOLO_SPACING.sm;
    g.fillStyle(HOLO_PALETTE.track, ZEBRA_ALPHA);
    g.fillRect(left, y, this.scale.width - left * 2, ROW_HEIGHT);
  }

  private addCell(
    x: number,
    y: number,
    text: string,
    color: number = HOLO_PALETTE.textPrimary,
  ): void {
    const cell = this.add
      .text(x, y + ROW_HEIGHT / 2, text, {
        ...holoFont(BODY_SIZE, "400"),
        color: toCssColor(color),
      })
      .setOrigin(0, 0.5);
    this.tableObjects.push(cell);
  }

  private setupInput(): void {
    bindMenuBack(this, () => this.goBack());
    const keyboard = this.input.keyboard;
    TAB_KEY_NAMES.slice(0, CONTROL_GROUPS.length).forEach((name, index) =>
      keyboard?.on(`keydown-${name}`, () => this.selectTab(index)),
    );
    keyboard?.on("keydown-LEFT", () => this.selectTab(this.activeTab - 1));
    keyboard?.on("keydown-RIGHT", () => this.selectTab(this.activeTab + 1));
    // "R" jumps straight to rebinding (Settings › Controls).
    this.input.keyboard?.on("keydown-R", () =>
      goToScene(this, "SettingsScene", { tab: "controls" }),
    );
  }
}
