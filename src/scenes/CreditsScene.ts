/**
 * Credits Scene
 *
 * Scrolling credits over the dimmed galaxy painting. The roll is clipped to
 * the area below the header so it never collides with the BACK button.
 * ↑ speeds the roll up, ↓ reverses it; ESC / SPACE / BACK return.
 */

import Phaser from "phaser";
import {
  addBackButton,
  addFooterHint,
  addMenuBackdrop,
  MENU_LAYOUT,
} from "../ui/menu/MenuScaffold";
import {
  bindMenuBack,
  fadeInMenu,
  goToScene,
} from "../ui/menu/menuTransitions";
import { holoFont } from "../ui/theme/holoFont";
import { HOLO_PALETTE } from "../ui/theme/HoloTheme";
import { toCssColor } from "../ui/theme/colorMath";
import { CREDITS, type CreditStyle } from "../data/credits";

/** Typography + advance per credit style. */
const CREDIT_STYLES: Readonly<
  Record<
    Exclude<CreditStyle, "spacer">,
    {
      size: number;
      weight: string;
      color: number;
      spacing: number;
      advance: number;
    }
  >
> = {
  title: {
    size: 44,
    weight: "300",
    color: HOLO_PALETTE.textPrimary,
    spacing: 12,
    advance: 60,
  },
  subtitle: {
    size: 18,
    weight: "400",
    color: HOLO_PALETTE.textSecondary,
    spacing: 1,
    advance: 40,
  },
  section: {
    size: 13,
    weight: "600",
    color: HOLO_PALETTE.accent,
    spacing: 5,
    advance: 44,
  },
  role: {
    size: 11,
    weight: "600",
    color: HOLO_PALETTE.textSecondary,
    spacing: 2,
    advance: 24,
  },
  name: {
    size: 20,
    weight: "400",
    color: HOLO_PALETTE.textPrimary,
    spacing: 0.5,
    advance: 34,
  },
  small: {
    size: 13,
    weight: "400",
    color: HOLO_PALETTE.textMuted,
    spacing: 0.5,
    advance: 24,
  },
};
const SPACER_ADVANCE = 20;
/** Half-length of the accent rules flanking section headings. */
const SECTION_RULE = 60;
const SECTION_RULE_GAP = 16;
/** Scroll speeds in px/frame. */
const SCROLL = { normal: 0.5, fast: 2, reverse: -1 } as const;
/** Bottom edge of the visible roll (above the footer hint). */
const ROLL_BOTTOM_INSET = 36;

export class CreditsScene extends Phaser.Scene {
  private creditsContainer!: Phaser.GameObjects.Container;
  private creditsTotalHeight = 0;
  private scrollSpeed: number = SCROLL.normal;

  constructor() {
    super({ key: "CreditsScene" });
  }

  create(): void {
    addMenuBackdrop(this, { textureId: "galaxy_spiral", scrimAlpha: 0.45 });
    this.createCredits();
    addBackButton(this, () => this.goBack());
    addFooterHint(this, "↑  FASTER        ↓  REWIND        ESC  BACK");
    this.setupInput();
    fadeInMenu(this);
  }

  private goBack(): void {
    goToScene(this, "MainMenuScene");
  }

  update(): void {
    // Scroll credits up
    this.creditsContainer.y -= this.scrollSpeed;

    // Reset when fully scrolled
    if (this.creditsContainer.y < -this.creditsTotalHeight) {
      this.creditsContainer.y = this.scale.height;
    }
  }

  private createCredits(): void {
    this.creditsContainer = this.add.container(
      this.scale.width / 2,
      this.scale.height,
    );
    let y = 0;
    for (const credit of CREDITS) {
      if (credit.style === "spacer") {
        y += SPACER_ADVANCE;
        continue;
      }
      const style = CREDIT_STYLES[credit.style];
      const text = this.add
        .text(0, y, credit.text, {
          ...holoFont(style.size, style.weight),
          color: toCssColor(style.color),
        })
        .setLetterSpacing(style.spacing)
        .setOrigin(0.5);
      this.creditsContainer.add(text);
      if (credit.style === "section") this.addSectionRules(y, text.width);
      y += style.advance;
    }
    this.creditsTotalHeight = y;
    this.clipRoll();
  }

  private addSectionRules(y: number, textWidth: number): void {
    const rules = this.add.graphics();
    const inner = textWidth / 2 + SECTION_RULE_GAP;
    rules.lineStyle(1, HOLO_PALETTE.accent, 0.6);
    rules.lineBetween(-inner - SECTION_RULE, y, -inner, y);
    rules.lineBetween(inner, y, inner + SECTION_RULE, y);
    this.creditsContainer.add(rules);
  }

  /** Clip the roll to the band between the header and the footer. */
  private clipRoll(): void {
    const top = MENU_LAYOUT.ruleY;
    const shape = this.make.graphics({}, false);
    shape.fillStyle(0xffffff, 1);
    shape.fillRect(
      0,
      top,
      this.scale.width,
      this.scale.height - ROLL_BOTTOM_INSET - top,
    );
    this.creditsContainer.setMask(shape.createGeometryMask());
  }

  private setupInput(): void {
    const keyboard = this.input.keyboard!;
    bindMenuBack(this, () => this.goBack());
    // Speed up / rewind the roll with arrow keys
    keyboard.on("keydown-UP", () => (this.scrollSpeed = SCROLL.fast));
    keyboard.on("keyup-UP", () => (this.scrollSpeed = SCROLL.normal));
    keyboard.on("keydown-DOWN", () => (this.scrollSpeed = SCROLL.reverse));
    keyboard.on("keyup-DOWN", () => (this.scrollSpeed = SCROLL.normal));
  }
}
