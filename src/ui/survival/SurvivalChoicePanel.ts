/**
 * Reusable full-screen choice overlay for Survival mode, in the holographic
 * style: a dim backdrop, a titled header and one HoloPanel card per option.
 *
 * Presentation only: it renders a titled list of choice cards and reports the
 * picked index through a callback. It knows nothing about powers, hangars or
 * progression — the scene owns that logic and feeds it plain view models. The
 * same panel drives both the regular-level power draft and the milestone Hangar.
 *
 * Each card is a Container whose LAST child is its interactive hit area (e2e
 * specs pick a card by emitting "pointerdown" on it). Show it only at camera
 * zoom 1.0 — scrollFactor-0 hit-testing breaks under zoom.
 */

import Phaser from "phaser";
import { audioManager } from "../../audio/AudioManager";
import type { FactionId } from "../../config";
import {
  HOLO_BORDER,
  HOLO_DEPTH,
  HOLO_PALETTE,
  HOLO_SPACING,
  HOLO_TYPE_SCALE,
  factionAccent,
} from "../theme/HoloTheme";
import { createHoloText } from "../hud/holoPrimitives";
import { HoloPanel } from "../hud/HoloPanel";
import { pinTree } from "../modeHud/screenSpace";

/** A single selectable option as seen by the player. */
export interface ChoiceCard {
  icon: string;
  name: string;
  description: string;
}

const CARD_WIDTH = 520;
const CARD_HEIGHT = 64;
const CARD_SPACING = 80;
const FIRST_CARD_Y = 200;
const TITLE_Y = 100;
/** Half-width of the accent rule under the title (px). */
const TITLE_RULE_HALF_WIDTH = 200;
/** Title size multiplier over the type scale's title step. */
const TITLE_SCALE = 1.3;
/** Icon column width (px). */
const ICON_COLUMN = 56;
/** Backdrop opacity. */
const BACKDROP_ALPHA = 0.8;
/** Card fill opacity (idle). */
const CARD_FILL_ALPHA = 0.88;

export class SurvivalChoicePanel {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly accent: number;

  /**
   * @param scene - The Survival scene.
   * @param faction - Player faction (card accents); neutral when omitted.
   */
  constructor(scene: Phaser.Scene, faction?: FactionId) {
    this.scene = scene;
    this.accent = factionAccent(faction);
    this.container = scene.add.container(0, 0);
    this.container
      .setScrollFactor(0)
      .setDepth(HOLO_DEPTH.menuPanel)
      .setVisible(false);
  }

  /** True while the overlay is on screen (scene should pause simulation). */
  get isOpen(): boolean {
    return this.container.visible;
  }

  /**
   * Shows the overlay for the given cards; calls onSelect with the index.
   *
   * @param title - Overlay heading, e.g. "CHOOSE A POWER".
   * @param cards - The options.
   * @param onSelect - Receives the picked card's index.
   */
  show(
    title: string,
    cards: ChoiceCard[],
    onSelect: (index: number) => void,
  ): void {
    this.container.removeAll(true);
    this.addBackdrop();
    this.addTitle(title);
    cards.forEach((card, index) => {
      const y = FIRST_CARD_Y + index * CARD_SPACING;
      this.addCard(this.scene.scale.width / 2, y, card, () => {
        this.hide();
        onSelect(index);
      });
    });
    pinTree(this.container);
    this.container.setVisible(true);
  }

  /** Hides and clears the overlay. */
  hide(): void {
    this.container.removeAll(true);
    this.container.setVisible(false);
  }

  private addBackdrop(): void {
    const bg = this.scene.add.graphics();
    bg.fillStyle(HOLO_PALETTE.panelFill, BACKDROP_ALPHA);
    bg.fillRect(0, 0, this.scene.scale.width, this.scene.scale.height);
    this.container.add(bg);
  }

  private addTitle(title: string): void {
    const x = this.scene.scale.width / 2;
    const text = createHoloText(
      this.scene,
      x,
      TITLE_Y,
      title.toUpperCase(),
      "title",
    );
    text.setFontSize(HOLO_TYPE_SCALE.title.size * TITLE_SCALE);
    const rule = this.scene.add.graphics();
    rule.lineStyle(HOLO_BORDER.regular, this.accent, 1);
    const ruleY = TITLE_Y + text.height / 2 + HOLO_SPACING.sm;
    rule.lineBetween(
      x - TITLE_RULE_HALF_WIDTH,
      ruleY,
      x + TITLE_RULE_HALF_WIDTH,
      ruleY,
    );
    this.container.add([text, rule]);
  }

  private addCard(
    x: number,
    y: number,
    card: ChoiceCard,
    onPick: () => void,
  ): void {
    const group = new HoloPanel(this.scene, x, y, {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      accentColor: this.accent,
      fillAlpha: CARD_FILL_ALPHA,
    });
    group.add(this.cardIcon(card.icon));
    group.add(this.cardName(card.name));
    group.add(this.cardDescription(card.description));
    group.add(this.cardHitArea(group, onPick));
    this.container.add(group);
  }

  private cardIcon(icon: string): Phaser.GameObjects.Text {
    return this.scene.add
      .text(-CARD_WIDTH / 2 + ICON_COLUMN / 2, 0, icon, { font: "24px Arial" })
      .setOrigin(0.5);
  }

  private cardName(name: string): Phaser.GameObjects.Text {
    const left = -CARD_WIDTH / 2 + ICON_COLUMN;
    return createHoloText(
      this.scene,
      left,
      -HOLO_SPACING.sm,
      name.toUpperCase(),
      "heading",
    ).setOrigin(0, 0.5);
  }

  private cardDescription(description: string): Phaser.GameObjects.Text {
    const left = -CARD_WIDTH / 2 + ICON_COLUMN;
    return createHoloText(
      this.scene,
      left,
      HOLO_SPACING.md,
      description,
      "body",
      HOLO_PALETTE.textSecondary,
    ).setOrigin(0, 0.5);
  }

  private cardHitArea(
    card: HoloPanel,
    onPick: () => void,
  ): Phaser.GameObjects.Rectangle {
    const hit = this.scene.add
      .rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT)
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0);
    hit.on("pointerover", () => card.setAccent(HOLO_PALETTE.accent));
    hit.on("pointerout", () => card.setAccent(this.accent));
    hit.on("pointerdown", () => {
      audioManager.playSound("ui_select", 0.7);
      onPick();
    });
    return hit;
  }
}
