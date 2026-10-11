/**
 * Reusable full-screen choice overlay for Survival mode, in the holographic
 * style: a dim backdrop, a titled header (with an optional body text, e.g.
 * an event's story) and one HoloPanel card per option.
 *
 * Presentation only: it renders view models and reports the picked index
 * through a callback. It knows nothing about powers, relics, shops or
 * progression — the scenes feed it plain view models. It drives the power
 * draft, relic picks, the Hangar, mutations, events, shops, repair docks
 * and the meta-unlock shop.
 *
 * Each card is a Container whose LAST child is its interactive hit area (e2e
 * specs pick a card by emitting "pointerdown" on it). Disabled cards have
 * no hit area reaction. Show it only at camera zoom 1.0 — scrollFactor-0
 * hit-testing breaks under zoom.
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
import { attachHintTooltip, type HintContent } from "../menu/HintTooltip";

/** A single selectable option as seen by the player. */
export interface ChoiceCard {
  icon: string;
  name: string;
  description: string;
  /** Greyed out and not selectable (e.g. unaffordable, faction-locked). */
  disabled?: boolean;
  /** Right-aligned note: a price, a requirement, a synergy hint. */
  note?: string;
  /** Hover tooltip: role + "best with" (relics). */
  hint?: HintContent;
}

/** Optional extras of one overlay. */
export interface ChoicePanelOptions {
  /** Body text under the title (event story, shop balance…). */
  readonly subtitle?: string;
}

const CARD_WIDTH = 760;
const CARD_HEIGHT = 64;
const CARD_SPACING = 80;
const FIRST_CARD_Y = 200;
/** First card row when a subtitle is shown. */
const FIRST_CARD_Y_WITH_SUBTITLE = 240;
/** Space kept free under the last card (px). */
const BOTTOM_MARGIN = 24;
/** Gap between stacked cards (px). */
const CARD_GAP = 12;
const TITLE_Y = 80;
const SUBTITLE_Y = 150;
/** Half-width of the accent rule under the title (px). */
const TITLE_RULE_HALF_WIDTH = 200;
/** Title size multiplier over the type scale's title step. */
const TITLE_SCALE = 1.3;
/** Icon column width (px). */
const ICON_COLUMN = 56;
/** Width reserved for the right-hand note (px). */
const NOTE_COLUMN = 150;
/** Backdrop opacity. */
const BACKDROP_ALPHA = 0.85;
/** Card fill opacity (idle). */
const CARD_FILL_ALPHA = 0.88;
/** Opacity of a disabled card. */
const DISABLED_ALPHA = 0.45;
/** Subtitle wrap width (px). */
const SUBTITLE_WRAP = 820;

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
   * @param options - Optional subtitle.
   */
  show(
    title: string,
    cards: ChoiceCard[],
    onSelect: (index: number) => void,
    options: ChoicePanelOptions = {},
  ): void {
    this.container.removeAll(true);
    this.addBackdrop();
    this.addTitle(title);
    if (options.subtitle) this.addSubtitle(options.subtitle);
    const top = options.subtitle ? FIRST_CARD_Y_WITH_SUBTITLE : FIRST_CARD_Y;
    const spacing = Math.min(
      CARD_SPACING,
      (this.scene.scale.height - top - BOTTOM_MARGIN) /
        Math.max(1, cards.length),
    );
    const height = Math.min(CARD_HEIGHT, spacing - CARD_GAP);
    cards.forEach((card, index) => {
      const y = top + index * spacing;
      this.addCard(this.scene.scale.width / 2, y, height, card, () => {
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
    // Swallow clicks so nothing underneath reacts while the panel is open.
    const blocker = this.scene.add
      .rectangle(0, 0, this.scene.scale.width, this.scene.scale.height)
      .setOrigin(0)
      .setInteractive();
    this.container.add([bg, blocker]);
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

  private addSubtitle(subtitle: string): void {
    const text = createHoloText(
      this.scene,
      this.scene.scale.width / 2,
      SUBTITLE_Y,
      subtitle,
      "body",
      HOLO_PALETTE.textSecondary,
    )
      .setWordWrapWidth(SUBTITLE_WRAP)
      .setAlign("center");
    this.container.add(text);
  }

  private addCard(
    x: number,
    y: number,
    height: number,
    card: ChoiceCard,
    onPick: () => void,
  ): void {
    const group = new HoloPanel(this.scene, x, y, {
      width: CARD_WIDTH,
      height,
      accentColor: this.accent,
      fillAlpha: CARD_FILL_ALPHA,
    });
    group.add(this.cardIcon(card.icon));
    group.add(this.cardName(card.name, height));
    group.add(this.cardDescription(card.description, height));
    if (card.note) group.add(this.cardNote(card.note, card.disabled === true));
    if (card.disabled) group.setAlpha(DISABLED_ALPHA);
    const hit = this.cardHitArea(group, height, card.disabled === true, onPick);
    group.add(hit);
    if (card.hint) attachHintTooltip(this.scene, hit, card.hint);
    this.container.add(group);
  }

  private cardIcon(icon: string): Phaser.GameObjects.Text {
    return this.scene.add
      .text(-CARD_WIDTH / 2 + ICON_COLUMN / 2, 0, icon, { font: "24px Arial" })
      .setOrigin(0.5);
  }

  private cardName(name: string, height: number): Phaser.GameObjects.Text {
    const left = -CARD_WIDTH / 2 + ICON_COLUMN;
    const y = height < CARD_HEIGHT ? -height / 4 : -HOLO_SPACING.sm;
    return createHoloText(
      this.scene,
      left,
      y,
      name.toUpperCase(),
      "heading",
    ).setOrigin(0, 0.5);
  }

  private cardDescription(
    description: string,
    height: number,
  ): Phaser.GameObjects.Text {
    const left = -CARD_WIDTH / 2 + ICON_COLUMN;
    const y = height < CARD_HEIGHT ? height / 4 : HOLO_SPACING.md;
    return createHoloText(
      this.scene,
      left,
      y,
      description,
      "body",
      HOLO_PALETTE.textSecondary,
    )
      .setOrigin(0, 0.5)
      .setWordWrapWidth(CARD_WIDTH - ICON_COLUMN - NOTE_COLUMN);
  }

  private cardNote(note: string, disabled: boolean): Phaser.GameObjects.Text {
    const color = disabled ? HOLO_PALETTE.danger : HOLO_PALETTE.warning;
    return createHoloText(
      this.scene,
      CARD_WIDTH / 2 - HOLO_SPACING.lg,
      0,
      note,
      "numeric",
      color,
    ).setOrigin(1, 0.5);
  }

  private cardHitArea(
    card: HoloPanel,
    height: number,
    disabled: boolean,
    onPick: () => void,
  ): Phaser.GameObjects.Rectangle {
    const hit = this.scene.add
      .rectangle(0, 0, CARD_WIDTH, height)
      .setInteractive({ useHandCursor: !disabled })
      .setScrollFactor(0);
    if (disabled) {
      hit.on("pointerdown", () => audioManager.playSound("ui_back", 0.5));
      return hit;
    }
    hit.on("pointerover", () => card.setAccent(HOLO_PALETTE.accent));
    hit.on("pointerout", () => card.setAccent(this.accent));
    hit.on("pointerdown", () => {
      audioManager.playSound("ui_select", 0.7);
      onPick();
    });
    return hit;
  }
}
