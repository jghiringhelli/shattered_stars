/**
 * HeroPowerBar — the hero's two active powers on the battle HUD (bottom
 * left): glyph, key hint (V / B), name, a cooldown shade with seconds left,
 * and a LOCKED state for powers not unlocked yet. Screen-space and
 * zoom-independent; never colour-only (text states back every colour).
 */

import Phaser from "phaser";
import type { FactionId } from "../../config";
import type { HeroPowerSlot } from "../../campaign/powers/heroPowerState";
import { slotCooldownFraction } from "../../campaign/powers/heroPowerState";
import {
  HOLO_DEPTH,
  HOLO_PALETTE,
  HOLO_SPACING,
  factionAccent,
} from "../theme/HoloTheme";
import { createHoloText } from "../hud/holoPrimitives";
import {
  cancelCameraZoom,
  pinTree,
  type ZoomCameraLike,
} from "../modeHud/screenSpace";

/** Slot square size (px). */
const SLOT_SIZE = 56;
/** Gap between slots (px) — room for each slot's wrapped name. */
const SLOT_GAP = 40;
/** Distance of the bar from the bottom-left corner (px). */
const MARGIN = HOLO_SPACING.lg;
/** Room under each slot for its (two-line) name (px). */
const NAME_HEIGHT = 30;
/** Wrap width of a slot's name (px). */
const NAME_WRAP = SLOT_SIZE + SLOT_GAP - 6;
/** Key hints per slot (default bindings: V / B). */
const KEY_HINTS = ["V", "B"] as const;
/** Flash length after a cast (ms). */
const FLASH_MS = 350;
/** Alpha of a locked slot. */
const LOCKED_ALPHA = 0.45;
/** Milliseconds per second. */
const MS_PER_SECOND = 1000;

/** One slot's readable state (HUD tests read this). */
export interface PowerSlotReadout {
  readonly id: string;
  readonly locked: boolean;
  readonly ready: boolean;
  readonly cooldownSeconds: number;
}

interface SlotView {
  readonly frame: Phaser.GameObjects.Graphics;
  readonly shade: Phaser.GameObjects.Graphics;
  readonly glyph: Phaser.GameObjects.Text;
  readonly key: Phaser.GameObjects.Text;
  readonly name: Phaser.GameObjects.Text;
  readonly timer: Phaser.GameObjects.Text;
}

export class HeroPowerBar {
  private readonly root: Phaser.GameObjects.Container;
  private readonly views: SlotView[] = [];
  private readonly accent: number;
  private states: PowerSlotReadout[] = [];

  /**
   * @param scene - Battle scene.
   * @param faction - Player faction (accent).
   */
  constructor(
    private readonly scene: Phaser.Scene,
    faction: FactionId,
  ) {
    this.accent = factionAccent(faction);
    this.root = scene.add.container(0, 0).setDepth(HOLO_DEPTH.hud);
    for (let i = 0; i < KEY_HINTS.length; i++)
      this.views.push(this.buildSlot(i));
    pinTree(this.root);
  }

  /** Readable state of both slots. */
  get readout(): readonly PowerSlotReadout[] {
    return this.states;
  }

  /** @param slots - Power slots this frame. */
  update(slots: readonly HeroPowerSlot[]): void {
    this.states = slots.map((slot, i) => {
      const view = this.views[i];
      const locked = slot.rank <= 0;
      const fraction = slotCooldownFraction(slot);
      const seconds = Math.ceil(slot.cooldownRemainingMs / MS_PER_SECOND);
      if (view) this.drawSlot(view, slot, { locked, fraction, seconds });
      return {
        id: slot.power.id,
        locked,
        ready: !locked && fraction === 0,
        cooldownSeconds: seconds,
      };
    });
  }

  /** @param slotIndex - Slot just cast: brief flash. */
  flash(slotIndex: number): void {
    const view = this.views[slotIndex];
    if (!view) return;
    view.frame.setAlpha(1);
    this.scene.tweens.add({
      targets: [view.glyph],
      scale: { from: 1.4, to: 1 },
      duration: FLASH_MS,
    });
  }

  /** @param camera - Scene camera (keeps the bar 1:1 under zoom). */
  sync(camera: ZoomCameraLike): void {
    cancelCameraZoom(this.root, camera);
  }

  /** @param visible - Visibility. */
  setVisible(visible: boolean): void {
    this.root.setVisible(visible);
  }

  /** Destroy the bar. */
  destroy(): void {
    this.root.destroy();
  }

  private buildSlot(index: number): SlotView {
    const x = MARGIN + index * (SLOT_SIZE + SLOT_GAP);
    const y = this.scene.scale.height - MARGIN - NAME_HEIGHT - SLOT_SIZE;
    const center = { x: x + SLOT_SIZE / 2, y: y + SLOT_SIZE / 2 };
    const view: SlotView = {
      frame: this.scene.add.graphics().setPosition(x, y),
      shade: this.scene.add.graphics().setPosition(x, y),
      glyph: createHoloText(
        this.scene,
        center.x,
        center.y,
        "",
        "title",
      ).setOrigin(0.5),
      key: createHoloText(
        this.scene,
        x + 5,
        y + 4,
        KEY_HINTS[index] ?? "",
        "caption",
        HOLO_PALETTE.textSecondary,
      ),
      name: createHoloText(
        this.scene,
        center.x,
        y + SLOT_SIZE + 2,
        "",
        "caption",
      )
        .setOrigin(0.5, 0)
        .setAlign("center")
        .setWordWrapWidth(NAME_WRAP),
      timer: createHoloText(
        this.scene,
        center.x,
        center.y,
        "",
        "numeric",
      ).setOrigin(0.5),
    };
    this.root.add([
      view.frame,
      view.shade,
      view.glyph,
      view.key,
      view.name,
      view.timer,
    ]);
    return view;
  }

  private drawSlot(
    view: SlotView,
    slot: HeroPowerSlot,
    state: { locked: boolean; fraction: number; seconds: number },
  ): void {
    const ready = !state.locked && state.fraction === 0;
    view.frame
      .clear()
      .fillStyle(HOLO_PALETTE.panelFill, HOLO_PALETTE.panelAlpha)
      .fillRoundedRect(0, 0, SLOT_SIZE, SLOT_SIZE, 6)
      .lineStyle(ready ? 2 : 1, ready ? this.accent : HOLO_PALETTE.border, 1)
      .strokeRoundedRect(0, 0, SLOT_SIZE, SLOT_SIZE, 6);
    view.shade.clear();
    if (!state.locked && state.fraction > 0) {
      view.shade
        .fillStyle(0x000000, 0.6)
        .fillRect(0, 0, SLOT_SIZE, SLOT_SIZE * state.fraction);
    }
    view.glyph
      .setText(slot.power.glyph)
      .setAlpha(state.locked ? LOCKED_ALPHA : 1);
    view.name.setText(
      state.locked
        ? "LOCKED"
        : `${slot.power.name.toUpperCase()} ${"I".repeat(slot.rank)}`,
    );
    view.timer.setText(
      !state.locked && state.fraction > 0 ? `${state.seconds}` : "",
    );
    view.frame.setAlpha(state.locked ? LOCKED_ALPHA : 1);
  }
}
