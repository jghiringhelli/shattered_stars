/**
 * Reusable full-screen choice overlay for Survival mode.
 *
 * Presentation only: it renders a titled list of choice cards and reports the
 * picked index through a callback. It knows nothing about powers, hangars or
 * progression — the scene owns that logic and feeds it plain view models. The
 * same panel drives both the regular-level power draft and the milestone Hangar.
 */

import Phaser from "phaser";
import { audioManager } from "../../audio/AudioManager";

/** A single selectable option as seen by the player. */
export interface ChoiceCard {
  icon: string;
  name: string;
  description: string;
}

const CARD_WIDTH = 500;
const CARD_HEIGHT = 60;
const CARD_SPACING = 80;
const FIRST_CARD_Y = 200;
const IDLE_FILL = 0x224466;
const HOVER_FILL = 0x336688;

export class SurvivalChoicePanel {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0).setDepth(1002).setVisible(false);
  }

  /** True while the overlay is on screen (scene should pause simulation). */
  get isOpen(): boolean {
    return this.container.visible;
  }

  /** Shows the overlay for the given cards; calls onSelect with the index. */
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
    this.container.setVisible(true);
  }

  /** Hides and clears the overlay. */
  hide(): void {
    this.container.removeAll(true);
    this.container.setVisible(false);
  }

  private addBackdrop(): void {
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.85);
    bg.fillRect(0, 0, this.scene.scale.width, this.scene.scale.height);
    this.container.add(bg);
  }

  private addTitle(title: string): void {
    const text = this.scene.add
      .text(this.scene.scale.width / 2, 100, title, {
        font: "bold 36px Arial",
        color: "#ffdd44",
      })
      .setOrigin(0.5);
    this.container.add(text);
  }

  private addCard(
    x: number,
    y: number,
    card: ChoiceCard,
    onPick: () => void,
  ): void {
    const group = this.scene.add.container(x, y);
    const bg = this.scene.add.graphics();
    this.paintCard(bg, IDLE_FILL);
    group.add(bg);
    group.add(this.cardIcon(card.icon));
    group.add(this.cardName(card.name));
    group.add(this.cardDescription(card.description));
    group.add(this.cardHitArea(bg, onPick));
    this.container.add(group);
  }

  private paintCard(bg: Phaser.GameObjects.Graphics, fill: number): void {
    const left = -CARD_WIDTH / 2;
    const top = -CARD_HEIGHT / 2;
    bg.clear();
    bg.fillStyle(fill, 0.9);
    bg.fillRoundedRect(left, top, CARD_WIDTH, CARD_HEIGHT, 8);
    bg.lineStyle(2, 0x44aaff, 1);
    bg.strokeRoundedRect(left, top, CARD_WIDTH, CARD_HEIGHT, 8);
  }

  private cardIcon(icon: string): Phaser.GameObjects.Text {
    return this.scene.add
      .text(-CARD_WIDTH / 2 + 30, 0, icon, { font: "24px Arial" })
      .setOrigin(0, 0.5);
  }

  private cardName(name: string): Phaser.GameObjects.Text {
    return this.scene.add
      .text(-CARD_WIDTH / 2 + 70, -8, name, {
        font: "bold 18px Arial",
        color: "#ffffff",
      })
      .setOrigin(0, 0.5);
  }

  private cardDescription(description: string): Phaser.GameObjects.Text {
    return this.scene.add
      .text(-CARD_WIDTH / 2 + 70, 12, description, {
        font: "14px Arial",
        color: "#aaaaaa",
      })
      .setOrigin(0, 0.5);
  }

  private cardHitArea(
    bg: Phaser.GameObjects.Graphics,
    onPick: () => void,
  ): Phaser.GameObjects.Rectangle {
    const hit = this.scene.add
      .rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerover", () => this.paintCard(bg, HOVER_FILL));
    hit.on("pointerout", () => this.paintCard(bg, IDLE_FILL));
    hit.on("pointerdown", () => {
      audioManager.playSound("ui_select", 0.7);
      onPick();
    });
    return hit;
  }
}
